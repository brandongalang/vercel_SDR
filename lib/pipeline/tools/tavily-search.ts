import type { WebSearchOutput } from "@/lib/pipeline/tools/search-types";

type TavilySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
    published_date?: string;
  }>;
};

export async function tavilySearch(input: {
  query: string;
  includeDomains?: string[];
  numResults?: number;
}): Promise<WebSearchOutput> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: input.query,
      max_results: input.numResults ?? 5,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      include_domains: input.includeDomains,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status})`);
  }

  const data = (await response.json()) as TavilySearchResponse;
  return {
    query: input.query,
    provider: "tavily",
    results: (data.results ?? []).map((result) => {
      const summary = result.content ?? "";
      return {
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
        publishedDate: result.published_date,
        summary,
        highlights: summary ? [summary.slice(0, 220)] : [],
        text: summary,
      };
    }),
  };
}
