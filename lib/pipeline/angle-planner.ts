import { generateText, Output } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import { getVercelProductContext, PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
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
    prompt: `
Prompt version: ${PROMPT_VERSIONS.anglePlanner}

You choose one outbound angle for Vercel.

Product context:
${productContext}

Lead input:
${JSON.stringify(input.leadInput, null, 2)}

Signals:
${JSON.stringify(input.signals, null, 2)}

Requirements:
- Choose exactly one angle.
- Use the strongest credible evidence available.
- Explain timing in whyNow.
- Even low-confidence leads should still get a usable plan.
- Do not select signal IDs that are not present.
- Prefer specificity over breadth.
`,
  });

  return result.output;
}
