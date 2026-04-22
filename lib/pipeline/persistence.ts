import { id as generateId, init_experimental } from "@instantdb/admin";
import { toInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import {
  clonePipelineRunAudit,
  completePipelineAuditPhase,
  getPipelinePhase,
  startPipelineAuditPhase,
  type PipelineRunAudit,
} from "@/lib/pipeline/run-job";
import { getRequiredServerEnv } from "@/lib/server/env";
import { nowIso, parseTimestamp } from "@/lib/time";
import type { OutboundJob } from "@/lib/types";

/**
 * Runtime persistence seam for generated jobs + pipeline runs.
 * Use this as the canonical write path for non-demo behavior.
 */
const INSTANT_APP_ID = getRequiredServerEnv("NEXT_PUBLIC_INSTANT_APP_ID");

function getAdminDb() {
  const adminToken = getRequiredServerEnv("INSTANT_ADMIN_TOKEN");

  return init_experimental({
    appId: INSTANT_APP_ID,
    adminToken,
  });
}

function toEpochMilliseconds(value?: string): number | null {
  return parseTimestamp(value);
}

function finalizeSuccessfulAudit(audit: PipelineRunAudit, jobId: string): PipelineRunAudit {
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

function finalizeFailedAudit(audit: PipelineRunAudit): PipelineRunAudit {
  const finalAudit = clonePipelineRunAudit(audit);

  if (!finalAudit.completedAt) {
    finalAudit.completedAt = nowIso();
  }

  finalAudit.status = "failed";

  return finalAudit;
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
