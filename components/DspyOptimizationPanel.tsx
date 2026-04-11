"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Cpu, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { computeDspyVersionMetrics } from "@/lib/metrics";
import type { AngleType, DspyCompileRun, DspyVersionRow, OutboundJob } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Compile run card ─────────────────────────────────────────────────────────

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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[13px] font-semibold text-zinc-900">{run.optimizer}</span>
            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-amber-700">
              Illustrative
            </span>
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
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Positive reply</p>
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

// ─── Version comparison table ─────────────────────────────────────────────────

function shortVersion(v: string) {
  // "2026-04-11.draft-generator.v3" → "v3 (Apr 11)"
  const parts = v.split(".");
  const tag = parts[parts.length - 1]; // e.g. "v3"
  const datePart = parts[0]; // e.g. "2026-04-11"
  const date = new Date(datePart);
  if (Number.isNaN(date.getTime())) return v;
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  return `${tag} (${month} ${day})`;
}

function VersionTable({ rows }: { rows: DspyVersionRow[] }) {
  const fmtPct = (n: number | null) => (n == null ? "—" : `${n}%`);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-zinc-600 w-[22%]">Version</TableHead>
          <TableHead className="text-right text-zinc-600">Jobs</TableHead>
          <TableHead className="text-right text-zinc-600">Clean accept</TableHead>
          <TableHead className="text-right text-zinc-600">Edit rate</TableHead>
          <TableHead className="text-right text-zinc-600">Reply rate</TableHead>
          <TableHead className="text-right text-zinc-600">Positive rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.draftPromptVersion}-${row.angleType ?? "all"}`}>
            <TableCell className="font-mono text-[11px] text-zinc-700">
              {shortVersion(row.draftPromptVersion)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">{row.jobCount}</TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">
              {row.withFeedback > 0
                ? `${fmtPct(row.cleanAcceptRate)} (${row.cleanAccept}/${row.withFeedback})`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">
              {row.withFeedback > 0 ? fmtPct(row.editRate) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">
              {row.sentWithOutcome > 0
                ? `${fmtPct(row.replyRate)} (${row.replied}/${row.sentWithOutcome})`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-zinc-700">
              {row.sentWithOutcome > 0 ? fmtPct(row.positiveRate) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function DspyOptimizationPanel({
  compileRuns,
  jobs,
}: {
  compileRuns: DspyCompileRun[];
  jobs: OutboundJob[];
}) {
  const [angleFilter, setAngleFilter] = useState<AngleType | "all">("all");

  const globalRows = useMemo(
    () => computeDspyVersionMetrics(jobs, null),
    [jobs],
  );

  const filteredRows = useMemo(
    () =>
      angleFilter === "all"
        ? globalRows
        : computeDspyVersionMetrics(jobs, angleFilter as AngleType),
    [jobs, angleFilter, globalRows],
  );

  const angleTypes = Object.keys(ANGLE_CONFIG) as AngleType[];
  const sortedRuns = [...compileRuns].sort(
    (a, b) => new Date(b.compiledAt).getTime() - new Date(a.compiledAt).getTime(),
  );

  return (
    <div className="space-y-6">
      {/* Compile history */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-950">DSPy compile history</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Offline optimization runs — each compile produces a new frozen prompt artifact deployed to production.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {sortedRuns.map((run) => (
            <CompileRunCard key={run.id} run={run} />
          ))}
        </div>
      </section>

      {/* Version comparison table */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-950">
              Version performance
            </h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Live metrics from jobs grouped by{" "}
              <code className="font-mono text-[11px]">draftGenerator</code> prompt version.
            </p>
          </div>
          {/* Angle filter */}
          <div className="relative">
            <select
              value={angleFilter}
              onChange={(e) => setAngleFilter(e.target.value as AngleType | "all")}
              className="h-8 appearance-none rounded-lg border border-zinc-200 bg-white py-0 pl-3 pr-8 text-[12px] text-zinc-800 shadow-sm outline-none transition-colors focus:border-zinc-400"
            >
              <option value="all">All angles</option>
              {angleTypes.map((a) => (
                <option key={a} value={a}>
                  {ANGLE_CONFIG[a].label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
          </div>
        </div>

        <div className="mt-5">
          {filteredRows.length > 0 ? (
            <VersionTable rows={filteredRows} />
          ) : (
            <p className="py-6 text-center text-[13px] text-zinc-400">
              No jobs with prompt version data for this angle.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
