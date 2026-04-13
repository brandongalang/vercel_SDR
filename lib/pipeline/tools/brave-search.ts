import type { WebSearchOutput } from "@/lib/pipeline/tools/search-types";

type BraveWebSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      age?: string;
      extra_snippets?: string[];
    }>;
  };
};

export async function braveSearch(input: {
  query: string;
  includeDomains?: string[];
  numResults?: number;
}): Promise<WebSearchOutput> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing BRAVE_SEARCH_API_KEY");
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", input.query);
  url.searchParams.set("count", String(input.numResults ?? 5));
  url.searchParams.set("country", "US");
  url.searchParams.set("search_lang", "en");

  for (const domain of input.includeDomains ?? []) {
    if (domain.trim()) {
      url.searchParams.append("site", domain.trim());
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed (${response.status})`);
  }

  const data = (await response.json()) as BraveWebSearchResponse;
  return {
    query: input.query,
    provider: "brave_search",
    results: (data.web?.results ?? []).map((result) => {
      const summary = result.description ?? "";
      return {
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
        publishedDate: result.age,
        summary,
        highlights: result.extra_snippets?.slice(0, 2) ?? (summary ? [summary] : []),
        text: summary,
      };
    }),
  };
}
