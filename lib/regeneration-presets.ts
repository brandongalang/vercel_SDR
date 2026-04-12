export const REGENERATION_PRESETS = [
  {
    id: "shorter",
    label: "Shorter",
    guidance: "Trim filler and keep the rewrite closer to the low end of the target word count.",
  },
  {
    id: "more_direct",
    label: "More direct",
    guidance: "Get to the point faster and make the ask feel clearer and more immediate.",
  },
  {
    id: "softer_cta",
    label: "Softer CTA",
    guidance: "Make the ending feel lower pressure and less like a hard meeting ask.",
  },
  {
    id: "stronger_why_now",
    label: "Stronger why now",
    guidance: "Make the timing feel more urgent, relevant, and grounded in the trigger signal.",
  },
  {
    id: "more_specific_signal",
    label: "More specific signal",
    guidance: "Anchor more tightly on the chosen trigger instead of drifting into generic context.",
  },
  {
    id: "less_creepy",
    label: "Less creepy",
    guidance: "Avoid surveillance-heavy phrasing and make internal intent feel more natural and human.",
  },
  {
    id: "more_executive",
    label: "More executive",
    guidance: "Frame the message at a higher level around org priorities, tradeoffs, and outcomes.",
  },
  {
    id: "more_technical",
    label: "More technical",
    guidance: "Use sharper engineering and workflow language for a technical buyer.",
  },
  {
    id: "less_hype",
    label: "Less hype",
    guidance: "Remove marketing-style language and keep the tone plainspoken and credible.",
  },
  {
    id: "more_value_forward",
    label: "More value-forward",
    guidance: "Make the concrete Vercel outcome clearer and more central to the message.",
  },
] as const;

export type RegenerationPreset = (typeof REGENERATION_PRESETS)[number]["id"];

export function getRegenerationPreset(preset: RegenerationPreset) {
  return REGENERATION_PRESETS.find((item) => item.id === preset);
}

export function summarizeRegenerationRequest(
  presets: RegenerationPreset[],
  note?: string,
) {
  const selected = presets
    .map((preset) => getRegenerationPreset(preset)?.label)
    .filter((label): label is NonNullable<typeof label> => label != null);

  const presetSummary =
    selected.length > 0 ? `Adjustments: ${selected.join(", ")}.` : undefined;
  const trimmedNote = note?.trim();

  return [presetSummary, trimmedNote ? `Note: ${trimmedNote}` : undefined]
    .filter(Boolean)
    .join(" ");
}
