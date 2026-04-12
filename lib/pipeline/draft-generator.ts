import { generateText, Output } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import { getLiveDraftGeneratorArtifact, getVercelProductContext, PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import { draftOutputSchema } from "@/lib/pipeline/schemas";
import type { AnglePlan, LeadInput, ScoredSignal } from "@/lib/types";

function resolveHighlightedSpan(body: string, highlightedSpan?: string) {
  if (!highlightedSpan) {
    return undefined;
  }

  const candidate = highlightedSpan.trim();
  return candidate.length > 0 && body.includes(candidate) ? candidate : undefined;
}

function formatFewShotExamples() {
  const artifact = getLiveDraftGeneratorArtifact();

  return artifact.demos
    .map(
      (demo, index) => `Example ${index + 1}
Lead context:
${demo.leadContext}

Top signal:
- ${demo.topSignal.label}: ${demo.topSignal.value}

Draft:
Subject: ${demo.draft.subject}
Body:
${demo.draft.body}`,
    )
    .join("\n\n---\n\n");
}

export async function runDraftGenerator(input: {
  leadInput: LeadInput;
  anglePlan: AnglePlan;
  signals: ScoredSignal[];
}) {
  const productContext = await getVercelProductContext();
  const usedSignals = input.signals.filter((signal) => signal.usedInAngle);
  const promptArtifact = getLiveDraftGeneratorArtifact();

  const result = await generateText({
    model: vertexModels.draftGenerator,
    output: Output.object({
      schema: draftOutputSchema,
    }),
    prompt: `
Prompt version: ${PROMPT_VERSIONS.draftGenerator}

Deployed prompt artifact instruction:
${promptArtifact.instruction}

Successful few-shot examples (style references only; do not reuse their names, facts, or phrasing):
${formatFewShotExamples()}

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
- Match the few-shot pattern: one grounded trigger, one practical implication, one concrete Vercel-relevant outcome, one low-friction CTA.
- If the signal is anonymized internal intent, lead with the operational question it implies instead of exposing tracking details.
- Keep the email concise, plainspoken, and commercially useful.
- Do not use generic pleasantries, hype, or multiple asks.
- Return highlightedSpan as an exact substring from the body when possible.
- End with a single CTA.
`,
  });

  return {
    ...result.output,
    highlightedSpan: resolveHighlightedSpan(result.output.body, result.output.highlightedSpan),
  };
}
