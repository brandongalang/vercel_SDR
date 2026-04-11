import { z } from "zod";

export const confidenceTierSchema = z.enum(["high", "medium", "low"]);
export const governanceRuleSchema = z.enum(["review_required", "auto_eligible"]);
export const jobStatusSchema = z.enum(["pending_review", "approved", "reviewed", "sent_stub"]);
export const pipelineStatusSchema = z.enum(["running", "completed", "failed"]);

export const signalCategorySchema = z.enum([
  "event",
  "plg",
  "tech_stack",
  "social",
  "web_activity",
  "hiring_signal",
  "internal",
]);

export const signalSourceSchema = z.enum(["internal", "external", "derived"]);
export const signalStrengthSchema = z.enum(["strong", "moderate", "weak"]);
export const signalHintSchema = z.enum([
  "event",
  "plg",
  "tech_stack",
  "social",
  "web_activity",
  "hiring_signal",
  "internal",
]);

export const angleTypeSchema = z.enum([
  "tech_migration",
  "trial_activation",
  "event_signal",
  "social_post",
  "web_intent",
  "hiring_signal",
  "generic",
]);

export const playTypeSchema = z.enum([
  "plg_signup",
  "event",
  "hiring_signal",
  "tech_migration",
  "web_intent",
  "social_post",
  "outbound_prospecting",
]);

export const leadSourceSchema = z.enum([
  "plg_product",
  "marketing_event_form",
  "marketing_event_scan",
  "crm_outbound",
  "social_listening",
  "web_deanonymization",
  "inbound_request",
]);

export const playSchema = z.object({
  type: playTypeSchema,
  label: z.string().min(1),
  context: z.string().optional(),
  leadSource: leadSourceSchema,
});

export const freeformContextSchema = z.string().trim().min(1).max(8000);

export const leadInputSchema = z.object({
  leadName: z.string().min(1),
  leadTitle: z.string().min(1),
  company: z.string().min(1),
  companyDomain: z.string().min(1).optional(),
  freeformContext: freeformContextSchema.optional(),
  play: playSchema,
});

export const demoLeadInputSchema = leadInputSchema.extend({
  freeformContext: freeformContextSchema,
});

export const findingSchema = z.object({
  text: z.string().min(1),
  sourceUrl: z.string().min(1),
  date: z.string().optional(),
  signalHint: signalHintSchema.optional(),
  strengthHint: signalStrengthSchema.optional(),
  confidence: confidenceTierSchema,
  rawQuote: z.string().optional(),
});

export const subAgentReportSchema = z.object({
  topic: z.string().min(1),
  findings: z.array(findingSchema),
  gaps: z.array(z.string()),
  summary: z.string().min(1),
});

export const researchPacketSchema = z.object({
  leadInput: leadInputSchema,
  reports: z.array(subAgentReportSchema),
  threadSummaries: z.array(z.string()),
  orchestratorSummary: z.string().min(1),
  uncertainty: z.string().optional(),
});

export const researchPacketModelOutputSchema = z.object({
  threadSummaries: z.array(z.string()),
  orchestratorSummary: z.string().min(1),
  uncertainty: z.string().optional(),
});

export const scoredSignalSchema = z.object({
  id: z.string().min(1),
  category: signalCategorySchema,
  label: z.string().min(1),
  value: z.string().min(1),
  source: signalSourceSchema,
  rank: z.number().int().positive(),
  strength: signalStrengthSchema,
  usedInAngle: z.boolean(),
  signalDate: z.string().optional(),
  evidenceUrl: z.string().optional(),
});

export const discardedSignalSchema = z.object({
  label: z.string().min(1),
  reason: z.string().min(1),
});

export const signalExtractionSchema = z.object({
  signals: z.array(scoredSignalSchema),
  discardedSignals: z.array(discardedSignalSchema),
});

export const anglePlanSchema = z.object({
  angleType: angleTypeSchema,
  angle: z.string().min(1),
  whyNow: z.string().min(1),
  confidence: z.object({
    tier: confidenceTierSchema,
    summary: z.string().min(1),
    reasons: z.array(z.string()).min(1),
  }),
  usedSignalIds: z.array(z.string()).min(1),
});

export const draftOutputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  highlightedSpan: z.string().optional(),
});

export const runResearcherInputSchema = z.object({
  topic: z.string().min(1),
  researchGoal: z.string().min(1),
  queryHints: z.array(z.string()).default([]),
  includeDomains: z.array(z.string()).default([]),
});

export const webSearchInputSchema = z.object({
  query: z.string().min(1),
  includeDomains: z.array(z.string()).default([]),
  numResults: z.number().int().min(1).max(8).default(5),
});

export const crmLookupInputSchema = z.object({
  company: z.string().min(1),
  leadName: z.string().min(1),
  leadTitle: z.string().min(1),
  playType: playTypeSchema.optional(),
  leadSource: leadSourceSchema.optional(),
});

export const productSignalsInputSchema = z.object({
  leadName: z.string().min(1),
  company: z.string().min(1),
  play: playSchema,
});
