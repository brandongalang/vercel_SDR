import { generateText, Output } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import { buildDraftGeneratorPrompt } from "@/lib/pipeline/draft-generator-prompt";
import {
  getLiveDraftGeneratorArtifact,
  getVercelProductContext,
} from "@/lib/pipeline/prompts";
import { draftOutputSchema } from "@/lib/pipeline/schemas";
import type { AnglePlan, LeadInput, ScoredSignal } from "@/lib/types";

function resolveHighlightedSpan(body: string, highlightedSpan?: string) {
  if (!highlightedSpan) {
    return undefined;
  }

  const candidate = highlightedSpan.trim();
  return candidate.length > 0 && body.includes(candidate) ? candidate : undefined;
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
    prompt: buildDraftGeneratorPrompt({
      anglePlan: input.anglePlan,
      artifact: promptArtifact,
      leadInput: input.leadInput,
      productContext,
      usedSignals,
    }),
  });

  return {
    ...result.output,
    highlightedSpan: resolveHighlightedSpan(result.output.body, result.output.highlightedSpan),
  };
}
