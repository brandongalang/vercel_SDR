#!/usr/bin/env ts-node
/**
 * scripts/export-dspy-dataset.ts
 *
 * Exports OutboundJob records as JSONL for offline DSPy optimization.
 *
 * Each row contains:
 *   - promptVersions: the prompt version map used to generate the draft
 *   - pipeline inputs (leadInput, signals, angleType)
 *   - draft output (subject, body)
 *   - labels: { edited, editorNote, replied, positiveReply } — the DSPy training signal
 *
 * Usage:
 *   npx ts-node scripts/export-dspy-dataset.ts [options]
 *
 * Options:
 *   --mock              Use local mock data instead of live InstantDB
 *   --angle <type>      Filter to a specific angleType
 *   --min-jobs <n>      Exit early if fewer than n qualifying jobs found (default: 5)
 *   --out <path>        Output file path (default: data/dspy-export-<timestamp>.jsonl)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { OutboundJob } from "../lib/types";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const useMock = args.includes("--mock");
const angleArg = args.includes("--angle") ? args[args.indexOf("--angle") + 1] : null;
const minJobsArg = args.includes("--min-jobs") ? parseInt(args[args.indexOf("--min-jobs") + 1], 10) : 5;
const outArg = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;

// ─── Job loading ──────────────────────────────────────────────────────────────

async function loadJobs(): Promise<OutboundJob[]> {
  if (useMock) {
    console.log("[export-dspy-dataset] Using demo snapshot data (--mock flag)");
    const snapshot = (await import("../data/demo-snapshot.json")).default as OutboundJob[];
    return snapshot;
  }

  // Live path: read from InstantDB via admin SDK
  console.log("[export-dspy-dataset] Loading jobs from InstantDB...");
  const { init_experimental } = await import("@instantdb/admin");

  const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;

  if (!appId || !adminToken) {
    console.error("Missing NEXT_PUBLIC_INSTANT_APP_ID or INSTANT_ADMIN_TOKEN env vars.");
    process.exit(1);
  }

  const db = init_experimental({ appId, adminToken });
  const result = await db.query({ jobs: {} });

  // Map raw InstantDB records back to OutboundJob shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.jobs ?? []).map((raw: any) => ({
    id: raw.id,
    lead: { name: raw.leadName, title: raw.leadTitle },
    company: raw.company,
    play: raw.play,
    whyNow: raw.whyNow,
    researchRun: raw.researchRun,
    angleType: raw.angleType,
    status: raw.status,
    pipelineStage: raw.pipelineStage,
    pipelineStatus: raw.pipelineStatus,
    governance: raw.governance,
    confidence: {
      tier: raw.confidenceTier,
      summary: raw.confidenceSummary,
      reasons: raw.confidenceReasons,
    },
    angle: raw.angle,
    signals: raw.signals ?? [],
    discardedSignals: raw.discardedSignals ?? [],
    draft: {
      subject: raw.draftSubject,
      body: raw.draftBody,
      highlightedSpan: raw.highlightedSpan ?? undefined,
    },
    feedback: raw.feedback ?? undefined,
    outcome: raw.outcome ?? undefined,
    promptVersions: raw.promptVersions ?? undefined,
    timestamps: {
      created: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      updated: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
      approvedAt: raw.approvedAt ? new Date(raw.approvedAt).toISOString() : undefined,
      archivedAt: raw.archivedAt ? new Date(raw.archivedAt).toISOString() : undefined,
      sentAt: raw.sentAt ? new Date(raw.sentAt).toISOString() : undefined,
      respondedAt: raw.respondedAt ? new Date(raw.respondedAt).toISOString() : undefined,
    },
  }));
}

// ─── Row builder ──────────────────────────────────────────────────────────────

interface DspyDatasetRow {
  id: string;
  promptVersions: Record<string, string> | null;
  angleType: string;
  leadInput: {
    leadName: string;
    leadTitle: string;
    company: string;
    play: OutboundJob["play"];
  };
  signals: OutboundJob["signals"];
  draftSubject: string;
  draftBody: string;
  labels: {
    /** True if rep shipped the draft without edits — primary DSPy training signal */
    cleanAccept: boolean;
    /** True if rep edited the draft before approving */
    edited: boolean;
    editorNote: string | null;
    /** True if a tracked send received any reply */
    replied: boolean | null;
    /** True if the lead gave a workable, non-negative reply an SDR can advance. */
    positiveReply: boolean | null;
  };
}

function toDatasetRow(job: OutboundJob): DspyDatasetRow {
  const edited = job.feedback?.edited ?? false;
  const positiveReply = job.outcome?.positive ?? job.feedback?.positiveReply ?? null;
  return {
    id: job.id,
    promptVersions: job.promptVersions ?? null,
    angleType: job.angleType,
    leadInput: {
      leadName: job.lead.name,
      leadTitle: job.lead.title,
      company: job.company,
      play: job.play,
    },
    signals: job.signals,
    draftSubject: job.draft.subject,
    draftBody: job.draft.body,
    labels: {
      cleanAccept: !edited,
      edited,
      editorNote: job.feedback?.editorNote ?? null,
      replied: job.outcome?.replied ?? (positiveReply === true ? true : null),
      positiveReply,
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const allJobs = await loadJobs();

  // Only include jobs with at least feedback (the primary training signal)
  let qualifying = allJobs.filter((j) => j.feedback != null);

  if (angleArg) {
    console.log(`[export-dspy-dataset] Filtering to angleType: ${angleArg}`);
    qualifying = qualifying.filter((j) => j.angleType === angleArg);
  }

  if (qualifying.length < minJobsArg) {
    console.error(
      `[export-dspy-dataset] Only ${qualifying.length} qualifying jobs found (min: ${minJobsArg}). ` +
        `Use --min-jobs to override or collect more labelled examples before running a compile.`,
    );
    process.exit(1);
  }

  const rows = qualifying.map(toDatasetRow);
  const jsonl = rows.map((r) => JSON.stringify(r)).join("\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = outArg ?? join("data", `dspy-export-${timestamp}.jsonl`);

  mkdirSync(join("data"), { recursive: true });
  writeFileSync(outPath, jsonl, "utf8");

  console.log(
    `[export-dspy-dataset] Exported ${rows.length} rows → ${outPath}`,
  );

  // Summary
  const withReplyLabel = rows.filter((r) => r.labels.positiveReply !== null || r.labels.replied !== null).length;
  const cleanAcceptCount = rows.filter((r) => r.labels.cleanAccept).length;
  const positiveCount = rows.filter((r) => r.labels.positiveReply).length;
  console.log(`  Clean accept: ${cleanAcceptCount}/${rows.length}`);
  console.log(`  With reply label: ${withReplyLabel}/${rows.length}`);
  console.log(`  Positive replies: ${positiveCount}/${withReplyLabel || 1}`);

  const withVersion = rows.filter((r) => r.promptVersions != null).length;
  if (withVersion < rows.length) {
    console.warn(
      `  ⚠  ${rows.length - withVersion} jobs missing promptVersions (generated before attribution was added).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
