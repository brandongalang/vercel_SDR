"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CompileRunCard } from "@/components/dspy/compile-run-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPct, shortVersion } from "@/components/dspy/shared";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { computeDspyVersionMetrics } from "@/lib/metrics";
import type { AngleType, DspyCompileRun, DspyVersionRow, OutboundJob } from "@/lib/types";

// ─── Compile run card ─────────────────────────────────────────────────────────

// ─── Version comparison table ─────────────────────────────────────────────────

function VersionTable({ rows }: { rows: DspyVersionRow[] }) {
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
            <CompileRunCard
              key={run.id}
              run={run}
              badge={{
                label: "Illustrative",
                className: "border-amber-200 bg-amber-50 text-amber-700",
              }}
              positiveMetricLabel="Positive reply"
            />
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
