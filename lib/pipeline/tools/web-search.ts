import { tool } from "ai";
import { webSearchInputSchema } from "@/lib/pipeline/schemas";
import { googleSearch } from "@/lib/pipeline/tools/google-search";
import type { WebSearchOutput } from "@/lib/pipeline/tools/search-types";

type ExaSearchResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  summary?: string;
  highlights?: string[];
  text?: string;
};

type ExaSearchResponse = {
  results?: ExaSearchResult[];
};

export async function exaSearch(input: {
  query: string;
  includeDomains?: string[];
  numResults?: number;
}): Promise<WebSearchOutput> {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXA_API_KEY");
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: input.query,
      numResults: input.numResults ?? 5,
      includeDomains: input.includeDomains,
      contents: {
        summary: true,
        highlights: { maxCharacters: 1200 },
        text: { maxCharacters: 1200 },
        livecrawl: "fallback",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa search failed (${response.status})`);
  }

  const data = (await response.json()) as ExaSearchResponse;
  return {
    query: input.query,
    provider: "exa",
    results: (data.results ?? []).map((result) => ({
      title: result.title ?? "Untitled result",
      url: result.url ?? "",
      publishedDate: result.publishedDate,
      summary: result.summary ?? "",
      highlights: result.highlights ?? [],
      text: result.text ?? "",
    })),
  };
}

export async function searchWeb(input: {
  query: string;
  includeDomains?: string[];
  numResults?: number;
}): Promise<WebSearchOutput> {
  const warnings: string[] = [];

  try {
    return await exaSearch(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Exa search failure";
    warnings.push(`Exa search unavailable: ${message}`);
  }

  try {
    const google = await googleSearch(input);
    return {
      ...google,
      warnings: [...warnings, ...(google.warnings ?? [])],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Gemini Google Search failure";
    warnings.push(`Gemini Google Search unavailable: ${message}`);
  }

  return {
    query: input.query,
    provider: "none",
    results: [],
    warnings,
  };
}

export function createWebSearchTool() {
  return tool({
    description: "Search the public web for recent company, person, hiring, social, and product signals.",
    inputSchema: webSearchInputSchema,
    execute: async ({ query, includeDomains, numResults }) => {
      return searchWeb({ query, includeDomains, numResults });
    },
  });
}
