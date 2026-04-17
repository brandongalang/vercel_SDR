import { generateText } from "ai";
import type { WebSearchOutput } from "@/lib/pipeline/tools/search-types";

import { createVertex } from "@ai-sdk/google-vertex";
import type { GoogleAuthOptions } from "google-auth-library";

const DEFAULT_SEARCH_MODEL =
  process.env.GOOGLE_SEARCH_MODEL?.trim() || "gemini-2.0-flash-001";

function buildConstrainedQuery(query: string, includeDomains: string[]) {
  const domains = includeDomains
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .slice(0, 3);

  return domains.length > 0
    ? `${query} — focus on results from: ${domains.join(", ")}`
    : query;
}

/**
 * Builds a vertex provider that carries the same auth credentials used
 * for all other LLM calls (GOOGLE_VERTEX_API_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON).
 *
 * Returns `vertex.tools.googleSearch()` for use in generateText.
 */
function createVertexWithTools() {
  const project =
    process.env.GOOGLE_VERTEX_PROJECT?.trim() || "hermes-vision-prod";
  const location =
    process.env.GOOGLE_VERTEX_LOCATION?.trim() || "us-central1";
  const vertexApiKey = process.env.GOOGLE_VERTEX_API_KEY?.trim() || undefined;

  let googleAuthOptions: GoogleAuthOptions | undefined;
  if (!vertexApiKey) {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
    if (raw) {
      try {
        const credentials = JSON.parse(raw) as Record<string, unknown>;
        googleAuthOptions = { credentials };
      } catch {
        // Ignore parse errors — will fall through to ADC
      }
    }
  }

  return createVertex({
    project,
    location,
    ...(vertexApiKey
      ? { apiKey: vertexApiKey }
      : {
          baseURL: `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google`,
          ...(googleAuthOptions ? { googleAuthOptions } : {}),
        }),
  });
}

/**
 * Google Search via Vertex AI's native googleSearch provider tool.
 *
 * Uses the same service account / API key credentials as all LLM calls,
 * so no separate GOOGLE_SEARCH_API_KEY is needed. Uses GCP credits.
 */
export async function googleSearch(input: {
  query: string;
  includeDomains?: string[];
  numResults?: number;
}): Promise<WebSearchOutput> {
  const query = buildConstrainedQuery(input.query, input.includeDomains ?? []);
  const limit = input.numResults ?? 5;
  const vertexWithTools = createVertexWithTools();

  const result = await generateText({
    model: vertexWithTools(DEFAULT_SEARCH_MODEL),
    tools: {
      googleSearch: vertexWithTools.tools.googleSearch({}),
    },
    prompt: `Research the following topic and provide a factual, concise summary based on current web sources:\n\n"${query}"`,
  });

  // result.sources contains grounding citations: { type: 'source', sourceType: 'url', url?, title? }
  const sources = result.sources ?? [];
  const results = sources.slice(0, limit).map((source) => ({
    title: source.title ?? query,
    url: "url" in source ? String(source.url ?? "") : "",
    summary: result.text.slice(0, 500),
    highlights: result.text.length > 0 ? [result.text.slice(0, 220)] : [],
  }));

  // Surface grounded text even if no structured source citations came back
  if (results.length === 0 && result.text.trim().length > 0) {
    results.push({
      title: `Grounded summary: ${query}`,
      url: "",
      summary: result.text.slice(0, 500),
      highlights: [result.text.slice(0, 220)],
    });
  }

  return {
    query: input.query,
    provider: "google_search",
    results,
    warnings:
      results.length === 0
        ? ["Vertex AI grounded search returned no sources."]
        : undefined,
  };
}
