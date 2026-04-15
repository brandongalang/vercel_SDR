import {
  ANGLE_TYPE_VALUES,
  CONFIDENCE_TIER_VALUES,
  GOVERNANCE_RULE_VALUES,
  JOB_STATUS_VALUES,
  LEAD_SOURCE_VALUES,
  PIPELINE_PHASE_STATUS_VALUES,
  PIPELINE_PHASE_VALUES,
  PIPELINE_STATUS_VALUES,
  PLAY_TYPE_VALUES,
  SIGNAL_CATEGORY_VALUES,
  SIGNAL_SOURCE_VALUES,
  SIGNAL_STRENGTH_VALUES,
  SIGNAL_SCOPE_VALUES,
  PERSON_ANGLE_STRENGTH_VALUES,
  INSIGHT_SOURCE_TYPE_VALUES,
} from "@/lib/pipeline/vocab";

// ─── Core enums ──────────────────────────────────────────────────────────────

export type ConfidenceTier = (typeof CONFIDENCE_TIER_VALUES)[number];
export type GovernanceRule = (typeof GOVERNANCE_RULE_VALUES)[number];
export type JobStatus = (typeof JOB_STATUS_VALUES)[number];
export type PipelineStatus = (typeof PIPELINE_STATUS_VALUES)[number];
export type PipelinePhase = (typeof PIPELINE_PHASE_VALUES)[number];
export type PipelinePhaseStatus = (typeof PIPELINE_PHASE_STATUS_VALUES)[number];

export type SignalCategory = (typeof SIGNAL_CATEGORY_VALUES)[number];
export type SignalSource = (typeof SIGNAL_SOURCE_VALUES)[number];
export type SignalStrength = (typeof SIGNAL_STRENGTH_VALUES)[number];
export type SignalHint = SignalCategory;

export type AngleType = (typeof ANGLE_TYPE_VALUES)[number];

export type PlayType = (typeof PLAY_TYPE_VALUES)[number];

export type LeadSource =
  | (typeof LEAD_SOURCE_VALUES)[number];

export type SignalScope = (typeof SIGNAL_SCOPE_VALUES)[number];
export type PersonAngleStrength = (typeof PERSON_ANGLE_STRENGTH_VALUES)[number];
export type InsightSourceType = (typeof INSIGHT_SOURCE_TYPE_VALUES)[number];

// ─── Pipeline input ───────────────────────────────────────────────────────────

export interface Play {
  type: PlayType;
  label: string;             // display: "Ship It SF 2026"
  context?: string;          // "attended keynote session"
  leadSource: LeadSource;    // determines research budget + quality floor
}

export interface LeadInput {
  leadName: string;
  leadTitle: string;
  company: string;
  companyDomain?: string;    // for Exa web research
  freeformContext?: string;
  play: Play;
}

// ─── Research layer (Stage 1) ─────────────────────────────────────────────────

/** Atomic research finding — fact + provenance co-located, never split across arrays */
export interface Finding {
  text: string;
  sourceUrl: string;
  date?: string;             // ISO date of the underlying event / publication
  signalHint?: SignalHint;
  strengthHint?: SignalStrength;
  confidence: ConfidenceTier;
  rawQuote?: string;
}

/** Output of a single Flash sub-agent research thread */
export interface SubAgentReport {
  topic: string;
  findings: Finding[];
  gaps: string[];
  summary: string;           // compact — returned to orchestrator only
}

/** Handoff object from research layer to structure chain */
export interface ResearchPacket {
  leadInput: LeadInput;
  reports: SubAgentReport[];
  threadSummaries: string[];
  orchestratorSummary: string;
  uncertainty?: string;
}

/** Slim trace of the research run stored alongside the job for UI transparency */
export interface ResearchRun {
  orchestratorSummary: string;
  threadSummaries: string[];
  uncertainty?: string;
  reports: SubAgentReport[];  // full atomic findings — available to SignalExtractor
}

// ─── Structure chain (Stages 2–4) ────────────────────────────────────────────

export interface ScoredSignal {
  id: string;
  category: SignalCategory;
  label: string;
  value: string;
  source: SignalSource;
  rank: number;
  strength: SignalStrength;
  usedInAngle: boolean;
  signalDate?: string;       // ISO date of underlying event (post, job posting, etc.)
  evidenceUrl?: string;
  scope?: SignalScope;
}

export interface DiscardedSignal {
  label: string;
  reason: string;
}

export interface AnglePlan {
  angleType: AngleType;
  angle: string;             // 1-sentence hook
  whyNow: string;            // explicit timing justification
  confidence: {
    tier: ConfidenceTier;
    summary: string;
    reasons: string[];
  };
  usedSignalIds: string[];
  outreach?: OutreachContext;
}

export interface InsightRef {
  label: string;
  url: string;
  date: string;
  sourceType: InsightSourceType;
}

export interface OutreachContext {
  companyInsight: string;
  companyRefs: InsightRef[];
  personInsight: string | null;
  personRefs: InsightRef[];
  personAngleStrength: PersonAngleStrength;
}

// ─── Job ──────────────────────────────────────────────────────────────────────

/** Populated when a send is tracked (e.g. synced from email / CRM). Prototype uses mock data. */
export interface JobOutcome {
  replied?: boolean;
  positive?: boolean;
}

export interface JobTimestamps {
  created: string;
  updated: string;
  approvedAt?: string;
  archivedAt?: string;
  sentAt?: string;
  respondedAt?: string;
}

export interface OutboundJob {
  id: string;
  lead: { name: string; title: string };
  company: string;
  play: Play;
  whyNow: string;
  researchRun: ResearchRun;
  /** The angle variant chosen by Stage 3 — experiment variable for DSPy optimization */
  angleType: AngleType;
  status: JobStatus;
  pipelineStage: string;
  pipelineStatus?: PipelineStatus;
  governance: GovernanceRule;
  confidence: {
    tier: ConfidenceTier;
    summary: string;
    score?: number;
    reasons?: string[];
  };
  angle: string;
  outreach?: OutreachContext;
  signals: ScoredSignal[];
  discardedSignals?: DiscardedSignal[];
  draft: { subject: string; body: string; highlightedSpan?: string };
  feedback?: {
    edited: boolean;
    editorNote?: string;
    /** Workable, non-negative lead reply that an SDR can advance. */
    positiveReply?: boolean | null;
  };
  /** Reply / pipeline signals for sent touches — drives success rates in Insights */
  outcome?: JobOutcome;
  timestamps: JobTimestamps;
  /** Prompt version map stamped at pipeline run time — enables DSPy version-attributed analytics */
  promptVersions?: Record<string, string>;
}

export interface WeeklyResponsePoint {
  label: string;
  cleanAcceptResponseRate: number;
  editedAcceptResponseRate: number;
  staticTemplateResponseRate: number;
  cleanAcceptSent: number;
  editedAcceptSent: number;
  staticTemplateSent: number;
}

export interface PlaybookRow {
  id: string;
  combo: string;
  volume: number;
  metricLabel: string;
  metricValue: number; 
  metricTrend?: number;
  metricType: "positive" | "negative";
  note: string;
}

export interface AnalyticsDateRange {
  start: string;
  end: string;
}

export interface AnalyticsSnapshot {
  windowLabel: string;
  generatedSent: number;
  staticBaselineSent: number;
  
  cleanAcceptRate: number;
  editedAcceptRate: number;
  archiveRate: number;
  avgReviewSeconds: number;
  
  overallResponseRate: number;
  positiveReplyRate: number;
  staticTemplateResponseRate: number;
  responseLift: number;

  trends?: {
    cleanAccept?: number;
    editedAccept?: number;
    archive?: number;
    avgReviewSeconds?: number;
    overallResponse?: number;
    positiveReply?: number;
    responseLift?: number;
  };

  weeklyResponse: WeeklyResponsePoint[];
  topPlays: PlaybookRow[];
  frictionPlays: PlaybookRow[];
}

// ─── DSPy optimization types ──────────────────────────────────────────────────

/** Metrics for a single prompt version bucket, optionally filtered by angle type */
export interface DspyVersionRow {
  /** The draftGenerator prompt version string, e.g. "2026-04-11.draft-generator.v2" */
  draftPromptVersion: string;
  /** AngleType filter applied to this row, or null for global (all angles) */
  angleType: AngleType | null;
  jobCount: number;
  withFeedback: number;
  cleanAccept: number;
  edited: number;
  cleanAcceptRate: number | null;
  editRate: number | null;
  sentWithOutcome: number;
  replied: number;
  positive: number;
  replyRate: number | null;
  positiveRate: number | null;
}

/** A single offline DSPy optimization run — stamped when a new frozen prompt artifact is compiled */
export interface DspyCompileRun {
  id: string;
  compiledAt: string;           // ISO date string
  optimizer: string;            // e.g. "BootstrapFewShot", "MIPROv2"
  promptVersionBefore: string;  // draftGenerator version that was the baseline
  promptVersionAfter: string;   // draftGenerator version produced by this compile
  trainWindowDays: number;      // how many days of jobs were used as training data
  jobsUsed: number;             // count of training examples
  /** Delta metrics vs the previous version (positive = improvement) */
  deltas: {
    cleanAcceptRate?: number;
    editRate?: number;
    positiveRate?: number;
    replyRate?: number;
  };
}
