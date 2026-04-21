import { useEffect, useMemo, useState } from "react";
import type { OutboundJob } from "@/lib/types";

type QueueView = "queue" | "history";
type HistoryFilter = "all" | "sent_today" | "skipped";

const QUEUE_VIEW_KEY = "sdr-review-queue-view";
const HISTORY_FILTER_KEY = "sdr-review-history-filter";

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

export function selectNextPendingId(ordered: OutboundJob[], afterJobId: string): string | null {
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

export function useQueueState(
  jobs: OutboundJob[],
  { isLoading, error }: { isLoading: boolean; error: { message: string } | undefined },
) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
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

  const todayStart = (() => {
    const next = new Date();
    next.setHours(0, 0, 0, 0);
    return next.getTime();
  })();

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

  return {
    selectedJobId: resolvedSelectedJobId,
    setSelectedJobId,
    queueView,
    setQueueView,
    historyFilter,
    setHistoryFilter,
    visibleSelectionIds,
    queueStatusCounts,
    queueListState,
  };
}
