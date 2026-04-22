import syntheticJobsAllData from "@/lib/db/seeds/synthetic-jobs-all.json";
import { ANGLE_CONFIG } from "./angle-config";
import { computeQueueMetrics } from "./metrics";
import { getDateInputRange, parseTimestamp, toDateInputValue } from "./time";
import {
  AnalyticsDateRange,
  AnalyticsSnapshot,
  DspyCompileRun,
  OutboundJob,
} from "./types";

/**
 * Demo-only analytics fixtures.
 * Runtime queue persistence and review state come from InstantDB.
 */
const SYNTHETIC_BENCHMARK_JOBS = syntheticJobsAllData as readonly OutboundJob[];
const DAY_MS = 86400000;

export const ANALYTICS_RANGE_PRESETS = [
  { key: "14d", days: 14, label: "14d" },
  { key: "30d", days: 30, label: "30d" },
  { key: "60d", days: 60, label: "60d" },
] as const;

/** Reply/positive rates are intentionally low — credible for cold outbound SDR (single-digit %). */
const SYNTHETIC_BENCHMARK_COHORTS = [
  { days: 15, volume: 28, source: "earlier", cleanRate: 34, replyRate: 2.5, positiveRate: 0.9, reviewMinutes: 34 },
  { days: 15, volume: 32, source: "earlier", cleanRate: 38, replyRate: 2.8, positiveRate: 1, reviewMinutes: 32 },
  { days: 15, volume: 36, source: "blend", cleanRate: 44, replyRate: 3.2, positiveRate: 1.1, reviewMinutes: 31 },
  { days: 15, volume: 40, source: "blend", cleanRate: 49, replyRate: 3.6, positiveRate: 1.2, reviewMinutes: 29 },
  { days: 15, volume: 46, source: "recent", cleanRate: 57, replyRate: 4.1, positiveRate: 1.5, reviewMinutes: 27 },
  { days: 15, volume: 52, source: "recent", cleanRate: 61, replyRate: 4.5, positiveRate: 1.7, reviewMinutes: 26 },
  { days: 15, volume: 58, source: "recent", cleanRate: 67, replyRate: 4.9, positiveRate: 1.9, reviewMinutes: 24 },
  { days: 15, volume: 66, source: "recent", cleanRate: 73, replyRate: 5.4, positiveRate: 2.2, reviewMinutes: 22 },
] as const;

function formatRangeLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function buildDateRange(days: number, referenceDate = new Date()): AnalyticsDateRange {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const start = new Date(end.getTime() - Math.max(days - 1, 0) * DAY_MS);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

export function createDefaultAnalyticsDateRange(referenceDate = new Date(), days = 30): AnalyticsDateRange {
  return buildDateRange(days, referenceDate);
}

export function getAnalyticsDateRangeSpanDays(range: AnalyticsDateRange) {
  const parsedRange = getDateInputRange(range);

  if (!parsedRange) {
    return 30;
  }

  const { start, end } = parsedRange;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function getRangeBounds(range: AnalyticsDateRange): { start: Date; end: Date } {
  const parsedRange = getDateInputRange(range);

  if (!parsedRange) {
    const fallback = buildDateRange(30);
    return getRangeBounds(fallback);
  }

  return parsedRange;
}

function getPreviousDateRange(range: AnalyticsDateRange) {
  const bounds = getRangeBounds(range);
  const spanDays = getAnalyticsDateRangeSpanDays(range);
  const previousEnd = new Date(bounds.start.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (spanDays - 1) * DAY_MS);

  return {
    start: toDateInputValue(previousStart),
    end: toDateInputValue(previousEnd),
  };
}

function withClock(date: Date, hour: number, minute: number) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function percentageCount(volume: number, rate: number) {
  return Math.max(0, Math.min(volume, Math.round((volume * rate) / 100)));
}

function cloneBenchmarkJobFromTemplate(
  template: OutboundJob,
  id: string,
  createdAt: Date,
  reviewMinutes: number,
  edited: boolean,
  replied: boolean,
  positive: boolean
) {
  const approvedAt = new Date(createdAt.getTime() + reviewMinutes * 60_000);
  const sentAt = new Date(approvedAt.getTime() + (edited ? 18 : 11) * 60_000);
  const respondedAt = replied
    ? new Date(sentAt.getTime() + (positive ? 2 : 3) * DAY_MS + (reviewMinutes % 5) * 60_000)
    : undefined;

  return {
    ...template,
    id,
    status: "sent_stub",
    feedback: {
      edited,
      editorNote: edited ? "Adjusted proof point order before send." : undefined,
      positiveReply: replied ? positive : false,
    },
    outcome: {
      replied,
      positive: replied ? positive : false,
    },
    timestamps: {
      created: createdAt.toISOString(),
      updated: (respondedAt ?? sentAt).toISOString(),
      approvedAt: approvedAt.toISOString(),
      sentAt: sentAt.toISOString(),
      respondedAt: respondedAt?.toISOString(),
    },
  };
}

/**
 * Historical `sent_stub` jobs for InstantDB seeding and analytics.
 * Same shape as production pipeline output.
 */
export function buildBenchmarkHistoryJobsForSeed(referenceDate = new Date()) {
  return getBackfilledSyntheticBenchmarkJobs(referenceDate);
}

function getBackfilledSyntheticBenchmarkJobs(referenceDate = new Date()) {
  const benchmarkEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const totalDays = SYNTHETIC_BENCHMARK_COHORTS.reduce((sum, cohort) => sum + cohort.days, 0);
  const benchmarkStart = new Date(benchmarkEnd.getTime() - (totalDays - 1) * DAY_MS);

  const byVersion = SYNTHETIC_BENCHMARK_JOBS.reduce<Record<string, OutboundJob[]>>((acc, job) => {
    const version = job.promptVersions?.draftGenerator ?? "unknown";
    acc[version] ??= [];
    acc[version].push(job);
    return acc;
  }, {});

  const versions = Object.keys(byVersion).sort();
  const earlierJobs = byVersion[versions[0]] ?? [];
  const recentJobs = byVersion[versions[versions.length - 1]] ?? [];
  const blendedJobs = [...earlierJobs.slice(0, Math.ceil(earlierJobs.length / 2)), ...recentJobs];

  let dayCursor = 0;

  return SYNTHETIC_BENCHMARK_COHORTS.flatMap((cohort, cohortIndex) => {
    const cohortStart = new Date(benchmarkStart.getTime() + dayCursor * DAY_MS);
    dayCursor += cohort.days;

    const cleanCount = percentageCount(cohort.volume, cohort.cleanRate);
    const replyCount = percentageCount(cohort.volume, cohort.replyRate);
    const positiveCount = Math.min(replyCount, percentageCount(cohort.volume, cohort.positiveRate));
    const pool =
      cohort.source === "earlier"
        ? earlierJobs
        : cohort.source === "recent"
          ? recentJobs
          : blendedJobs;
    const cohortPoolSize = Math.min(pool.length, cohort.source === "recent" ? 8 : 10);
    const cohortPoolStart = (cohortIndex * 4) % pool.length;
    const cohortPool = Array.from({ length: cohortPoolSize }, (_, poolIndex) => (
      pool[(cohortPoolStart + poolIndex) % pool.length]
    ));

    return Array.from({ length: cohort.volume }, (_, index) => {
      const template = cohortPool[index % cohortPool.length];
      const dayOffset = Math.round((index * Math.max(cohort.days - 1, 0)) / Math.max(cohort.volume - 1, 1));
      const createdAt = withClock(
        new Date(cohortStart.getTime() + dayOffset * DAY_MS),
        9 + ((index + cohortIndex) % 6),
        (index * 11) % 60,
      );
      const reviewMinutes = Math.max(12, cohort.reviewMinutes + ((index % 3) - 1) * 2);
      const edited = index >= cleanCount;
      const replied = index < replyCount;
      const positive = index < positiveCount;

      return cloneBenchmarkJobFromTemplate(
        template,
        `benchmark-${cohortIndex + 1}-${index + 1}-${template.id}`,
        createdAt,
        reviewMinutes,
        edited,
        replied,
        positive,
      );
    });
  }) as OutboundJob[];
}

function toRateDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) {
    return null;
  }

  return Math.round((current - previous) * 10) / 10;
}

function rateDeltaOrUndef(current: number | null, previous: number | null): number | undefined {
  const d = toRateDelta(current, previous);
  return d == null ? undefined : d;
}

function toCountDelta(current: number, previous: number) {
  return current - previous;
}

function buildTrendSeries(
  range: AnalyticsDateRange,
  benchmarkJobs: OutboundJob[]
) {
  const currentBounds = getRangeBounds(range);
  const spanDays = getAnalyticsDateRangeSpanDays(range);
  const periodCount = 4;

  return Array.from({ length: periodCount }, (_, index) => {
    const end = new Date(currentBounds.end);
    end.setDate(end.getDate() - 14 * (periodCount - 1 - index));
    const pointRange = buildDateRange(spanDays, end);
    const previousRange = getPreviousDateRange(pointRange);
    const currentSummary = computeQueueMetrics(benchmarkJobs, pointRange).summary;
    const previousSummary = computeQueueMetrics(benchmarkJobs, previousRange).summary;
    const bounds = getRangeBounds(pointRange);

    return {
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(bounds.end),
      responseLift: toRateDelta(currentSummary.replyRate, previousSummary.replyRate) ?? 0,
      cleanAcceptRate: currentSummary.cleanAcceptRate ?? 0,
      generatedSent: currentSummary.sent,
      medianReviewSeconds: currentSummary.medianReviewSeconds ?? 0,
    };
  });
}

function buildPlayRows(
  jobs: OutboundJob[],
  range: AnalyticsDateRange,
  tone: "positive" | "negative"
) {
  const bounds = getRangeBounds(range);
  const startMs = bounds.start.getTime();
  const endMs = new Date(
    bounds.end.getFullYear(),
    bounds.end.getMonth(),
    bounds.end.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  const scoped = jobs.filter((job) => {
    const sentAt = parseTimestamp(job.timestamps.sentAt || job.timestamps.approvedAt || job.timestamps.created);
    return sentAt != null && sentAt >= startMs && sentAt <= endMs;
  });

  const byCombo = scoped.reduce<
    Map<
      string,
      {
        id: string;
        combo: string;
        volume: number;
        replied: number;
        positive: number;
        clean: number;
        edited: number;
      }
    >
  >((acc, job) => {
    const combo = `${ANGLE_CONFIG[job.angleType].label} + ${job.play.label}`;
    const current = acc.get(combo) ?? {
      id: `${job.angleType}-${job.play.type}`,
      combo,
      volume: 0,
      replied: 0,
      positive: 0,
      clean: 0,
      edited: 0,
    };

    current.volume += 1;
    if (job.outcome?.replied) {
      current.replied += 1;
    }
    if (job.outcome?.positive || job.feedback?.positiveReply) {
      current.positive += 1;
    }
    if (job.feedback?.edited === false) {
      current.clean += 1;
    }
    if (job.feedback?.edited === true) {
      current.edited += 1;
    }
    acc.set(combo, current);
    return acc;
  }, new Map());

  const normalized = [...byCombo.values()]
    .filter((row) => row.volume >= 2)
    .map((row) => {
      const replyRate = row.volume > 0 ? Math.round((row.replied / row.volume) * 1000) / 10 : 0;
      const positiveRate = row.volume > 0 ? Math.round((row.positive / row.volume) * 1000) / 10 : 0;
      const cleanRate = row.volume > 0 ? Math.round((row.clean / row.volume) * 1000) / 10 : 0;
      const editRate = row.volume > 0 ? Math.round((row.edited / row.volume) * 1000) / 10 : 0;

      return {
        ...row,
        replyRate,
        positiveRate,
        cleanRate,
        editRate,
      };
    });

  const ranked =
    tone === "positive"
      ? normalized
          .filter((row) => row.replyRate > 0)
          .sort((a, b) => b.replyRate - a.replyRate || b.cleanRate - a.cleanRate || b.volume - a.volume)
      : normalized
          .filter((row) => row.editRate > 0)
          .sort((a, b) => b.editRate - a.editRate || a.replyRate - b.replyRate || b.volume - a.volume);

  return ranked.slice(0, tone === "positive" ? 3 : 2).map((row) => ({
    id: row.id,
    combo: row.combo,
    volume: row.volume,
    metricLabel: tone === "positive" ? "Reply rate" : "Edit rate",
    metricValue: tone === "positive" ? row.replyRate : row.editRate,
    metricType: tone,
    note:
      tone === "positive"
        ? `${row.replied} of ${row.volume} sends got a reply. ${row.clean} shipped without edits.`
        : `${row.edited} of ${row.volume} sends were edited before send, and only ${row.positive} drew a positive reply.`,
  }));
}

function buildSnapshotFromJobSummaries(
  range: AnalyticsDateRange,
  jobs: OutboundJob[],
  currentSummary: ReturnType<typeof computeQueueMetrics>["summary"],
  previousSummary: ReturnType<typeof computeQueueMetrics>["summary"],
): AnalyticsSnapshot {
  const currentBounds = getRangeBounds(range);
  const previousRange = getPreviousDateRange(range);
  const previousBounds = getRangeBounds(previousRange);

  return {
    windowLabel: formatRangeLabel(currentBounds.start, currentBounds.end),
    comparisonWindowLabel: formatRangeLabel(previousBounds.start, previousBounds.end),
    generatedSent: currentSummary.sent,
    comparisonSent: previousSummary.sent,
    cleanAcceptRate: currentSummary.cleanAcceptRate ?? 0,
    editedAcceptRate: currentSummary.editRate ?? 0,
    archiveRate:
      currentSummary.decidedCount > 0 && currentSummary.reviewed > 0
        ? Math.round((currentSummary.reviewed / currentSummary.decidedCount) * 1000) / 10
        : 0,
    medianReviewSeconds: currentSummary.medianReviewSeconds ?? 0,
    overallResponseRate: currentSummary.replyRate ?? 0,
    positiveReplyRate: currentSummary.positiveRate ?? 0,
    comparisonResponseRate: previousSummary.replyRate ?? 0,
    responseLift: toRateDelta(currentSummary.replyRate, previousSummary.replyRate) ?? 0,
    trends: {
      generatedSent: toCountDelta(currentSummary.sent, previousSummary.sent),
      cleanAccept: rateDeltaOrUndef(currentSummary.cleanAcceptRate, previousSummary.cleanAcceptRate),
      editedAccept: rateDeltaOrUndef(currentSummary.editRate, previousSummary.editRate),
      archive: rateDeltaOrUndef(
        currentSummary.decidedCount > 0 ? (currentSummary.reviewed / currentSummary.decidedCount) * 100 : 0,
        previousSummary.decidedCount > 0 ? (previousSummary.reviewed / previousSummary.decidedCount) * 100 : 0,
      ),
      medianReviewSeconds:
        currentSummary.medianReviewSeconds != null && previousSummary.medianReviewSeconds != null
          ? Math.round((currentSummary.medianReviewSeconds - previousSummary.medianReviewSeconds) * 10) / 10
          : undefined,
      overallResponse: rateDeltaOrUndef(currentSummary.replyRate, previousSummary.replyRate),
      positiveReply: rateDeltaOrUndef(currentSummary.positiveRate, previousSummary.positiveRate),
    },
    trendSeries: buildTrendSeries(range, jobs),
    topPlays: buildPlayRows(jobs, range, "positive"),
    frictionPlays: buildPlayRows(jobs, range, "negative"),
  };
}

/** Benchmark analytics from the same `jobs` array InstantDB provides (production path). */
export function getAnalyticsSnapshotFromJobs(jobs: OutboundJob[], range: AnalyticsDateRange) {
  const previousRange = getPreviousDateRange(range);
  const currentSummary = computeQueueMetrics(jobs, range).summary;
  const previousSummary = computeQueueMetrics(jobs, previousRange).summary;
  const snapshot = buildSnapshotFromJobSummaries(range, jobs, currentSummary, previousSummary);

  return {
    snapshot,
    snapshotDays: getAnalyticsDateRangeSpanDays(range),
    spanDays: getAnalyticsDateRangeSpanDays(range),
  };
}

export function getAnalyticsSnapshotForRange(
  range: AnalyticsDateRange,
  referenceDate = new Date()
) {
  const currentBounds = getRangeBounds(range);
  const benchmarkReferenceDate = currentBounds.end ?? referenceDate;
  const benchmarkJobs = getBackfilledSyntheticBenchmarkJobs(benchmarkReferenceDate);
  const currentSummary = computeQueueMetrics(benchmarkJobs, range).summary;
  const previousRange = getPreviousDateRange(range);
  const previousSummary = computeQueueMetrics(benchmarkJobs, previousRange).summary;
  const snapshot = buildSnapshotFromJobSummaries(range, benchmarkJobs, currentSummary, previousSummary);

  return {
    snapshot,
    snapshotDays: getAnalyticsDateRangeSpanDays(range),
    spanDays: getAnalyticsDateRangeSpanDays(range),
  };
}

export function formatAnalyticsDateRangeLabel(range: AnalyticsDateRange) {
  const parsedRange = getDateInputRange(range);

  if (!parsedRange) {
    return "Selected range";
  }

  return formatRangeLabel(parsedRange.start, parsedRange.end);
}

/**
 * Mock DSPy compile run history.
 * Represents the offline optimization loop: each entry is one compile event
 * where a DSPy optimizer produced a new frozen prompt artifact.
 * Metric deltas are relative to the previous version.
 */
export const MOCK_DSPY_COMPILE_RUNS: DspyCompileRun[] = [
  {
    id: "compile-v1-to-v2",
    compiledAt: "2026-02-17",
    optimizer: "BootstrapFewShot",
    promptVersionBefore: "2026-01-20.draft-generator.v1",
    promptVersionAfter: "2026-02-17.draft-generator.v2",
    trainWindowDays: 28,
    jobsUsed: 64,
    deltas: {
      cleanAcceptRate: +9.4,
      editRate: -9.4,
      positiveRate: +0.5,
    },
  },
  {
    id: "compile-v2-to-v3",
    compiledAt: "2026-04-11",
    optimizer: "GEPA",
    promptVersionBefore: "2026-02-17.draft-generator.v2",
    promptVersionAfter: "2026-04-11.draft-generator.v3",
    trainWindowDays: 53,
    jobsUsed: 118,
    deltas: {
      cleanAcceptRate: +11.2,
      editRate: -11.2,
      positiveRate: +0.7,
      replyRate: +0.4,
    },
  },
];
