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
- Write angle as one short sentence that describes the chosen opener strategy, ideally under 18 words.
- Use the strongest credible evidence available.
- Use 1 to 3 reinforcing signals that tell the same story; do not stitch together unrelated strong facts.
- Prefer the signal that will feel most natural in the opener, not the most impressive fact on paper.
- Select the angleType that matches the actual evidence: public posts/articles/newsletters should usually map to social_post, event participation to event_signal, hiring roles to hiring_signal, explicit framework/stack shifts to tech_migration, anonymous research behavior to web_intent, and product usage to trial_activation. Use generic when nothing cleaner fits.
- If the strongest signal is anonymized internal intent, translate it into the operational question it implies instead of writing a surveillance-heavy hook.
- The angle should create a useful commercial conversation, not sound like a diagnosis, an internal strategy memo, or a product pitch.
- Do not invent frontend, deployment, or infrastructure pain if the signals only support general AI, product, or workflow interest.
- Prefer plain workflow language like shipping, preview, release, iteration, review, or launch over heavyweight abstractions.
- If the Vercel connection is indirect, keep the angle modest and practical instead of forcing a heavy technical diagnosis.
- Explain timing in whyNow using one concrete sentence about the observable trigger or recent shift, not an asserted bottleneck you cannot prove.
- Even low-confidence leads should still get a usable but modest plan.
- Do not select signal IDs that are not present.
- Prefer specificity over breadth.
`;
}
