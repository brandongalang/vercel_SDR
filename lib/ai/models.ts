import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, InvalidResponseDataError, wrapLanguageModel } from "ai";
import { z } from "zod";

export const MODEL_PROVIDER = "openrouter";
export const MODEL_REQUEST_TIMEOUT_MS = 60000;
const PRIMARY_COOLDOWN_MS = 300000;
export const PRIMARY_MODEL_ID = "stealth/space-bunny-alpha";
export const LIVE_FALLBACK_MODEL_ID = "inclusionai/ling-3.0-flash-sante:free";
export const FALLBACK_MODEL_IDS = [
  LIVE_FALLBACK_MODEL_ID,
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "thinkingmachines/inkling:free",
] as const;
export const MODEL_IDS = {
  orchestrator: PRIMARY_MODEL_ID,
  researcher: PRIMARY_MODEL_ID,
  signalExtractor: PRIMARY_MODEL_ID,
  anglePlanner: PRIMARY_MODEL_ID,
  draftGenerator: PRIMARY_MODEL_ID,
} as const;

class InvalidStructuredOutput extends Error {
  constructor() { super("Invalid model structured output"); }
}

class ProviderUnavailable extends Error {
  constructor(message = "OpenRouter connection failed") { super(message); }
}

function isRecoverable(error: unknown) {
  return error instanceof InvalidStructuredOutput || error instanceof ProviderUnavailable ||
    InvalidResponseDataError.isInstance(error) ||
    (APICallError.isInstance(error) && error.statusCode !== undefined &&
      [404, 408, 429, 500, 502, 503, 504].includes(error.statusCode));
}

/** Eligibility is a trusted server/harness assertion, never a user-supplied lead flag. */
export function createPipelineModel(options: {
  requestFetch?: typeof fetch;
  getApiKey?: () => string | undefined;
  requestTimeoutMs?: number;
  fallbackDataPolicy?: "synthetic-nonpersonal";
  agenticHarness?: boolean;
} = {}) {
  let primaryRetryAfter = 0;
  const makeModel = (modelId: string) => createOpenAICompatible({
    name: MODEL_PROVIDER,
    baseURL: "https://openrouter.ai/api/v1",
    supportsStructuredOutputs: true,
    // Enforce price and model after providerOptions are merged by the SDK.
    transformRequestBody: (body) => {
      const safeBody = { ...body };
      delete safeBody.models;
      delete safeBody.plugins;
      delete safeBody.route;
      // These endpoints support tools; the schema prompt avoids relying on native
      // JSON schema enforcement, while validation remains mandatory locally.
      if (safeBody.response_format) {
        const format = safeBody.response_format as { json_schema?: { schema?: unknown } };
        safeBody.messages = [...(safeBody.messages as object[]), {
          role: "user",
          content: `For the final answer, return only JSON matching this schema: ${JSON.stringify(format.json_schema?.schema)}. You may call the available tools before the final answer.`,
        }];
        if (modelId === PRIMARY_MODEL_ID) safeBody.response_format = { type: "json_object" };
        else delete safeBody.response_format;
      }
      return {
        ...safeBody,
        model: modelId,
        ...(modelId === PRIMARY_MODEL_ID ? { reasoning: { effort: "low" } } : {}),
        provider: {
          allow_fallbacks: false,
          require_parameters: true,
          max_price: { prompt: 0, completion: 0, request: 0 },
          ...([PRIMARY_MODEL_ID, LIVE_FALLBACK_MODEL_ID].includes(modelId) ? { data_collection: "deny" } : {}),
        },
      };
    },
    fetch: async (url, init) => {
      const apiKey = (options.getApiKey?.() ?? process.env.OPENROUTER_API_KEY)?.trim();
      if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");
      if (String(url) !== "https://openrouter.ai/api/v1/chat/completions") {
        throw new Error("Unsupported OpenRouter endpoint");
      }
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${apiKey}`);
      let response: Response;
      const startedAt = Date.now();
      console.info("SDR OpenRouter request started", { model: modelId });
      try {
        response = await (options.requestFetch ?? fetch)(url, {
          ...init, headers, redirect: "error",
        });
        console.info("SDR OpenRouter response", {
          model: modelId,
          status: response.status,
          durationMs: Date.now() - startedAt,
        });
      } catch {
        console.info("SDR OpenRouter connection failed", {
          model: modelId,
          durationMs: Date.now() - startedAt,
        });
        init?.signal?.throwIfAborted();
        throw new ProviderUnavailable();
      }
      if (!response.ok) {
        // Provider errors can echo request content; expose only the status.
        await response.body?.cancel();
        return Response.json(
          { error: { message: `OpenRouter request failed (${response.status})` } },
          { status: response.status },
        );
      }
      if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
        // The compatible SDK discards SSE error codes and keeps the raw message.
        // Sanitize before it parses the stream, retaining only a numeric status.
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let pending = "";
        const sanitizeLine = (line: string) => {
          if (!line.startsWith("data:")) return line;
          try {
            const data = JSON.parse(line.slice(5));
            if (data.error) {
              const code = Number(data.error.code);
              return `data: ${JSON.stringify({ error: { message: `OpenRouter stream failed (${Number.isInteger(code) ? code : 0})`, code } })}`;
            }
          } catch { /* Non-JSON SSE data is handled by the SDK. */ }
          return line;
        };
        const stream = response.body.pipeThrough(new TransformStream({
          transform(chunk, controller) {
            pending += decoder.decode(chunk, { stream: true });
            const lines = pending.split("\n");
            pending = lines.pop() ?? "";
            for (const line of lines) controller.enqueue(encoder.encode(`${sanitizeLine(line)}\n`));
          },
          flush(controller) {
            pending += decoder.decode();
            if (pending) controller.enqueue(encoder.encode(sanitizeLine(pending)));
          },
        }));
        return new Response(stream, { status: response.status, headers: response.headers });
      }
      return response;
    },
  }).chatModel(modelId);

  const models = [makeModel(PRIMARY_MODEL_ID), ...FALLBACK_MODEL_IDS.map(makeModel)];
  type Params = Parameters<(typeof models)[number]["doGenerate"]>[0];

  function validateOutput(params: Params, text: string, hasTools: boolean) {
    if (hasTools || params.responseFormat?.type !== "json") return text;
    // Convert before parsing: an unsupported caller schema is a configuration error,
    // not a reason to send the same request to another provider.
    const schema = params.responseFormat.schema
      ? z.fromJSONSchema(params.responseFormat.schema as Parameters<typeof z.fromJSONSchema>[0]) : undefined;
    // Prompt-only JSON providers can wrap an otherwise valid object in a fence.
    // Accept only a complete JSON fence; prose and schema violations still fail.
    const normalized = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1").trim();
    try {
      const value = JSON.parse(normalized);
      if (schema && !schema.safeParse(value).success) throw new InvalidStructuredOutput();
      return normalized;
    } catch { throw new InvalidStructuredOutput(); }
  }

  async function attempt<T>(params: Params, call: (model: (typeof models)[number], boundedParams: Params) => Promise<T>) {
    let failure: unknown;
    for (const [index, model] of models.entries()) {
      params.abortSignal?.throwIfAborted();
      if (index === 0 && Date.now() < primaryRetryAfter) continue;
      if (index > 1 && options.fallbackDataPolicy !== "synthetic-nonpersonal") {
        const status = APICallError.isInstance(failure) ? ` (${failure.statusCode})`
          : failure instanceof ProviderUnavailable && failure.message === "OpenRouter request timed out" ? " (request timed out)" : "";
        throw new Error(`Free fallback blocked${status}: Nemotron and Inkling require synthetic, nonpersonal, nonconfidential data. No paid fallback.`);
      }
      if (index === 3 && !options.agenticHarness) {
        throw new Error("Free Inkling fallback blocked: an agentic harness is required. No paid fallback.");
      }
      // Bound the entire model step, including reading its response body.
      const deadline = AbortSignal.timeout(options.requestTimeoutMs ?? MODEL_REQUEST_TIMEOUT_MS);
      const boundedParams = { ...params, abortSignal: params.abortSignal
        ? AbortSignal.any([params.abortSignal, deadline]) : deadline };
      try { return await call(model, boundedParams); } catch (error) {
        params.abortSignal?.throwIfAborted();
        const handledError = deadline.aborted ? new ProviderUnavailable("OpenRouter request timed out") : error;
        if (deadline.aborted) console.info("SDR OpenRouter model step timed out", { model: model.modelId });
        if (!isRecoverable(handledError)) throw handledError;
        if (index === 0 && (handledError instanceof ProviderUnavailable || APICallError.isInstance(handledError))) {
          primaryRetryAfter = Date.now() + PRIMARY_COOLDOWN_MS;
        }
        if (index === models.length - 1) {
          const status = APICallError.isInstance(handledError) ? ` (${handledError.statusCode})` : "";
          // A plain Error prevents the SDK's outer retry loop from replaying the
          // entire exhausted chain. Never include provider response text.
          throw new Error(`Free models exhausted${status}. No paid fallback.`);
        }
        failure = handledError;
      }
    }
    throw new Error("Free models exhausted. No paid fallback.");
  }

  return wrapLanguageModel({
    model: models[0],
    middleware: {
      specificationVersion: "v3",
      wrapGenerate: ({ params }) => attempt(params, async (model, boundedParams) => {
        const result = await model.doGenerate(boundedParams);
        if (result.finishReason.unified === "content-filter") throw new Error("Model response was filtered");
        const text = result.content.filter(part => part.type === "text").map(part => part.text).join("");
        const normalized = validateOutput(params, text, result.content.some(part => part.type === "tool-call"));
        if (normalized === text) return result;
        let emitted = false;
        return { ...result, content: result.content.flatMap<(typeof result.content)[number]>(part => {
          if (part.type !== "text") return [part];
          if (emitted) return [];
          emitted = true;
          return [{ ...part, text: normalized }];
        }) };
      }),
      wrapStream: ({ params }) => attempt(params, async (model, boundedParams) => {
        const result = await model.doStream(boundedParams);
        const reader = result.stream.getReader();
        const chunks: NonNullable<Awaited<ReturnType<typeof reader.read>>["value"]>[] = [];
        let text = "";
        let hasTools = false;
        let finished = false;
        // Buffer a single model step so failed text/tool calls never escape or execute
        // before choosing a fallback. Completed agent steps are never replayed.
        try {
          while (true) {
            boundedParams.abortSignal?.throwIfAborted();
            const { value, done } = await reader.read();
            if (done) break;
            if (value.type === "error") {
              const match = typeof value.error === "string" && /^OpenRouter stream failed \((\d+)\)$/.exec(value.error);
              if ((match && [404, 408, 429, 500, 502, 503, 504].includes(Number(match[1]))) || InvalidResponseDataError.isInstance(value.error)) throw new ProviderUnavailable();
              throw new Error("OpenRouter stream failed");
            }
            if (value.type === "text-delta") text += value.delta;
            if (value.type === "tool-call") hasTools = true;
            if (value.type === "finish") {
              finished = true;
              if (value.finishReason.unified === "error") throw new ProviderUnavailable();
              if (value.finishReason.unified === "content-filter") throw new Error("Model response was filtered");
            }
            chunks.push(value);
          }
          if (!finished) throw new ProviderUnavailable();
          const normalized = validateOutput(params, text, hasTools);
          if (normalized !== text) {
            let emitted = false;
            for (let index = chunks.length - 1; index >= 0; index--) {
              if (chunks[index].type === "text-delta") chunks.splice(index, 1);
            }
            const startIndex = chunks.findIndex(chunk => chunk.type === "text-start");
            if (startIndex >= 0) {
              const start = chunks[startIndex];
              if (start.type === "text-start") {
                chunks.splice(startIndex + 1, 0, { type: "text-delta", id: start.id, delta: normalized });
                emitted = true;
              }
            }
            if (!emitted) throw new InvalidStructuredOutput();
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        return { ...result, stream: new ReadableStream({ start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        } }) };
      }),
    },
  });
}

// Roles share the provider cooldown so an outage does not stall each stage again.
const sharedPipelineModel = createPipelineModel();
export const pipelineModels = {
  orchestrator: sharedPipelineModel,
  researcher: sharedPipelineModel,
  signalExtractor: sharedPipelineModel,
  anglePlanner: sharedPipelineModel,
  draftGenerator: sharedPipelineModel,
};
