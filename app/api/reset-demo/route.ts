import { authorizeRequest } from "@/lib/server/session";
import { createHash } from "node:crypto";
import { init_experimental } from "@instantdb/admin";
import { buildBenchmarkHistoryJobsForSeed } from "@/lib/analytics-mock";
import demoSnapshotData from "@/lib/db/seeds/demo-snapshot.json";
import { buildSkippedJobsForSeed } from "@/lib/skipped-seed-jobs";
import { toInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import {
  getRequiredServerEnv,
  isAuthorizedDemoResetRequest,
  isDemoResetEnabled,
} from "@/lib/server/env";
import type { OutboundJob } from "@/lib/types";

/**
 * Demo-only route. Replaces InstantDB data with known fixtures for repeatable walkthroughs.
 * This endpoint is optional and guarded by ENABLE_DEMO_RESET + token checks.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toSeededInstantJobId(jobId: string) {
  if (UUID_PATTERN.test(jobId)) {
    return jobId.toLowerCase();
  }

  const bytes = createHash("sha256").update(`seed-job:${jobId}`).digest().subarray(0, 16);

  // Encode local fixture IDs as stable UUIDs so InstantDB can store them.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function transactInChunks(
  db: ReturnType<typeof init_experimental>,
  txns: Parameters<ReturnType<typeof init_experimental>["transact"]>[0],
  chunkSize = 100,
) {
  const txnArray = Array.isArray(txns) ? txns : [txns];
  for (let index = 0; index < txnArray.length; index += chunkSize) {
    const batch = txnArray.slice(index, index + chunkSize);

    if (batch.length > 0) {
      await db.transact(batch);
    }
  }
}

export async function POST(request: Request) {
  const denied = authorizeRequest(request);
  if (denied) return denied;
  if (!isDemoResetEnabled()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAuthorizedDemoResetRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const appId = getRequiredServerEnv("NEXT_PUBLIC_INSTANT_APP_ID");
    const adminToken = getRequiredServerEnv("INSTANT_ADMIN_TOKEN");

    const db = init_experimental({
      appId,
      adminToken,
    });
    const snapshotJobs: OutboundJob[] = [
      ...(demoSnapshotData as OutboundJob[]),
      ...(buildBenchmarkHistoryJobsForSeed(new Date()) as OutboundJob[]),
      ...buildSkippedJobsForSeed(new Date()),
    ];
    const existing = await db.query({ jobs: {}, pipelineRuns: {} });

    const deleteTxns = [
      ...(existing.jobs ?? []).map((job: { id: string }) => db.tx.jobs[job.id].delete()),
      ...(existing.pipelineRuns ?? []).map((run: { id: string }) =>
        db.tx.pipelineRuns[run.id].delete(),
      ),
    ];

    await transactInChunks(db, deleteTxns);

    const seedTxns = snapshotJobs.map((job) =>
      db.tx.jobs[toSeededInstantJobId(job.id)].update(toInstantJobRecord(job)),
    );

    await transactInChunks(db, seedTxns);

    return Response.json({
      ok: true,
      jobsSeeded: snapshotJobs.length,
      jobsCleared: (existing.jobs ?? []).length,
      pipelineRunsCleared: (existing.pipelineRuns ?? []).length,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reset demo workspace",
      },
      { status: 500 },
    );
  }
}
