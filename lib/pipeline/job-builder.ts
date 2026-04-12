import { determineGovernance } from "@/lib/pipeline/governance";
import type {
  AnglePlan,
  DiscardedSignal,
  LeadInput,
  OutboundJob,
  ResearchPacket,
  ScoredSignal,
} from "@/lib/types";

function getTimestamp(): string {
  return new Date().toISOString();
}

export function buildResearchRun(packet: ResearchPacket): OutboundJob["researchRun"] {
  return {
    orchestratorSummary: packet.orchestratorSummary,
    threadSummaries: packet.threadSummaries,
    uncertainty: packet.uncertainty,
    reports: packet.reports,
  };
}

export function markAngleSignals(
  signals: ScoredSignal[],
  usedSignalIds: string[],
): ScoredSignal[] {
  return signals.map((signal) => ({
    ...signal,
    usedInAngle: usedSignalIds.includes(signal.id),
  }));
}

export function buildGeneratedJob(input: {
  leadInput: LeadInput;
  researchPacket: ResearchPacket;
  anglePlan: AnglePlan;
  signals: ScoredSignal[];
  discardedSignals: DiscardedSignal[];
  draft: OutboundJob["draft"];
  createdAt?: string;
}): Omit<OutboundJob, "id"> {
  const governance = determineGovernance({
    confidenceTier: input.anglePlan.confidence.tier,
    leadSource: input.leadInput.play.leadSource,
  });
  const timestamp = input.createdAt ?? getTimestamp();

  return {
    lead: {
      name: input.leadInput.leadName,
      title: input.leadInput.leadTitle,
    },
    company: input.leadInput.company,
    play: input.leadInput.play,
    whyNow: input.anglePlan.whyNow,
    researchRun: buildResearchRun(input.researchPacket),
    angleType: input.anglePlan.angleType,
    status: governance.status,
    pipelineStage: governance.pipelineStage,
    pipelineStatus: governance.pipelineStatus,
    governance: governance.governance,
    confidence: {
      tier: input.anglePlan.confidence.tier,
      summary: input.anglePlan.confidence.summary,
      reasons: input.anglePlan.confidence.reasons,
    },
    angle: input.anglePlan.angle,
    signals: input.signals,
    discardedSignals: input.discardedSignals,
    draft: input.draft,
    feedback: undefined,
    outcome: undefined,
    timestamps: {
      created: timestamp,
      updated: timestamp,
    },
  };
}
