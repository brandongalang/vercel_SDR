import {
  VERTEX_LOCATION,
  VERTEX_MODEL_IDS,
  VERTEX_PROJECT,
} from "@/lib/ai/vertex";
import { runAnglePlanner } from "@/lib/pipeline/angle-planner";
import { runDraftGenerator } from "@/lib/pipeline/draft-generator";
import {
  buildGeneratedJob,
  markAngleSignals,
} from "@/lib/pipeline/job-builder";
import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import { runResearchAgent } from "@/lib/pipeline/research-agent";
import { runSignalExtractor } from "@/lib/pipeline/signal-extractor";
import type {
  DiscardedSignal,
  LeadInput,
  OutboundJob,
  PipelinePhase,
  PipelinePhaseStatus,
  PipelineStatus,
  ScoredSignal,
} from "@/lib/types";

export type PipelinePhaseRecord<P extends PipelinePhase = PipelinePhase> = {
  id: P;
  label: string;
  status: PipelinePhaseStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
};

export interface PipelineTraces {
  research?: {
    orchestratorSteps: unknown[];
    threadTraces: unknown[];
  };
}

export interface PipelineRunAudit {
  leadInput: LeadInput;
  startedAt: string;
  completedAt?: string;
  currentPhase: PipelinePhase;
  status: PipelineStatus;
  phases: PipelinePhaseRecord[];
  traces: PipelineTraces;
  promptVersions: typeof PROMPT_VERSIONS;
  modelMetadata: {
    project: string;
    location: string;
    models: typeof VERTEX_MODEL_IDS;
  };
  error?: {
    message: string;
    phase?: PipelinePhase;
  };
  jobId?: string;
}

export interface PipelinePhasePayloads {
  ingest: {
    leadInput: LeadInput;
  };
  research: {
    threadSummaries: string[];
    orchestratorSummary: string;
    uncertainty?: string;
  };
  signals: {
    signals: ScoredSignal[];
    discardedSignals: DiscardedSignal[];
  };
  angle: {
    angleType: OutboundJob["angleType"];
    angle: string;
    whyNow: string;
    confidence: OutboundJob["confidence"];
  };
  draft: OutboundJob["draft"];
  persist: {
    jobId?: string;
    pipelineRunId?: string;
  };
  done: {
    jobId?: string;
    pipelineRunId?: string;
  };
}

export type PipelinePhaseEvent = {
  [P in PipelinePhase]:
    | {
        type: "started";
        phase: PipelinePhaseRecord<P>;
        audit: PipelineRunAudit;
      }
    | {
        type: "completed";
        phase: PipelinePhaseRecord<P>;
        audit: PipelineRunAudit;
        data: PipelinePhasePayloads[P];
      }
    | {
        type: "failed";
        phase: PipelinePhaseRecord<P>;
        audit: PipelineRunAudit;
        error: {
          message: string;
        };
      };
}[PipelinePhase];

const PIPELINE_PHASE_DEFINITIONS = [
  { id: "ingest", label: "Ingest" },
  { id: "research", label: "Research" },
  { id: "signals", label: "Signals" },
  { id: "angle", label: "Angle" },
  { id: "draft", label: "Draft" },
  { id: "persist", label: "Persist" },
  { id: "done", label: "Done" },
] as const satisfies ReadonlyArray<{
  id: PipelinePhase;
  label: string;
}>;

export async function runResearchWithRetry(
  leadInput: LeadInput,
  abortSignal?: AbortSignal,
) {
  try {
    return await runResearchAgent({ leadInput, abortSignal });
  } catch (error) {
    // Don't retry aborted requests or programming errors
    if (abortSignal?.aborted) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return runResearchAgent({ leadInput, abortSignal });
  }
}

export async function runPipelinePhase<T>(
  audit: PipelineRunAudit,
  phaseId: PipelinePhase,
  fn: () => Promise<T>,
): Promise<T> {
  startPipelineAuditPhase(audit, phaseId);
  try {
    const result = await fn();
    completePipelineAuditPhase(audit, phaseId);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : `${phaseId} phase failed`;
    failPipelineAuditPhase(audit, phaseId, message);
    throw error;
  }
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function clonePhaseRecord<P extends PipelinePhase>(phase: PipelinePhaseRecord<P>) {
  return { ...phase };
}

export function clonePipelineRunAudit(audit: PipelineRunAudit) {
  return structuredClone(audit);
}

export function syncPipelineRunAudit(
  target: PipelineRunAudit,
  source: PipelineRunAudit,
): void {
  Object.assign(target, clonePipelineRunAudit(source));
}

export function getPipelinePhase<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phaseId: P,
) {
  const phase = audit.phases.find((candidate) => candidate.id === phaseId);

  if (!phase) {
    throw new Error(`Unknown pipeline phase: ${phaseId}`);
  }

  return phase as PipelinePhaseRecord<P>;
}

export function createPipelineRunAudit(leadInput: LeadInput): PipelineRunAudit {
  return {
    leadInput,
    startedAt: getTimestamp(),
    currentPhase: "ingest",
    status: "running",
    phases: PIPELINE_PHASE_DEFINITIONS.map((phase) => ({
      ...phase,
      status: "pending",
    })),
    traces: {},
    promptVersions: PROMPT_VERSIONS,
    modelMetadata: {
      project: VERTEX_PROJECT,
      location: VERTEX_LOCATION,
      models: VERTEX_MODEL_IDS,
    },
  };
}

export function startPipelineAuditPhase<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phaseId: P,
) {
  const phase = getPipelinePhase(audit, phaseId);
  const startedAt = phase.startedAt ?? getTimestamp();

  phase.status = "running";
  phase.startedAt = startedAt;
  phase.completedAt = undefined;
  phase.durationMs = undefined;

  audit.currentPhase = phaseId;
  audit.status = "running";

  return clonePhaseRecord(phase);
}

export function completePipelineAuditPhase<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phaseId: P,
) {
  const phase = getPipelinePhase(audit, phaseId);
  const completedAt = getTimestamp();
  const startedAt = phase.startedAt ?? completedAt;

  phase.status = "completed";
  phase.startedAt = startedAt;
  phase.completedAt = completedAt;
  phase.durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  audit.currentPhase = phaseId;

  return clonePhaseRecord(phase);
}

export function failPipelineAuditPhase<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phaseId: P,
  message: string,
) {
  const phase = getPipelinePhase(audit, phaseId);
  const completedAt = getTimestamp();
  const startedAt = phase.startedAt ?? completedAt;

  phase.status = "failed";
  phase.startedAt = startedAt;
  phase.completedAt = completedAt;
  phase.durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  audit.currentPhase = phaseId;
  audit.status = "failed";
  audit.completedAt = completedAt;
  audit.error = {
    message,
    phase: phaseId,
  };

  return clonePhaseRecord(phase);
}

export class PipelineExecutionError extends Error {
  constructor(
    message: string,
    readonly audit: PipelineRunAudit,
    readonly traces: PipelineTraces,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PipelineExecutionError";
  }
}

async function emitPhaseStarted<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phase: PipelinePhaseRecord<P>,
  onPhaseUpdate?: (event: PipelinePhaseEvent) => Promise<void> | void,
) {
  await onPhaseUpdate?.(
    {
      type: "started",
      phase,
      audit: clonePipelineRunAudit(audit),
    } as PipelinePhaseEvent,
  );
}

async function emitPhaseCompleted<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phase: PipelinePhaseRecord<P>,
  data: PipelinePhasePayloads[P],
  onPhaseUpdate?: (event: PipelinePhaseEvent) => Promise<void> | void,
) {
  await onPhaseUpdate?.(
    {
      type: "completed",
      phase,
      audit: clonePipelineRunAudit(audit),
      data,
    } as PipelinePhaseEvent,
  );
}

async function emitPhaseFailed<P extends PipelinePhase>(
  audit: PipelineRunAudit,
  phase: PipelinePhaseRecord<P>,
  message: string,
  onPhaseUpdate?: (event: PipelinePhaseEvent) => Promise<void> | void,
) {
  await onPhaseUpdate?.(
    {
      type: "failed",
      phase,
      audit: clonePipelineRunAudit(audit),
      error: {
        message,
      },
    } as PipelinePhaseEvent,
  );
}

export async function runOutboundJobPipeline(input: {
  leadInput: LeadInput;
  abortSignal?: AbortSignal;
  onPhaseUpdate?: (event: PipelinePhaseEvent) => Promise<void> | void;
}) {
  const audit = createPipelineRunAudit(input.leadInput);
  const traces: PipelineTraces = {};
  audit.traces = traces;

  try {
    const ingestStarted = startPipelineAuditPhase(audit, "ingest");
    await emitPhaseStarted(audit, ingestStarted, input.onPhaseUpdate);

    const ingestCompleted = completePipelineAuditPhase(audit, "ingest");
    await emitPhaseCompleted(
      audit,
      ingestCompleted,
      {
        leadInput: input.leadInput,
      },
      input.onPhaseUpdate,
    );

    const researchStarted = startPipelineAuditPhase(audit, "research");
    await emitPhaseStarted(audit, researchStarted, input.onPhaseUpdate);

    const research = await runResearchWithRetry(input.leadInput, input.abortSignal);
    traces.research = {
      orchestratorSteps: research.steps,
      threadTraces: research.threadTraces,
    };

    const researchCompleted = completePipelineAuditPhase(audit, "research");
    await emitPhaseCompleted(
      audit,
      researchCompleted,
      {
        threadSummaries: research.packet.threadSummaries,
        orchestratorSummary: research.packet.orchestratorSummary,
        uncertainty: research.packet.uncertainty,
      },
      input.onPhaseUpdate,
    );

    const signalsStarted = startPipelineAuditPhase(audit, "signals");
    await emitPhaseStarted(audit, signalsStarted, input.onPhaseUpdate);

    const extraction = await runSignalExtractor(research.packet);
    const signalsCompleted = completePipelineAuditPhase(audit, "signals");
    await emitPhaseCompleted(
      audit,
      signalsCompleted,
      {
        signals: extraction.signals,
        discardedSignals: extraction.discardedSignals,
      },
      input.onPhaseUpdate,
    );

    const angleStarted = startPipelineAuditPhase(audit, "angle");
    await emitPhaseStarted(audit, angleStarted, input.onPhaseUpdate);

    const anglePlan = await runAnglePlanner({
      leadInput: input.leadInput,
      signals: extraction.signals,
    });

    const angleCompleted = completePipelineAuditPhase(audit, "angle");
    await emitPhaseCompleted(
      audit,
      angleCompleted,
      {
        angleType: anglePlan.angleType,
        angle: anglePlan.angle,
        whyNow: anglePlan.whyNow,
        confidence: {
          tier: anglePlan.confidence.tier,
          summary: anglePlan.confidence.summary,
          reasons: anglePlan.confidence.reasons,
        },
      },
      input.onPhaseUpdate,
    );

    const signals = markAngleSignals(extraction.signals, anglePlan.usedSignalIds);

    const draftStarted = startPipelineAuditPhase(audit, "draft");
    await emitPhaseStarted(audit, draftStarted, input.onPhaseUpdate);

    const draft = await runDraftGenerator({
      leadInput: input.leadInput,
      anglePlan,
      signals,
    });

    const draftCompleted = completePipelineAuditPhase(audit, "draft");
    await emitPhaseCompleted(audit, draftCompleted, draft, input.onPhaseUpdate);

    const job: Omit<OutboundJob, "id"> = buildGeneratedJob({
      leadInput: input.leadInput,
      researchPacket: research.packet,
      anglePlan,
      signals,
      discardedSignals: extraction.discardedSignals,
      draft,
      createdAt: getTimestamp(),
    });

    return {
      job,
      traces,
      audit,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline failure";
    const activePhase = audit.currentPhase;
    const failedPhase = failPipelineAuditPhase(audit, activePhase, message);

    await emitPhaseFailed(audit, failedPhase, message, input.onPhaseUpdate);

    throw new PipelineExecutionError(message, clonePipelineRunAudit(audit), structuredClone(traces), {
      cause: error instanceof Error ? error : undefined,
    });
  }
}
