import { generateText, Output } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import { getVercelProductContext, PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import { draftOutputSchema } from "@/lib/pipeline/schemas";
import type { AnglePlan, LeadInput, ScoredSignal } from "@/lib/types";

function resolveHighlightedSpan(body: string, highlightedSpan?: string) {
  if (!highlightedSpan) {
    return undefined;
  }

  const candidate = highlightedSpan.trim();
  return candidate.length > 0 && body.includes(candidate) ? candidate : undefined;
}

export async function runDraftGenerator(input: {
  leadInput: LeadInput;
  anglePlan: AnglePlan;
  signals: ScoredSignal[];
}) {
  const productContext = await getVercelProductContext();
  const usedSignals = input.signals.filter((signal) => signal.usedInAngle);

  const result = await generateText({
    model: vertexModels.draftGenerator,
    output: Output.object({
      schema: draftOutputSchema,
    }),
    prompt: `
Prompt version: ${PROMPT_VERSIONS.draftGenerator}

Write a first-touch outbound email for Vercel using only the provided plan and signals.

Product context:
${productContext}

Lead input:
${JSON.stringify(input.leadInput, null, 2)}

Angle plan:
${JSON.stringify(input.anglePlan, null, 2)}

Signals allowed in the draft:
${JSON.stringify(usedSignals, null, 2)}

Requirements:
- Use only the allowed signals.
- Keep the email concise and commercially useful.
- Return highlightedSpan as an exact substring from the body when possible.
- End with a single CTA.
`,
  });

  return {
    ...result.output,
    highlightedSpan: resolveHighlightedSpan(result.output.body, result.output.highlightedSpan),
  };
}
