import type { LeadInput, ScoredSignal, DiscardedSignal, AnglePlan, OutboundJob } from "@/lib/types";
import type { ResearchStageResult } from "@/lib/pipeline/execution-core";

export type ResearchStepOutput = {
  packet: ResearchStageResult["packet"];
  steps: ResearchStageResult["steps"];
  threadTraces: ResearchStageResult["threadTraces"];
};

export type SignalStepOutput = {
  signals: ScoredSignal[];
  discardedSignals: DiscardedSignal[];
};

export type AngleStepOutput = AnglePlan;

export type DraftStepOutput = OutboundJob["draft"];

export type PersistStepOutput = {
  jobId: string;
  pipelineRunId: string;
};

export async function researchStep(leadInput: LeadInput): Promise<ResearchStepOutput> {
  "use step";
  const { runResearchWithRetry } = await import("@/lib/pipeline/execution-core");
  const result = await runResearchWithRetry(leadInput);
  return {
    packet: result.packet,
    steps: result.steps,
    threadTraces: result.threadTraces,
  };
}

export async function signalExtractionStep(
  researchPacket: ResearchStepOutput["packet"]
): Promise<SignalStepOutput> {
  "use step";
  const { runSignalExtractor } = await import("@/lib/pipeline/signal-extractor");
  return runSignalExtractor(researchPacket);
}

export async function anglePlanningStep(input: {
  leadInput: LeadInput;
  signals: ScoredSignal[];
}): Promise<AngleStepOutput> {
  "use step";
  const { runAnglePlanner } = await import("@/lib/pipeline/angle-planner");
  return runAnglePlanner({
    leadInput: input.leadInput,
    signals: input.signals,
  });
}

export async function draftStep(input: {
  leadInput: LeadInput;
  signals: ScoredSignal[];
  anglePlan: AnglePlan;
}): Promise<DraftStepOutput> {
  "use step";
  const { markAngleSignals } = await import("@/lib/pipeline/job-builder");
  const { runDraftGenerator } = await import("@/lib/pipeline/draft-generator");
  
  const draftSignals = markAngleSignals(input.signals, input.anglePlan.usedSignalIds);
  return runDraftGenerator({
    leadInput: input.leadInput,
    anglePlan: input.anglePlan,
    signals: draftSignals,
  });
}

export async function persistStep(input: {
  leadInput: LeadInput;
  researchPacket: ResearchStepOutput["packet"];
  anglePlan: AnglePlan;
  signals: ScoredSignal[];
  discardedSignals: DiscardedSignal[];
  draft: OutboundJob["draft"];
}): Promise<PersistStepOutput> {
  "use step";
  const { buildGeneratedJob } = await import("@/lib/pipeline/job-builder");
  const runJobModule = await import("@/lib/pipeline/run-job");
  
  // We need to construct the pipeline run audit record
  const audit = runJobModule.createPipelineRunAudit(input.leadInput);
  
  // Mark all phases as completed for the audit 
  const phases = ["ingest", "research", "signals", "angle", "draft"];
  for (const phase of phases) {
    runJobModule.startPipelineAuditPhase(audit, phase as any);
    runJobModule.completePipelineAuditPhase(audit, phase as any);
  }

  // Then build the job
  const job = buildGeneratedJob({
    leadInput: input.leadInput,
    researchPacket: input.researchPacket,
    anglePlan: input.anglePlan,
    signals: input.signals,
    discardedSignals: input.discardedSignals,
    draft: input.draft,
  });

  const { persistPipelineRun } = await import("@/lib/pipeline/persistence");
  const persisted = await persistPipelineRun({ 
    job, 
    audit 
  });

  return {
    jobId: persisted.job.id,
    pipelineRunId: persisted.pipelineRunId,
  };
}
