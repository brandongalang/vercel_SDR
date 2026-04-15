"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import { CompileRunCard } from "@/components/dspy/compile-run-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtPct, shortVersion } from "@/components/dspy/shared";
import optimizedArtifactData from "@/data/ax-optimized-v3.json";
import { computeDspyVersionMetrics } from "@/lib/metrics";
import {
  DRAFT_GENERATOR_V2_ARTIFACT,
  type DraftGeneratorPromptDemo,
} from "@/lib/pipeline/prompt-artifacts";
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

export type DspyOptimizationState = {
  optimizationStatus: OptimizationStatus;
  activeStepIndex: number | null;
  completedStepCount: number;
  runError: string | null;
};

export const INITIAL_DSPY_OPTIMIZATION_STATE: DspyOptimizationState = {
  optimizationStatus: "idle",
  activeStepIndex: null,
  completedStepCount: 0,
  runError: null,
};

interface OptimizationArtifact {
  instruction: string;
  demos: DraftGeneratorPromptDemo[];
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

/** Full runtime prompt as one markdown document (instruction + summary + few-shots), for display as plain text. */
function buildDraftGeneratorPromptMarkdown(input: {
  label: string;
  releaseDate: string;
  packageLabel: string;
  summary: string;
  instruction: string;
  demos: DraftGeneratorPromptDemo[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.label}`);
  lines.push("");
  lines.push(`_${input.releaseDate} · ${input.packageLabel}_`);
  lines.push("");
  if (input.summary.trim()) {
    lines.push(`> ${input.summary.trim().replace(/\n/g, "\n> ")}`);
    lines.push("");
  }
  lines.push(`## Instruction`);
  lines.push("");
  lines.push(input.instruction.trim());
  lines.push("");
  lines.push(`## Few-shot examples`);
  lines.push("");
  if (input.demos.length === 0) {
    lines.push(`*(none — the model receives the instruction and live lead context only.)*`);
  } else {
    for (let i = 0; i < input.demos.length; i++) {
      const demo = input.demos[i];
      lines.push(`### Example ${i + 1}`);
      lines.push("");
      lines.push(`**Signal:** ${demo.topSignal.label}`);
      lines.push("");
      lines.push(`**Lead context:** ${demo.leadContext}`);
      lines.push("");
      lines.push(`**Subject:** ${demo.draft.subject}`);
      lines.push("");
      lines.push(demo.draft.body.trim());
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd();
}

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

function CompileFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-zinc-900">{value}</p>
    </div>
  );
}

function VersionTable({
  rows,
  candidateUnlocked,
}: {
  rows: DspyVersionRow[];
  candidateUnlocked: boolean;
}) {
  return (
    <div className="-mx-1 overflow-x-auto sm:mx-0">
    <Table className="min-w-[680px]">
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
        <TableRow className={candidateUnlocked ? "bg-violet-50/60" : "bg-zinc-50/80 opacity-60"}>
          <TableCell className={cn("font-mono text-[11px]", candidateUnlocked ? "text-zinc-700" : "text-zinc-500")}>
            <span className="flex items-center gap-2">
              v3 (Apr 11)
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider",
                  candidateUnlocked
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-zinc-200 bg-zinc-100 text-zinc-500",
                )}
              >
                {candidateUnlocked ? <Sparkles size={9} /> : <Lock size={9} />}
                {candidateUnlocked ? "Artifact revealed" : "Pending"}
              </span>
            </span>
          </TableCell>
          <TableCell className="text-right tabular-nums text-zinc-400">—</TableCell>
          <TableCell className="text-right text-zinc-400">—</TableCell>
          <TableCell className="text-right text-zinc-400">—</TableCell>
          <TableCell className="text-right text-zinc-400">—</TableCell>
          <TableCell className="text-right">
            <span
              className={cn(
                "text-[11px]",
                candidateUnlocked ? "font-medium text-violet-700" : "text-zinc-400",
              )}
            >
              {candidateUnlocked ? "Compile artifact only" : "Run optimization to inspect"}
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    </div>
  );
}

function PromptSnapshotCard({
  snapshot,
  columnLabel,
  role,
}: {
  snapshot: SyntheticPromptSnapshot & {
    demos: DraftGeneratorPromptDemo[];
    optimizer?: string;
    packageLabel: string;
  };
  columnLabel: string;
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
      badge: "Compile artifact",
      badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    },
  }[role];

  return (
    <div className={cn("rounded-xl border px-5 py-4", config.border, config.bg)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-400">
            {columnLabel}
          </p>
          <p className="text-[13px] font-semibold text-zinc-900">{snapshot.label}</p>
          <p className="font-mono text-[11px] text-zinc-500">
            {snapshot.releaseDate} · {snapshot.packageLabel}
          </p>
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
          {snapshot.optimizer && (
            <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
              {snapshot.optimizer}
            </span>
          )}
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
            {snapshot.fewShotDemos} few-shot demo{snapshot.fewShotDemos !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="max-h-[min(520px,60vh)] overflow-y-auto rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-zinc-800">
          {buildDraftGeneratorPromptMarkdown({
            label: snapshot.label,
            releaseDate: snapshot.releaseDate,
            packageLabel: snapshot.packageLabel,
            summary: snapshot.summary,
            instruction: snapshot.instruction,
            demos: snapshot.demos,
          })}
        </pre>
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
          Run optimization to reveal the full v3 prompt markdown (instruction + few-shots) and
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

  const v1Package = v1
    ? {
        ...v1,
        demos: [] as DraftGeneratorPromptDemo[],
        packageLabel: "Instruction only",
      }
    : null;
  const v2Package = v2
    ? {
        ...v2,
        demos: DRAFT_GENERATOR_V2_ARTIFACT.demos,
        optimizer: DRAFT_GENERATOR_V2_ARTIFACT.optimizer,
        packageLabel: "Instruction + selected examples",
      }
    : null;
  const v3Package = optimizedSnapshot
    ? {
        ...optimizedSnapshot,
        demos: OPTIMIZATION_ARTIFACT.demos,
        optimizer: OPTIMIZATION_ARTIFACT.optimizer,
        packageLabel: "Rewritten instruction + selected examples",
      }
    : null;

  const leftSnapshot = compareMode === "v1-v2" ? v1Package : v2Package;
  const rightSnapshot = compareMode === "v1-v2" ? v2Package : v3Package;
  const leftColumnLabel = compareMode === "v1-v2" ? "Before" : "Current live";
  const rightColumnLabel = compareMode === "v1-v2" ? "After" : "Compile artifact";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-[12px] font-medium text-zinc-600">Comparing:</p>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {(
            [
              { id: "v1-v2" as CompareMode, label: "v1 → v2", sub: "Baseline → Deployed" },
              {
                id: "v2-v3" as CompareMode,
                label: "v2 → v3",
                sub: hasOptimized ? "Live → Compile artifact" : "Run optimization to unlock",
              },
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
        <p className="text-[12px] leading-relaxed text-zinc-500">
          Each column shows the full runtime prompt as one markdown document (summary, instruction,
          and few-shot examples).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {leftSnapshot && (
          <PromptSnapshotCard
            snapshot={leftSnapshot}
            columnLabel={leftColumnLabel}
            role={compareMode === "v2-v3" ? "live" : "baseline"}
          />
        )}
        {compareMode === "v2-v3" ? (
          rightSnapshot ? (
            <PromptSnapshotCard
              snapshot={rightSnapshot}
              columnLabel={rightColumnLabel}
              role="optimization-target"
            />
          ) : (
            <LockedSnapshotCard />
          )
        ) : (
          rightSnapshot && (
            <PromptSnapshotCard
              snapshot={rightSnapshot}
              columnLabel={rightColumnLabel}
              role="live"
            />
          )
        )}
      </div>
    </div>
  );
}

export default function DspyPage({
  compileRuns,
  optimizationState,
  setOptimizationState,
}: {
  compileRuns: DspyCompileRun[];
  optimizationState: DspyOptimizationState;
  setOptimizationState: Dispatch<SetStateAction<DspyOptimizationState>>;
}) {
  const sortedRuns = useMemo(
    () =>
      [...compileRuns].sort(
        (a, b) => new Date(b.compiledAt).getTime() - new Date(a.compiledAt).getTime(),
      ),
    [compileRuns],
  );
  const syntheticJobs = useMemo(() => getSyntheticDspyJobs(), []);
  const versionRows = useMemo(
    () => computeDspyVersionMetrics(syntheticJobs, null),
    [syntheticJobs],
  );
  const { optimizationStatus, activeStepIndex, completedStepCount, runError } =
    optimizationState;
  const hasOptimized = optimizationStatus === "complete";
  const candidateRun = useMemo(
    () =>
      sortedRuns.find((run) => run.promptVersionAfter === OPTIMIZATION_TARGET_VERSION) ?? null,
    [sortedRuns],
  );
  const candidateSnapshotBase = useMemo(
    () =>
      getSyntheticPromptSnapshots().find(
        (snapshot) => snapshot.version === OPTIMIZATION_TARGET_VERSION,
      ) ?? null,
    [],
  );
  const optimizedSnapshot = useMemo(() => {
    if (!candidateSnapshotBase || !hasOptimized) {
      return null;
    }

    return {
      ...candidateSnapshotBase,
      instruction: OPTIMIZATION_ARTIFACT.instruction,
      fewShotDemos: OPTIMIZATION_ARTIFACT.demos.length,
    } satisfies SyntheticPromptSnapshot;
  }, [candidateSnapshotBase, hasOptimized]);

  const handleRunOptimization = async () => {
    if (optimizationStatus !== "idle") return;

    setOptimizationState({
      optimizationStatus: "running",
      activeStepIndex: 0,
      completedStepCount: 0,
      runError: null,
    });

    try {
      for (let index = 0; index < RUN_STEPS.length; index++) {
        setOptimizationState((prev) => ({
          ...prev,
          activeStepIndex: index,
          completedStepCount: index,
        }));
        await delay(index === RUN_STEPS.length - 1 ? 1200 : 950);
      }

      setOptimizationState((prev) => ({
        ...prev,
        completedStepCount: RUN_STEPS.length,
        activeStepIndex: null,
        optimizationStatus: "complete",
      }));
    } catch (error) {
      setOptimizationState((prev) => ({
        ...prev,
        activeStepIndex: null,
        completedStepCount: 0,
        optimizationStatus: "idle",
        runError: error instanceof Error ? error.message : "Optimization failed",
      }));
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/80">
      <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 pb-20 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Prompt optimization · DSPy
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-zinc-950">
              Three compile generations. Measurable improvement at each step.
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-500">
              v1 and v2 are corpus actuals from the synthetic eval set. v3 is a MIPROv2 compile
              candidate — reveal the frozen artifact below to inspect what changed without implying
              forward-looking live outcomes.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRunOptimization}
            disabled={optimizationStatus !== "idle"}
            className={cn("min-w-[190px]", optimizationStatus === "idle" && "bg-violet-600 text-white hover:bg-violet-700")}
          >
            {optimizationStatus === "running" ? (
              <>
                <Loader2 className="animate-spin" />
                Running optimization…
              </>
            ) : optimizationStatus === "complete" ? (
              <>
                <CheckCircle2 />
                Candidate revealed
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
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold text-zinc-950">Version performance</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              v1 and v2 are measured corpus actuals computed from the static evaluation set.
              Candidate v3 stays artifact-only here until it is deployed and measured.
            </p>
          </div>
          <VersionTable rows={versionRows} candidateUnlocked={hasOptimized} />
          <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">
            The locked v3 row intentionally omits outcome metrics. Revealing the candidate below
            loads the compiled prompt package and optimizer facts only.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold text-zinc-950">Compile history</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Each compile event produces a frozen prompt artifact. Deployed runs can show corpus
              deltas; candidate compiles stay artifact-only until they collect live outcomes.
            </p>
          </div>
          <div className="space-y-3">
            {sortedRuns.map((run) => {
              const isCandidateRun = run.promptVersionAfter === OPTIMIZATION_TARGET_VERSION;
              const isLiveRun = run.promptVersionAfter === SYNTHETIC_DSPY_VERSION_V2;

              return (
                <CompileRunCard
                  key={run.id}
                  run={run}
                  badge={
                    isCandidateRun
                      ? {
                          label: "Candidate",
                          className: "border-violet-200 bg-violet-100 text-violet-700",
                        }
                      : isLiveRun
                        ? {
                            label: "Current live",
                            className: "border-teal-200 bg-teal-100 text-teal-700",
                          }
                        : null
                  }
                  containerClassName={
                    isCandidateRun
                      ? "border-violet-200 bg-violet-50/40"
                      : isLiveRun
                        ? "border-teal-200 bg-teal-50/30"
                        : undefined
                  }
                  positiveMetricLabel="Workable reply"
                  showDeltas={!isCandidateRun}
                  note={
                    isCandidateRun
                      ? "Compiled candidate only. Inspect the rewritten instruction and larger demo package below; deploy it to measure live outcomes."
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-950">Run optimization</h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                Replays the committed MIPROv2 compile — loads the v2 training corpus, scores
                against the{" "}
                <code className="font-mono text-[11px]">0.2 clean accept + 0.8 workable reply</code>{" "}
                objective, and reveals the frozen v3 artifact.
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
                Compile facts
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <CompileFact label="Optimizer" value={OPTIMIZATION_ARTIFACT.optimizer} />
                <CompileFact
                  label="Compiled"
                  value={new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(OPTIMIZATION_ARTIFACT.compiledAt))}
                />
                <CompileFact
                  label="Training corpus"
                  value={
                    candidateRun
                      ? `${candidateRun.jobsUsed} examples · ${candidateRun.trainWindowDays}-day window`
                      : "Committed compile artifact"
                  }
                />
                <CompileFact label="Objective" value={OPTIMIZATION_ARTIFACT.objective.label} />
                <CompileFact
                  label="Prompt package"
                  value={`${DRAFT_GENERATOR_V2_ARTIFACT.demos.length} demos → ${OPTIMIZATION_ARTIFACT.demos.length} demos`}
                />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-zinc-600">
                {candidateSnapshotBase?.summary ??
                  "v3 is a compiled candidate artifact. Deploy it to collect real outcome data."}
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
          <div className="mb-1 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-zinc-400" />
            <h2 className="text-[15px] font-semibold text-zinc-950">Prompt packages</h2>
          </div>
          <p className="mb-5 text-[12px] text-zinc-500">
            Each version is shown as plain markdown text: the same document the model sees (instruction
            plus few-shots). Before the run, compare historical v1 → v2. After the run, unlock live
            v2 → compiled v3 artifact.
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
