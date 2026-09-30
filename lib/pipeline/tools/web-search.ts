import "server-only";
import { z } from "zod";
import type { WebSearchOutput } from "./search-types";

const usageSchema = z.object({
  key: z.object({ usage: z.number().nonnegative(), limit: z.number().nonnegative() }),
  account: z.object({
    current_plan: z.literal("Researcher"),
    plan_usage: z.number().nonnegative(),
    plan_limit: z.literal(1000),
    paygo_usage: z.literal(0),
    paygo_limit: z.literal(0),
  }),
});

const resultsSchema = z.object({
  results: z.array(z.object({
    title: z.string().optional(),
    url: z.string().url(),
    content: z.string().optional(),
    published_date: z.string().optional(),
  })),
});

export function createWebSearch(options: {
  requestFetch?: typeof fetch;
  getApiKey?: () => string | undefined;
} = {}) {
  return async function searchWeb(input: {
    query: string;
    includeDomains?: string[];
    numResults?: number;
  }): Promise<WebSearchOutput> {
    const apiKey = (options.getApiKey?.() ?? process.env.TAVILY_API_KEY)?.trim();
    if (!apiKey) throw new Error("Missing TAVILY_API_KEY: free web search is not configured");
    const requestFetch = options.requestFetch ?? fetch;
    const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
    const usageResponse = await requestFetch("https://api.tavily.com/usage", {
      headers, redirect: "error", signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!usageResponse.ok) {
      throw new Error(`Cannot verify Tavily free quota (${usageResponse.status})`);
    }
    const usage = usageSchema.safeParse(await usageResponse.json());
    if (!usage.success) {
      throw new Error("Free-only search requires Tavily Researcher plan with pay-as-you-go disabled");
    }
    if (usage.data.account.plan_usage >= 1000 || usage.data.key.usage >= usage.data.key.limit) {
      throw new Error("Tavily free search quota exhausted; no paid fallback is enabled");
    }

    const limit = Math.min(20, Math.max(1, Math.trunc(input.numResults ?? 5)));
    const response = await requestFetch("https://api.tavily.com/search", {
      method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        query: input.query,
        search_depth: "basic",
        auto_parameters: false,
        max_results: limit,
        include_domains: input.includeDomains ?? [],
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!response.ok) throw new Error(`Tavily search failed (${response.status}); no paid fallback is enabled`);
    const parsed = resultsSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Tavily returned invalid search results");
    return {
      query: input.query,
      provider: "tavily",
      results: parsed.data.results.slice(0, limit).map((result) => ({
        title: result.title ?? "Untitled result",
        url: result.url,
        publishedDate: result.published_date,
        summary: result.content ?? "",
        highlights: result.content ? [result.content.slice(0, 1200)] : [],
        text: result.content ?? "",
      })),
    };
  };
}

export const searchWeb = createWebSearch();
