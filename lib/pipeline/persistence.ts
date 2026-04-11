import { id as generateId, init_experimental } from "@instantdb/admin";
import {
  clonePipelineRunAudit,
  completePipelineAuditPhase,
  getPipelinePhase,
  startPipelineAuditPhase,
  type PipelineRunAudit,
} from "@/lib/pipeline/run-job";
import type { OutboundJob } from "@/lib/types";

const INSTANT_APP_ID =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ?? "52c6a678-6f76-4082-ae80-b3c7a65a9216";

function getAdminDb() {
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;

  if (!adminToken) {
    throw new Error("Missing INSTANT_ADMIN_TOKEN");
  }

  return init_experimental({
    appId: INSTANT_APP_ID,
    adminToken,
  });
}

function toEpochMilliseconds(value?: string) {
  return value ? new Date(value).getTime() : null;
}

function finalizeSuccessfulAudit(audit: PipelineRunAudit, jobId: string) {
  const finalAudit = clonePipelineRunAudit(audit);

  if (getPipelinePhase(finalAudit, "persist").status === "pending") {
    startPipelineAuditPhase(finalAudit, "persist");
  }

  if (getPipelinePhase(finalAudit, "persist").status !== "completed") {
    completePipelineAuditPhase(finalAudit, "persist");
  }

  if (getPipelinePhase(finalAudit, "done").status === "pending") {
    startPipelineAuditPhase(finalAudit, "done");
  }

  finalAudit.jobId = jobId;

  if (getPipelinePhase(finalAudit, "done").status !== "completed") {
    completePipelineAuditPhase(finalAudit, "done");
  }

  finalAudit.currentPhase = "done";
  finalAudit.status = "completed";
  finalAudit.completedAt = getPipelinePhase(finalAudit, "done").completedAt;

  return finalAudit;
}

function finalizeFailedAudit(audit: PipelineRunAudit) {
  const finalAudit = clonePipelineRunAudit(audit);

  if (!finalAudit.completedAt) {
    finalAudit.completedAt = new Date().toISOString();
  }

  finalAudit.status = "failed";

  return finalAudit;
}

export function toInstantJobRecord(job: OutboundJob) {
  return {
    leadName: job.lead.name,
    leadTitle: job.lead.title,
    company: job.company,
    play: job.play,
    whyNow: job.whyNow,
    pipelineStatus: job.pipelineStatus ?? "completed",
    angleType: job.angleType,
    status: job.status,
    pipelineStage: job.pipelineStage,
    governance: job.governance,
    confidenceTier: job.confidence.tier,
    confidenceSummary: job.confidence.summary,
    confidenceReasons: job.confidence.reasons ?? [],
    angle: job.angle,
    draftSubject: job.draft.subject,
    draftBody: job.draft.body,
    highlightedSpan: job.draft.highlightedSpan ?? null,
    signals: job.signals,
    discardedSignals: job.discardedSignals ?? [],
    researchRun: job.researchRun,
    feedback: job.feedback ?? null,
    outcome: job.outcome ?? null,
    promptVersions: job.promptVersions ?? null,
    createdAt: new Date(job.timestamps.created).getTime(),
    updatedAt: new Date(job.timestamps.updated).getTime(),
    approvedAt: toEpochMilliseconds(job.timestamps.approvedAt),
    archivedAt: toEpochMilliseconds(job.timestamps.archivedAt),
    sentAt: toEpochMilliseconds(job.timestamps.sentAt),
    respondedAt: toEpochMilliseconds(job.timestamps.respondedAt),
  };
}

function toInstantPipelineRunRecord(audit: PipelineRunAudit, pipelineRunId: string) {
  const createdAt = toEpochMilliseconds(audit.startedAt) ?? Date.now();
  const updatedAt = toEpochMilliseconds(audit.completedAt) ?? createdAt;

  return {
    pipelineRunId,
    leadInput: audit.leadInput,
    currentPhase: audit.currentPhase,
    finalStatus: audit.status,
    phases: audit.phases,
    traces: audit.traces,
    promptVersions: audit.promptVersions,
    modelMetadata: audit.modelMetadata,
    error: audit.error ?? null,
    jobId: audit.jobId ?? null,
    startedAt: createdAt,
    completedAt: toEpochMilliseconds(audit.completedAt),
    createdAt,
    updatedAt,
  };
}

type PersistPipelineRunInput =
  | {
      audit: PipelineRunAudit;
      job: Omit<OutboundJob, "id">;
    }
  | {
      audit: PipelineRunAudit;
      job?: undefined;
    };

export async function persistPipelineRun(input: {
  audit: PipelineRunAudit;
  job: Omit<OutboundJob, "id">;
}): Promise<{
  pipelineRunId: string;
  audit: PipelineRunAudit;
  job: OutboundJob;
}>;
export async function persistPipelineRun(input: {
  audit: PipelineRunAudit;
  job?: undefined;
}): Promise<{
  pipelineRunId: string;
  audit: PipelineRunAudit;
}>;
export async function persistPipelineRun(input: PersistPipelineRunInput) {
  const adminDb = getAdminDb();
  const pipelineRunId = generateId();

  if (!input.job) {
    const finalAudit = finalizeFailedAudit(input.audit);

    await adminDb.transact([
      adminDb.tx.pipelineRuns[pipelineRunId].update(
        toInstantPipelineRunRecord(finalAudit, pipelineRunId),
      ),
    ]);

    return {
      pipelineRunId,
      audit: finalAudit,
    };
  }

  const jobId = generateId();
  const job: OutboundJob = {
    id: jobId,
    ...input.job,
    promptVersions: input.audit.promptVersions,
  };
  const finalAudit = finalizeSuccessfulAudit(input.audit, jobId);

  await adminDb.transact([
    adminDb.tx.jobs[jobId].update(toInstantJobRecord(job)),
    adminDb.tx.pipelineRuns[pipelineRunId].update(
      toInstantPipelineRunRecord(finalAudit, pipelineRunId),
    ),
  ]);

  return {
    pipelineRunId,
    audit: finalAudit,
    job,
  };
}
