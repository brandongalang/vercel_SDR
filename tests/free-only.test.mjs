import assert from "node:assert/strict";
import { test } from "node:test";
import { generateText, streamText, Output, ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createPipelineModel, MODEL_IDS, PRIMARY_MODEL_ID, FALLBACK_MODEL_IDS } from "../lib/ai/models.ts";
import { createWebSearch } from "../lib/pipeline/tools/web-search.ts";

const completion = (message, reason = "stop") => Response.json({
  id: "synthetic-completion", model: PRIMARY_MODEL_ID, created: 1,
  choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: reason }],
  usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
});

test("all roles use the selected free model; missing key makes no request", async () => {
  assert.ok(Object.values(MODEL_IDS).every(id => id === PRIMARY_MODEL_ID));
  let requests = 0;
  const model = createPipelineModel({ getApiKey: () => "", requestFetch: async () => { requests++; } });
  await assert.rejects(generateText({ model, prompt: "Synthetic test", maxRetries: 0 }), /Missing OPENROUTER_API_KEY/);
  assert.equal(requests, 0);
});

test("structured output uses JSON schema and cannot override the free routing policy", async () => {
  let body;
  const model = createPipelineModel({
    getApiKey: () => "synthetic-test-key",
    requestFetch: async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init.redirect, "error");
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer synthetic-test-key");
      body = JSON.parse(init.body);
      return completion({ content: '{"value":"synthetic"}' });
    },
  });
  const result = await generateText({
    model, prompt: "Return the synthetic object", maxRetries: 0,
    output: Output.object({ schema: z.object({ value: z.string() }) }),
    providerOptions: { openrouter: { model: "paid/model", models: ["paid/model"], plugins: [{ id: "web" }], provider: { max_price: { prompt: 10 } } } },
  });
  assert.deepEqual(result.output, { value: "synthetic" });
  assert.equal(body.model, PRIMARY_MODEL_ID);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.models, undefined);
  assert.equal(body.plugins, undefined);
  assert.deepEqual(body.provider, { allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0, completion: 0, request: 0 } });
});

test("malformed structured output is rejected by the SDK", async () => {
  const model = createPipelineModel({ getApiKey: () => "synthetic-test-key", requestFetch: async () => completion({ content: '{"value":123}' }) });
  await assert.rejects(generateText({ model, prompt: "Synthetic", maxRetries: 0, output: Output.object({ schema: z.object({ value: z.string() }) }) }));
});

test("streaming uses the same free-only request policy", async () => {
  const model = createPipelineModel({
    getApiKey: () => "synthetic-test-key",
    requestFetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.stream, true);
      assert.equal(body.model, PRIMARY_MODEL_ID);
      assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0, request: 0 });
      const chunks = [
        { id: "stream-1", model: PRIMARY_MODEL_ID, created: 1, choices: [{ index: 0, delta: { role: "assistant", content: "Synthetic stream" }, finish_reason: null }] },
        { id: "stream-1", model: PRIMARY_MODEL_ID, created: 1, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
      ];
      return new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    },
  });
  const result = streamText({ model, prompt: "Synthetic streaming test", maxRetries: 0 });
  assert.equal(await result.text, "Synthetic stream");
});

test("tool loop executes validated tools and returns validated structured output", async () => {
  let calls = 0;
  const model = createPipelineModel({
    getApiKey: () => "synthetic-test-key",
    requestFetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.ok(body.tools.some(t => t.function.name === "public_lookup"));
      calls++;
      return calls === 1
        ? completion({ content: null, tool_calls: [{ id: "lookup-1", type: "function", function: { name: "public_lookup", arguments: '{"domain":"example.com"}' } }] }, "tool_calls")
        : completion({ content: '{"summary":"Synthetic public result"}' });
    },
  });
  const agent = new ToolLoopAgent({
    model, maxRetries: 0, stopWhen: stepCountIs(3),
    output: Output.object({ schema: z.object({ summary: z.string() }) }),
    tools: { public_lookup: tool({ inputSchema: z.object({ domain: z.literal("example.com") }), execute: async () => ({ source: "https://example.com" }) }) },
  });
  const result = await agent.generate({ prompt: "Synthetic public research" });
  assert.equal(calls, 2);
  assert.equal(result.output.summary, "Synthetic public result");
});

test("unclassified live data blocks fallback and provider echoes stay private", async () => {
  let calls = 0;
  const model = createPipelineModel({ getApiKey: () => "synthetic-test-key", requestFetch: async () => { calls++; return Response.json({ error: { message: "sensitive-provider-echo" } }, { status: 429 }); } });
  await assert.rejects(generateText({ model, prompt: "Synthetic", maxRetries: 0 }), error => error.message.includes("429") && !error.message.includes("sensitive-provider-echo"));
  assert.equal(calls, 1);
});

const syntheticHarness = { getApiKey: () => "synthetic-test-key", fallbackDataPolicy: "synthetic-nonpersonal", agenticHarness: true };

test("synthetic harness follows Qwen -> Nemotron -> Inkling with zero-price routing", async () => {
  const ids = [];
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async (_url, init) => {
    const body = JSON.parse(init.body);
    ids.push(body.model);
    assert.equal(body.models, undefined);
    assert.equal(body.plugins, undefined);
    assert.deepEqual(body.provider, { allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0, completion: 0, request: 0 } });
    if (ids.length < 3) return Response.json({ error: { message: "private echo" } }, { status: ids.length === 1 ? 429 : 503 });
    return completion({ content: "Synthetic harness success" });
  } });
  const result = await generateText({ model, prompt: "Synthetic fixture only", maxRetries: 0,
    providerOptions: { openrouter: { model: "paid/model", models: ["paid/model"], route: "fallback", plugins: [{ id: "web" }] } } });
  assert.equal(result.text, "Synthetic harness success");
  assert.deepEqual(ids, [PRIMARY_MODEL_ID, ...FALLBACK_MODEL_IDS]);
});

test("invalid JSON and schema failure advance fallback; endpoints without JSON support use a schema prompt", async () => {
  const ids = [];
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async (_url, init) => {
    const body = JSON.parse(init.body);
    ids.push(body.model);
    if (ids.length === 1) {
      assert.equal(body.response_format.type, "json_schema");
      return completion({ content: "malformed JSON" });
    }
    assert.equal(body.response_format, undefined);
    assert.match(body.messages.at(-1).content, /JSON matching this schema/);
    assert.match(body.messages.at(-1).content, /"value"/);
    return completion({ content: ids.length === 2 ? '{"value":123}' : '{"value":"synthetic"}' });
  } });
  const result = await generateText({ model, prompt: "Synthetic fixture", maxRetries: 0,
    output: Output.object({ schema: z.object({ value: z.string() }) }) });
  assert.deepEqual(result.output, { value: "synthetic" });
  assert.deepEqual(ids, [PRIMARY_MODEL_ID, ...FALLBACK_MODEL_IDS]);
});

for (const status of [400, 401, 402, 403, 422]) {
  test(`terminal provider status ${status} makes only one request`, async () => {
    let calls = 0;
    const model = createPipelineModel({ ...syntheticHarness, requestFetch: async () => {
      calls++;
      return Response.json({ error: { message: "private echo" } }, { status });
    } });
    await assert.rejects(generateText({ model, prompt: "Synthetic", maxRetries: 0 }), error =>
      error.message.includes(String(status)) && !error.message.includes("private echo"));
    assert.equal(calls, 1);
  });
}

test("exhausted free models stop after three attempts and sanitize errors", async () => {
  let calls = 0;
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async () => {
    calls++;
    return Response.json({ error: { message: "private echo" } }, { status: 429 });
  } });
  await assert.rejects(generateText({ model, prompt: "Synthetic" }), error =>
    error.message.includes("429") && !error.message.includes("private echo"));
  assert.equal(calls, 3);
});

test("synthetic data alone cannot invoke Inkling outside an agentic harness", async () => {
  let calls = 0;
  const model = createPipelineModel({ ...syntheticHarness, agenticHarness: false, requestFetch: async () => {
    calls++;
    return Response.json({}, { status: 503 });
  } });
  await assert.rejects(generateText({ model, prompt: "Synthetic", maxRetries: 0 }), /agentic harness is required/);
  assert.equal(calls, 2);
});

test("network failures fall back without exposing network error text", async () => {
  let calls = 0;
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async () => {
    if (++calls === 1) throw new TypeError("private network detail");
    return completion({ content: "Synthetic" });
  } });
  assert.equal((await generateText({ model, prompt: "Synthetic", maxRetries: 0 })).text, "Synthetic");
  assert.equal(calls, 2);
});

test("cancellation stops without any fallback", async () => {
  const controller = new AbortController();
  let calls = 0;
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async () => {
    calls++;
    controller.abort();
    throw new Error("cancelled");
  } });
  await assert.rejects(generateText({ model, prompt: "Synthetic", maxRetries: 0, abortSignal: controller.signal }), /abort/i);
  assert.equal(calls, 1);
});

const streamCompletion = (text, reason = "stop") => new Response([
  { id: "synthetic-stream", model: PRIMARY_MODEL_ID, created: 1, choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] },
  { id: "synthetic-stream", model: PRIMARY_MODEL_ID, created: 1, choices: [{ index: 0, delta: {}, finish_reason: reason }] },
].map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });

test("stream fallback suppresses failed step text and validates final JSON before publishing", async () => {
  const ids = [];
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async (_url, init) => {
    ids.push(JSON.parse(init.body).model);
    return streamCompletion(ids.length === 1 ? '{"value":123}' : '{"value":"synthetic"}');
  } });
  const result = streamText({ model, prompt: "Synthetic", maxRetries: 0,
    output: Output.object({ schema: z.object({ value: z.string() }) }) });
  let published = "";
  for await (const text of result.textStream) published += text;
  assert.equal(published, '{"value":"synthetic"}');
  assert.deepEqual(await result.output, { value: "synthetic" });
  assert.deepEqual(ids, [PRIMARY_MODEL_ID, FALLBACK_MODEL_IDS[0]]);
});

test("synthetic tool harness reaches Inkling without replaying completed tool executions", async () => {
  const ids = [];
  let executions = 0;
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async (_url, init) => {
    const body = JSON.parse(init.body);
    ids.push(body.model);
    assert.ok(body.tools.some(t => t.function.name === "synthetic_lookup"));
    if (body.messages.some(m => m.role === "tool")) return completion({ content: '{"summary":"Synthetic fixture"}' });
    if (body.model !== FALLBACK_MODEL_IDS[1]) return Response.json({}, { status: 503 });
    return completion({ content: null, tool_calls: [{ id: "synthetic-call", type: "function", function: { name: "synthetic_lookup", arguments: '{"domain":"example.com"}' } }] }, "tool_calls");
  } });
  const agent = new ToolLoopAgent({ model, stopWhen: stepCountIs(3),
    output: Output.object({ schema: z.object({ summary: z.string() }) }),
    tools: { synthetic_lookup: tool({ inputSchema: z.object({ domain: z.literal("example.com") }), execute: async () => { executions++; return { summary: "Synthetic fixture" }; } }) },
  });
  assert.equal((await agent.generate({ prompt: "Synthetic fixture only" })).output.summary, "Synthetic fixture");
  assert.equal(executions, 1);
  assert.deepEqual(ids, [PRIMARY_MODEL_ID, ...FALLBACK_MODEL_IDS, PRIMARY_MODEL_ID]);
});

test("content-filtered responses stop without fallback", async () => {
  let calls = 0;
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async () => {
    calls++;
    return completion({ content: "" }, "content_filter");
  } });
  await assert.rejects(generateText({ model, prompt: "Synthetic", output: Output.object({ schema: z.object({ value: z.string() }) }) }), /filtered/);
  assert.equal(calls, 1);
});

test("streaming provider errors recover without publishing partial failed content", async () => {
  let calls = 0;
  const model = createPipelineModel({ ...syntheticHarness, requestFetch: async () => {
    if (++calls === 1) return new Response(
      `data: ${JSON.stringify({ id: "synthetic", model: PRIMARY_MODEL_ID, created: 1, choices: [{ index: 0, delta: { content: "failed partial" }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ error: { code: 503, message: "private provider echo" } })}\n\n`,
      { headers: { "content-type": "text/event-stream" } });
    return streamCompletion("Synthetic success");
  } });
  const result = streamText({ model, prompt: "Synthetic", maxRetries: 0 });
  assert.equal(await result.text, "Synthetic success");
  assert.equal(calls, 2);
});

const freeUsage = {
  key: { usage: 5, limit: 1000 },
  account: { current_plan: "Researcher", plan_usage: 5, plan_limit: 1000, paygo_usage: 0, paygo_limit: 0 },
};

test("free search checks billing/quota before a one-credit basic request", async () => {
  const urls = [];
  const search = createWebSearch({
    getApiKey: () => "synthetic-test-key",
    requestFetch: async (url, init) => {
      urls.push(url);
      if (url.endsWith("/usage")) return Response.json(freeUsage);
      const body = JSON.parse(init.body);
      assert.equal(body.search_depth, "basic");
      assert.equal(body.auto_parameters, false);
      assert.deepEqual(body.include_domains, ["example.com"]);
      return Response.json({ results: [{ title: "Synthetic public result", url: "https://example.com", content: "Public synthetic content" }] });
    },
  });
  const result = await search({ query: "synthetic public company", includeDomains: ["example.com"] });
  assert.deepEqual(urls, ["https://api.tavily.com/usage", "https://api.tavily.com/search"]);
  assert.equal(result.provider, "tavily");
  assert.equal(result.results[0].summary, "Public synthetic content");
});

for (const [name, usage] of [
  ["quota exhausted", { ...freeUsage, account: { ...freeUsage.account, plan_usage: 1000 } }],
  ["paygo enabled", { ...freeUsage, account: { ...freeUsage.account, paygo_limit: 10 } }],
  ["paid plan", { ...freeUsage, account: { ...freeUsage.account, current_plan: "Bootstrap" } }],
  ["unknown billing", {}],
]) {
  test(`search fails closed when ${name}`, async () => {
    let requests = 0;
    const search = createWebSearch({ getApiKey: () => "synthetic-test-key", requestFetch: async () => { requests++; return Response.json(usage); } });
    await assert.rejects(search({ query: "synthetic" }));
    assert.equal(requests, 1);
  });
}

test("missing search key fails before any request", async () => {
  let requests = 0;
  const search = createWebSearch({ getApiKey: () => "", requestFetch: async () => { requests++; } });
  await assert.rejects(search({ query: "synthetic" }), /Missing TAVILY_API_KEY/);
  assert.equal(requests, 0);
});

test("search provider failure cannot activate Exa or paid Google Search", async () => {
  const urls = [];
  const search = createWebSearch({ getApiKey: () => "synthetic-test-key", requestFetch: async url => { urls.push(url); return url.endsWith("/usage") ? Response.json(freeUsage) : Response.json({}, { status: 432 }); } });
  await assert.rejects(search({ query: "synthetic" }), /no paid fallback/);
  assert.deepEqual(urls, ["https://api.tavily.com/usage", "https://api.tavily.com/search"]);
});
