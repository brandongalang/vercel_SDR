import { startTransition, useCallback, useState } from "react";
import type { AnalyticsDateRange } from "@/lib/types";
import { createDefaultAnalyticsDateRange } from "@/lib/analytics-mock";

export function useAnalyticsState() {
  const [analyticsDateRange, setAnalyticsDateRange] = useState<AnalyticsDateRange>(() =>
    createDefaultAnalyticsDateRange(),
  );

  const handleAnalyticsRangeStart = useCallback(
    (start: string) => {
      startTransition(() => {
        setAnalyticsDateRange((prev) => ({
          start,
          end: start > prev.end ? start : prev.end,
        }));
      });
    },
    [],
  );

  const handleAnalyticsRangeEnd = useCallback(
    (end: string) => {
      startTransition(() => {
        setAnalyticsDateRange((prev) => ({
          start: end < prev.start ? end : prev.start,
          end,
        }));
      });
    },
    [],
  );

  const handleAnalyticsQuickRange = useCallback((days: number) => {
    startTransition(() => {
      setAnalyticsDateRange(createDefaultAnalyticsDateRange(new Date(), days));
    });
  }, []);

  const resetAnalyticsDateRange = useCallback(() => {
    setAnalyticsDateRange(createDefaultAnalyticsDateRange());
  }, []);

  return {
    analyticsDateRange,
    handleAnalyticsRangeStart,
    handleAnalyticsRangeEnd,
    handleAnalyticsQuickRange,
    resetAnalyticsDateRange,
  };
}
