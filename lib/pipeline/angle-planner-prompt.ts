import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import type { LeadInput, ScoredSignal } from "@/lib/types";

export function buildAnglePlannerPrompt(input: {
  leadInput: LeadInput;
  productContext: string;
  signals: ScoredSignal[];
}): string {
  return `
Prompt version: ${PROMPT_VERSIONS.anglePlanner}

You choose one outbound angle for Vercel.

Product context:
${input.productContext}

Lead input:
${JSON.stringify(input.leadInput, null, 2)}

Signals:
${JSON.stringify(input.signals, null, 2)}

Requirements:
- Choose exactly one angle that can lead a credible first-touch SDR email.
- Use the strongest credible evidence available.
- Prefer the signal that will feel most natural in the opener, not the most impressive fact on paper.
- If the strongest signal is anonymized internal intent, translate it into the operational question it implies instead of writing a surveillance-heavy hook.
- The angle should create a useful commercial conversation, not sound like a diagnosis or a product pitch.
- Explain timing in whyNow.
- Even low-confidence leads should still get a usable but modest plan.
- Do not select signal IDs that are not present.
- Prefer specificity over breadth.
`;
}
