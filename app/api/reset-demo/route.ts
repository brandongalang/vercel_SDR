import { init_experimental } from "@instantdb/admin";
import { buildBenchmarkHistoryJobsForSeed } from "@/lib/analytics-mock";
import demoSnapshotData from "@/data/demo-snapshot.json";
import { buildSkippedJobsForSeed } from "@/lib/skipped-seed-jobs";
import { toInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import {
  getRequiredServerEnv,
  isAuthorizedDemoResetRequest,
  isDemoResetEnabled,
} from "@/lib/server/env";
import type { OutboundJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    if (deleteTxns.length > 0) {
      await db.transact(deleteTxns);
    }

    const seedTxns = snapshotJobs.map((job) =>
      db.tx.jobs[job.id].update(toInstantJobRecord(job)),
    );

    if (seedTxns.length > 0) {
      await db.transact(seedTxns);
    }

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
