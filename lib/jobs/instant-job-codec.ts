import {
  ANGLE_TYPE_VALUES,
  CONFIDENCE_TIER_VALUES,
  GOVERNANCE_RULE_VALUES,
  JOB_STATUS_VALUES,
  LEAD_SOURCE_VALUES,
  PIPELINE_STATUS_VALUES,
  PLAY_TYPE_VALUES,
} from "@/lib/pipeline/vocab";
import type {
  ConfidenceTier,
  GovernanceRule,
  JobStatus,
  LeadSource,
  OutboundJob,
  OutreachContext,
  PipelineStatus,
  Play,
  PlayType,
  ResearchRun,
} from "@/lib/types";

export interface InstantJobRecord {
  leadName: string;
  leadTitle: string;
  company: string;
  play: OutboundJob["play"];
  whyNow: string;
  pipelineStatus: PipelineStatus;
  angleType: OutboundJob["angleType"];
  status: JobStatus;
  pipelineStage: string;
  governance: GovernanceRule;
  confidenceTier: ConfidenceTier;
  confidenceSummary: string;
  confidenceReasons: string[];
  angle: string;
  outreach: OutreachContext | null;
  draftSubject: string;
  draftBody: string;
  highlightedSpan: string | null;
  signals: OutboundJob["signals"];
  discardedSignals: OutboundJob["discardedSignals"];
  researchRun: ResearchRun;
  feedback: OutboundJob["feedback"] | null;
  outcome: OutboundJob["outcome"] | null;
  promptVersions: OutboundJob["promptVersions"] | null;
  createdAt: number;
  updatedAt: number;
  approvedAt: number | null;
  archivedAt: number | null;
  sentAt: number | null;
  respondedAt: number | null;
}

type LegacySourceSummary = {
  label?: string;
  count?: number;
  note?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringEnumValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isPlay(value: unknown): value is Play {
  return (
    isRecord(value) &&
    isStringEnumValue(PLAY_TYPE_VALUES, value.type) &&
    typeof value.label === "string" &&
    (value.context === undefined || typeof value.context === "string") &&
    isStringEnumValue(LEAD_SOURCE_VALUES, value.leadSource)
  );
}

function isResearchRun(value: unknown): value is ResearchRun {
  return (
    isRecord(value) &&
    Array.isArray(value.reports) &&
    Array.isArray(value.threadSummaries) &&
    typeof value.orchestratorSummary === "string"
  );
}

function normalizeLeadSource(raw: unknown): LeadSource {
  if (typeof raw !== "string" || raw.length === 0) {
    return "crm_outbound";
  }

  const value = raw.toLowerCase();

  if (value.includes("trial") || value.includes("workspace") || value.includes("product")) {
    return "plg_product";
  }

  if (value.includes("event form")) {
    return "marketing_event_form";
  }

  if (value.includes("event") || value.includes("registration") || value.includes("scan")) {
    return "marketing_event_scan";
  }

  if (value.includes("social")) {
    return "social_listening";
  }

  if (value.includes("web")) {
    return "web_deanonymization";
  }

  if (value.includes("inbound")) {
    return "inbound_request";
  }

  return "crm_outbound";
}

function normalizePlayType(label: string): PlayType {
  const value = label.toLowerCase();

  if (value.includes("trial") || value.includes("plg")) return "plg_signup";
  if (value.includes("event")) return "event";
  if (value.includes("hiring")) return "hiring_signal";
  if (value.includes("tech") || value.includes("migration") || value.includes("stack")) {
    return "tech_migration";
  }
  if (value.includes("web")) return "web_intent";
  if (value.includes("social")) return "social_post";

  return "outbound_prospecting";
}

function normalizePlay(rawPlay: unknown, rawResearchRun: unknown): Play {
  if (isPlay(rawPlay)) {
    return rawPlay;
  }

  const label = typeof rawPlay === "string" && rawPlay.length > 0 ? rawPlay : "Outbound";
  const legacyRun = isRecord(rawResearchRun) ? rawResearchRun : {};

  return {
    type: normalizePlayType(label),
    label,
    leadSource: normalizeLeadSource(legacyRun.leadSource),
  };
}

function getLegacySourceSummary(raw: Record<string, unknown>): LegacySourceSummary[] {
  if (!Array.isArray(raw.sourceSummary)) {
    return [];
  }

  return raw.sourceSummary
    .filter(isRecord)
    .map((source) => ({
      label: typeof source.label === "string" ? source.label : undefined,
      count: typeof source.count === "number" ? source.count : undefined,
      note: typeof source.note === "string" ? source.note : undefined,
    }));
}

function normalizeResearchRun(rawResearchRun: unknown): ResearchRun {
  if (isResearchRun(rawResearchRun)) {
    return rawResearchRun;
  }

  const raw = isRecord(rawResearchRun) ? rawResearchRun : {};
  const sourceSummary = getLegacySourceSummary(raw);

  return {
    orchestratorSummary:
      (typeof raw.scope === "string" && raw.scope) ||
      (typeof raw.whyChosen === "string" && raw.whyChosen) ||
      (typeof raw.label === "string" && raw.label) ||
      "Legacy research trace",
    threadSummaries: [
      typeof raw.whyChosen === "string" && raw.whyChosen ? `Selection: ${raw.whyChosen}` : null,
      ...sourceSummary.map((source) => {
        const label = source.label ?? "Source";
        const count = source.count != null ? `${source.count} signals` : "No count";
        const note = source.note ? ` - ${source.note}` : "";

        return `${label}: ${count}${note}`;
      }),
    ].filter((value): value is string => Boolean(value)),
    uncertainty: typeof raw.uncertainty === "string" ? raw.uncertainty : undefined,
    reports: sourceSummary.map((source) => ({
      topic: source.label ?? "Legacy source",
      findings: [],
      gaps: source.note ? [source.note] : [],
      summary:
        source.note ??
        (source.count != null
          ? `${source.count} signals captured in the legacy trace.`
          : "Imported from legacy trace."),
    })),
  };
}

function toEpochMilliseconds(value?: string): number | null {
  return value ? new Date(value).getTime() : null;
}

function toIsoTimestamp(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }

  return undefined;
}

function getRawTimestamp(
  record: Record<string, unknown>,
  topLevelKey: string,
  nestedKey: string,
): unknown {
  if (record[topLevelKey] != null) {
    return record[topLevelKey];
  }

  const nested = isRecord(record.timestamps) ? record.timestamps : undefined;
  return nested?.[nestedKey];
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function fromInstantJobRecord(record: Record<string, unknown>): OutboundJob {
  const play = normalizePlay(record.play, record.researchRun);
  const whyNow =
    typeof record.whyNow === "string"
      ? record.whyNow
      : isRecord(record.researchRun) && typeof record.researchRun.whyNow === "string"
        ? record.researchRun.whyNow
        : "";

  return {
    id: typeof record.id === "string" ? record.id : "",
    lead: {
      name: typeof record.leadName === "string" ? record.leadName : "",
      title: typeof record.leadTitle === "string" ? record.leadTitle : "",
    },
    company: typeof record.company === "string" ? record.company : "",
    play,
    whyNow,
    angleType: isStringEnumValue(ANGLE_TYPE_VALUES, record.angleType)
      ? record.angleType
      : "generic",
    status: isStringEnumValue(JOB_STATUS_VALUES, record.status)
      ? record.status
      : "pending_review",
    pipelineStage: typeof record.pipelineStage === "string" ? record.pipelineStage : "complete",
    pipelineStatus: isStringEnumValue(PIPELINE_STATUS_VALUES, record.pipelineStatus)
      ? record.pipelineStatus
      : "completed",
    governance: isStringEnumValue(GOVERNANCE_RULE_VALUES, record.governance)
      ? record.governance
      : "review_required",
    confidence: {
      tier: isStringEnumValue(CONFIDENCE_TIER_VALUES, record.confidenceTier)
        ? record.confidenceTier
        : "medium",
      summary: typeof record.confidenceSummary === "string" ? record.confidenceSummary : "",
      reasons: getStringArray(record.confidenceReasons),
    },
    angle: typeof record.angle === "string" ? record.angle : "",
    outreach: isRecord(record.outreach) ? (record.outreach as unknown as OutboundJob["outreach"]) : undefined,
    signals: Array.isArray(record.signals) ? (record.signals as OutboundJob["signals"]) : [],
    discardedSignals: Array.isArray(record.discardedSignals)
      ? (record.discardedSignals as OutboundJob["discardedSignals"])
      : [],
    researchRun: normalizeResearchRun(record.researchRun),
    draft: {
      subject: typeof record.draftSubject === "string" ? record.draftSubject : "",
      body: typeof record.draftBody === "string" ? record.draftBody : "",
      highlightedSpan:
        typeof record.highlightedSpan === "string" ? record.highlightedSpan : undefined,
    },
    feedback: isRecord(record.feedback) ? (record.feedback as OutboundJob["feedback"]) : undefined,
    outcome: isRecord(record.outcome) ? (record.outcome as OutboundJob["outcome"]) : undefined,
    timestamps: {
      created:
        toIsoTimestamp(getRawTimestamp(record, "createdAt", "created")) ??
        new Date().toISOString(),
      updated:
        toIsoTimestamp(getRawTimestamp(record, "updatedAt", "updated")) ??
        new Date().toISOString(),
      approvedAt: toIsoTimestamp(getRawTimestamp(record, "approvedAt", "approvedAt")),
      archivedAt: toIsoTimestamp(getRawTimestamp(record, "archivedAt", "archivedAt")),
      sentAt: toIsoTimestamp(getRawTimestamp(record, "sentAt", "sentAt")),
      respondedAt: toIsoTimestamp(getRawTimestamp(record, "respondedAt", "respondedAt")),
    },
    promptVersions:
      isRecord(record.promptVersions)
        ? (record.promptVersions as OutboundJob["promptVersions"])
        : undefined,
  };
}

export function toInstantJobRecord(job: OutboundJob): InstantJobRecord {
  return {
    leadName: job.lead.name,
    leadTitle: job.lead.title,
    company: job.company,
    play: job.play,
    whyNow: job.whyNow,
    pipelineStatus: job.pipelineStatus ?? "completed",
    angleType: job.angleType,
    status: job.status,
    pipelineStage: job.pipelineStage,
    governance: job.governance,
    confidenceTier: job.confidence.tier,
    confidenceSummary: job.confidence.summary,
    confidenceReasons: job.confidence.reasons ?? [],
    angle: job.angle,
    outreach: job.outreach ?? null,
    draftSubject: job.draft.subject,
    draftBody: job.draft.body,
    highlightedSpan: job.draft.highlightedSpan ?? null,
    signals: job.signals,
    discardedSignals: job.discardedSignals ?? [],
    researchRun: job.researchRun,
    feedback: job.feedback ?? null,
    outcome: job.outcome ?? null,
    promptVersions: job.promptVersions ?? null,
    createdAt: new Date(job.timestamps.created).getTime(),
    updatedAt: new Date(job.timestamps.updated).getTime(),
    approvedAt: toEpochMilliseconds(job.timestamps.approvedAt),
    archivedAt: toEpochMilliseconds(job.timestamps.archivedAt),
    sentAt: toEpochMilliseconds(job.timestamps.sentAt),
    respondedAt: toEpochMilliseconds(job.timestamps.respondedAt),
  };
}
