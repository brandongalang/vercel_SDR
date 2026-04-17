import { z } from "zod";
import {
  ANGLE_TYPE_VALUES,
  CONFIDENCE_TIER_VALUES,
  GOVERNANCE_RULE_VALUES,
  JOB_STATUS_VALUES,
  LEAD_SOURCE_VALUES,
  PIPELINE_STATUS_VALUES,
  PLAY_TYPE_VALUES,
  SIGNAL_CATEGORY_VALUES,
  SIGNAL_SOURCE_VALUES,
  SIGNAL_STRENGTH_VALUES,
  SIGNAL_SCOPE_VALUES,
  PERSON_ANGLE_STRENGTH_VALUES,
  INSIGHT_SOURCE_TYPE_VALUES,
  COMPANY_SIZE_VALUES,
} from "@/lib/pipeline/vocab";
import { REGENERATION_PRESETS } from "@/lib/regeneration-presets";

export const companySizeSchema = z.enum(COMPANY_SIZE_VALUES);
export const confidenceTierSchema = z.enum(CONFIDENCE_TIER_VALUES);
export const governanceRuleSchema = z.enum(GOVERNANCE_RULE_VALUES);
export const jobStatusSchema = z.enum(JOB_STATUS_VALUES);
export const pipelineStatusSchema = z.enum(PIPELINE_STATUS_VALUES);

export const signalCategorySchema = z.enum(SIGNAL_CATEGORY_VALUES);

export const signalSourceSchema = z.enum(SIGNAL_SOURCE_VALUES);
export const signalStrengthSchema = z.enum(SIGNAL_STRENGTH_VALUES);
export const signalHintSchema = signalCategorySchema;

export const angleTypeSchema = z.enum(ANGLE_TYPE_VALUES);

export const playTypeSchema = z.enum(PLAY_TYPE_VALUES);

export const leadSourceSchema = z.enum(LEAD_SOURCE_VALUES);

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
  companySize: companySizeSchema.optional(),
  uncertainty: z.string().optional(),
});

export const researchPacketModelOutputSchema = z.object({
  threadSummaries: z.array(z.string()),
  orchestratorSummary: z.string().min(1),
  companySize: companySizeSchema.optional().describe("Estimate the size of the company based on the web signals you traversed (e.g. employee count, funding stage)."),
  uncertainty: z.string().optional(),
});

export const signalScopeSchema = z.enum(SIGNAL_SCOPE_VALUES);
export const personAngleStrengthSchema = z.enum(PERSON_ANGLE_STRENGTH_VALUES);
export const insightSourceTypeSchema = z.enum(INSIGHT_SOURCE_TYPE_VALUES);

export const insightRefSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  date: z.string().min(1),
  sourceType: insightSourceTypeSchema,
});

export const outreachContextSchema = z.object({
  companyInsight: z.string().min(1),
  companyRefs: z.array(insightRefSchema),
  personInsight: z.string().nullable(),
  personRefs: z.array(insightRefSchema),
  personAngleStrength: personAngleStrengthSchema,
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
  scope: signalScopeSchema.optional(),
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
  outreach: outreachContextSchema.optional(),
});

export const draftOutputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  highlightedSpan: z.string().optional(),
});

export const regenerationPresetSchema = z.enum(
  REGENERATION_PRESETS.map((preset) => preset.id) as [
    (typeof REGENERATION_PRESETS)[number]["id"],
    ...(typeof REGENERATION_PRESETS)[number]["id"][],
  ],
);

export const regenerateDraftRequestSchema = z.object({
  job: z.object({
    lead: z.object({
      name: z.string().min(1),
      title: z.string().min(1),
    }),
    company: z.string().min(1),
    play: playSchema,
    whyNow: z.string().min(1),
    angleType: angleTypeSchema,
    angle: z.string().min(1),
    confidence: z.object({
      tier: confidenceTierSchema,
      summary: z.string().min(1),
      reasons: z.array(z.string()).optional(),
    }),
    signals: z.array(scoredSignalSchema).min(1),
    draft: draftOutputSchema,
  }),
  adjustments: z.array(regenerationPresetSchema).min(1).max(3),
  note: z.string().trim().max(500).optional(),
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
