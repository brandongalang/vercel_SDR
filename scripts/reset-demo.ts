/**
 * Seed script — pushes demo-snapshot.json + benchmark history jobs to InstantDB.
 * Reads credentials from .env.local via tsx --env-file flag.
 * Usage: npx tsx --env-file .env.local scripts/reset-demo.ts
 */
import { createHash } from "crypto";
import { init_experimental } from "@instantdb/admin";
import { buildBenchmarkHistoryJobsForSeed } from "@/lib/analytics-mock";
import demoSnapshotData from "@/data/demo-snapshot.json";
import { buildSkippedJobsForSeed } from "@/lib/skipped-seed-jobs";
import { toInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import type { OutboundJob } from "@/lib/types";

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
const adminToken = process.env.INSTANT_ADMIN_TOKEN;

if (!appId || !adminToken) {
  console.error(
    "Missing NEXT_PUBLIC_INSTANT_APP_ID or INSTANT_ADMIN_TOKEN in environment.",
  );
  process.exit(1);
}

/** Deterministic UUID v5 so entity IDs are stable across seed runs. */
function stableUUID(shortId: string): string {
  // DNS namespace UUID used as seed
  const NS = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
  const nsBytes = Buffer.from(NS.replace(/-/g, ""), "hex");
  const h = createHash("sha1")
    .update(nsBytes)
    .update(Buffer.from(shortId, "utf8"))
    .digest();
  h[6] = (h[6] & 0x0f) | 0x50; // version 5
  h[8] = (h[8] & 0x3f) | 0x80; // variant 10xx
  const x = h.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

const db = init_experimental({ appId, adminToken });
const snapshotJobs: OutboundJob[] = [
  ...(demoSnapshotData as OutboundJob[]),
  ...(buildBenchmarkHistoryJobsForSeed(new Date()) as OutboundJob[]),
  ...buildSkippedJobsForSeed(new Date()),
];

async function main() {
  console.log(`Seeding ${snapshotJobs.length} jobs (demo + benchmark history + skipped)…`);

  const existing = await db.query({ jobs: {}, pipelineRuns: {} });

  const deleteTxns = [
    ...(existing.jobs ?? []).map((job: { id: string }) =>
      db.tx.jobs[job.id].delete(),
    ),
    ...(existing.pipelineRuns ?? []).map((run: { id: string }) =>
      db.tx.pipelineRuns[run.id].delete(),
    ),
  ];

  if (deleteTxns.length > 0) {
    console.log(
      `Clearing ${existing.jobs?.length ?? 0} jobs, ${existing.pipelineRuns?.length ?? 0} pipelineRuns…`,
    );
    await db.transact(deleteTxns);
  }

  const seedTxns = snapshotJobs.map((job) =>
    db.tx.jobs[stableUUID(job.id)].update(toInstantJobRecord(job)),
  );

  await db.transact(seedTxns);
  console.log(`✓ Seeded ${snapshotJobs.length} jobs successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
