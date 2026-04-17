import type { LeadInput } from "@/lib/types";
import {
  researchStep,
  signalExtractionStep,
  anglePlanningStep,
  draftStep,
  persistStep,
} from "./steps";

export async function outboundPipelineWorkflow(leadInput: LeadInput) {
  "use workflow";

  const research = await researchStep(leadInput);
  const extraction = await signalExtractionStep(research.packet);
  const anglePlan = await anglePlanningStep({
    leadInput,
    signals: extraction.signals,
  });
  const draft = await draftStep({
    leadInput,
    signals: extraction.signals,
    anglePlan,
  });
  const persisted = await persistStep({
    leadInput,
    researchPacket: research.packet,
    anglePlan,
    signals: extraction.signals,
    discardedSignals: extraction.discardedSignals,
    draft,
  });

  return {
    jobId: persisted.jobId,
    pipelineRunId: persisted.pipelineRunId,
  };
}
