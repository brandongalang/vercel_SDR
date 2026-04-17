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
- Signal Strength: Categorize the overall plan as "high" (Strong Relevance), "medium" (Moderate Relevance), or "low" (Weak Relevance) based on signal density and specificity. Surface this in the confidence schema.
- Even weak-relevance leads should still get a usable but modest plan.
- Do not select signal IDs that are not present.
- Prefer specificity over breadth.
- Generate an outreach object containing SDR-facing context (separate from the agent-to-agent angle and whyNow fields):
  - companyInsight: 1-2 factual sentences about what is happening at the company right now, written for a human sales rep, not an LLM. Include inline source type and date references like "(engineering blog, Mar 27)" so the SDR can assess grounding at a glance. No strategy directives, no imperative verbs — just the situation.
  - companyRefs: structured references for each claim, with label, url, date, and sourceType. Valid sourceType values: linkedin, twitter, conference, blog, podcast, job_posting, product_data, news.
  - personInsight: 1-2 sentences about why THIS person specifically, based on their public professional activity. Include inline source and date. Set to null if no viable personal angle exists. Only use content the person authored, shared, or participated in publicly. Never reference browsing behavior or internal tracking attributed to the individual. Never be invasive or creepy.
  - personRefs: structured references for person-level claims. Empty array when personInsight is null.
  - personAngleStrength: "strong" when the person authored or said something directly related to the angle (blog post, conference talk, tweet, LinkedIn post). "moderate" when they have related professional activity but did not author an opinion (attended a session, reshared a job posting). "none" when no viable personal angle was found.
- When personAngleStrength is "strong", the angle sentence should incorporate the personal hook so the draft generator can prioritize it as the opener.
`;
}
