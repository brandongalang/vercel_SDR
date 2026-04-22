import syntheticJobsAll from "@/lib/db/seeds/synthetic-jobs-all.json";
import type { OutboundJob } from "./types";

const DAY_MS = 86400000;
const POOL = syntheticJobsAll as OutboundJob[];

/**
 * Synthetic skipped leads for InstantDB seeding — `status: reviewed` with `archivedAt`
 * so the queue "Skipped" section and metrics match production.
 */
export function buildSkippedJobsForSeed(referenceDate = new Date(), count = 28): OutboundJob[] {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  return Array.from({ length: count }, (_, i) => {
    const template = POOL[i % POOL.length];
    const dayOffset = 20 + Math.floor(i / 2) + (i % 7);
    const createdAt = new Date(end.getTime() - dayOffset * DAY_MS);
    createdAt.setHours(10 + (i % 6), (i * 13) % 60, 0, 0);
    const reviewMinutes = 12 + (i % 45);
    const archivedAt = new Date(createdAt.getTime() + reviewMinutes * 60_000);

    return {
      ...template,
      id: `seed-skipped-${String(i + 1).padStart(3, "0")}`,
      status: "reviewed" as const,
      feedback: undefined,
      outcome: undefined,
      timestamps: {
        created: createdAt.toISOString(),
        updated: archivedAt.toISOString(),
        archivedAt: archivedAt.toISOString(),
      },
    };
  });
}
