import { createVertex } from "@ai-sdk/google-vertex";

const project = process.env.GOOGLE_VERTEX_PROJECT ?? "hermes-vision-prod";
const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";

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

export const vertex = createVertex({
  baseURL: VERTEX_BASE_URL,
  project,
  location,
});

export const vertexModels = {
  orchestrator: vertex(VERTEX_MODEL_IDS.orchestrator),
  researcher: vertex(VERTEX_MODEL_IDS.researcher),
  signalExtractor: vertex(VERTEX_MODEL_IDS.signalExtractor),
  anglePlanner: vertex(VERTEX_MODEL_IDS.anglePlanner),
  draftGenerator: vertex(VERTEX_MODEL_IDS.draftGenerator),
};
