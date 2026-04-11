import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { demoLeadInputSchema } from "@/lib/pipeline/schemas";
import { persistPipelineRun } from "@/lib/pipeline/persistence";
import {
  PipelineExecutionError,
  getPipelinePhase,
  runOutboundJobPipeline,
  startPipelineAuditPhase,
  type PipelinePhaseEvent,
  type PipelinePhaseRecord,
  type PipelineRunAudit,
} from "@/lib/pipeline/run-job";
import type { OutboundJob, PipelinePhase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type StreamData = {
  phase: {
    phase: PipelinePhaseRecord;
    detail?: string;
  };
  research: {
    threadSummaries: string[];
    orchestratorSummary: string;
    uncertainty?: string;
  };
  job: {
    jobId: string;
    pipelineRunId: string;
    job: OutboundJob;
  };
  error: {
    message: string;
    phase?: string;
    pipelineRunId?: string;
  };
};

type StreamMessage = UIMessage<unknown, StreamData>;

function extractLeadInput(body: unknown) {
  if (typeof body === "object" && body !== null && "leadInput" in body) {
    return body.leadInput;
  }

  return body;
}

function getPhaseDetail(event: PipelinePhaseEvent) {
  if (event.type === "failed") {
    return event.error.message;
  }

  if (event.type !== "completed") {
    return undefined;
  }

  if (isCompletedPhaseEvent(event, "ingest")) {
    return `${event.data.leadInput.leadName} @ ${event.data.leadInput.company}`;
  }

  if (isCompletedPhaseEvent(event, "research")) {
    return `${event.data.threadSummaries.length} research threads completed`;
  }

  if (isCompletedPhaseEvent(event, "signals")) {
    return `${event.data.signals.length} signals ranked`;
  }

  if (isCompletedPhaseEvent(event, "angle")) {
    return event.data.angle;
  }

  if (isCompletedPhaseEvent(event, "draft")) {
    return event.data.subject;
  }

  if (isCompletedPhaseEvent(event, "persist")) {
    return event.data.jobId ? `Saved job ${event.data.jobId}` : undefined;
  }

  if (isCompletedPhaseEvent(event, "done")) {
    return event.data.jobId ? `Completed run for job ${event.data.jobId}` : undefined;
  }

  return undefined;
}

function isCompletedPhaseEvent<P extends PipelinePhase>(
  event: PipelinePhaseEvent,
  phaseId: P,
): event is Extract<PipelinePhaseEvent, { type: "completed"; phase: { id: P } }> {
  return event.type === "completed" && event.phase.id === phaseId;
}

function writePhasePart(
  writer: {
    write: (part: {
      type: "data-phase";
      id: string;
      data: StreamData["phase"];
    }) => void;
  },
  phase: PipelinePhaseRecord,
  detail?: string,
) {
  writer.write({
    type: "data-phase",
    id: `phase-${phase.id}`,
    data: {
      phase,
      detail,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = demoLeadInputSchema.safeParse(extractLeadInput(body));

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid lead input",
        issues: z.treeifyError(parsed.error),
      },
      { status: 400 },
    );
  }

  const stream = createUIMessageStream<StreamMessage>({
    execute: async ({ writer }) => {
      let audit: PipelineRunAudit | null = null;

      try {
        const result = await runOutboundJobPipeline({
          leadInput: parsed.data,
          abortSignal: request.signal,
          onPhaseUpdate: async (event) => {
            writePhasePart(writer, event.phase, getPhaseDetail(event));

            if (isCompletedPhaseEvent(event, "research")) {
              writer.write({
                type: "data-research",
                id: "research-summary",
                data: {
                  threadSummaries: event.data.threadSummaries,
                  orchestratorSummary: event.data.orchestratorSummary,
                  uncertainty: event.data.uncertainty,
                },
              });
            }
          },
        });

        audit = result.audit;
        writePhasePart(
          writer,
          startPipelineAuditPhase(audit, "persist"),
          "Writing job and audit records",
        );

        const persisted = await persistPipelineRun({
          job: result.job,
          audit,
        });

        audit = persisted.audit;

        writePhasePart(
          writer,
          getPipelinePhase(audit, "persist"),
          `Saved job ${persisted.job.id} and pipeline run ${persisted.pipelineRunId}`,
        );
        writePhasePart(
          writer,
          getPipelinePhase(audit, "done"),
          `Pipeline completed for ${persisted.job.company}`,
        );

        writer.write({
          type: "data-job",
          id: `job-${persisted.job.id}`,
          data: {
            jobId: persisted.job.id,
            pipelineRunId: persisted.pipelineRunId,
            job: persisted.job,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown pipeline failure";
        const pipelineError = error instanceof PipelineExecutionError ? error : null;
        const failedAudit = pipelineError?.audit ?? audit;
        let pipelineRunId: string | undefined;
        let finalMessage = message;

        if (failedAudit && failedAudit.currentPhase !== "persist") {
          try {
            const persisted = await persistPipelineRun({
              audit: failedAudit,
            });
            pipelineRunId = persisted.pipelineRunId;
          } catch (persistError) {
            const persistMessage =
              persistError instanceof Error
                ? persistError.message
                : "Unknown audit persistence failure";
            finalMessage = `${message}. Failed to persist audit: ${persistMessage}`;
          }
        }

        if (failedAudit) {
          writePhasePart(
            writer,
            getPipelinePhase(failedAudit, failedAudit.currentPhase),
            finalMessage,
          );
        }

        writer.write({
          type: "data-error",
          id: "run-error",
          data: {
            message: finalMessage,
            phase: failedAudit?.currentPhase,
            pipelineRunId,
          },
        });
      }
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Unknown streaming pipeline failure",
  });

  return createUIMessageStreamResponse({ stream });
}
