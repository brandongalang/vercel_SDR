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
  researchOrchestrator: "2026-02-17.research-orchestrator.v1",
  researchThread: "2026-02-17.research-thread.v1",
  signalExtractor: "2026-02-17.signal-extractor.v1",
  anglePlanner: "2026-02-17.angle-planner.v2",
  draftGenerator: LIVE_DRAFT_GENERATOR_ARTIFACT.promptVersionAfter,
} as const;

export function getLiveDraftGeneratorArtifact() {
  return LIVE_DRAFT_GENERATOR_ARTIFACT;
}
