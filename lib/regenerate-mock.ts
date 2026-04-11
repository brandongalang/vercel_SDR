/** Deterministic “regenerate” for demo UX — nudges tone without an LLM. */
export function mockRegeneratedBody(
  body: string,
  preset: "shorter" | "softer_cta" | "less_hype" | "more_direct"
): string {
  const t = body.trim();
  const paras = t.split(/\n\n+/).filter(Boolean);

  if (preset === "shorter" && paras.length > 1) {
    return paras.slice(0, Math.min(2, paras.length)).join("\n\n");
  }
  if (preset === "softer_cta") {
    return t.replace(/\?(\s*)$/m, "$1Happy to share more if helpful.$1");
  }
  if (preset === "less_hype") {
    return t.replace(/\b(love|amazing|incredible)\b/gi, "noticed");
  }
  if (preset === "more_direct") {
    const core = paras.slice(0, -1).join("\n\n");
    return `${core}\n\nIf a short call would help, I can share two concrete examples.\n\n${paras[paras.length - 1] ?? "Best,"}`;
  }
  return t;
}
