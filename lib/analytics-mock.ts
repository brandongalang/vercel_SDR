import { AnalyticsDateRange, AnalyticsSnapshot, PlaybookRow } from "./types";

const baseTopPlays: PlaybookRow[] = [
  { id: "p1", combo: "Product-qualified + Activation help", volume: 142, metricLabel: "Positive Reply", metricValue: 8.2, metricTrend: 1.4, metricType: "positive", note: "Strongest converting pair. Reps rarely edit this because the timing is undeniable in the generated copy." },
  { id: "p2", combo: "Hiring Role + Developer Experience", volume: 84, metricLabel: "Positive Reply", metricValue: 6.7, metricTrend: 0.8, metricType: "positive", note: "Works best when the open role requires platform ownership. Cuts through noise for technical buyers." },
  { id: "p3", combo: "Leadership Post + Routing Docs", volume: 61, metricLabel: "Positive Reply", metricValue: 5.9, metricTrend: 0.2, metricType: "positive", note: "High resonance but lower volume. Requires a public leader actively posting about the pain point." }
];

const baseFrictionPlays: PlaybookRow[] = [
  { id: "f1", combo: "Data provider repull + Event baseline", volume: 92, metricLabel: "Archive Rate", metricValue: 42, metricTrend: 4.1, metricType: "negative", note: "Weakest combination. SDRs archive these drafts because they sound generic and fail to stand out." },
  { id: "f2", combo: "Marketing handoff + Broad web intent", volume: 114, metricLabel: "Edit Rate", metricValue: 58, metricTrend: -2.3, metricType: "negative", note: "Drafts often come off slightly invasive. Reps frequently edit to soften the tone to be less Big Brother." }
];

export const WORKSPACE_ANALYTICS_7D: AnalyticsSnapshot = {
  windowLabel: "Last 7 days",
  generatedSent: 145,
  staticBaselineSent: 130,
  cleanAcceptRate: 52,
  editedAcceptRate: 32,
  archiveRate: 16,
  avgReviewSeconds: 12.4,
  overallResponseRate: 14.2,
  positiveReplyRate: 6.8,
  staticTemplateResponseRate: 6.8,
  responseLift: 7.4,
  trends: {
    cleanAccept: 4.5,
    editedAccept: -2.1,
    archive: -2.4,
    avgReviewSeconds: -1.2,
    overallResponse: 1.2,
    positiveReply: 1.8,
    responseLift: 1.5
  },
  weeklyResponse: [],
  topPlays: baseTopPlays.map(x => ({ ...x, volume: Math.floor(x.volume * 0.3) })),
  frictionPlays: baseFrictionPlays.map(x => ({ ...x, volume: Math.floor(x.volume * 0.3) }))
};

export const WORKSPACE_ANALYTICS_30D: AnalyticsSnapshot = {
  windowLabel: "Last 30 days",
  generatedSent: 428,
  staticBaselineSent: 391,
  cleanAcceptRate: 44,
  editedAcceptRate: 39,
  archiveRate: 17,
  avgReviewSeconds: 15.2,
  overallResponseRate: 12.8,
  positiveReplyRate: 5.4,
  staticTemplateResponseRate: 7.1,
  responseLift: 5.7,
  trends: {
    cleanAccept: 2.1,
    editedAccept: -0.5,
    archive: -1.6,
    avgReviewSeconds: -0.8,
    overallResponse: 0.8,
    positiveReply: 0.5,
    responseLift: 0.9
  },
  weeklyResponse: [],
  topPlays: baseTopPlays,
  frictionPlays: baseFrictionPlays
};

export const WORKSPACE_ANALYTICS_90D: AnalyticsSnapshot = {
  windowLabel: "Last 90 days",
  generatedSent: 1250,
  staticBaselineSent: 1100,
  cleanAcceptRate: 38,
  editedAcceptRate: 42,
  archiveRate: 20,
  avgReviewSeconds: 18.5,
  overallResponseRate: 11.5,
  positiveReplyRate: 4.8,
  staticTemplateResponseRate: 7.3,
  responseLift: 4.2,
  trends: {
    cleanAccept: 8.4,
    editedAccept: -4.5,
    archive: -3.9,
    avgReviewSeconds: -4.2,
    overallResponse: 2.1,
    positiveReply: 1.1,
    responseLift: 2.3
  },
  weeklyResponse: [],
  topPlays: baseTopPlays.map(x => ({ ...x, volume: Math.floor(x.volume * 2.8) })),
  frictionPlays: baseFrictionPlays.map(x => ({ ...x, volume: Math.floor(x.volume * 2.8) }))
};

export const MOCK_ANALYTICS_MAP: Record<string, AnalyticsSnapshot> = {
  "7d": WORKSPACE_ANALYTICS_7D,
  "30d": WORKSPACE_ANALYTICS_30D,
  "90d": WORKSPACE_ANALYTICS_90D
};

const DAY_MS = 86400000;

const SNAPSHOT_WINDOWS = [
  { key: "7d", days: 7 },
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
] as const;

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function createDefaultAnalyticsDateRange(referenceDate = new Date(), days = 30): AnalyticsDateRange {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const start = new Date(end.getTime() - Math.max(days - 1, 0) * DAY_MS);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

function getRangeSpanDays(range: AnalyticsDateRange) {
  const start = parseDateInput(range.start);
  const end = parseDateInput(range.end);

  if (!start || !end || start.getTime() > end.getTime()) {
    return 30;
  }

  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function getNearestAnalyticsSnapshot(
  range: AnalyticsDateRange,
  analyticsMap: Record<string, AnalyticsSnapshot> = MOCK_ANALYTICS_MAP
) {
  const spanDays = getRangeSpanDays(range);
  const nearest = SNAPSHOT_WINDOWS.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.days - spanDays);
    const candidateDistance = Math.abs(candidate.days - spanDays);

    return candidateDistance < bestDistance ? candidate : best;
  });

  return {
    snapshot: analyticsMap[nearest.key],
    snapshotKey: nearest.key,
    snapshotDays: nearest.days,
    spanDays,
  };
}

export function formatAnalyticsDateRangeLabel(range: AnalyticsDateRange) {
  const start = parseDateInput(range.start);
  const end = parseDateInput(range.end);

  if (!start || !end || start.getTime() > end.getTime()) {
    return "Selected range";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
