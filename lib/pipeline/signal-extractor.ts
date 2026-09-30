import { generateText, Output } from "ai";
import { pipelineModels } from "@/lib/ai/models";
import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import { signalExtractionSchema } from "@/lib/pipeline/schemas";
import type { ResearchPacket } from "@/lib/types";

export async function runSignalExtractor(packet: ResearchPacket) {
  const result = await generateText({
    model: pipelineModels.signalExtractor,
    output: Output.object({
      schema: signalExtractionSchema,
    }),
    prompt: `
Prompt version: ${PROMPT_VERSIONS.signalExtractor}

You are the signal extraction stage for an SDR outbound pipeline.

Convert the research packet into atomic scored signals for the UI and downstream planning.

Requirements:
- Only use grounded evidence from the research packet.
- Preserve provenance in evidenceUrl and signalDate when possible.
- Prefer 3 to 5 total signals; use 2 to 4 when one tight cluster is stronger than breadth.
- Each signal must map to one finding or a clearly corroborated pair of findings from the same exact company/entity.
- Include weaker signals when the lead is thin; do not invent stronger evidence.
- Rank signals from strongest to weakest.
- Prefer first-party or lead-authored sources over enrichment/directory pages when both are available.
- Do not infer frontend, deployment, migration, governance, or platform pain unless the underlying finding explicitly supports it.
- Write labels and values like an SDR-ready trigger: concrete first, implication second. Avoid vague abstractions like "operational need" or "AI-ready interfaces."
- If a fact is just background bio/title and does not sharpen timing or angle selection, rank it low or discard it.
- Set usedInAngle to false for every signal at this stage.
- Set scope to "person" when the signal describes something the individual said, wrote, attended, or shared publicly. Set scope to "company" for org-level activity like hiring waves, product launches, product telemetry, or migrations.
- Put anything interesting-but-not-worth-leading-with into discardedSignals.

Research packet:
${JSON.stringify(packet, null, 2)}
`,
  });

  return {
    signals: result.output.signals.map((signal, index) => ({
      ...signal,
      rank: index + 1,
      usedInAngle: false,
    })),
    discardedSignals: result.output.discardedSignals,
  };
}
