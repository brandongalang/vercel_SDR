export interface RunStatusViewModel {
  headline: string;
  badgeLabel: string;
  badgeClassName: string;
  progressClassName: string;
}

export function getRunStatusViewModel(input: {
  activePhaseLabel?: string;
  hasError: boolean;
  isDone: boolean;
  isRunning: boolean;
  status: string;
}): RunStatusViewModel {
  if (input.hasError) {
    return {
      headline: "Run failed",
      badgeLabel: "Failed",
      badgeClassName:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
      progressClassName: "bg-red-500",
    };
  }

  if (input.isDone) {
    return {
      headline: "Run completed",
      badgeLabel: "Completed",
      badgeClassName:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      progressClassName: "bg-emerald-500",
    };
  }

  if (input.isRunning) {
    return {
      headline: input.activePhaseLabel
        ? `${input.activePhaseLabel} in progress`
        : "Submitting live run",
      badgeLabel: input.status,
      badgeClassName:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      progressClassName: "bg-amber-500",
    };
  }

  return {
    headline: "Ready to stream",
    badgeLabel: "Idle",
    badgeClassName: "border-border bg-muted text-muted-foreground",
    progressClassName: "bg-amber-500",
  };
}
