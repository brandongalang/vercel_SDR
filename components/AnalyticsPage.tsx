"use client";

import { useMemo } from "react";
import { AnalyticsDateRange, AnalyticsSnapshot, OutboundJob, PlaybookRow } from "@/lib/types";
import { computeQueueMetrics } from "@/lib/metrics";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Sparkles, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function MetricCard({
  label,
  value,
  sub,
  tone = "default",
  trend,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "emerald" | "amber" | "teal";
  trend?: number;
  highlight?: boolean;
}) {
  const toneMap: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    teal: "border-teal-200 bg-teal-50",
    default: "border-zinc-200 bg-white",
  };
  const toneClasses = toneMap[tone] ?? toneMap.default;

  return (
    <div className={cn("rounded-xl border px-4 py-4 shadow-sm", toneClasses, highlight && "ring-1 ring-emerald-200/60")}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold",
              trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}
          >
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">{sub}</p>
    </div>
  );
}

function formatPct(value: number) {
  return `${value}%`;
}

function PlaybookCard({ play }: { play: PlaybookRow }) {
  const isPositive = play.metricType === "positive";
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">
          {isPositive ? (
            <Sparkles className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-[13px] font-medium text-zinc-900">{play.combo}</h3>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {play.metricLabel}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-[15px] font-semibold text-zinc-900">{play.metricValue}%</p>
                {play.metricTrend !== undefined && play.metricTrend !== 0 && (
                  <span className={cn("text-[11px] font-medium", play.metricTrend > 0 ? "text-emerald-600" : "text-red-600")}>
                    {play.metricTrend > 0 ? "↑" : "↓"} {Math.abs(play.metricTrend)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-600 pr-16">{play.note}</p>
          <p className="mt-3 text-[11px] font-medium text-zinc-400">{play.volume} drafted</p>
        </div>
      </div>
    </div>
  );
}

function QueueStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-3.5">
      <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-[26px] font-semibold tabular-nums leading-none text-zinc-950">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage({
  analytics,
  analyticsWindowLabel,
  baselineWindowDays,
  dateRange,
  jobs,
  onDateRangeStart,
  onDateRangeEnd,
}: {
  analytics: AnalyticsSnapshot;
  analyticsWindowLabel: string;
  baselineWindowDays: number;
  dateRange: AnalyticsDateRange;
  jobs: OutboundJob[];
  onDateRangeStart: (value: string) => void;
  onDateRangeEnd: (value: string) => void;
}) {
  const { summary, byAngle } = useMemo(
    () => computeQueueMetrics(jobs, dateRange),
    [dateRange, jobs]
  );
  const fmtPct = (n: number | null) => (n == null ? "—" : `${n}%`);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/80">
      <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 pb-20 sm:px-6">
        {/* Date range selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-[11px] font-mono uppercase tracking-wide text-zinc-500 shrink-0">Date range</span>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            From
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeStart(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-3 text-[12px] text-foreground shadow-sm outline-none transition-colors focus:border-ring"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            To
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeEnd(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-3 text-[12px] text-foreground shadow-sm outline-none transition-colors focus:border-ring"
            />
          </label>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-zinc-950">Operational benchmarks</h2>
              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-amber-700">
                Demo baseline
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-zinc-500 tabular-nums">
              {analyticsWindowLabel} · {analytics.generatedSent} generated sends · {analytics.staticBaselineSent} illustrative static baseline · nearest {baselineWindowDays}-day snapshot
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Adoption: Clean accept"
              value={formatPct(analytics.cleanAcceptRate)}
              sub="Drafts approved and sent entirely untouched by SDRs."
              tone="teal"
              trend={analytics.trends?.cleanAccept}
            />
            <MetricCard
              label="Speed: Review time"
              value={`${analytics.avgReviewSeconds}s`}
              sub="Average seconds spent reviewing generated drafts vs writing from scratch."
              trend={analytics.trends?.avgReviewSeconds}
            />
            <MetricCard
              label="Impact: Positive reply"
              value={formatPct(analytics.positiveReplyRate)}
              sub="Meetings booked or active replies from generated emails."
              tone="emerald"
              trend={analytics.trends?.positiveReply}
              highlight
            />
            <MetricCard
              label="Lift vs template ROI"
              value={`+${analytics.responseLift.toFixed(1)} pts`}
              sub="Response margin strictly above the static baseline."
              trend={analytics.trends?.responseLift}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-950">Review quality</h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                Live rollups for {analyticsWindowLabel} using approval, skip, send, and response timestamps. Clean accept is the key signal that drafts are trusted without alteration.
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-teal-700">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
              Live
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QueueStatCard
              label="Clean accept"
              value={fmtPct(summary.cleanAcceptRate)}
              sub={`${summary.cleanAcceptCount} of ${summary.withApprovalFeedback} with feedback`}
            />
            <QueueStatCard
              label="Edit before approve"
              value={fmtPct(summary.editRate)}
              sub={`${summary.editedCount} edited before sending`}
            />
            <QueueStatCard
              label="Reply rate (sent)"
              value={fmtPct(summary.replyRate)}
              sub={`${summary.replyCount} replies / ${summary.sentWithOutcomeTracked} tracked`}
            />
            <QueueStatCard
              label="Positive outcome"
              value={fmtPct(summary.positiveRate)}
              sub={`${summary.positiveCount} meetings / strong intent`}
            />
          </div>

          <div className="mt-6 -mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:max-w-none sm:overflow-visible sm:px-0">
            <h3 className="mb-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
              By angle type
            </h3>
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-zinc-600 w-[30%]">Angle</TableHead>
                  <TableHead className="text-right tabular-nums text-zinc-600">Decided</TableHead>
                  <TableHead className="text-right tabular-nums text-zinc-600">Clean</TableHead>
                  <TableHead className="text-right tabular-nums text-zinc-600">Edit</TableHead>
                  <TableHead className="text-right tabular-nums text-zinc-600">Sent</TableHead>
                  <TableHead className="text-right tabular-nums text-zinc-600">Reply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byAngle.map((row) => {
                  const fb = row.cleanAccept + row.edited;
                  const cleanPct = fb > 0 ? Math.round((row.cleanAccept / fb) * 100) : null;
                  const replyPct =
                    row.withOutcome > 0 ? Math.round((row.replied / row.withOutcome) * 100) : null;
                  return (
                    <TableRow key={row.angleType} className={cn("border-l-[3px]", ANGLE_CONFIG[row.angleType].borderColor)}>
                      <TableCell className="font-medium text-zinc-900">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-block w-2 h-2 rounded-full shrink-0",
                              ANGLE_CONFIG[row.angleType].dot
                            )}
                          />
                          {row.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-700">{row.decided}</TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-700">
                        {fb > 0 ? `${row.cleanAccept} (${cleanPct}%)` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-700">
                        {row.edited > 0 ? row.edited : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-700">
                        {row.sent > 0 ? row.sent : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-700">
                        {row.withOutcome > 0 ? `${row.replied}/${row.withOutcome} (${replyPct}%)` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-950">Top Performing Combos</h2>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              Synthetic demo leaderboard mapped to the nearest {baselineWindowDays}-day benchmark snapshot.
            </p>
            <div className="mt-6 space-y-3">
              {analytics.topPlays.map(play => (
                <PlaybookCard key={play.id} play={play} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-950">High Friction Combos</h2>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              Synthetic demo friction view for the nearest {baselineWindowDays}-day benchmark snapshot.
            </p>
            <div className="mt-6 space-y-3">
              {analytics.frictionPlays.map(play => (
                <PlaybookCard key={play.id} play={play} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
