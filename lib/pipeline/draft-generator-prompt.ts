import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import type { AnglePlan, LeadInput, OutboundJob, ScoredSignal } from "@/lib/types";
import {
  getRegenerationPreset,
  type RegenerationPreset,
} from "@/lib/regeneration-presets";

interface DraftPromptArtifact {
  instruction: string;
  demos: Array<{
    leadContext: string;
    topSignal: {
      label: string;
      value: string;
    };
    draft: OutboundJob["draft"];
  }>;
}

function formatFewShotExamples(
  artifact: DraftPromptArtifact,
): string {
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

export function buildDraftGeneratorPrompt(input: {
  anglePlan: AnglePlan;
  artifact: DraftPromptArtifact;
  leadInput: LeadInput;
  productContext: string;
  regeneration?: {
    adjustments: RegenerationPreset[];
    currentDraft: OutboundJob["draft"];
    note?: string;
  };
  usedSignals: ScoredSignal[];
}): string {
  const regenerationSection = input.regeneration
    ? `
Current draft to improve:
Subject: ${input.regeneration.currentDraft.subject}
Body:
${input.regeneration.currentDraft.body}

Rewrite adjustments:
${input.regeneration.adjustments
  .map((preset) => {
    const config = getRegenerationPreset(preset);
    return `- ${config?.label ?? preset}: ${config?.guidance ?? "Apply this rewrite request."}`;
  })
  .join("\n")}
${input.regeneration.note ? `\nSDR note:\n${input.regeneration.note}` : ""}
`
    : "";

  return `
Prompt version: ${PROMPT_VERSIONS.draftGenerator}

Deployed prompt artifact instruction:
${input.artifact.instruction}

Successful few-shot examples (style references only; do not reuse their names, facts, or phrasing):
${formatFewShotExamples(input.artifact)}

Product context:
${input.productContext}

Lead input:
${JSON.stringify(input.leadInput, null, 2)}

Angle plan:
${JSON.stringify(input.anglePlan, null, 2)}

Signals allowed in the draft:
${JSON.stringify(input.usedSignals, null, 2)}

${regenerationSection}

Requirements:
- Use only the allowed signals.
- Match the few-shot pattern: one grounded trigger, one practical implication, one concrete Vercel-relevant outcome, one low-friction CTA.
- If the signal is anonymized internal intent, lead with the operational question it implies instead of exposing tracking details.
- Keep the email concise, plainspoken, and commercially useful.
- Target 65 to 95 words in the body.
- Subject should be concrete and short, usually 3 to 7 words.
- Do not use generic pleasantries, hype, or multiple asks.
- Body formatting (required): Write the body as plain text with line breaks. Put the greeting on its own line, then a blank line, then exactly 3 short body paragraphs before the signoff. Separate each paragraph with a blank line (double newline). Do not output the body as one continuous paragraph or a single block of text—match the spacing in the few-shot examples.
- Paragraph shape: paragraph 1 should be one concrete trigger sentence; paragraph 2 should be one or two short sentences translating the implication; paragraph 3 should be one short CTA sentence. No paragraph should run long.
- Use at most 2 allowed signals in the draft body. Do not restate the whole dossier.
- Prefer exact nouns and phrasing from the signal set over invented abstractions like "architecture", "infrastructure", or "interfaces" unless the signal itself uses that language.
- When the Vercel connection is indirect, anchor the implication in a simple shipping, preview, release, or iteration workflow instead of heavyweight infrastructure language.
- Prefer low-friction offers like sharing a short example, pattern, benchmark, or checklist before asking for time.
- If a current draft is provided, treat this as a rewrite, not a fresh strategy reset.
- Preserve the chosen angle and the same underlying signal set unless the SDR note explicitly asks for a reframing.
- Return highlightedSpan as an exact substring from the body when possible.
- End with a single CTA.
- When the angle plan includes outreach.personAngleStrength "strong", prefer opening with the person-level hook rather than a company-level observation. Keep it professional and non-invasive.
`;
}
