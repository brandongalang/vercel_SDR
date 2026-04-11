"use client";

import { useMemo, useState } from "react";
import {
  AnalyticsDateRange,
  AnalyticsSnapshot,
  AngleType,
  ConfidenceTier,
  GovernanceRule,
  JobStatus,
  LeadSource,
  OutboundJob,
  PipelineStatus,
  Play,
  PlayType,
  ResearchRun,
} from "@/lib/types";
import { db } from "@/lib/instant-db";
import {
  createDefaultAnalyticsDateRange,
  formatAnalyticsDateRangeLabel,
  getNearestAnalyticsSnapshot,
  MOCK_DSPY_COMPILE_RUNS,
} from "@/lib/analytics-mock";
import QueueList from "./QueueList";
import DetailPanel from "./DetailPanel";
import AnalyticsPage from "./AnalyticsPage";
import LiveAgentDemo from "./LiveAgentDemo";
import { cn } from "@/lib/utils";

interface SDRWorkspaceProps {
  analyticsMap: Record<string, AnalyticsSnapshot>;
}

type BaselineDraft = { subject: string; body: string; highlightedSpan?: string };

function getTimestamp() {
  return Date.now();
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
  if (value.includes("tech") || value.includes("migration") || value.includes("stack")) return "tech_migration";
  if (value.includes("web")) return "web_intent";
  if (value.includes("social")) return "social_post";
  return "outbound_prospecting";
}

function normalizePlay(rawPlay: unknown, rawResearchRun: unknown): Play {
  if (typeof rawPlay === "object" && rawPlay !== null && "type" in rawPlay && "label" in rawPlay) {
    const play = rawPlay as Play;
    return {
      type: play.type,
      label: play.label,
      context: play.context,
      leadSource: play.leadSource,
    };
  }

  const label = typeof rawPlay === "string" && rawPlay.length > 0 ? rawPlay : "Outbound";
  const legacyRun = (rawResearchRun ?? {}) as Record<string, unknown>;
  return {
    type: normalizePlayType(label),
    label,
    leadSource: normalizeLeadSource(legacyRun.leadSource),
  };
}

function normalizeResearchRun(rawResearchRun: unknown): ResearchRun {
  const raw = (rawResearchRun ?? {}) as Record<string, unknown>;

  if (
    Array.isArray(raw.reports) &&
    Array.isArray(raw.threadSummaries) &&
    typeof raw.orchestratorSummary === "string"
  ) {
    return raw as unknown as ResearchRun;
  }

  const sourceSummary = Array.isArray(raw.sourceSummary)
    ? (raw.sourceSummary as Array<{ label?: string; count?: number; note?: string }>)
    : [];

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
        const note = source.note ? ` — ${source.note}` : "";
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
        (source.count != null ? `${source.count} signals captured in the legacy trace.` : "Imported from legacy trace."),
    })),
  };
}

function toIsoTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }

  return undefined;
}

function getRawTimestamp(record: Record<string, unknown>, topLevelKey: string, nestedKey: string) {
  if (record[topLevelKey] != null) {
    return record[topLevelKey];
  }

  const nested = record.timestamps as Record<string, unknown> | undefined;
  return nested?.[nestedKey];
}

function toOutboundJob(r: Record<string, unknown>): OutboundJob {
  const play = normalizePlay(r.play, r.researchRun);
  const whyNow =
    (r.whyNow as string) ??
    ((r.researchRun as Record<string, unknown> | undefined)?.whyNow as string | undefined) ??
    "";

  return {
    id: r.id as string,
    lead: { name: (r.leadName as string) ?? "", title: (r.leadTitle as string) ?? "" },
    company: (r.company as string) ?? "",
    play,
    whyNow,
    angleType: ((r.angleType as string) ?? "generic") as AngleType,
    status: ((r.status as string) ?? "pending_review") as JobStatus,
    pipelineStage: (r.pipelineStage as string) ?? "complete",
    pipelineStatus: ((r.pipelineStatus as string) ?? "completed") as PipelineStatus,
    governance: ((r.governance as string) ?? "review_required") as GovernanceRule,
    confidence: {
      tier: ((r.confidenceTier as string) ?? "medium") as ConfidenceTier,
      summary: (r.confidenceSummary as string) ?? "",
      reasons: (r.confidenceReasons as string[]) ?? [],
    },
    angle: (r.angle as string) ?? "",
    signals: (r.signals as OutboundJob["signals"]) ?? [],
    discardedSignals: (r.discardedSignals as OutboundJob["discardedSignals"]) ?? [],
    researchRun: normalizeResearchRun(r.researchRun),
    draft: {
      subject: (r.draftSubject as string) ?? "",
      body: (r.draftBody as string) ?? "",
      highlightedSpan: (r.highlightedSpan as string | undefined) ?? undefined,
    },
    feedback: r.feedback as OutboundJob["feedback"],
    outcome: r.outcome as OutboundJob["outcome"],
    timestamps: {
      created:
        toIsoTimestamp(getRawTimestamp(r, "createdAt", "created")) ??
        new Date().toISOString(),
      updated:
        toIsoTimestamp(getRawTimestamp(r, "updatedAt", "updated")) ??
        new Date().toISOString(),
      approvedAt: toIsoTimestamp(getRawTimestamp(r, "approvedAt", "approvedAt")),
      archivedAt: toIsoTimestamp(getRawTimestamp(r, "archivedAt", "archivedAt")),
      sentAt: toIsoTimestamp(getRawTimestamp(r, "sentAt", "sentAt")),
      respondedAt: toIsoTimestamp(getRawTimestamp(r, "respondedAt", "respondedAt")),
    },
  };
}

function selectNextPendingId(ordered: OutboundJob[], afterJobId: string): string | null {
  const idx = ordered.findIndex((j) => j.id === afterJobId);
  for (let i = idx + 1; i < ordered.length; i++) {
    if (ordered[i].status === "pending_review" && ordered[i].id !== afterJobId) {
      return ordered[i].id;
    }
  }
  for (let i = 0; i < idx; i++) {
    if (ordered[i].status === "pending_review" && ordered[i].id !== afterJobId) {
      return ordered[i].id;
    }
  }
  return null;
}

export default function SDRWorkspace({ analyticsMap }: SDRWorkspaceProps) {
  const { isLoading, error, data } = db.useQuery({ jobs: {} });
  const jobs: OutboundJob[] = useMemo(
    () =>
      [...(data?.jobs ?? [])]
        .sort((a, b) => ((a.createdAt as number) ?? 0) - ((b.createdAt as number) ?? 0))
        .map(toOutboundJob),
    [data?.jobs]
  );

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"review" | "analytics" | "debugger">("review");
  const [analyticsDateRange, setAnalyticsDateRange] = useState<AnalyticsDateRange>(() =>
    createDefaultAnalyticsDateRange()
  );
  const [regenerateNotes, setRegenerateNotes] = useState<Record<string, string | undefined>>({});
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, BaselineDraft>>({});
  const selectedAnalytics = useMemo(
    () => getNearestAnalyticsSnapshot(analyticsDateRange, analyticsMap),
    [analyticsDateRange, analyticsMap]
  );
  const analyticsWindowLabel = useMemo(
    () => formatAnalyticsDateRangeLabel(analyticsDateRange),
    [analyticsDateRange]
  );
  const resolvedSelectedJobId =
    (selectedJobId && jobs.some((job) => job.id === selectedJobId) ? selectedJobId : null) ??
    jobs.find((job) => job.status === "pending_review")?.id ??
    jobs[0]?.id ??
    null;
  const selectedJob = resolvedSelectedJobId ? jobs.find((j) => j.id === resolvedSelectedJobId) || null : null;

  const handleApprove = (jobId: string, payload: { subject: string; body: string; edited: boolean; editorNote?: string }) => {
    const now = getTimestamp();
    db.transact(
      db.tx.jobs[jobId].update({
        status: "approved",
        draftSubject: payload.subject,
        draftBody: payload.body,
        highlightedSpan: null,
        feedback: { edited: payload.edited, editorNote: payload.editorNote ?? null },
        approvedAt: now,
        updatedAt: now,
      })
    );
    setRegenerateNotes((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  };

  const handleApproveFromQueue = (jobId: string) => {
    const job = jobs.find((value) => value.id === jobId);
    if (!job || job.status !== "pending_review") return;

    const base = baselineDrafts[jobId];
    const edited = base ? job.draft.subject !== base.subject || job.draft.body !== base.body : false;

    handleApprove(jobId, {
      subject: job.draft.subject,
      body: job.draft.body,
      edited,
      editorNote: regenerateNotes[jobId],
    });

    const nextId = selectNextPendingId(jobs, jobId);
    if (nextId) setSelectedJobId(nextId);
  };

  const handleArchive = (jobId: string) => {
    const now = getTimestamp();
    db.transact(
      db.tx.jobs[jobId].update({
        status: "reviewed",
        archivedAt: now,
        updatedAt: now,
      })
    );
  };

  const handleArchiveFromQueue = (jobId: string) => {
    const nextId = selectNextPendingId(jobs, jobId);
    handleArchive(jobId);
    if (nextId) setSelectedJobId(nextId);
  };

  const handleDraftUpdate = (jobId: string, draft: OutboundJob["draft"]) => {
    const current = jobs.find((job) => job.id === jobId);
    if (current && !baselineDrafts[jobId]) {
      setBaselineDrafts((prev) => ({
        ...prev,
        [jobId]: {
          subject: current.draft.subject,
          body: current.draft.body,
          highlightedSpan: current.draft.highlightedSpan,
        },
      }));
    }

    db.transact(
      db.tx.jobs[jobId].update({
        draftSubject: draft.subject,
        draftBody: draft.body,
        highlightedSpan: draft.highlightedSpan ?? null,
        updatedAt: getTimestamp(),
      })
    );
  };

  const handleRegenerateNote = (jobId: string, note: string | undefined) => {
    setRegenerateNotes((prev) => ({ ...prev, [jobId]: note }));
  };

  const handleResetDraft = (jobId: string) => {
    const baseline = baselineDrafts[jobId];
    if (!baseline) return;

    db.transact(
      db.tx.jobs[jobId].update({
        draftSubject: baseline.subject,
        draftBody: baseline.body,
        highlightedSpan: baseline.highlightedSpan ?? null,
        updatedAt: getTimestamp(),
      })
    );

    setRegenerateNotes((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  };

  const selectedBaseline = resolvedSelectedJobId ? baselineDrafts[resolvedSelectedJobId] : undefined;
  const draftHasEdits = selectedJob
    ? selectedBaseline != null &&
      (selectedJob.draft.subject !== selectedBaseline.subject || selectedJob.draft.body !== selectedBaseline.body)
    : false;

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-[13px] text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <p className="text-[13px] text-destructive">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-6 py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Outbound personalization
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              Better first-touch emails than the static sequence baseline
            </h1>
          </div>

          <div className="inline-flex w-fit rounded-xl border border-border bg-muted p-1">
            {[
              {
                id: "review" as const,
                label: "Lead review",
                sub: `${jobs.filter((j) => j.status === "pending_review").length} pending`,
              },
              {
                id: "analytics" as const,
                label: "Analytics",
                sub: analyticsWindowLabel,
              },
              {
                id: "debugger" as const,
                label: "Live Agent",
                sub: "Trace",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={cn(
                  "rounded-lg px-4 py-2.5 text-left transition-colors",
                  activeView === tab.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={activeView === tab.id}
              >
                <p className="text-[12px] font-medium text-current">{tab.label}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                  {tab.sub}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeView === "review" ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <QueueList
            jobs={jobs}
            selectedJobId={resolvedSelectedJobId}
            onSelectJob={setSelectedJobId}
            onArchiveJob={handleArchiveFromQueue}
            onApproveJob={handleApproveFromQueue}
          />
          <DetailPanel
            key={selectedJob?.id ?? "empty"}
            job={selectedJob}
            onApprove={handleApprove}
            onArchive={handleArchive}
            onDraftUpdate={handleDraftUpdate}
            onResetDraft={handleResetDraft}
            onRegenerateNote={handleRegenerateNote}
            draftHasEdits={Boolean(draftHasEdits)}
            regenerateNote={selectedJob ? regenerateNotes[selectedJob.id] : undefined}
          />
        </div>
      ) : activeView === "analytics" ? (
        <AnalyticsPage 
          analytics={selectedAnalytics.snapshot}
          analyticsWindowLabel={analyticsWindowLabel}
          baselineWindowDays={selectedAnalytics.snapshotDays}
          dateRange={analyticsDateRange}
          setDateRange={setAnalyticsDateRange}
          jobs={jobs}
          compileRuns={MOCK_DSPY_COMPILE_RUNS}
        />
      ) : (
        <LiveAgentDemo />
      )}
    </div>
  );
}
