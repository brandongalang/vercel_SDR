"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  AnalyticsDateRange,
  OutboundJob,
} from "@/lib/types";
import { db } from "@/lib/instant-db";
import { fromInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import {
  createDefaultAnalyticsDateRange,
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

const QUEUE_VIEW_KEY = "sdr-review-queue-view";
const HISTORY_FILTER_KEY = "sdr-review-history-filter";

type BaselineDraft = { subject: string; body: string; highlightedSpan?: string };
type ReviewWorkspaceState = "loading" | "error" | "empty" | "complete" | "idle" | "ready";
type QueueView = "queue" | "history";
type HistoryFilter = "all" | "sent_today" | "skipped";

function getTimestamp() {
  return Date.now();
}

function readStoredPreference(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredPreference(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference persistence is optional; keep the current in-memory view when storage is unavailable.
  }
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

export default function SDRWorkspace() {
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
  /** Below `md`, review uses full-screen queue ↔ full-screen detail so the draft and actions are usable. */
  const isDesktopReviewLayout = useMediaQuery("(min-width: 768px)");
  const [mobileReviewPane, setMobileReviewPane] = useState<"queue" | "detail">("detail");
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [queueView, setQueueView] = useState<QueueView>("queue");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  useEffect(() => {
    const savedView = readStoredPreference(QUEUE_VIEW_KEY);
    if (savedView === "queue" || savedView === "history") {
      setQueueView(savedView);
    }

    const savedFilter = readStoredPreference(HISTORY_FILTER_KEY);
    if (savedFilter === "all" || savedFilter === "sent_today" || savedFilter === "skipped") {
      setHistoryFilter(savedFilter);
    }
  }, []);

  useEffect(() => {
    writeStoredPreference(QUEUE_VIEW_KEY, queueView);
    writeStoredPreference(HISTORY_FILTER_KEY, historyFilter);
  }, [queueView, historyFilter]);

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
  const todayStart = (() => {
    const next = new Date();
    next.setHours(0, 0, 0, 0);
    return next.getTime();
  })();
  const pendingCount = jobs.filter((j) => j.status === "pending_review").length;
  const visibleSelectionIds = useMemo(() => {
    if (queueView === "queue") {
      return jobs.filter((job) => job.status === "pending_review").map((job) => job.id);
    }

    const historyJobs = jobs
      .filter((job) => job.status !== "pending_review")
      .sort((a, b) => {
        const aMs = Date.parse(a.timestamps.updated) || 0;
        const bMs = Date.parse(b.timestamps.updated) || 0;
        return bMs - aMs;
      });

    if (historyFilter === "skipped") {
      return historyJobs.filter((job) => job.status === "reviewed").map((job) => job.id);
    }

    if (historyFilter === "sent_today") {
      return historyJobs
        .filter((job) => job.status === "sent_stub")
        .filter((job) => {
          const sentAt = job.timestamps.sentAt ? Date.parse(job.timestamps.sentAt) : NaN;
          return Number.isNaN(sentAt) || sentAt >= todayStart;
        })
        .map((job) => job.id);
    }

    return historyJobs.map((job) => job.id);
  }, [jobs, queueView, historyFilter, todayStart]);
  const resolvedSelectedJobId =
    (selectedJobId && visibleSelectionIds.includes(selectedJobId) ? selectedJobId : null) ??
    visibleSelectionIds[0] ??
    null;
  const selectedJob = resolvedSelectedJobId ? jobs.find((j) => j.id === resolvedSelectedJobId) || null : null;
  const queueStatusCounts = useMemo(() => {
    let pending = 0;
    let sent = 0;
    let skipped = 0;
    for (const j of jobs) {
      if (j.status === "pending_review") pending += 1;
      else if (j.status === "sent_stub") sent += 1;
      else if (j.status === "reviewed") skipped += 1;
    }
    return { pending, sent, skipped };
  }, [jobs]);
  const queueListState: "error" | "loading" | "empty" | "ready" =
    error ? "error" : isLoading ? "loading" : jobs.length === 0 ? "empty" : "ready";

  function deriveReviewWorkspaceState(): ReviewWorkspaceState {
    if (error) return "error";
    if (isLoading) return "loading";
    if (jobs.length === 0) return "empty";
    if (queueView === "queue" && pendingCount === 0 && !selectedJob) return "complete";
    if (selectedJob) return "ready";
    return "idle";
  }
  const reviewWorkspaceState = deriveReviewWorkspaceState();

  const handleApprove = (jobId: string, payload: { subject: string; body: string; edited: boolean; editorNote?: string }) => {
    const now = getTimestamp();
    // Production: enqueue ESP/sequencer here; on success webhook, set sentAt + status.
    // Stub: mark sent immediately so the job leaves triage and analytics stay consistent.
    db.transact(
      db.tx.jobs[jobId].update({
        status: "sent_stub",
        draftSubject: payload.subject,
        draftBody: payload.body,
        highlightedSpan: null,
        feedback: { edited: payload.edited, editorNote: payload.editorNote ?? null },
        approvedAt: now,
        sentAt: now,
        updatedAt: now,
        outcome: { replied: false, positive: false },
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
      const payload = (await response.json()) as { error?: string } | null;

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
      overline: "Learning loop",
      title: "How the system learns",
      subtitle: "See how rep judgment and lead replies shape the next checkpoint.",
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
    startTransition(() => {
      setAnalyticsDateRange({
        start,
        end: start > analyticsDateRange.end ? start : analyticsDateRange.end,
      });
    });
  };
  const handleAnalyticsRangeEnd = (end: string) => {
    startTransition(() => {
      setAnalyticsDateRange({
        start: end < analyticsDateRange.start ? end : analyticsDateRange.start,
        end,
      });
    });
  };
  const handleAnalyticsQuickRange = (days: number) => {
    startTransition(() => {
      setAnalyticsDateRange(createDefaultAnalyticsDateRange(new Date(), days));
    });
  };
  const handleOpenReviewJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveView("review");
    setMobileReviewPane("detail");
  };

  useEffect(() => {
    if (activeView !== "review") return;
    const job = selectedJob;
    if (!job || job.status !== "pending_review") return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if ((e.key === "a" || e.key === "A") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleApproveFromDetail(job!.id, {
          subject: job!.draft.subject,
          body: job!.draft.body,
          edited: draftHasEdits,
          editorNote: regenerateNotes[job!.id],
        });
      } else if ((e.key === "s" || e.key === "S") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleArchiveFromDetail(job!.id);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedJob?.id, selectedJob?.status]);

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
                  label: "Learning Loop",
                  sub: "How it learns",
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
