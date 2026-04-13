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

  // Step 1: Research
  const research = await researchStep(leadInput);

  // Step 2: Signal Extraction
  const extraction = await signalExtractionStep(research.packet);

  // Step 3: Angle Planning
  const anglePlan = await anglePlanningStep({
    leadInput,
    signals: extraction.signals,
  });

  // Step 4: Draft Generation
  const draft = await draftStep({
    leadInput,
    signals: extraction.signals,
    anglePlan,
  });

  // Step 5: Persist
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
