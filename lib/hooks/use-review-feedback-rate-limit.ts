"use client";

import { useCallback, useEffect, useState } from "react";

const ELIGIBLE_ACTION_COUNT_KEY = "sdr-review-feedback-eligible-count";
const PROMPTED_JOB_IDS_KEY = "sdr-review-feedback-prompted-job-ids";
const PROMPT_INTERVAL = 12;

function readStoredNumber(key: string): number {
  if (typeof window === "undefined") return 0;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;

    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function readStoredPromptedJobIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PROMPTED_JOB_IDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredNumber(key: string, value: number) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures and keep the in-memory counter.
  }
}

function writeStoredPromptedJobIds(jobIds: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PROMPTED_JOB_IDS_KEY, JSON.stringify(jobIds));
  } catch {
    // Ignore storage failures and keep the in-memory prompt history.
  }
}

export function useReviewFeedbackRateLimit() {
  const [eligibleActionCount, setEligibleActionCount] = useState(() =>
    readStoredNumber(ELIGIBLE_ACTION_COUNT_KEY),
  );
  const [promptedJobIds, setPromptedJobIds] = useState<string[]>(() =>
    readStoredPromptedJobIds(),
  );

  useEffect(() => {
    writeStoredNumber(ELIGIBLE_ACTION_COUNT_KEY, eligibleActionCount);
  }, [eligibleActionCount]);

  useEffect(() => {
    writeStoredPromptedJobIds(promptedJobIds);
  }, [promptedJobIds]);

  const shouldPromptForAction = useCallback(
    (jobId: string) =>
      !promptedJobIds.includes(jobId) && (eligibleActionCount + 1) % PROMPT_INTERVAL === 0,
    [eligibleActionCount, promptedJobIds],
  );

  const markPromptShown = useCallback((jobId: string) => {
    setPromptedJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
  }, []);

  const markEligibleActionHandled = useCallback(() => {
    setEligibleActionCount((prev) => prev + 1);
  }, []);

  const reset = useCallback(() => {
    setEligibleActionCount(0);
    setPromptedJobIds([]);
  }, []);

  return {
    eligibleActionCount,
    shouldPromptForAction,
    markPromptShown,
    markEligibleActionHandled,
    reset,
  };
}
