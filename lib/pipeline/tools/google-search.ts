import { GoogleGenAI } from "@google/genai";
import type { WebSearchOutput, WebSearchResult } from "@/lib/pipeline/tools/search-types";

const DEFAULT_GOOGLE_SEARCH_MODEL =
  process.env.GOOGLE_SEARCH_MODEL?.trim() || "gemini-2.5-flash";

function buildConstrainedQuery(query: string, includeDomains: string[]) {
  const domains = includeDomains
    .map((domain) => domain.trim())
    .filter((domain) => domain.length > 0)
    .slice(0, 3);

  if (domains.length === 0) {
    return query;
  }

  return `${query} ${domains.map((domain) => `site:${domain}`).join(" ")}`;
}

function createGoogleSearchClient() {
  const explicitApiKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
  const vertexApiKey = process.env.GOOGLE_VERTEX_API_KEY?.trim();
  const apiKey = explicitApiKey || vertexApiKey;

  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }

  const project = process.env.GOOGLE_VERTEX_PROJECT?.trim();
  const location = process.env.GOOGLE_VERTEX_LOCATION?.trim() || "us-central1";

  if (!project) {
    throw new Error(
      "Missing GOOGLE_SEARCH_API_KEY/GOOGLE_VERTEX_API_KEY or GOOGLE_VERTEX_PROJECT for Gemini Google Search fallback",
    );
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });
}

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1)}…`;
}

function walkGoogleSearchResults(input: unknown, out: WebSearchResult[]) {
  if (Array.isArray(input)) {
    input.forEach((item) => walkGoogleSearchResults(item, out));
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  const record = input as Record<string, unknown>;

  // Interactions API exposes google_search_result blocks with a `result` array.
  if (record.type === "google_search_result" && Array.isArray(record.result)) {
    for (const entry of record.result) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const result = entry as Record<string, unknown>;
      const title = typeof result.title === "string" ? result.title : "Google result";
      const url = typeof result.url === "string" ? result.url : "";
      const renderedContent =
        typeof result.rendered_content === "string" ? result.rendered_content : "";

      out.push({
        title,
        url,
        summary: truncate(renderedContent, 400),
        highlights: renderedContent ? [truncate(renderedContent, 220)] : [],
      });
    }
  }

  Object.values(record).forEach((value) => walkGoogleSearchResults(value, out));
}

function dedupeResults(results: WebSearchResult[], limit: number) {
  const seen = new Set<string>();
  const deduped: WebSearchResult[] = [];

  for (const result of results) {
    const key = `${result.url}|${result.title}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(result);

    if (deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

export async function googleSearch(input: {
  query: string;
  includeDomains?: string[];
  numResults?: number;
}): Promise<WebSearchOutput> {
  const ai = createGoogleSearchClient();
  const query = buildConstrainedQuery(input.query, input.includeDomains ?? []);

  const interaction = await ai.interactions.create({
    model: DEFAULT_GOOGLE_SEARCH_MODEL,
    input: query,
    tools: [{ type: "google_search" }],
  });

  const results: WebSearchResult[] = [];
  walkGoogleSearchResults(interaction, results);

  return {
    query: input.query,
    provider: "google_search",
    results: dedupeResults(results, input.numResults ?? 5),
    warnings:
      results.length > 0 ? undefined : ["Gemini Google Search returned no structured results."],
  };
}
