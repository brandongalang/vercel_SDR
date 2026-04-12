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
      badgeClassName: "border-red-200 bg-red-50 text-red-700",
      progressClassName: "bg-red-500",
    };
  }

  if (input.isDone) {
    return {
      headline: "Run completed",
      badgeLabel: "Completed",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      progressClassName: "bg-emerald-500",
    };
  }

  if (input.isRunning) {
    return {
      headline: input.activePhaseLabel
        ? `${input.activePhaseLabel} in progress`
        : "Submitting live run",
      badgeLabel: input.status,
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
      progressClassName: "bg-amber-500",
    };
  }

  return {
    headline: "Ready to stream",
    badgeLabel: "Idle",
    badgeClassName: "border-zinc-200 bg-zinc-50 text-zinc-600",
    progressClassName: "bg-amber-500",
  };
}
