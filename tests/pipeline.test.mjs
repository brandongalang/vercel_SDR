import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Node runs TypeScript directly; resolve the same @/ paths used by Next.js.
registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context);
  },
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = resolve(specifier.slice(2));
      const path = [`${base}.ts`, `${base}.tsx`, base].find(existsSync);
      if (!path) throw new Error(`Missing test import: ${specifier}`);
      return nextResolve(pathToFileURL(path).href, path.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context);
    }
    return nextResolve(specifier, context);
  },
});

test("actual sequential pipeline runs synthetic research, search, extraction, planning and draft", async () => {
  const previousFetch = globalThis.fetch;
  const oldModelKey = process.env.OPENROUTER_API_KEY;
  const oldSearchKey = process.env.TAVILY_API_KEY;
  process.env.OPENROUTER_API_KEY = "synthetic-test-key";
  process.env.TAVILY_API_KEY = "synthetic-test-key";
  const calls = [];
  const phases = [];
  const signal = { id: "synthetic-signal", category: "hiring_signal", label: "Synthetic hiring", value: "Synthetic public hiring page", source: "external", rank: 1, strength: "moderate", usedInAngle: false, evidenceUrl: "https://example.com", scope: "company" };
  const response = (message, reason = "stop") => Response.json({
    id: "synthetic", model: "qwen/qwen3.8-27b:free", created: 1,
    choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: reason }],
    usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
  });
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (url === "https://api.tavily.com/usage") return Response.json({ key: { usage: 0, limit: 1000 }, account: { current_plan: "Researcher", plan_usage: 0, plan_limit: 1000, paygo_usage: 0, paygo_limit: 0 } });
    if (url === "https://api.tavily.com/search") return Response.json({ results: [{ title: "Synthetic public hiring", url: "https://example.com", content: "Synthetic Company is hiring developers." }] });
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "qwen/qwen3.8-27b:free");
    assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0, request: 0 });
    const names = (body.tools ?? []).map(t => t.function.name);
    const hasToolResult = body.messages.some(m => m.role === "tool");
    if (names.includes("spawn_researcher") && !hasToolResult) {
      return response({ content: null, tool_calls: [{ id: "spawn-1", type: "function", function: { name: "spawn_researcher", arguments: JSON.stringify({ topic: "Synthetic company hiring", researchGoal: "Verify synthetic public hiring", queryHints: ["synthetic"], includeDomains: ["example.com"] }) } }] }, "tool_calls");
    }
    if (names.includes("web_search") && !hasToolResult) {
      return response({ content: null, tool_calls: [{ id: "search-1", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: "Synthetic Company hiring", includeDomains: ["example.com"], numResults: 1 }) } }] }, "tool_calls");
    }
    const properties = body.response_format.json_schema.schema.properties;
    let output;
    if (properties.topic) output = { topic: "Synthetic hiring", findings: [{ text: "Synthetic Company is hiring developers.", sourceUrl: "https://example.com", signalHint: "hiring_signal", strengthHint: "moderate", confidence: "medium" }], gaps: [], summary: "Synthetic public hiring evidence." };
    else if (properties.orchestratorSummary) output = { threadSummaries: ["Synthetic public hiring evidence."], orchestratorSummary: "Synthetic research complete.", companySize: "startup" };
    else if (properties.signals) output = { signals: [signal], discardedSignals: [] };
    else if (properties.angleType) output = { angleType: "hiring_signal", angle: "Synthetic hiring workflow", whyNow: "Synthetic public hiring evidence", confidence: { tier: "medium", summary: "Synthetic evidence", reasons: ["Synthetic first-party page"] }, usedSignalIds: [signal.id] };
    else if (properties.subject) output = { subject: "Synthetic draft", body: "Synthetic draft for review only.", highlightedSpan: "Synthetic draft" };
    else throw new Error("Unexpected synthetic pipeline request");
    return response({ content: JSON.stringify(output) });
  };
  try {
    const { runOutboundJobPipeline } = await import("../lib/pipeline/run-job.ts");
    const result = await runOutboundJobPipeline({
      leadInput: { leadName: "Synthetic Person", leadTitle: "Synthetic CTO", company: "Synthetic Company", companyDomain: "example.com", play: { type: "outbound_prospecting", label: "Synthetic public test", leadSource: "crm_outbound" } },
      onPhaseUpdate: event => { if (event.type === "completed") phases.push(event.phase.id); },
    });
    assert.deepEqual(phases, ["ingest", "research", "signals", "angle", "draft"]);
    assert.equal(result.job.draft.subject, "Synthetic draft");
    assert.equal(result.job.status, "pending_review");
    assert.equal(result.job.signals[0].usedInAngle, true);
    assert.equal(result.job.researchRun.reports.length, 1);
    assert.equal(result.audit.modelMetadata.provider, "openrouter");
    assert.equal(result.audit.modelMetadata.freeOnly, true);
    assert.equal(calls.filter(url => url.endsWith("/chat/completions")).length, 7);
    assert.equal(calls.filter(url => url.endsWith("/search")).length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (oldModelKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldModelKey;
    if (oldSearchKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = oldSearchKey;
  }
});
