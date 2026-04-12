import { generateText, Output } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import { buildAnglePlannerPrompt } from "@/lib/pipeline/angle-planner-prompt";
import { getVercelProductContext } from "@/lib/pipeline/prompts";
import { anglePlanSchema } from "@/lib/pipeline/schemas";
import type { LeadInput, ScoredSignal } from "@/lib/types";

export async function runAnglePlanner(input: {
  leadInput: LeadInput;
  signals: ScoredSignal[];
}) {
  const productContext = await getVercelProductContext();

  const result = await generateText({
    model: vertexModels.anglePlanner,
    output: Output.object({
      schema: anglePlanSchema,
    }),
    prompt: buildAnglePlannerPrompt({
      leadInput: input.leadInput,
      productContext,
      signals: input.signals,
    }),
  });

  return result.output;
}
