import { runAnglePlanner } from "@/lib/pipeline/angle-planner";
import { runDraftGenerator } from "@/lib/pipeline/draft-generator";
import {
  buildGeneratedJob,
  markAngleSignals,
} from "@/lib/pipeline/job-builder";
import { runResearchAgent } from "@/lib/pipeline/research-agent";
import { runSignalExtractor } from "@/lib/pipeline/signal-extractor";
import type { PipelineTraceEmitter } from "@/lib/pipeline/live-trace";
import type { PipelineTraces } from "@/lib/pipeline/pipeline-traces";
import type {
  AnglePlan,
  DiscardedSignal,
  LeadInput,
  OutboundJob,
  ScoredSignal,
} from "@/lib/types";

export type ResearchStageResult = Awaited<ReturnType<typeof runResearchAgent>>;

export interface PipelineExecutionState {
  research: ResearchStageResult | null;
  signals: ScoredSignal[] | null;
  discardedSignals: DiscardedSignal[] | null;
  anglePlan: AnglePlan | null;
  draft: OutboundJob["draft"] | null;
}

const TRANSIENT_RESEARCH_ERROR_PATTERNS = [
  /\b429\b/i,
  /\b5\d\d\b/i,
  /connection/i,
  /deadline/i,
  /econnreset/i,
  /rate limit/i,
  /socket/i,
  /temporar/i,
  /timeout/i,
  /unavailable/i,
] as const;

function isAbortError(error: unknown, abortSignal?: AbortSignal): boolean {
  if (abortSignal?.aborted) {
    return true;
  }

  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return error instanceof Error && error.name === "AbortError";
}

function isRetryableResearchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return TRANSIENT_RESEARCH_ERROR_PATTERNS.some((pattern) =>
    pattern.test(error.message),
  );
}

function requireResearch(
  state: PipelineExecutionState,
): ResearchStageResult {
  if (!state.research) {
    throw new Error("Research must complete before downstream pipeline stages.");
  }

  return state.research;
}

function requireSignals(state: PipelineExecutionState): ScoredSignal[] {
  if (!state.signals) {
    throw new Error("Signals must be available before this pipeline stage can run.");
  }

  return state.signals;
}

function requireAnglePlan(state: PipelineExecutionState): AnglePlan {
  if (!state.anglePlan) {
    throw new Error("Angle planning must complete before this pipeline stage can run.");
  }

  return state.anglePlan;
}

function requireDraft(
  state: PipelineExecutionState,
): OutboundJob["draft"] {
  if (!state.draft) {
    throw new Error("Draft generation must complete before persisting the job.");
  }

  return state.draft;
}

export function createPipelineExecutionState(): PipelineExecutionState {
  return {
    research: null,
    signals: null,
    discardedSignals: null,
    anglePlan: null,
    draft: null,
  };
}

export async function runResearchWithRetry(
  leadInput: LeadInput,
  abortSignal?: AbortSignal,
): Promise<ResearchStageResult> {
  try {
    return await runResearchAgent({ leadInput, abortSignal });
  } catch (error) {
    if (isAbortError(error, abortSignal) || !isRetryableResearchError(error)) {
      throw error;
    }

    return runResearchAgent({ leadInput, abortSignal });
  }
}

export async function runResearchStage(input: {
  leadInput: LeadInput;
  state: PipelineExecutionState;
  traces: PipelineTraces;
  abortSignal?: AbortSignal;
  trace?: PipelineTraceEmitter;
}): Promise<ResearchStageResult> {
  const result = input.trace
    ? await runResearchAgent({
        leadInput: input.leadInput,
        abortSignal: input.abortSignal,
        trace: input.trace,
      })
    : await runResearchWithRetry(input.leadInput, input.abortSignal);

  input.state.research = result;
  input.traces.research = {
    orchestratorSteps: result.steps,
    threadTraces: result.threadTraces,
  };

  return result;
}

export async function runSignalExtractionStage(
  state: PipelineExecutionState,
): Promise<{
  signals: ScoredSignal[];
  discardedSignals: DiscardedSignal[];
}> {
  const research = requireResearch(state);
  const extraction = await runSignalExtractor(research.packet);

  state.signals = extraction.signals;
  state.discardedSignals = extraction.discardedSignals;

  return extraction;
}

export async function runAnglePlanningStage(input: {
  leadInput: LeadInput;
  state: PipelineExecutionState;
}): Promise<AnglePlan> {
  const signals = requireSignals(input.state);
  const anglePlan = await runAnglePlanner({
    leadInput: input.leadInput,
    signals,
  });

  input.state.anglePlan = anglePlan;

  return anglePlan;
}

export async function runDraftStage(input: {
  leadInput: LeadInput;
  state: PipelineExecutionState;
}): Promise<OutboundJob["draft"]> {
  const signals = requireSignals(input.state);
  const anglePlan = requireAnglePlan(input.state);
  const draftSignals = markAngleSignals(signals, anglePlan.usedSignalIds);
  const draft = await runDraftGenerator({
    leadInput: input.leadInput,
    anglePlan,
    signals: draftSignals,
  });

  input.state.signals = draftSignals;
  input.state.draft = draft;

  return draft;
}

export function buildPipelineJob(input: {
  leadInput: LeadInput;
  state: PipelineExecutionState;
  createdAt?: string;
}): Omit<OutboundJob, "id"> {
  const research = requireResearch(input.state);
  const anglePlan = requireAnglePlan(input.state);
  const signals = requireSignals(input.state);
  const draft = requireDraft(input.state);

  return buildGeneratedJob({
    leadInput: input.leadInput,
    researchPacket: research.packet,
    anglePlan,
    signals,
    discardedSignals: input.state.discardedSignals ?? [],
    draft,
    createdAt: input.createdAt,
  });
}
