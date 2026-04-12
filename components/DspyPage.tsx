"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import optimizedArtifactData from "@/data/ax-optimized-v3.json";
import { computeDspyVersionMetrics } from "@/lib/metrics";
import {
  getSyntheticDspyJobs,
  getSyntheticPromptSnapshots,
  SYNTHETIC_DSPY_VERSION_V1,
  SYNTHETIC_DSPY_VERSION_V2,
  type SyntheticPromptSnapshot,
} from "@/lib/synthetic-data";
import type { DspyCompileRun, DspyVersionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIMIZATION_TARGET_VERSION = "2026-04-11.draft-generator.v3";

const RUN_STEPS = [
  "Loading v2 training corpus",
  "Scoring drafts against the 0.2 / 0.8 objective",
  "Selecting the highest-signal few-shot demos",
  "Compiling the v3 prompt artifact",
] as const;

type OptimizationStatus = "idle" | "running" | "complete";
type CompareMode = "v2-v3" | "v1-v2";

interface OptimizationArtifact {
  instruction: string;
  demos: Array<{
    id: string;
  }>;
  compiledAt: string;
  optimizer: string;
  mode?: string;
  promptVersionBefore: string;
  promptVersionAfter: string;
  objective: {
    label: string;
    weights: {
      cleanAccept: number;
      workableReply: number;
    };
  };
  evaluation: {
    kind: string;
    basis: string;
    baselineVersionRow: DspyVersionRow;
    projectedVersionRow: DspyVersionRow;
    deltas: {
      cleanAcceptRate?: number;
      editRate?: number;
      replyRate?: number;
      positiveRate?: number;
    };
  };
}

const OPTIMIZATION_ARTIFACT = optimizedArtifactData as OptimizationArtifact;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function compositeScore(
  cleanAcceptRate: number | null,
  workableReplyRate: number | null,
): number | null {
  if (cleanAcceptRate == null || workableReplyRate == null) return null;
  return Math.round((0.2 * cleanAcceptRate + 0.8 * workableReplyRate) * 10) / 10;
}

function shortVersion(v: string) {
  const parts = v.split(".");
  const tag = parts[parts.length - 1];
  const date = new Date(parts[0]);
  if (Number.isNaN(date.getTime())) return v;
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${tag} (${month} ${date.getDate()})`;
}

function fmtPct(n: number | null) {
  return n == null ? "—" : `${n}%`;
}

function DeltaBadge({ value, invert = false }: { value?: number; invert?: boolean }) {
  if (value == null) return null;
  const positive = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
      )}
    >
      {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(value)}pp
    </span>
  );
}

function CompileRunCard({ run }: { run: DspyCompileRun }) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(run.compiledAt));

  const isLatest = run.promptVersionAfter === OPTIMIZATION_TARGET_VERSION;

  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 shadow-sm",
        isLatest ? "border-violet-200 bg-violet-50/40" : "border-zinc-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[13px] font-semibold text-zinc-900">{run.optimizer}</span>
            {isLatest && (
              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-violet-700">
                Latest
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {date} · {run.trainWindowDays}-day train window · {run.jobsUsed} examples
          </p>
          <p className="mt-1 font-mono text-[10px] text-zinc-400">
            {run.promptVersionBefore} → {run.promptVersionAfter}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Clean accept</p>
            <div className="mt-1 flex justify-center">
              <DeltaBadge value={run.deltas.cleanAcceptRate} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Edit rate</p>
            <div className="mt-1 flex justify-center">
              <DeltaBadge value={run.deltas.editRate} invert />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Workable reply</p>
            <div className="mt-1 flex justify-center">
              <DeltaBadge value={run.deltas.positiveRate} />
            </div>
          </div>
          {run.deltas.replyRate != null && (
            <div className="text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Reply rate</p>
              <div className="mt-1 flex justify-center">
                <DeltaBadge value={run.deltas.replyRate} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionTable({
  compileRuns,
  revealedRow,
}: {
  compileRuns: DspyCompileRun[];
  revealedRow: DspyVersionRow | null;
}) {
  const syntheticJobs = useMemo(() => getSyntheticDspyJobs(), []);
  const rows = useMemo(() => computeDspyVersionMetrics(syntheticJobs, null), [syntheticJobs]);
  const v3CompileRun = compileRuns.find(
    (run) => run.promptVersionAfter === OPTIMIZATION_TARGET_VERSION,
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[22%] text-zinc-600">Version</TableHead>
          <TableHead className="text-right text-zinc-600">Jobs</TableHead>
          <TableHead className="text-right text-zinc-600">Clean accept</TableHead>
          <TableHead className="text-right text-zinc-600">Workable reply</TableHead>
          <TableHead className="text-right text-zinc-600">
            Composite
            <span className="ml-1 font-mono text-[9px] font-normal text-zinc-400">
              (0.2×C + 0.8×W)
            </span>
          </TableHead>
          <TableHead className="text-right text-zinc-600">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isLive = row.draftPromptVersion === SYNTHETIC_DSPY_VERSION_V2;
          const score = compositeScore(row.cleanAcceptRate, row.positiveRate);

          return (
            <TableRow
              key={row.draftPromptVersion}
              className={isLive ? "bg-teal-50/50" : undefined}
            >
              <TableCell className="font-mono text-[11px] text-zinc-700">
                <span className="flex items-center gap-2">
                  {shortVersion(row.draftPromptVersion)}
                  {isLive && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-teal-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      Live
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-zinc-700">{row.jobCount}</TableCell>
              <TableCell className="text-right tabular-nums text-zinc-700">
                {row.withFeedback > 0
                  ? `${fmtPct(row.cleanAcceptRate)} (${row.cleanAccept}/${row.withFeedback})`
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-zinc-700">
                {row.sentWithOutcome > 0
                  ? `${fmtPct(row.positiveRate)} (${row.positive}/${row.sentWithOutcome})`
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium text-zinc-700">
                {score != null ? `${score}%` : "—"}
              </TableCell>
              <TableCell className="text-right">
                {isLive ? (
                  <span className="text-[11px] font-medium text-teal-700">Deployed</span>
                ) : (
                  <span className="text-[11px] text-zinc-400">Historical</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}

        {revealedRow ? (
          <TableRow className="bg-violet-50/60">
            <TableCell className="font-mono text-[11px] text-zinc-700">
              <span className="flex items-center gap-2">
                {shortVersion(revealedRow.draftPromptVersion)}
                <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-violet-700">
                  <Sparkles size={9} />
                  Candidate
                </span>
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">{revealedRow.jobCount}</TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">
              {revealedRow.withFeedback > 0
                ? `${fmtPct(revealedRow.cleanAcceptRate)} (${revealedRow.cleanAccept}/${revealedRow.withFeedback})`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">
              {revealedRow.sentWithOutcome > 0
                ? `${fmtPct(revealedRow.positiveRate)} (${revealedRow.positive}/${revealedRow.sentWithOutcome})`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium text-zinc-700">
              {compositeScore(revealedRow.cleanAcceptRate, revealedRow.positiveRate) != null
                ? `${compositeScore(revealedRow.cleanAcceptRate, revealedRow.positiveRate)}%`
                : "—"}
            </TableCell>
            <TableCell className="text-right">
              <span className="text-[11px] font-medium text-violet-700">Ready to evaluate</span>
            </TableCell>
          </TableRow>
        ) : (
          <TableRow className="bg-zinc-50/80 opacity-60">
            <TableCell className="font-mono text-[11px] text-zinc-500">
              <span className="flex items-center gap-2">
                v3 (Apr 11)
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  <Lock size={9} />
                  Pending
                </span>
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-400">
              <span className="flex items-center justify-end gap-1">
                <Lock size={11} className="text-zinc-300" />—
              </span>
            </TableCell>
            <TableCell className="text-right text-zinc-400">
              {v3CompileRun?.deltas.cleanAcceptRate != null ? (
                <span className="text-[11px] italic">
                  projected +{v3CompileRun.deltas.cleanAcceptRate}pp vs v2
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-right text-zinc-400">
              {v3CompileRun?.deltas.positiveRate != null ? (
                <span className="text-[11px] italic">
                  projected +{v3CompileRun.deltas.positiveRate}pp vs v2
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-right text-[11px] italic text-zinc-400">
              Run optimization to unlock
            </TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <Lock size={11} />
                Not revealed
              </span>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function PromptSnapshotCard({
  snapshot,
  role,
}: {
  snapshot: SyntheticPromptSnapshot;
  role: "baseline" | "live" | "optimization-target";
}) {
  const config = {
    baseline: {
      border: "border-zinc-200",
      bg: "bg-white",
      badge: null as string | null,
      badgeClass: "",
    },
    live: {
      border: "border-teal-200",
      bg: "bg-teal-50/30",
      badge: "Current live",
      badgeClass: "border-teal-200 bg-teal-50 text-teal-700",
    },
    "optimization-target": {
      border: "border-violet-200",
      bg: "bg-violet-50/30",
      badge: "Candidate",
      badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    },
  }[role];

  return (
    <div className={cn("rounded-xl border px-5 py-4", config.border, config.bg)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-900">{snapshot.label}</p>
          <p className="font-mono text-[11px] text-zinc-500">{snapshot.releaseDate}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {config.badge && (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em]",
                config.badgeClass,
              )}
            >
              {config.badge}
            </span>
          )}
          {snapshot.badgeText && (
            <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-violet-700">
              {snapshot.badgeText}
            </span>
          )}
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
            {snapshot.fewShotDemos} few-shot demo{snapshot.fewShotDemos !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          Instruction
        </p>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3">
          <p className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-zinc-700">
            {snapshot.instruction}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          Summary
        </p>
        <p className="text-[12px] leading-relaxed text-zinc-600">{snapshot.summary}</p>
      </div>
    </div>
  );
}

function LockedSnapshotCard() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-5 py-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-700">v3</p>
          <p className="font-mono text-[11px] text-zinc-400">Candidate prompt artifact</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
          <Lock size={10} />
          Locked
        </span>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
        <p className="text-[12px] leading-relaxed text-zinc-500">
          Run optimization to reveal the v3 instruction rewrite, selected few-shot demos, and
          projected candidate metrics.
        </p>
      </div>
    </div>
  );
}

function PromptSnapshotViewer({
  hasOptimized,
  optimizedSnapshot,
}: {
  hasOptimized: boolean;
  optimizedSnapshot: SyntheticPromptSnapshot | null;
}) {
  const snapshots = useMemo(() => getSyntheticPromptSnapshots(), []);
  const [compareMode, setCompareMode] = useState<CompareMode>(() =>
    hasOptimized ? "v2-v3" : "v1-v2",
  );

  const v1 = snapshots.find((snapshot) => snapshot.version === SYNTHETIC_DSPY_VERSION_V1);
  const v2 = snapshots.find((snapshot) => snapshot.version === SYNTHETIC_DSPY_VERSION_V2);

  const leftSnapshot = compareMode === "v1-v2" ? v1 : v2;
  const rightSnapshot = compareMode === "v1-v2" ? v2 : optimizedSnapshot;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-[12px] font-medium text-zinc-600">Comparing:</p>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {(
            [
              {
                id: "v2-v3" as CompareMode,
                label: "v2 → v3",
                sub: hasOptimized ? "Live → Candidate" : "Run optimization to unlock",
              },
              { id: "v1-v2" as CompareMode, label: "v1 → v2", sub: "Baseline → Deployed" },
            ] as const
          ).map((option) => {
            const disabled = option.id === "v2-v3" && !hasOptimized;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (!disabled) {
                    setCompareMode(option.id);
                  }
                }}
                disabled={disabled}
                className={cn(
                  "rounded-md px-3 py-1.5 text-left transition-colors",
                  compareMode === option.id
                    ? "bg-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 disabled:text-zinc-400",
                )}
              >
                <p className="flex items-center gap-1 text-[12px] font-medium text-current">
                  {option.label}
                  {disabled && <Lock size={11} />}
                </p>
                <p className="text-[10px] font-mono text-zinc-400">{option.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {leftSnapshot && (
          <PromptSnapshotCard
            snapshot={leftSnapshot}
            role={compareMode === "v2-v3" ? "live" : "baseline"}
          />
        )}
        {compareMode === "v2-v3" ? (
          rightSnapshot ? (
            <PromptSnapshotCard snapshot={rightSnapshot} role="optimization-target" />
          ) : (
            <LockedSnapshotCard />
          )
        ) : (
          rightSnapshot && <PromptSnapshotCard snapshot={rightSnapshot} role="live" />
        )}
      </div>
    </div>
  );
}

export default function DspyPage({ compileRuns }: { compileRuns: DspyCompileRun[] }) {
  const sortedRuns = useMemo(
    () =>
      [...compileRuns].sort(
        (a, b) => new Date(b.compiledAt).getTime() - new Date(a.compiledAt).getTime(),
      ),
    [compileRuns],
  );
  const [optimizationStatus, setOptimizationStatus] = useState<OptimizationStatus>("idle");
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [completedStepCount, setCompletedStepCount] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);

  const hasOptimized = optimizationStatus === "complete";
  const revealedRow = hasOptimized ? OPTIMIZATION_ARTIFACT.evaluation.projectedVersionRow : null;
  const optimizedSnapshot = useMemo(() => {
    const v3 = getSyntheticPromptSnapshots().find(
      (snapshot) => snapshot.version === OPTIMIZATION_TARGET_VERSION,
    );
    if (!v3 || !hasOptimized) {
      return null;
    }

    return {
      ...v3,
      instruction: OPTIMIZATION_ARTIFACT.instruction,
      fewShotDemos: OPTIMIZATION_ARTIFACT.demos.length,
    } satisfies SyntheticPromptSnapshot;
  }, [hasOptimized]);

  const handleRunOptimization = async () => {
    if (optimizationStatus !== "idle") return;

    setRunError(null);
    setCompletedStepCount(0);
    setActiveStepIndex(0);
    setOptimizationStatus("running");

    try {
      for (let index = 0; index < RUN_STEPS.length; index++) {
        setActiveStepIndex(index);
        setCompletedStepCount(index);
        await delay(index === RUN_STEPS.length - 1 ? 1200 : 950);
      }

      setCompletedStepCount(RUN_STEPS.length);
      setActiveStepIndex(null);
      setOptimizationStatus("complete");
    } catch (error) {
      setActiveStepIndex(null);
      setCompletedStepCount(0);
      setOptimizationStatus("idle");
      setRunError(error instanceof Error ? error.message : "Optimization failed");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-50/80">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-6 pb-20 space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Prompt optimization
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-zinc-950">
              DSPy optimization
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-500">
              Offline compile history, version attribution, and prompt snapshot comparison. Version
              metrics are computed from the static v1/v2 synthetic corpus. v3 is revealed only after
              the optimization run finishes.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRunOptimization}
            disabled={optimizationStatus !== "idle"}
            className="min-w-[190px]"
          >
            {optimizationStatus === "running" ? (
              <>
                <Loader2 className="animate-spin" />
                Running optimization…
              </>
            ) : optimizationStatus === "complete" ? (
              <>
                <CheckCircle2 />
                Optimization revealed
              </>
            ) : (
              <>
                <Sparkles />
                Run Optimization
              </>
            )}
          </Button>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-950">Candidate run</h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                Replays the committed v3 artifact scored against the{" "}
                <code className="font-mono text-[11px]">
                  0.2 clean accept + 0.8 workable reply
                </code>{" "}
                objective.
              </p>
            </div>
            {hasOptimized && (
              <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-violet-700">
                <CheckCircle2 size={12} />
                v3 candidate ready
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {RUN_STEPS.map((step, index) => {
              const isCompleted = completedStepCount > index || hasOptimized;
              const isActive = optimizationStatus === "running" && activeStepIndex === index;

              return (
                <div
                  key={step}
                  className={cn(
                    "rounded-xl border px-4 py-3",
                    isCompleted
                      ? "border-emerald-200 bg-emerald-50/60"
                      : isActive
                        ? "border-violet-200 bg-violet-50/60"
                        : "border-zinc-200 bg-zinc-50/80",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-zinc-400" />
                    )}
                    <p className="text-[12px] font-medium text-zinc-800">{step}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {hasOptimized && (
            <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-4">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-violet-600">
                Optimization result
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <DeltaBadge value={OPTIMIZATION_ARTIFACT.evaluation.deltas.cleanAcceptRate} />
                <DeltaBadge value={OPTIMIZATION_ARTIFACT.evaluation.deltas.positiveRate} />
                <DeltaBadge value={OPTIMIZATION_ARTIFACT.evaluation.deltas.replyRate} />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-zinc-600">
                The candidate v3 artifact is now unlocked below with its projected version row and
                the rewritten prompt instruction.
              </p>
            </div>
          )}

          {runError && (
            <p className="mt-4 text-[12px] text-destructive">
              Failed to reveal optimization artifact: {runError}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold text-zinc-950">Compile history</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Each compile run produces a new frozen prompt artifact. Metric deltas are relative to
              the prior version baseline.
            </p>
          </div>
          <div className="space-y-3">
            {sortedRuns.map((run) => (
              <CompileRunCard key={run.id} run={run} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold text-zinc-950">Version performance</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Computed from the static v1/v2 synthetic corpus. Composite score:{" "}
              <code className="font-mono text-[11px]">0.2 × clean accept + 0.8 × workable reply</code>
              . Run the optimization to unlock the candidate v3 row.
            </p>
          </div>
          <VersionTable compileRuns={compileRuns} revealedRow={revealedRow} />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-zinc-400" />
            <h2 className="text-[15px] font-semibold text-zinc-950">Prompt snapshots</h2>
          </div>
          <p className="mb-5 text-[12px] text-zinc-500">
            Frozen prompt artifacts for each version. Before the run, the tab shows the historical
            v1 → v2 progression. After the run, it unlocks the live v2 → candidate v3 comparison.
          </p>
          <PromptSnapshotViewer
            key={hasOptimized ? "optimized" : "historical"}
            hasOptimized={hasOptimized}
            optimizedSnapshot={optimizedSnapshot}
          />
        </section>
      </div>
    </div>
  );
}
