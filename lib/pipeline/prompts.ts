import { readFile } from "node:fs/promises";
import path from "node:path";
import { LIVE_DRAFT_GENERATOR_ARTIFACT } from "@/lib/pipeline/prompt-artifacts";

let cachedVercelProductContext: string | null = null;

export async function getVercelProductContext() {
  if (cachedVercelProductContext) {
    return cachedVercelProductContext;
  }

  const filePath = path.join(
    process.cwd(),
    "lib",
    "pipeline",
    "prompts",
    "vercel-product-context.md",
  );

  cachedVercelProductContext = await readFile(filePath, "utf8");
  return cachedVercelProductContext;
}

export const PROMPT_VERSIONS = {
  researchOrchestrator: "2026-04-14.research-orchestrator.v2",
  researchThread: "2026-04-14.research-thread.v2",
  signalExtractor: "2026-04-14.signal-extractor.v2",
  anglePlanner: "2026-04-14.angle-planner.v3",
  draftGenerator: LIVE_DRAFT_GENERATOR_ARTIFACT.promptVersionAfter,
} as const;

export function getLiveDraftGeneratorArtifact() {
  return LIVE_DRAFT_GENERATOR_ARTIFACT;
}
