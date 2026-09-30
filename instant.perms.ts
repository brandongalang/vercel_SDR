import type { InstantRules } from "@instantdb/react";

// Apply only after the server-mediated routes are verified. Admin SDK operations
// bypass client rules; other existing namespaces keep their present behavior.
const rules = {
  jobs: { allow: { $default: "false" } },
  pipelineRuns: { allow: { $default: "false" } },
} satisfies InstantRules;

export default rules;
