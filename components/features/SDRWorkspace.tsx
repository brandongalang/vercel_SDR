"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import type { OutboundJob } from "@/lib/types";
import { db } from "@/lib/instant-db";
import { fromInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import {
  formatAnalyticsDateRangeLabel,
  getAnalyticsDateRangeSpanDays,
  getAnalyticsSnapshotFromJobs,
  MOCK_DSPY_COMPILE_RUNS,
} from "@/lib/analytics-mock";
import QueueList from "./QueueList";
import DetailPanel from "./DetailPanel";
import AnalyticsPage from "./AnalyticsPage";
import DspyPage from "./DspyPage";
import LiveAgentDemo from "./LiveAgentDemo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { useViewContext } from "@/lib/view-context";
import { useJobActions } from "@/lib/hooks/use-job-actions";
import { useQueueState, selectNextPendingId } from "@/lib/hooks/use-queue-state";
import { useDemoReset } from "@/lib/hooks/use-demo-reset";
import { useAnalyticsState } from "@/lib/hooks/use-analytics-state";

type ReviewWorkspaceState = "loading" | "error" | "empty" | "complete" | "idle" | "ready";

export default function SDRWorkspace() {
  const { isLoading, error, data } = db.useQuery({ jobs: {} });
  const jobs: OutboundJob[] = useMemo(
    () =>
      [...(data?.jobs ?? [])]
        .sort((a, b) => ((a.createdAt as number) ?? 0) - ((b.createdAt as number) ?? 0))
        .map(fromInstantJobRecord),
    [data?.jobs]
  );

  const { activeView, setActiveView, setRailControls } = useViewContext();
  const isDesktopReviewLayout = useMediaQuery("(min-width: 768px)");
  const [mobileReviewPane, setMobileReviewPane] = useState<"queue" | "detail">("detail");
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const {
    handleApprove,
    handleArchive,
    handleDraftUpdate,
    handleResetDraft,
    handleRegenerateNote,
    getBaselineDraft,
    getRegenerateNote,
    resetAll: resetJobActions,
  } = useJobActions(jobs);

  const {
    selectedJobId: resolvedSelectedJobId,
    setSelectedJobId,
    queueView,
    setQueueView,
    historyFilter,
    setHistoryFilter,
    queueStatusCounts,
    queueListState,
  } = useQueueState(jobs, { isLoading, error });

  const {
    analyticsDateRange,
    handleAnalyticsRangeStart,
    handleAnalyticsRangeEnd,
    handleAnalyticsQuickRange,
    resetAnalyticsDateRange,
  } = useAnalyticsState();

  const handleDemoResetCallback = useCallback(() => {
    setSelectedJobId(null);
    resetJobActions();
    resetAnalyticsDateRange();
    setActiveView("review");
  }, [setSelectedJobId, resetJobActions, resetAnalyticsDateRange, setActiveView]);

  const { handleResetDemo, isResettingDemo, resetError, workspaceResetVersion } =
    useDemoReset(handleDemoResetCallback);

  // ── Slow-loading indicator ────────────────────────────────────────────────
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

  // ── Derived values ────────────────────────────────────────────────────────
  const selectedJob = resolvedSelectedJobId ? jobs.find((j) => j.id === resolvedSelectedJobId) || null : null;
  const pendingCount = jobs.filter((j) => j.status === "pending_review").length;

  const selectedBaseline = resolvedSelectedJobId ? getBaselineDraft(resolvedSelectedJobId) : undefined;
  const draftHasEdits = selectedJob
    ? selectedBaseline != null &&
      (selectedJob.draft.subject !== selectedBaseline.subject || selectedJob.draft.body !== selectedBaseline.body)
    : false;

  const selectedAnalytics = useMemo(
    () => getAnalyticsSnapshotFromJobs(jobs, analyticsDateRange),
    [jobs, analyticsDateRange]
  );
  const analyticsWindowLabel = useMemo(
    () => formatAnalyticsDateRangeLabel(analyticsDateRange),
    [analyticsDateRange]
  );
  const analyticsRangeDays = useMemo(
    () => getAnalyticsDateRangeSpanDays(analyticsDateRange),
    [analyticsDateRange]
  );

  // ── Workspace state ───────────────────────────────────────────────────────
  function deriveReviewWorkspaceState(): ReviewWorkspaceState {
    if (error) return "error";
    if (isLoading) return "loading";
    if (jobs.length === 0) return "empty";
    if (queueView === "queue" && pendingCount === 0 && !selectedJob) return "complete";
    if (selectedJob) return "ready";
    return "idle";
  }
  const reviewWorkspaceState = deriveReviewWorkspaceState();

  // ── Composite action handlers ─────────────────────────────────────────────
  const handleApproveFromQueue = (jobId: string) => {
    const job = jobs.find((value) => value.id === jobId);
    if (!job || job.status !== "pending_review") return;

    const base = getBaselineDraft(jobId);
    const edited = base ? job.draft.subject !== base.subject || job.draft.body !== base.body : false;

    handleApprove(jobId, {
      subject: job.draft.subject,
      body: job.draft.body,
      edited,
      editorNote: getRegenerateNote(jobId),
    });

    const nextId = selectNextPendingId(jobs, jobId);
    setSelectedJobId(nextId);
    if (!isDesktopReviewLayout) setMobileReviewPane("detail");
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

  // ── View headers ──────────────────────────────────────────────────────────
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
    const figures = `${queueStatusCounts.pending} pending · ${queueStatusCounts.sent} sent · ${queueStatusCounts.skipped} skipped`;
    if (pendingCount === 0) {
      return { overline, title: "All caught up", subtitle: figures };
    }
    return {
      overline,
      title: `${pendingCount} lead${pendingCount !== 1 ? "s" : ""} pending review`,
      subtitle: figures,
    };
  }
  const reviewHeader = getReviewHeader();
  const viewHeader = {
    review: {
      ...reviewHeader,
    },
    analytics: {
      overline: "Analytics",
      title: "Benchmark board",
      subtitle: "Benchmark reporting for AI-generated outbound and the current review queue.",
    },
    dspy: {
      overline: "GEPA loop",
      title: "Reflective prompt optimization",
      subtitle: "AxGEPA searches instruction space; rep judgment and replies ground each compile.",
    },
    debugger: {
      overline: "Live agent",
      title: "Live pipeline demo",
      subtitle: "Step through a full research-and-draft run in real time.",
    },
  }[activeView];

  const handleOpenReviewJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveView("review");
    setMobileReviewPane("detail");
  };

  const handleReviewShortcut = useEffectEvent((shortcut: "approve" | "archive") => {
    const job = selectedJob;
    if (!job || job.status !== "pending_review") return;

    if (shortcut === "approve") {
      handleApproveFromDetail(job.id, {
        subject: job.draft.subject,
        body: job.draft.body,
        edited: draftHasEdits,
        editorNote: getRegenerateNote(job.id),
      });
      return;
    }

    handleArchiveFromDetail(job.id);
  });

  useEffect(() => {
    if (activeView !== "review") return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if ((e.key === "a" || e.key === "A") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReviewShortcut("approve");
      } else if ((e.key === "s" || e.key === "S") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReviewShortcut("archive");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView]);

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
            <div role="tablist" className="-mx-1 flex max-w-full overflow-x-auto rounded-xl border border-border bg-muted p-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:inline-flex sm:w-fit [&::-webkit-scrollbar]:hidden">
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
                          : `${queueStatusCounts.pending} pending · ${queueStatusCounts.sent} sent · ${queueStatusCounts.skipped} skipped`,
                },
                {
                  id: "analytics" as const,
                  label: "Analytics",
                  sub: "Benchmarks",
                },
                {
                  id: "dspy" as const,
                  label: "GEPA loop",
                  sub: "AxGEPA",
                },
                {
                  id: "debugger" as const,
                  label: "Live Agent",
                  sub: "Live pipeline",
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveView(tab.id)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2.5 text-left transition-colors sm:px-4",
                    activeView === tab.id
                      ? "bg-card shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-selected={activeView === tab.id}
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

      <div
        role="tabpanel"
        id="tabpanel-review"
        aria-labelledby="tab-review"
        aria-hidden={activeView !== "review"}
        hidden={activeView !== "review"}
        key={`review-${workspaceResetVersion}`}
        className={cn(
          "min-h-0 flex-1 flex-col overflow-hidden md:flex-row",
          activeView === "review" ? "flex" : "hidden",
        )}
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
            queueView={queueView}
            onQueueViewChange={setQueueView}
            historyFilter={historyFilter}
            onHistoryFilterChange={setHistoryFilter}
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
            regenerateNote={selectedJob ? getRegenerateNote(selectedJob.id) : undefined}
            state={reviewWorkspaceState}
            errorMessage={error?.message}
            isLoadingSlow={isLoadingSlow}
            onBackToQueue={
              isDesktopReviewLayout ? undefined : () => setMobileReviewPane("queue")
            }
          />
        </div>
      </div>
      <div
        role="tabpanel"
        id="tabpanel-analytics"
        aria-labelledby="tab-analytics"
        aria-hidden={activeView !== "analytics"}
        hidden={activeView !== "analytics"}
        className={cn("min-h-0 flex-1 flex-col", activeView === "analytics" ? "flex" : "hidden")}
      >
        <AnalyticsPage
          analytics={selectedAnalytics.snapshot}
          analyticsWindowLabel={analyticsWindowLabel}
          baselineWindowDays={selectedAnalytics.snapshotDays}
          dateRange={analyticsDateRange}
          rangeDays={analyticsRangeDays}
          jobs={jobs}
          onDateRangeStart={handleAnalyticsRangeStart}
          onDateRangeEnd={handleAnalyticsRangeEnd}
          onQuickRange={handleAnalyticsQuickRange}
        />
      </div>
      <div
        role="tabpanel"
        id="tabpanel-dspy"
        aria-labelledby="tab-dspy"
        aria-hidden={activeView !== "dspy"}
        hidden={activeView !== "dspy"}
        className={cn("min-h-0 flex-1 flex-col", activeView === "dspy" ? "flex" : "hidden")}
      >
        <DspyPage
          key={`dspy-${workspaceResetVersion}`}
          compileRuns={MOCK_DSPY_COMPILE_RUNS}
        />
      </div>
      <div
        role="tabpanel"
        id="tabpanel-debugger"
        aria-labelledby="tab-debugger"
        aria-hidden={activeView !== "debugger"}
        hidden={activeView !== "debugger"}
        className={cn("min-h-0 flex-1 flex-col", activeView === "debugger" ? "flex" : "hidden")}
      >
        <LiveAgentDemo
          key={`debugger-${workspaceResetVersion}`}
          onOpenReviewJob={handleOpenReviewJob}
        />
      </div>
    </div>
  );
}
