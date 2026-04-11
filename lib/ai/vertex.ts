import { createVertex } from "@ai-sdk/google-vertex";
import type { GoogleAuthOptions } from "google-auth-library";

const project = process.env.GOOGLE_VERTEX_PROJECT ?? "hermes-vision-prod";
const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";

/** API key mode (Gemini on Vertex “express”) — works on Vercel without a JSON key file. */
const vertexApiKey = process.env.GOOGLE_VERTEX_API_KEY?.trim() || undefined;

/**
 * Paste the full service account JSON (single line) for Vertex on hosts without ADC (e.g. Vercel).
 * Ignored when `GOOGLE_VERTEX_API_KEY` is set.
 */
function loadGoogleAuthOptions(): GoogleAuthOptions | undefined {
  if (vertexApiKey) return undefined;
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (!raw) return undefined;
  try {
    const credentials = JSON.parse(raw) as Record<string, unknown>;
    return { credentials };
  } catch {
    console.error("[vertex] GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON");
    return undefined;
  }
}

// Verified against Model Garden in hermes-vision-prod on 2026-04-11.
export const VERTEX_MODEL_IDS = {
  orchestrator: "gemini-3.1-pro-preview",
  researcher: "gemini-3-flash-preview",
  signalExtractor: "gemini-3.1-pro-preview",
  anglePlanner: "gemini-3.1-pro-preview",
  draftGenerator: "gemini-3.1-pro-preview",
} as const;

export const VERTEX_PROJECT = project;
export const VERTEX_LOCATION = location;
export const VERTEX_BASE_URL = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google`;

const googleAuthOptions = loadGoogleAuthOptions();

export const vertex = createVertex({
  project,
  location,
  ...(vertexApiKey
    ? { apiKey: vertexApiKey }
    : {
        baseURL: VERTEX_BASE_URL,
        ...(googleAuthOptions ? { googleAuthOptions } : {}),
      }),
});

export const vertexModels = {
  orchestrator: vertex(VERTEX_MODEL_IDS.orchestrator),
  researcher: vertex(VERTEX_MODEL_IDS.researcher),
  signalExtractor: vertex(VERTEX_MODEL_IDS.signalExtractor),
  anglePlanner: vertex(VERTEX_MODEL_IDS.anglePlanner),
  draftGenerator: vertex(VERTEX_MODEL_IDS.draftGenerator),
};
