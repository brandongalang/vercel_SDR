import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const MODEL_PROVIDER = "openrouter";
export const PRIMARY_MODEL_ID = "qwen/qwen3.8-27b:free";
export const MODEL_IDS = {
  orchestrator: PRIMARY_MODEL_ID,
  researcher: PRIMARY_MODEL_ID,
  signalExtractor: PRIMARY_MODEL_ID,
  anglePlanner: PRIMARY_MODEL_ID,
  draftGenerator: PRIMARY_MODEL_ID,
} as const;

/** No model fallback is enabled until a second free model is selected. */
export function createPipelineModel(options: {
  requestFetch?: typeof fetch;
  getApiKey?: () => string | undefined;
} = {}) {
  const provider = createOpenAICompatible({
    name: MODEL_PROVIDER,
    baseURL: "https://openrouter.ai/api/v1",
    supportsStructuredOutputs: true,
    // Enforce price and model after providerOptions are merged by the SDK.
    transformRequestBody: (body) => {
      const safeBody = { ...body };
      delete safeBody.models;
      delete safeBody.plugins;
      delete safeBody.route;
      return {
        ...safeBody,
        model: PRIMARY_MODEL_ID,
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
      const response = await (options.requestFetch ?? fetch)(url, {
        ...init,
        headers,
        redirect: "error",
      });
      if (!response.ok) {
        // Provider errors can echo request content; expose only the status.
        await response.body?.cancel();
        return Response.json(
          { error: { message: `OpenRouter request failed (${response.status})` } },
          { status: response.status },
        );
      }
      return response;
    },
  });
  return provider.chatModel(PRIMARY_MODEL_ID);
}

export const pipelineModels = {
  orchestrator: createPipelineModel(),
  researcher: createPipelineModel(),
  signalExtractor: createPipelineModel(),
  anglePlanner: createPipelineModel(),
  draftGenerator: createPipelineModel(),
};
