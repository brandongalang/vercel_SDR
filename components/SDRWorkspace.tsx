"use client";

import { useMemo, useState } from "react";
import {
  AnalyticsDateRange,
  AnalyticsSnapshot,
  OutboundJob,
} from "@/lib/types";
import { db } from "@/lib/instant-db";
import { fromInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import {
  createDefaultAnalyticsDateRange,
  formatAnalyticsDateRangeLabel,
  getNearestAnalyticsSnapshot,
  MOCK_DSPY_COMPILE_RUNS,
} from "@/lib/analytics-mock";
import QueueList from "./QueueList";
import DetailPanel from "./DetailPanel";
import AnalyticsPage from "./AnalyticsPage";
import DspyPage, {
  INITIAL_DSPY_OPTIMIZATION_STATE,
  type DspyOptimizationState,
} from "./DspyPage";
import LiveAgentDemo from "./LiveAgentDemo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, RotateCcw } from "lucide-react";

interface SDRWorkspaceProps {
  analyticsMap: Record<string, AnalyticsSnapshot>;
}

type BaselineDraft = { subject: string; body: string; highlightedSpan?: string };

function getTimestamp() {
  return Date.now();
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
        .map(fromInstantJobRecord),
    [data?.jobs]
  );

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"review" | "analytics" | "debugger" | "dspy">("review");
  const [analyticsDateRange, setAnalyticsDateRange] = useState<AnalyticsDateRange>(() =>
    createDefaultAnalyticsDateRange()
  );
  const [regenerateNotes, setRegenerateNotes] = useState<Record<string, string | undefined>>({});
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, BaselineDraft>>({});
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [workspaceResetVersion, setWorkspaceResetVersion] = useState(0);
  const [dspyOptimizationState, setDspyOptimizationState] = useState<DspyOptimizationState>(
    INITIAL_DSPY_OPTIMIZATION_STATE,
  );
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

    // Snapshot baseline on first edit so we can restore highlights later.
    let baseline = baselineDrafts[jobId];
    if (current && !baseline) {
      baseline = {
        subject: current.draft.subject,
        body: current.draft.body,
        highlightedSpan: current.draft.highlightedSpan,
      };
      setBaselineDrafts((prev) => ({ ...prev, [jobId]: baseline! }));
    }

    // Highlight resolution rules:
    // • Manual body edits pass `highlightedSpan: undefined` to explicitly clear it.
    // • If that manual body edit returns to the baseline body, restore the baseline highlight.
    // • Regenerated-preview acceptance passes the full API draft, so preserve its highlight
    //   even if the regenerated body happens to match the baseline text.
    // • Subject-only edits carry the current highlight through unchanged.
    const resolvedHighlight =
      baseline && draft.body === baseline.body && draft.highlightedSpan === undefined
        ? baseline.highlightedSpan
        : draft.highlightedSpan;

    db.transact(
      db.tx.jobs[jobId].update({
        draftSubject: draft.subject,
        draftBody: draft.body,
        highlightedSpan: resolvedHighlight ?? null,
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

  const handleResetDemo = async () => {
    if (isResettingDemo) return;

    setIsResettingDemo(true);
    setResetError(null);

    try {
      const response = await fetch("/api/reset-demo", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to reset demo");
      }

      setSelectedJobId(null);
      setRegenerateNotes({});
      setBaselineDrafts({});
      setAnalyticsDateRange(createDefaultAnalyticsDateRange());
      setDspyOptimizationState(INITIAL_DSPY_OPTIMIZATION_STATE);
      setActiveView("review");
      setWorkspaceResetVersion((value) => value + 1);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Failed to reset demo");
    } finally {
      setIsResettingDemo(false);
    }
  };

  const pendingCount = jobs.filter((j) => j.status === "pending_review").length;
  const viewHeader = {
    review: {
      overline: "Lead review",
      title: `${pendingCount} lead${pendingCount !== 1 ? "s" : ""} pending review`,
      subtitle: "Approve or skip each AI-generated first-touch draft.",
    },
    analytics: {
      overline: "Analytics",
      title: "Performance benchmarks",
      subtitle: "Compare AI-personalized sends against the static sequence baseline.",
    },
    dspy: {
      overline: "DSPy compiler",
      title: "Prompt optimization history",
      subtitle: "Review compile runs and trace-backed improvements to the drafting program.",
    },
    debugger: {
      overline: "Live agent",
      title: "Live pipeline demo",
      subtitle: "Step through a full research-and-draft run in real time.",
    },
  }[activeView];

  const selectedBaseline = resolvedSelectedJobId ? baselineDrafts[resolvedSelectedJobId] : undefined;
  const draftHasEdits = selectedJob
    ? selectedBaseline != null &&
      (selectedJob.draft.subject !== selectedBaseline.subject || selectedJob.draft.body !== selectedBaseline.body)
    : false;

  const handleAnalyticsRangeStart = (start: string) => {
    setAnalyticsDateRange({
      start,
      end: start > analyticsDateRange.end ? start : analyticsDateRange.end,
    });
  };
  const handleAnalyticsRangeEnd = (end: string) => {
    setAnalyticsDateRange({
      start: end < analyticsDateRange.start ? end : analyticsDateRange.start,
      end,
    });
  };
  const handleOpenReviewJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveView("review");
  };

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
              {viewHeader.overline}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {viewHeader.title}
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">
              {viewHeader.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
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
                    sub: "Benchmarks",
                  },
                  {
                    id: "dspy" as const,
                    label: "DSPy",
                    sub: "Compile history",
                  },
                  {
                    id: "debugger" as const,
                    label: "Live Agent",
                    sub: "Live pipeline",
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveView(tab.id)}
                    className={cn(
                      "rounded-lg px-4 py-2.5 text-left transition-colors",
                      activeView === tab.id
                        ? "bg-card shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={activeView === tab.id}
                  >
                    <p className="text-[12px] font-medium text-current">{tab.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-none">
                      {tab.sub}
                    </p>
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleResetDemo}
                disabled={isResettingDemo}
              >
                {isResettingDemo ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Resetting…
                  </>
                ) : (
                  <>
                    <RotateCcw />
                    Reset Demo
                  </>
                )}
              </Button>
            </div>
            {resetError && (
              <p className="text-[12px] text-destructive">{resetError}</p>
            )}
          </div>
        </div>
      </div>

      {activeView === "review" ? (
        <div key={`review-${workspaceResetVersion}`} className="flex min-h-0 flex-1 overflow-hidden">
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
          jobs={jobs}
          onDateRangeStart={handleAnalyticsRangeStart}
          onDateRangeEnd={handleAnalyticsRangeEnd}
        />
      ) : activeView === "dspy" ? (
        <DspyPage
          key={`dspy-${workspaceResetVersion}`}
          compileRuns={MOCK_DSPY_COMPILE_RUNS}
          optimizationState={dspyOptimizationState}
          setOptimizationState={setDspyOptimizationState}
        />
      ) : (
        <LiveAgentDemo
          key={`debugger-${workspaceResetVersion}`}
          onOpenReviewJob={handleOpenReviewJob}
        />
      )}
    </div>
  );
}
