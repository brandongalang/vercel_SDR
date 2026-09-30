import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, InvalidResponseDataError, wrapLanguageModel } from "ai";
import { z } from "zod";

export const MODEL_PROVIDER = "openrouter";
export const PRIMARY_MODEL_ID = "qwen/qwen3.8-27b:free";
export const FALLBACK_MODEL_IDS = [
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
  constructor() { super("OpenRouter connection failed"); }
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
  fallbackDataPolicy?: "synthetic-nonpersonal";
  agenticHarness?: boolean;
} = {}) {
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
      // The free Nemotron and Inkling endpoints support tools, but not response_format.
      if (modelId !== PRIMARY_MODEL_ID && safeBody.response_format) {
        const format = safeBody.response_format as { json_schema?: { schema?: unknown } };
        safeBody.messages = [...(safeBody.messages as object[]), {
          role: "user",
          content: `For the final answer, return only JSON matching this schema: ${JSON.stringify(format.json_schema?.schema)}. You may call the available tools before the final answer.`,
        }];
        delete safeBody.response_format;
      }
      return {
        ...safeBody,
        model: modelId,
        provider: {
          allow_fallbacks: false,
          require_parameters: true,
          max_price: { prompt: 0, completion: 0, request: 0 },
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
      try {
        response = await (options.requestFetch ?? fetch)(url, {
          ...init, headers, redirect: "error",
        });
      } catch {
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
    if (hasTools || params.responseFormat?.type !== "json") return;
    // Convert before parsing: an unsupported caller schema is a configuration error,
    // not a reason to send the same request to another provider.
    const schema = params.responseFormat.schema
      ? z.fromJSONSchema(params.responseFormat.schema as Parameters<typeof z.fromJSONSchema>[0]) : undefined;
    try {
      const value = JSON.parse(text);
      if (schema && !schema.safeParse(value).success) throw new InvalidStructuredOutput();
    } catch { throw new InvalidStructuredOutput(); }
  }

  async function attempt<T>(params: Params, call: (model: (typeof models)[number]) => Promise<T>) {
    let failure: unknown;
    for (const [index, model] of models.entries()) {
      params.abortSignal?.throwIfAborted();
      if (index > 0 && options.fallbackDataPolicy !== "synthetic-nonpersonal") {
        const status = APICallError.isInstance(failure) ? ` (${failure.statusCode})` : "";
        throw new Error(`Free fallback blocked${status}: Nemotron and Inkling require synthetic, nonpersonal, nonconfidential data. No paid fallback.`);
      }
      if (index === 2 && !options.agenticHarness) {
        throw new Error("Free Inkling fallback blocked: an agentic harness is required. No paid fallback.");
      }
      try { return await call(model); } catch (error) {
        params.abortSignal?.throwIfAborted();
        if (!isRecoverable(error)) throw error;
        if (index === models.length - 1) {
          const status = APICallError.isInstance(error) ? ` (${error.statusCode})` : "";
          // A plain Error prevents the SDK's outer retry loop from replaying the
          // entire exhausted chain. Never include provider response text.
          throw new Error(`Free models exhausted${status}. No paid fallback.`);
        }
        failure = error;
      }
    }
    throw new Error("Free models exhausted. No paid fallback.");
  }

  return wrapLanguageModel({
    model: models[0],
    middleware: {
      specificationVersion: "v3",
      wrapGenerate: ({ params }) => attempt(params, async model => {
        const result = await model.doGenerate(params);
        if (result.finishReason.unified === "content-filter") throw new Error("Model response was filtered");
        validateOutput(params, result.content.filter(part => part.type === "text").map(part => part.text).join(""), result.content.some(part => part.type === "tool-call"));
        return result;
      }),
      wrapStream: ({ params }) => attempt(params, async model => {
        const result = await model.doStream(params);
        const reader = result.stream.getReader();
        const chunks: NonNullable<Awaited<ReturnType<typeof reader.read>>["value"]>[] = [];
        let text = "";
        let hasTools = false;
        let finished = false;
        // Buffer a single model step so failed text/tool calls never escape or execute
        // before choosing a fallback. Completed agent steps are never replayed.
        try {
          while (true) {
            params.abortSignal?.throwIfAborted();
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
          validateOutput(params, text, hasTools);
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

export const pipelineModels = {
  orchestrator: createPipelineModel(),
  researcher: createPipelineModel(),
  signalExtractor: createPipelineModel(),
  anglePlanner: createPipelineModel(),
  draftGenerator: createPipelineModel(),
};
