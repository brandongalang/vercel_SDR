import "server-only";
import { z } from "zod";
import type { WebSearchOutput } from "./search-types";

const usageSchema = z.object({
  key: z.object({ usage: z.number().nonnegative(), limit: z.number().positive().max(1000) }),
  account: z.object({
    current_plan: z.literal("Researcher"),
    plan_usage: z.number().nonnegative(),
    plan_limit: z.literal(1000),
    paygo_usage: z.literal(0),
    // Tavily returns null for this Researcher account with pay-as-you-go off.
    paygo_limit: z.literal(0).nullable(),
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
  let quota: { apiKey: string; remaining: number; expiresAt: number } | undefined;
  let pendingQuota: { apiKey: string; promise: Promise<NonNullable<typeof quota>> } | undefined;
  return async function searchWeb(input: {
    query: string;
    includeDomains?: string[];
    numResults?: number;
  }): Promise<WebSearchOutput> {
    const apiKey = (options.getApiKey?.() ?? process.env.TAVILY_API_KEY)?.trim();
    if (!apiKey) throw new Error("Missing TAVILY_API_KEY: free web search is not configured");
    const requestFetch = options.requestFetch ?? fetch;
    const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
    if (quota?.apiKey !== apiKey || Date.now() >= quota.expiresAt) {
      if (!pendingQuota || pendingQuota.apiKey !== apiKey) {
        const promise = (async () => {
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
          const keyRemaining = usage.data.key.limit - usage.data.key.usage;
          const accountRemaining = 1000 - usage.data.account.plan_usage;
          if (keyRemaining > accountRemaining) {
            throw new Error("Tavily key cap exceeds remaining free account quota; reduce the key cap before searching");
          }
          return { apiKey, remaining: Math.min(keyRemaining, accountRemaining), expiresAt: Date.now() + 600000 };
        })();
        pendingQuota = { apiKey, promise };
      }
      const pending = pendingQuota;
      try { quota = await pending.promise; }
      finally { if (pendingQuota === pending) pendingQuota = undefined; }
    }
    if (quota.remaining < 1) {
      throw new Error("Tavily free search quota exhausted; no paid fallback is enabled");
    }
    // /usage allows only 10 calls per 10 minutes. Share its validated budget and
    // reserve one basic-search credit before each request, including concurrent calls.
    quota.remaining--;

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
