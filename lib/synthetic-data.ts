import v2PromptArtifactData from "@/data/ax-optimized-v2.json";
import promptSnapshotsData from "@/data/prompt-snapshots.json";
import syntheticJobsAllData from "@/data/synthetic-jobs-all.json";
import syntheticJobsV1Data from "@/data/synthetic-jobs-v1.json";
import syntheticJobsV2Data from "@/data/synthetic-jobs-v2.json";
import type { OutboundJob } from "./types";

export const SYNTHETIC_DSPY_VERSION_V1 = "2026-01-20.draft-generator.v1" as const;
export const SYNTHETIC_DSPY_VERSION_V2 = "2026-02-17.draft-generator.v2" as const;

export const SYNTHETIC_DSPY_HISTORY_VERSIONS = [
  SYNTHETIC_DSPY_VERSION_V1,
  SYNTHETIC_DSPY_VERSION_V2,
] as const;

export type SyntheticDspyHistoryVersion =
  (typeof SYNTHETIC_DSPY_HISTORY_VERSIONS)[number];

export interface SyntheticPromptSnapshot {
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

export const SYNTHETIC_DSPY_JOBS_V1 =
  syntheticJobsV1Data as readonly OutboundJob[];
export const SYNTHETIC_DSPY_JOBS_V2 =
  syntheticJobsV2Data as readonly OutboundJob[];
export const SYNTHETIC_DSPY_JOBS =
  syntheticJobsAllData as readonly OutboundJob[];

export const SYNTHETIC_DSPY_PROMPT_SNAPSHOTS = (
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

const SYNTHETIC_DSPY_JOBS_BY_VERSION: Record<
  SyntheticDspyHistoryVersion,
  readonly OutboundJob[]
> = {
  [SYNTHETIC_DSPY_VERSION_V1]: SYNTHETIC_DSPY_JOBS_V1,
  [SYNTHETIC_DSPY_VERSION_V2]: SYNTHETIC_DSPY_JOBS_V2,
};

export function getSyntheticDspyJobs(
  version?: SyntheticDspyHistoryVersion,
): OutboundJob[] {
  return [...(version ? SYNTHETIC_DSPY_JOBS_BY_VERSION[version] : SYNTHETIC_DSPY_JOBS)];
}

export function getSyntheticPromptSnapshots(): SyntheticPromptSnapshot[] {
  return [...SYNTHETIC_DSPY_PROMPT_SNAPSHOTS];
}

export function getSyntheticPromptSnapshot(
  version: string,
): SyntheticPromptSnapshot | undefined {
  return SYNTHETIC_DSPY_PROMPT_SNAPSHOTS.find(
    (snapshot) => snapshot.version === version,
  );
}
