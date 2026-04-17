import draftGeneratorV2ArtifactData from "@/data/ax-optimized-v2.json";

export interface DraftGeneratorPromptDemo {
  id: string;
  leadContext: string;
  topSignal: {
    label: string;
    value: string;
    category: string | null;
    strength: string | null;
    source: string | null;
    rank: number | null;
  };
  draft: {
    subject: string;
    body: string;
  };
  priorDraft?: string;
  labels?: {
    cleanAccept: boolean;
    replied?: boolean;
    positiveReply?: boolean;
  };
  objectiveScore?: number;
  angleType?: string | null;
}

export interface DraftGeneratorPromptArtifact {
  version: string;
  instruction: string;
  summary: string;
  demos: DraftGeneratorPromptDemo[];
  compiledAt: string;
  optimizer: string;
  mode: string;
  promptVersionBefore: string;
  promptVersionAfter: string;
}

export type DraftPromptArtifact = Pick<DraftGeneratorPromptArtifact, "instruction" | "demos">;

const DRAFT_GENERATOR_V2_ARTIFACT =
  draftGeneratorV2ArtifactData as DraftGeneratorPromptArtifact;

export const LIVE_DRAFT_GENERATOR_ARTIFACT = DRAFT_GENERATOR_V2_ARTIFACT;
