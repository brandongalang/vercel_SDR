import type { ActiveView } from "@/lib/view-context";

export type QueueListState = "error" | "loading" | "empty" | "ready";

export interface QueueStatusCounts {
  pending: number;
  sent: number;
  skipped: number;
}

export interface WorkspaceHeader {
  overline: string;
  title: string;
  subtitle: string;
}

export interface WorkspaceTab {
  id: ActiveView;
  label: string;
  sub: string;
}

export function getReviewHeader(input: {
  isLoading: boolean;
  hasError: boolean;
  hasJobs: boolean;
  pendingCount: number;
  queueStatusCounts: QueueStatusCounts;
}): WorkspaceHeader {
  const overline = "Lead review";
  if (input.isLoading) {
    return {
      overline,
      title: "Loading lead review queue",
      subtitle: "Connecting to InstantDB so you can review the latest drafted leads.",
    };
  }
  if (input.hasError) {
    return {
      overline,
      title: "Lead review unavailable",
      subtitle: "The queue could not load right now. You can still use the other demo surfaces.",
    };
  }
  if (!input.hasJobs) {
    return {
      overline,
      title: "Queue is empty",
      subtitle: "No AI-generated drafts are waiting in review yet.",
    };
  }

  const figures = `${input.queueStatusCounts.pending} pending · ${input.queueStatusCounts.sent} sent · ${input.queueStatusCounts.skipped} skipped`;
  if (input.pendingCount === 0) {
    return { overline, title: "All caught up", subtitle: figures };
  }

  return {
    overline,
    title: `${input.pendingCount} lead${input.pendingCount !== 1 ? "s" : ""} pending review`,
    subtitle: figures,
  };
}

export function getViewHeader(activeView: ActiveView, reviewHeader: WorkspaceHeader): WorkspaceHeader {
  const byView: Record<ActiveView, WorkspaceHeader> = {
    review: reviewHeader,
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
  };

  return byView[activeView];
}

export function getWorkspaceTabs(
  queueListState: QueueListState,
  queueStatusCounts: QueueStatusCounts,
): WorkspaceTab[] {
  const reviewSub =
    queueListState === "loading"
      ? "Loading…"
      : queueListState === "error"
        ? "Unavailable"
        : queueListState === "empty"
          ? "No leads"
          : `${queueStatusCounts.pending} pending · ${queueStatusCounts.sent} sent · ${queueStatusCounts.skipped} skipped`;

  return [
    { id: "review", label: "Lead review", sub: reviewSub },
    { id: "analytics", label: "Analytics", sub: "Benchmarks" },
    { id: "dspy", label: "GEPA loop", sub: "AxGEPA" },
    { id: "debugger", label: "Live Agent", sub: "Live pipeline" },
  ];
}
