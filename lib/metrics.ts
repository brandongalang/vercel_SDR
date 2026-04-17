import type { AnalyticsDateRange, AngleType, DspyVersionRow, OutboundJob } from "./types";
import { ANGLE_CONFIG } from "./angle-config";
import { getInclusiveDateInputBounds, parseTimestamp } from "./time";

export interface QueueMetricsSummary {
  totalJobs: number;
  pendingReview: number;
  decidedCount: number;
  approvedOrSent: number;
  approvedSendRate: number | null;
  reviewed: number;
  sent: number;
  /** Sent jobs where `feedback` exists (denominator for accept vs edit) */
  withApprovalFeedback: number;
  cleanAcceptCount: number;
  editedCount: number;
  /** % of approvals that shipped the model draft unchanged */
  cleanAcceptRate: number | null;
  /** % of approvals where the rep edited before approve */
  editRate: number | null;
  medianReviewSeconds: number | null;
  sentWithOutcomeTracked: number;
  replyCount: number;
  positiveCount: number;
  replyRate: number | null;
  positiveRate: number | null;
}

export interface AngleMetricsRow {
  angleType: AngleType;
  label: string;
  /** Not pending — triage completed */
  decided: number;
  approved: number;
  cleanAccept: number;
  edited: number;
  archived: number;
  sent: number;
  withOutcome: number;
  replied: number;
  positive: number;
}

function isTerminal(j: OutboundJob) {
  return j.status !== "pending_review";
}

function isApprovedPath(j: OutboundJob) {
  return j.status === "sent_stub";
}

function toPercentage(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
}

function toMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = values.toSorted((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[midpoint - 1] + sorted[midpoint]) / 2) * 10) / 10;
  }

  return Math.round(sorted[midpoint] * 10) / 10;
}

function getDateRangeBounds(range?: AnalyticsDateRange) {
  return getInclusiveDateInputBounds(range);
}

function isInRange(timestamp: string | undefined, bounds: ReturnType<typeof getDateRangeBounds>) {
  if (!bounds) {
    return true;
  }

  const value = parseTimestamp(timestamp);
  return value != null && value >= bounds.start && value <= bounds.end;
}

function createdTimestamp(job: OutboundJob) {
  return job.timestamps.created || job.timestamps.updated;
}

function approvalTimestamp(job: OutboundJob) {
  return job.timestamps.approvedAt || job.timestamps.updated || job.timestamps.created;
}

function archiveTimestamp(job: OutboundJob) {
  return job.timestamps.archivedAt || job.timestamps.updated || job.timestamps.created;
}

function sentTimestamp(job: OutboundJob) {
  return job.timestamps.sentAt || job.timestamps.updated || job.timestamps.approvedAt || job.timestamps.created;
}

function respondedTimestamp(job: OutboundJob) {
  return job.timestamps.respondedAt || job.timestamps.updated || job.timestamps.sentAt || job.timestamps.created;
}

function fallbackReplyLabel(job: OutboundJob) {
  if (job.outcome?.replied != null) {
    return job.outcome.replied;
  }

  return job.outcome == null ? (job.feedback?.positiveReply ?? null) : null;
}

function fallbackPositiveLabel(job: OutboundJob) {
  if (job.outcome?.positive != null) {
    return job.outcome.positive;
  }

  return job.outcome == null ? (job.feedback?.positiveReply ?? null) : null;
}

function hasTrackedOutcomeInRange(job: OutboundJob, bounds: ReturnType<typeof getDateRangeBounds>) {
  return (
    isInRange(sentTimestamp(job), bounds) ||
    isInRange(job.outcome?.replied || job.outcome?.positive ? respondedTimestamp(job) : undefined, bounds)
  );
}

function decisionTimestamp(job: OutboundJob) {
  if (job.status === "reviewed") {
    return archiveTimestamp(job);
  }

  if (isApprovedPath(job)) {
    return approvalTimestamp(job);
  }

  return createdTimestamp(job);
}

export function computeQueueMetrics(jobs: OutboundJob[], dateRange?: AnalyticsDateRange): {
  summary: QueueMetricsSummary;
  byAngle: AngleMetricsRow[];
} {
  const bounds = getDateRangeBounds(dateRange);
  const pendingReview = jobs.filter((j) => j.status === "pending_review" && isInRange(createdTimestamp(j), bounds)).length;
  const approvedOrSent = jobs.filter((j) => isApprovedPath(j) && isInRange(approvalTimestamp(j), bounds)).length;
  const reviewed = jobs.filter((j) => j.status === "reviewed" && isInRange(archiveTimestamp(j), bounds)).length;
  const decidedCount = approvedOrSent + reviewed;
  const approvedSendRate = toPercentage(approvedOrSent, decidedCount);
  const sent = jobs.filter((j) => j.status === "sent_stub" && isInRange(sentTimestamp(j), bounds)).length;

  const approvalPath = jobs.filter((j) => isApprovedPath(j) && isInRange(approvalTimestamp(j), bounds));
  const withFeedback = approvalPath.filter((j) => j.feedback != null);
  const cleanAcceptCount = withFeedback.filter((f) => f.feedback!.edited === false).length;
  const editedCount = withFeedback.filter((f) => f.feedback!.edited === true).length;
  const withApprovalFeedback = withFeedback.length;
  const denom = cleanAcceptCount + editedCount;
  const cleanAcceptRate = toPercentage(cleanAcceptCount, denom);
  const editRate = toPercentage(editedCount, denom);
  const reviewDurations = approvalPath
    .map((job) => {
      const created = parseTimestamp(createdTimestamp(job));
      const approved = parseTimestamp(approvalTimestamp(job));
      if (created == null || approved == null || approved < created) {
        return null;
      }

      return (approved - created) / 1000;
    })
    .filter((value): value is number => value != null);
  const medianReviewSeconds = toMedian(reviewDurations);

  const sentJobs = jobs.filter((j) => j.status === "sent_stub");
  const withOutcome = sentJobs.filter((j) => j.outcome != null && hasTrackedOutcomeInRange(j, bounds));
  const replyCount = withOutcome.filter((j) => j.outcome!.replied && isInRange(respondedTimestamp(j), bounds)).length;
  const positiveCount = withOutcome.filter((j) => j.outcome!.positive && isInRange(respondedTimestamp(j), bounds)).length;
  const o = withOutcome.length;
  const replyRate = toPercentage(replyCount, o);
  const positiveRate = toPercentage(positiveCount, o);

  const summary: QueueMetricsSummary = {
    totalJobs: bounds ? jobs.filter((j) => isInRange(createdTimestamp(j), bounds)).length : jobs.length,
    pendingReview,
    decidedCount,
    approvedOrSent,
    approvedSendRate,
    reviewed,
    sent,
    withApprovalFeedback,
    cleanAcceptCount,
    editedCount,
    cleanAcceptRate,
    editRate,
    medianReviewSeconds,
    sentWithOutcomeTracked: o,
    replyCount,
    positiveCount,
    replyRate,
    positiveRate,
  };

  const angleTypes = Object.keys(ANGLE_CONFIG) as AngleType[];
  const byAngle: AngleMetricsRow[] = angleTypes
    .map((angleType) => {
      const subset = jobs.filter((j) => j.angleType === angleType);
      const decided = subset.filter((j) => isTerminal(j) && isInRange(decisionTimestamp(j), bounds)).length;
      const approved = subset.filter((j) => isApprovedPath(j) && isInRange(approvalTimestamp(j), bounds)).length;
      const apWithFb = subset.filter(
        (j) => isApprovedPath(j) && j.feedback != null && isInRange(approvalTimestamp(j), bounds)
      );
      const cleanAccept = apWithFb.filter((j) => j.feedback!.edited === false).length;
      const edited = apWithFb.filter((j) => j.feedback!.edited === true).length;
      const archived = subset.filter((j) => j.status === "reviewed" && isInRange(archiveTimestamp(j), bounds)).length;
      const sentN = subset.filter((j) => j.status === "sent_stub" && isInRange(sentTimestamp(j), bounds)).length;
      const withO = subset.filter((j) => j.status === "sent_stub" && j.outcome != null && hasTrackedOutcomeInRange(j, bounds));
      const replied = withO.filter((j) => j.outcome!.replied && isInRange(respondedTimestamp(j), bounds)).length;
      const positive = withO.filter((j) => j.outcome!.positive && isInRange(respondedTimestamp(j), bounds)).length;
      return {
        angleType,
        label: ANGLE_CONFIG[angleType].label,
        decided,
        approved,
        cleanAccept,
        edited,
        archived,
        sent: sentN,
        withOutcome: withO.length,
        replied,
        positive,
      };
    })
    .filter(
      (row) =>
        row.decided > 0 ||
        row.sent > 0 ||
        row.withOutcome > 0 ||
        jobs.some(
          (j) =>
            j.angleType === row.angleType &&
            j.status === "pending_review" &&
            isInRange(createdTimestamp(j), bounds)
        )
    );

  return { summary, byAngle };
}

/**
 * Groups jobs by their draftGenerator prompt version and computes the DSPy optimization
 * metrics for each bucket. Optionally filtered to a single angleType.
 *
 * Returns one row per (draftPromptVersion, angleType) combination — plus a global row
 * (angleType: null) for each version showing the aggregate across all angles.
 */
export function computeDspyVersionMetrics(
  jobs: OutboundJob[],
  angleFilter?: AngleType | null,
): DspyVersionRow[] {
  const versionedJobs = jobs.filter((j) => j.promptVersions?.draftGenerator);

  const angleTypes: Array<AngleType | null> =
    angleFilter !== undefined
      ? [angleFilter]
      : [null, ...(Object.keys(ANGLE_CONFIG) as AngleType[])];

  const versions = [
    ...new Set(versionedJobs.map((j) => j.promptVersions!.draftGenerator)),
  ].sort();

  const rows: DspyVersionRow[] = [];

  for (const version of versions) {
    const vJobs = versionedJobs.filter(
      (j) => j.promptVersions!.draftGenerator === version,
    );

    for (const angleType of angleTypes) {
      const subset = angleType == null ? vJobs : vJobs.filter((j) => j.angleType === angleType);

      if (subset.length === 0) continue;

      const approvedPath = subset.filter(isApprovedPath);
      const withFeedback = approvedPath.filter((j) => j.feedback != null);
      const cleanAccept = withFeedback.filter((j) => !j.feedback!.edited).length;
      const edited = withFeedback.filter((j) => j.feedback!.edited).length;
      const fb = cleanAccept + edited;

      const sentJobs = subset.filter(
        (j) =>
          j.status === "sent_stub" &&
          (j.outcome != null || j.feedback?.positiveReply != null),
      );
      const replied = sentJobs.filter((j) => fallbackReplyLabel(j) === true).length;
      const positive = sentJobs.filter((j) => fallbackPositiveLabel(j) === true).length;
      const o = sentJobs.length;

      rows.push({
        draftPromptVersion: version,
        angleType,
        jobCount: subset.length,
        withFeedback: withFeedback.length,
        cleanAccept,
        edited,
        cleanAcceptRate: toPercentage(cleanAccept, fb),
        editRate: toPercentage(edited, fb),
        sentWithOutcome: o,
        replied,
        positive,
        replyRate: toPercentage(replied, o),
        positiveRate: toPercentage(positive, o),
      });
    }
  }

  return rows;
}
