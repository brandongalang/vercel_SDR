import { tool } from "ai";
import { webSearchInputSchema } from "@/lib/pipeline/schemas";

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
}) {
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

export function createWebSearchTool() {
  return tool({
    description: "Search the public web for recent company, person, hiring, social, and product signals.",
    inputSchema: webSearchInputSchema,
    execute: async ({ query, includeDomains, numResults }) => {
      return exaSearch({ query, includeDomains, numResults });
    },
  });
}
