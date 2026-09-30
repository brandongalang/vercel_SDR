import type {
  InferUITools,
  UIMessage,
} from "ai";
import {
  stepCountIs,
  tool,
  ToolLoopAgent,
  zodSchema,
} from "ai";
import { z } from "zod/v4";
import type {
  PipelineTraceDataParts,
  PipelineTraceEmitter,
} from "@/lib/pipeline/live-trace";
import { pipelineModels } from "@/lib/ai/models";
import {
  buildPipelineJob,
  createPipelineExecutionState,
  runAnglePlanningStage,
  runDraftStage,
  runResearchStage,
  runSignalExtractionStage,
  type PipelineExecutionState,
} from "@/lib/pipeline/execution-core";
import { persistPipelineRun } from "@/lib/pipeline/persistence";
import {
  clonePipelineRunAudit,
  completePipelineAuditPhase,
  createPipelineRunAudit,
  failPipelineAuditPhase,
  runPipelinePhase,
  startPipelineAuditPhase,
  syncPipelineRunAudit,
  type PipelineRunAudit,
  type PipelineTraces,
} from "@/lib/pipeline/run-job";
import type { AnglePlan, DiscardedSignal, LeadInput, ScoredSignal } from "@/lib/types";

type PipelineState = PipelineExecutionState & {
  persistResult: { jobId: string; pipelineRunId: string } | null;
};

type NoInput = Record<string, never>;

const noInputSchema = zodSchema(z.object({}));

type ResearchReportPreview = {
  topic: string;
  summary: string;
  gaps: string[];
  findings: Array<{
    text: string;
    sourceUrl: string;
    confidence: NonNullable<PipelineState["research"]>["packet"]["reports"][number]["findings"][number]["confidence"];
    date?: string;
    rawQuote?: string;
  }>;
};

type RunResearchOutput = {
  threadsCompleted: number;
  orchestratorSummary: string;
  uncertainty: string | null;
  threadSummaries: string[];
  reports: ResearchReportPreview[];
};

type ExtractSignalsOutput =
  | {
      error: string;
    }
  | {
      signalCount: number;
      topSignals: Array<{
        id: string;
        label: string;
        value: string;
        category: ScoredSignal["category"];
        strength: ScoredSignal["strength"];
        source: ScoredSignal["source"];
        evidenceUrl?: string;
        signalDate?: string;
      }>;
      discardedCount: number;
      discardedSignals: DiscardedSignal[];
    };

type PlanAngleOutput =
  | {
      error: string;
    }
  | {
      angleType: AnglePlan["angleType"];
      angle: string;
      whyNow: string;
      confidenceTier: AnglePlan["confidence"]["tier"];
      confidenceSummary: string;
      reasons: string[];
    };

type GenerateDraftOutput =
  | {
      error: string;
    }
  | {
      subject: string;
      body: string;
      highlightedSpan?: string;
    };

type PersistJobOutput =
  | {
      error: string;
    }
  | {
      jobId: string;
      pipelineRunId: string;
    };

function buildSystemPrompt(leadInput: LeadInput): string {
  const domain = leadInput.companyDomain ? `\n- Domain: ${leadInput.companyDomain}` : "";
  const playCtx = leadInput.play.context ? `\n- Play context: ${leadInput.play.context}` : "";
  const notes = (leadInput.freeformContext ?? "").trim();

  return `You are executing a Vercel SDR outbound pipeline.

Lead:
- Name: ${leadInput.leadName}
- Title: ${leadInput.leadTitle}
- Company: ${leadInput.company}${domain}
- Play: ${leadInput.play.type} — ${leadInput.play.label}${playCtx}

Rep notes:
"""
${notes || "None provided."}
"""

Execute these 5 steps in EXACT order — do not skip or reorder:
1. run_research    — gather evidence about the lead
2. extract_signals — rank research into scored signals
3. plan_angle      — choose the best outbound angle
4. generate_draft  — write the personalized email
5. persist_job     — save the completed job to the review queue

After persist_job returns, confirm with a short message: "Pipeline complete for ${leadInput.leadName} at ${leadInput.company}."`;
}

export function createPipelineAgent(
  leadInput: LeadInput,
  options?: {
    abortSignal?: AbortSignal;
    trace?: PipelineTraceEmitter;
  },
) {
  const abortSignal = options?.abortSignal;
  const trace = options?.trace;
  const audit = createPipelineRunAudit(leadInput);
  const traces: PipelineTraces = {};
  audit.traces = traces;
  const state: PipelineState = {
    ...createPipelineExecutionState(),
    persistResult: null,
  };
  startPipelineAuditPhase(audit, "ingest");
  completePipelineAuditPhase(audit, "ingest");

  function markPipelineFailed(message: string) {
    if (audit.status === "failed" || audit.status === "completed") {
      return;
    }

    failPipelineAuditPhase(audit, audit.currentPhase, message);
  }

  const agent = new ToolLoopAgent({
    model: pipelineModels.orchestrator,
    instructions: buildSystemPrompt(leadInput),
    stopWhen: stepCountIs(20),
    tools: {
      run_research: tool<NoInput, RunResearchOutput>({
        description: "Run all research threads for the lead and synthesize findings into a packet.",
        inputSchema: noInputSchema,
        execute: async () => {
          return runPipelinePhase(audit, "research", async () => {
            const result = await runResearchStage({
              leadInput,
              state,
              traces,
              abortSignal,
              trace,
            });
            return {
              threadsCompleted: result.packet.reports.length,
              orchestratorSummary: result.packet.orchestratorSummary,
              uncertainty: result.packet.uncertainty ?? null,
              threadSummaries: result.packet.threadSummaries,
              reports: result.packet.reports.map((report) => ({
                topic: report.topic,
                summary: report.summary,
                gaps: report.gaps,
                findings: report.findings.slice(0, 5).map((finding) => ({
                  text: finding.text,
                  sourceUrl: finding.sourceUrl,
                  confidence: finding.confidence,
                  date: finding.date,
                  rawQuote: finding.rawQuote,
                })),
              })),
            };
          });
        },
        toModelOutput: ({ output }) => ({
          type: "content",
          value: [
            {
              type: "text",
              text: `Research done. ${output.threadsCompleted} threads. ${output.orchestratorSummary}`,
            },
          ],
        }),
      }),

      extract_signals: tool<NoInput, ExtractSignalsOutput>({
        description: "Extract and rank signals from the research packet. Call after run_research.",
        inputSchema: noInputSchema,
        execute: async () => {
          if (!state.research) {
            return { error: "run_research must complete before extract_signals." };
          }
          return runPipelinePhase(audit, "signals", async () => {
            const extraction = await runSignalExtractionStage(state);
            return {
              signalCount: extraction.signals.length,
              topSignals: extraction.signals.slice(0, 3).map((s) => ({
                id: s.id,
                label: s.label,
                value: s.value,
                category: s.category,
                strength: s.strength,
                source: s.source,
                evidenceUrl: s.evidenceUrl,
                signalDate: s.signalDate,
              })),
              discardedCount: extraction.discardedSignals.length,
              discardedSignals: extraction.discardedSignals.slice(0, 5),
            };
          });
        },
        toModelOutput: ({ output }) => {
          if ("error" in output) {
            return { type: "content", value: [{ type: "text", text: output.error }] };
          }
          const labels = output.topSignals.map((s) => s.label).join(", ");
          return {
            type: "content",
            value: [
              {
                type: "text",
                text: `${output.signalCount} signals extracted. Top: ${labels}`,
              },
            ],
          };
        },
      }),

      plan_angle: tool<NoInput, PlanAngleOutput>({
        description: "Choose the best outbound angle from extracted signals. Call after extract_signals.",
        inputSchema: noInputSchema,
        execute: async () => {
          if (!state.signals) {
            return { error: "extract_signals must complete before plan_angle." };
          }
          return runPipelinePhase(audit, "angle", async () => {
            const anglePlan = await runAnglePlanningStage({
              leadInput,
              state,
            });
            return {
              angleType: anglePlan.angleType,
              angle: anglePlan.angle,
              whyNow: anglePlan.whyNow,
              confidenceTier: anglePlan.confidence.tier,
              confidenceSummary: anglePlan.confidence.summary,
              reasons: anglePlan.confidence.reasons,
            };
          });
        },
        toModelOutput: ({ output }) => {
          if ("error" in output) {
            return { type: "content", value: [{ type: "text", text: output.error }] };
          }
          return {
            type: "content",
            value: [
              {
                type: "text",
                text: `Angle: "${output.angle}" (${output.confidenceTier}). Why now: ${output.whyNow}`,
              },
            ],
          };
        },
      }),

      generate_draft: tool<NoInput, GenerateDraftOutput>({
        description: "Generate the outbound email draft. Call after plan_angle.",
        inputSchema: noInputSchema,
        execute: async () => {
          if (!state.anglePlan || !state.signals) {
            return { error: "plan_angle must complete before generate_draft." };
          }
          return runPipelinePhase(audit, "draft", async () => {
            const draft = await runDraftStage({
              leadInput,
              state,
            });
            return {
              subject: draft.subject,
              body: draft.body,
              highlightedSpan: draft.highlightedSpan,
            };
          });
        },
        toModelOutput: ({ output }) => {
          if ("error" in output) {
            return { type: "content", value: [{ type: "text", text: output.error }] };
          }
          return {
            type: "content",
            value: [{ type: "text", text: `Draft ready. Subject: "${output.subject}"` }],
          };
        },
      }),

      persist_job: tool<NoInput, PersistJobOutput>({
        description: "Save the completed job to the review queue. Call after generate_draft.",
        inputSchema: noInputSchema,
        execute: async () => {
          // Idempotent: skip if already persisted
          if (state.persistResult) {
            return {
              jobId: state.persistResult.jobId,
              pipelineRunId: state.persistResult.pipelineRunId,
            };
          }
          if (!state.draft || !state.anglePlan || !state.signals || !state.research) {
            return { error: "All prior pipeline steps must complete before persist_job." };
          }
          return runPipelinePhase(
            audit,
            "persist",
            async () => {
              const job = buildPipelineJob({
                leadInput,
                state,
              });

              const persisted = await persistPipelineRun({ job, audit });
              state.persistResult = {
                jobId: persisted.job.id,
                pipelineRunId: persisted.pipelineRunId,
              };
              syncPipelineRunAudit(audit, persisted.audit);

              return {
                jobId: persisted.job.id,
                pipelineRunId: persisted.pipelineRunId,
              };
            },
            {
              completePhaseOnSuccess: false,
            },
          );
        },
        toModelOutput: ({ output }) => {
          if ("error" in output) {
            return {
              type: "content",
              value: [{ type: "text", text: `Persist failed: ${output.error}` }],
            };
          }
          return {
            type: "content",
            value: [{ type: "text", text: `Saved. Job: ${output.jobId}` }],
          };
        },
      }),
    },
  });

  return {
    agent,
    getAuditSnapshot: (): PipelineRunAudit => clonePipelineRunAudit(audit),
    markFailed: (message: string) => {
      markPipelineFailed(message);
      return clonePipelineRunAudit(audit);
    },
  };
}

type PipelineAgentTools = ReturnType<typeof createPipelineAgent>["agent"]["tools"];

export type PipelineAgentUIMessage = UIMessage<
  unknown,
  PipelineTraceDataParts,
  InferUITools<PipelineAgentTools>
>;
