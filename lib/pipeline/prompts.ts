import { readFile } from "node:fs/promises";
import path from "node:path";

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
  researchOrchestrator: "2026-04-11.research-orchestrator.v1",
  researchThread: "2026-04-11.research-thread.v1",
  signalExtractor: "2026-04-11.signal-extractor.v1",
  anglePlanner: "2026-04-11.angle-planner.v1",
  draftGenerator: "2026-04-11.draft-generator.v1",
} as const;
