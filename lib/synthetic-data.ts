import v2PromptArtifactData from "@/lib/db/seeds/ax-optimized-v2.json";
import promptSnapshotsData from "@/lib/db/seeds/prompt-snapshots.json";

/**
 * Demo-only DSPy snapshots used by the interview surface.
 * This is intentionally fixture-backed and separate from runtime job data.
 */
interface SyntheticPromptSnapshot {
  version: string;
  label: string;
  releaseDate: string;
  instruction: string;
  fewShotDemos: number;
  summary: string;
  badgeText?: string;
}

interface PromptArtifactOverlay {
  instruction: string;
  summary: string;
  demos: Array<{ id: string }>;
  promptVersionAfter: string;
}

const V2_PROMPT_ARTIFACT = v2PromptArtifactData as PromptArtifactOverlay;
const SYNTHETIC_DSPY_PROMPT_SNAPSHOTS = (
  promptSnapshotsData as readonly SyntheticPromptSnapshot[]
).map((snapshot) =>
  snapshot.version === V2_PROMPT_ARTIFACT.promptVersionAfter
    ? {
        ...snapshot,
        instruction: V2_PROMPT_ARTIFACT.instruction,
        summary: V2_PROMPT_ARTIFACT.summary,
        fewShotDemos: V2_PROMPT_ARTIFACT.demos.length,
      }
    : snapshot,
) as readonly SyntheticPromptSnapshot[];

export function getSyntheticPromptSnapshots(): SyntheticPromptSnapshot[] {
  return [...SYNTHETIC_DSPY_PROMPT_SNAPSHOTS];
}
