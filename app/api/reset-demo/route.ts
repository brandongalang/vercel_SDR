import { init_experimental } from "@instantdb/admin";
import demoSnapshotData from "@/data/demo-snapshot.json";
import { toInstantJobRecord } from "@/lib/pipeline/persistence";
import type { OutboundJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTANT_APP_ID =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ?? "52c6a678-6f76-4082-ae80-b3c7a65a9216";

export async function POST() {
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;

  if (!adminToken) {
    return Response.json(
      { error: "Missing INSTANT_ADMIN_TOKEN" },
      { status: 500 },
    );
  }

  try {
    const db = init_experimental({
      appId: INSTANT_APP_ID,
      adminToken,
    });
    const snapshotJobs = demoSnapshotData as OutboundJob[];
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
