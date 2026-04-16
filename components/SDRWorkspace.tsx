"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { RotateCcw } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { useViewContext } from "@/lib/view-context";

interface SDRWorkspaceProps {
  analyticsMap: Record<string, AnalyticsSnapshot>;
}

type BaselineDraft = { subject: string; body: string; highlightedSpan?: string };
type ReviewWorkspaceState = "loading" | "error" | "empty" | "complete" | "idle" | "ready";

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
  const { activeView, setActiveView, setRailControls } = useViewContext();
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
  /** Below `md`, review uses full-screen queue ↔ full-screen detail so the draft and actions are usable. */
  const isDesktopReviewLayout = useMediaQuery("(min-width: 768px)");
  const [mobileReviewPane, setMobileReviewPane] = useState<"queue" | "detail">("detail");
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsLoadingSlow(false);
      return;
    }

    setIsLoadingSlow(false);
    const timer = window.setTimeout(() => {
      setIsLoadingSlow(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isLoading]);
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
    null;
  const selectedJob = resolvedSelectedJobId ? jobs.find((j) => j.id === resolvedSelectedJobId) || null : null;
  const pendingCount = jobs.filter((j) => j.status === "pending_review").length;
  const queueListState: "error" | "loading" | "empty" | "ready" =
    error ? "error" : isLoading ? "loading" : jobs.length === 0 ? "empty" : "ready";

  function deriveReviewWorkspaceState(): ReviewWorkspaceState {
    if (error) return "error";
    if (isLoading) return "loading";
    if (jobs.length === 0) return "empty";
    if (pendingCount === 0 && !selectedJob) return "complete";
    if (selectedJob) return "ready";
    return "idle";
  }
  const reviewWorkspaceState = deriveReviewWorkspaceState();

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
    setSelectedJobId(nextId);
    if (!isDesktopReviewLayout) setMobileReviewPane("detail");
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
    setSelectedJobId(nextId);
    if (!isDesktopReviewLayout) setMobileReviewPane("detail");
  };

  const handleApproveFromDetail = (
    jobId: string,
    payload: { subject: string; body: string; edited: boolean; editorNote?: string },
  ) => {
    handleApprove(jobId, payload);
    setSelectedJobId(selectNextPendingId(jobs, jobId));
  };

  const handleArchiveFromDetail = (jobId: string) => {
    handleArchive(jobId);
    setSelectedJobId(selectNextPendingId(jobs, jobId));
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

  const handleResetDemo = useCallback(async () => {
    if (isResettingDemo) return;

    setIsResettingDemo(true);
    setResetError(null);

    try {
      const headers: HeadersInit = {};
      const publicToken = process.env.NEXT_PUBLIC_DEMO_RESET_TOKEN?.trim();
      if (publicToken) {
        headers["x-demo-reset-token"] = publicToken;
      }

      const response = await fetch("/api/reset-demo", {
        method: "POST",
        headers,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Demo reset is off in this environment. Set ENABLE_DEMO_RESET=true on the server (e.g. .env.local or Vercel).",
          );
        }
        if (response.status === 401) {
          throw new Error(
            "Demo reset is not authorized. Set DEMO_RESET_TOKEN and the same value in NEXT_PUBLIC_DEMO_RESET_TOKEN so the browser can send x-demo-reset-token.",
          );
        }
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
  }, [isResettingDemo, setActiveView]);

  function getReviewHeader() {
    const overline = "Lead review";
    if (isLoading) {
      return { overline, title: "Loading lead review queue", subtitle: "Connecting to InstantDB so you can review the latest drafted leads." };
    }
    if (error) {
      return { overline, title: "Lead review unavailable", subtitle: "The queue could not load right now. You can still use the other demo surfaces." };
    }
    if (jobs.length === 0) {
      return { overline, title: "Queue is empty", subtitle: "No AI-generated drafts are waiting in review yet." };
    }
    if (pendingCount === 0) {
      return { overline, title: "All caught up", subtitle: "No drafts are currently waiting for SDR review." };
    }
    return {
      overline,
      title: `${pendingCount} lead${pendingCount !== 1 ? "s" : ""} pending review`,
      subtitle: "Approve or skip each AI-generated first-touch draft.",
    };
  }
  const reviewHeader = getReviewHeader();
  const viewHeader = {
    review: {
      ...reviewHeader,
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
    setMobileReviewPane("detail");
  };

  const handleSelectReviewJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (!isDesktopReviewLayout) setMobileReviewPane("detail");
  };

  useEffect(() => {
    setRailControls(
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 rounded-md bg-background/80 text-muted-foreground hover:text-foreground"
        onClick={handleResetDemo}
        disabled={isResettingDemo}
        title={isResettingDemo ? "Resetting demo" : "Reset demo"}
        aria-label={isResettingDemo ? "Resetting demo" : "Reset demo"}
      >
        <RotateCcw className={cn("size-4", isResettingDemo && "animate-spin")} aria-hidden />
      </Button>,
    );

    return () => setRailControls(null);
  }, [handleResetDemo, isResettingDemo, setRailControls]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3.5 sm:px-6">
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
            <div className="-mx-1 flex max-w-full overflow-x-auto rounded-xl border border-border bg-muted p-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:inline-flex sm:w-fit [&::-webkit-scrollbar]:hidden">
                {[
                  {
                    id: "review" as const,
                    label: "Lead review",
                    sub:
                      queueListState === "loading"
                        ? "Loading…"
                        : queueListState === "error"
                          ? "Unavailable"
                          : queueListState === "empty"
                            ? "No leads"
                            : `${pendingCount} pending`,
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
                      "shrink-0 rounded-lg px-3 py-2.5 text-left transition-colors sm:px-4",
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

            {resetError && (
              <p className="text-[12px] text-destructive">{resetError}</p>
            )}
          </div>
        </div>
      </div>

      {activeView === "review" ? (
        <div
          key={`review-${workspaceResetVersion}`}
          className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row"
        >
          <div
            className={cn(
              "min-h-0 flex-col overflow-hidden md:w-[min(100%,380px)] md:shrink-0 md:border-r md:border-border",
              isDesktopReviewLayout || mobileReviewPane === "queue"
                ? "flex flex-1 md:flex md:flex-none"
                : "hidden md:flex md:flex-none",
            )}
          >
            <QueueList
              jobs={jobs}
              selectedJobId={resolvedSelectedJobId}
              onSelectJob={handleSelectReviewJob}
              onArchiveJob={handleArchiveFromQueue}
              onApproveJob={handleApproveFromQueue}
              state={queueListState}
              errorMessage={error?.message}
            />
          </div>
          <div
            className={cn(
              "min-h-0 flex-col overflow-hidden",
              isDesktopReviewLayout || mobileReviewPane === "detail"
                ? "flex min-h-0 flex-1"
                : "hidden md:flex md:min-h-0 md:flex-1",
            )}
          >
            <DetailPanel
              key={selectedJob?.id ?? reviewWorkspaceState}
              job={selectedJob}
              onApprove={handleApproveFromDetail}
              onArchive={handleArchiveFromDetail}
              onDraftUpdate={handleDraftUpdate}
              onResetDraft={handleResetDraft}
              onRegenerateNote={handleRegenerateNote}
              draftHasEdits={Boolean(draftHasEdits)}
              regenerateNote={selectedJob ? regenerateNotes[selectedJob.id] : undefined}
              state={reviewWorkspaceState}
              errorMessage={error?.message}
              isLoadingSlow={isLoadingSlow}
              onBackToQueue={
                isDesktopReviewLayout ? undefined : () => setMobileReviewPane("queue")
              }
            />
          </div>
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
