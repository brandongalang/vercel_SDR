"use client";

import { useId, useMemo } from "react";
import type {
  AnalyticsDateRange,
  AnalyticsSnapshot,
  AnalyticsTrendPoint,
  OutboundJob,
  PlaybookRow,
} from "@/lib/types";
import { ANALYTICS_RANGE_PRESETS } from "@/lib/analytics-mock";
import { computeQueueMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BadgeCheck,
  Info,
} from "lucide-react";

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatSignedPoints(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pts`;
}

function formatSignedCount(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${Math.round(value).toLocaleString("en-US")}`;
}

function formatDuration(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 3600) {
    const hours = Math.round((absoluteValue / 3600) * 10) / 10;
    return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)} hr`;
  }

  if (absoluteValue >= 60) {
    const minutes = Math.round((absoluteValue / 60) * 10) / 10;
    return `${Number.isInteger(minutes) ? minutes.toFixed(0) : minutes.toFixed(1)} min`;
  }

  const seconds = Math.round(absoluteValue * 10) / 10;
  return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)} sec`;
}

function formatDeltaSentence(
  value: number | null | undefined,
  positiveLabel: string,
  negativeLabel: string,
  unit: "pts" | "seconds" | "count",
  comparisonLabel?: string
) {
  const windowRef = comparisonLabel ?? "the prior window";

  if (value == null || value === 0) {
    return `Flat against ${windowRef}.`;
  }

  const absoluteValue =
    unit === "count"
      ? Math.round(Math.abs(value)).toLocaleString("en-US")
      : unit === "seconds"
        ? formatDuration(Math.abs(value))
        : Math.abs(value).toFixed(1);

  const unitLabel = unit === "seconds" ? "" : unit === "count" ? "" : " pts";
  const spacedUnit = unit === "count" ? "" : unitLabel;

  return `${absoluteValue}${spacedUnit} ${value > 0 ? positiveLabel : negativeLabel} vs ${windowRef}.`;
}

function getBenchmarkSignal(sampleSize: number) {
  if (sampleSize >= 100) {
    return {
      label: "Reliable sample",
      detail: "Both windows have enough volume to trust the comparison.",
    };
  }

  if (sampleSize >= 40) {
    return {
      label: "Directional sample",
      detail: "Enough volume to read the trend; treat the exact delta as approximate.",
    };
  }

  return {
    label: "Thin sample",
    detail: "Not enough sends yet to trust the comparison.",
  };
}

function getQueueSignal(sampleSize: number): string {
  if (sampleSize >= 100) {
    return "Enough reviewed drafts to reflect how the queue is running.";
  }

  if (sampleSize >= 40) {
    return "Enough reviewed drafts to see the shape of the queue, not a final rate.";
  }

  return "Too few reviewed drafts to draw a conclusion yet — treat this as a live snapshot.";
}

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  paddingX: number,
  paddingY: number
) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length === 1 ? 0 : (width - paddingX * 2) / (values.length - 1);

  return values
    .map((value, index) => {
      const x = paddingX + step * index;
      const y = height - paddingY - ((value - min) / range) * (height - paddingY * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function getLinePoints(
  values: number[],
  width: number,
  height: number,
  paddingX: number,
  paddingY: number
) {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length === 1 ? 0 : (width - paddingX * 2) / (values.length - 1);

  return values.map((value, index) => ({
    x: paddingX + step * index,
    y: height - paddingY - ((value - min) / range) * (height - paddingY * 2),
    value,
  }));
}

function LiveDot() {
  return (
    <span className="relative flex size-2" role="presentation">
      <span
        aria-hidden
        className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden"
      />
      <span aria-hidden className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}

function MetricTooltip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="cursor-help text-muted-foreground/70 transition-colors hover:text-foreground"
    >
      <Info size={12} aria-hidden />
    </span>
  );
}

function ExecutiveMetric({
  label,
  value,
  supporting,
  tone = "neutral",
  tooltip,
}: {
  label: string;
  value: string;
  supporting: string;
  tone?: "positive" | "negative" | "neutral";
  tooltip?: string;
}) {
  return (
    <div className="grid gap-1 p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-[0.02em] text-muted-foreground">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </p>
      <p
        className={cn(
          "font-mono tabular-nums text-[22px] font-semibold tracking-tight",
          tone === "positive"
            ? "text-emerald-700 dark:text-emerald-300"
            : tone === "negative"
              ? "text-rose-700 dark:text-rose-300"
              : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="max-w-[40ch] text-[13px] leading-5 text-muted-foreground">{supporting}</p>
    </div>
  );
}

function PulseMetric({
  label,
  value,
  detail,
  tooltip,
}: {
  label: string;
  value: string;
  detail: string;
  tooltip?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-[0.02em] text-muted-foreground">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </p>
      <p className="font-mono tabular-nums text-[22px] font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-[13px] leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function InsightList({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "positive" | "negative";
  rows: PlaybookRow[];
}) {
  const positive = tone === "positive";

  return (
    <section className="rounded-[28px] border border-border/70 bg-card px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium tracking-[0.02em] text-muted-foreground">
            {positive ? "Top performers" : "Friction points"}
          </p>
          <h3 className="mt-1 text-[18px] font-medium tracking-tight text-foreground">{title}</h3>
        </div>
        {positive ? (
          <BadgeCheck className="size-5 text-emerald-500" aria-hidden />
        ) : (
          <AlertCircle className="size-5 text-rose-500" aria-hidden />
        )}
      </div>

      <div className="mt-4 divide-y divide-border/70">
        {rows.length === 0 ? (
          <div className="py-3">
            <p className="text-[14px] leading-6 text-muted-foreground">
              Not enough benchmark volume in the selected window to rank plays reliably yet.
            </p>
          </div>
        ) : null}
        {rows.map((play) => (
          <div key={play.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div>
              <p className="text-[15px] font-medium leading-6 text-foreground">{play.combo}</p>
              <p className="mt-1 max-w-[48ch] text-[14px] leading-6 text-muted-foreground">{play.note}</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {play.volume} drafted in the selected benchmark window.
                {play.volume < 10 ? " Directional only." : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
                  positive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                )}
              >
                {play.metricLabel}
                <span className="font-mono tabular-nums font-semibold">{play.metricValue}%</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BenchmarkTrendChart({
  data,
  windowDays,
}: {
  data: AnalyticsTrendPoint[];
  windowDays: number;
}) {
  const chartWidth = 640;
  const lineHeight = 190;
  const barHeight = 92;
  const paddingX = 26;
  const paddingY = 22;
  const responseValues = data.map((point) => point.responseLift);
  const linePath = buildLinePath(responseValues, chartWidth, lineHeight, paddingX, paddingY);
  const linePoints = getLinePoints(responseValues, chartWidth, lineHeight, paddingX, paddingY);
  const barMax = Math.max(...data.map((point) => point.generatedSent), 1);
  const barStep = data.length === 1 ? 0 : (chartWidth - paddingX * 2) / (data.length - 1);
  const latest = data[data.length - 1];

  return (
    <div className="rounded-[28px] border border-border/70 bg-card px-6 py-4">
      <div>
        <p className="text-[12px] font-medium tracking-[0.02em] text-muted-foreground">Rolling trend</p>
        <h3 className="mt-1 text-[18px] font-medium tracking-tight text-foreground">Rolling benchmark trend</h3>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-6 text-muted-foreground">
          Rolling {windowDays}-day benchmark windows sampled every 14 days. The line tracks response-rate change vs the previous matching window. The bars track AI-generated send volume.
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden />
            Response lift vs previous matching period
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${lineHeight}`}
            className="w-full overflow-visible"
            role="img"
            aria-label={`Response lift trend: latest ${windowDays}-day window shows ${formatSignedPoints(latest?.responseLift ?? null)} lift. ${data.length} bi-weekly periods shown.`}
          >
            <title>{`Response lift trend: latest ${windowDays}-day window shows ${formatSignedPoints(latest?.responseLift ?? null)} lift. ${data.length} bi-weekly periods shown.`}</title>
            {[0, 1, 2, 3].map((index) => {
              const y = paddingY + ((lineHeight - paddingY * 2) / 3) * index;
              const min = Math.min(...responseValues);
              const max = Math.max(...responseValues);
              const range = max - min || 1;
              const valueAtLine = max - (index / 3) * range;
              return (
                <g key={index}>
                  <line
                    x1={paddingX}
                    x2={chartWidth - paddingX}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    className="text-foreground"
                  />
                  <text
                    x={paddingX - 4}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity="0.45"
                    className="text-foreground"
                  >
                    {valueAtLine >= 0 ? "+" : ""}{valueAtLine.toFixed(1)}
                  </text>
                </g>
              );
            })}

            <path
              d={linePath}
              fill="none"
              stroke="oklch(0.67 0.11 189)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {linePoints.map((point, index) => (
              <g key={`${point.x}-${point.y}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={index === linePoints.length - 1 ? 5 : 3.5}
                  fill="oklch(0.67 0.11 189)"
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden />
            AI-generated sends
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${barHeight}`}
            className="w-full overflow-visible"
            role="img"
            aria-label={`AI-generated send volume: latest period ${formatCompactNumber(latest?.generatedSent ?? 0)} sends.`}
          >
            <title>{`AI-generated send volume: latest period ${formatCompactNumber(latest?.generatedSent ?? 0)} sends.`}</title>
            {data.map((point, index) => {
              const x = paddingX + barStep * index - 24;
              const height = Math.max((point.generatedSent / barMax) * (barHeight - 28), 8);
              return (
                <g key={point.label}>
                  <rect
                    x={x}
                    y={barHeight - height - 16}
                    width="48"
                    height={height}
                    rx="12"
                    fill={index === data.length - 1 ? "oklch(0.63 0.08 195)" : "oklch(0.89 0.01 240)"}
                  />
                </g>
              );
            })}
          </svg>

          <div
            className="flex justify-between text-[13px] text-muted-foreground"
            style={{
              paddingLeft: `${(paddingX / chartWidth) * 100}%`,
              paddingRight: `${(paddingX / chartWidth) * 100}%`,
            }}
          >
            {data.map((point) => (
              <div key={point.label} className="min-w-0 text-center">
                <p className="font-medium text-foreground">{point.label}</p>
                <p className="tabular-nums">{formatCompactNumber(point.generatedSent)} sent</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PresetButton({
  active,
  label,
  ariaLabel,
  onClick,
}: {
  active: boolean;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 min-w-[40px] items-center justify-center rounded-full px-3.5 text-[13px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-foreground text-background"
          : "bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

export default function AnalyticsPage({
  analytics,
  analyticsWindowLabel,
  baselineWindowDays,
  dateRange,
  rangeDays,
  jobs,
  onDateRangeStart,
  onDateRangeEnd,
  onQuickRange,
}: {
  analytics: AnalyticsSnapshot;
  analyticsWindowLabel: string;
  baselineWindowDays: number;
  dateRange: AnalyticsDateRange;
  rangeDays: number;
  jobs: OutboundJob[];
  onDateRangeStart: (value: string) => void;
  onDateRangeEnd: (value: string) => void;
  onQuickRange: (days: number) => void;
}) {
  const startDateInputId = useId();
  const endDateInputId = useId();
  const startDateLabelId = useId();
  const endDateLabelId = useId();
  const { summary } = useMemo(() => computeQueueMetrics(jobs, dateRange), [dateRange, jobs]);

  const generatedSentDelta = analytics.trends?.generatedSent ?? null;
  const acceptLift = analytics.trends?.cleanAccept ?? null;
  const editedLift = analytics.trends?.editedAccept ?? null;
  const isPresetRange = ANALYTICS_RANGE_PRESETS.some((preset) => preset.days === rangeDays);
  const benchmarkSignal = getBenchmarkSignal(Math.min(analytics.generatedSent, analytics.comparisonSent));
  const liveQueueSignal = getQueueSignal(summary.withApprovalFeedback);

  const verdictTitle = `${baselineWindowDays}-day benchmark`;

  const isInvalidRange = dateRange.start && dateRange.end && dateRange.start > dateRange.end;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-6 pb-12 sm:px-6">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {`Analytics updated: showing ${analyticsWindowLabel}`}
        </div>
        <header className="flex flex-col gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Benchmark board
              </p>
              <h2 className="mt-1 text-[24px] font-semibold tracking-tight text-foreground">
                {verdictTitle}
              </h2>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                {analyticsWindowLabel} · compared with {analytics.comparisonWindowLabel}
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div role="group" aria-label="Quick date range" className="flex gap-1.5 rounded-full border border-border/70 bg-muted p-1">
                {ANALYTICS_RANGE_PRESETS.map((preset) => (
                  <PresetButton
                    key={preset.key}
                    active={rangeDays === preset.days}
                    label={preset.label}
                    ariaLabel={`Last ${preset.days} days`}
                    onClick={() => onQuickRange(preset.days)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label id={startDateLabelId} htmlFor={startDateInputId} className="sr-only">
                  From date
                </label>
                <input
                  id={startDateInputId}
                  type="date"
                  value={dateRange.start}
                  max={dateRange.end}
                  onChange={(event) => onDateRangeStart(event.target.value)}
                  aria-labelledby={startDateLabelId}
                  aria-label="From date"
                  className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground shadow-sm outline-none transition-colors focus:border-ring"
                />
                <span aria-hidden className="text-[12px] text-muted-foreground">→</span>
                <label id={endDateLabelId} htmlFor={endDateInputId} className="sr-only">
                  To date
                </label>
                <input
                  id={endDateInputId}
                  type="date"
                  value={dateRange.end}
                  min={dateRange.start}
                  onChange={(event) => onDateRangeEnd(event.target.value)}
                  aria-labelledby={endDateLabelId}
                  aria-label="To date"
                  className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground shadow-sm outline-none transition-colors focus:border-ring"
                />
                {!isPresetRange ? (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground">Custom</span>
                ) : null}
              </div>
            </div>
          </div>
          {isInvalidRange && (
            <p role="alert" className="text-[12px] text-destructive">
              Start date must be before end date.
            </p>
          )}
        </header>

        <section className="rounded-[28px] border border-border/70 bg-card px-6 py-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.4)] dark:shadow-[0_18px_48px_-36px_rgba(0,0,0,0.5)] sm:px-7 sm:py-6">
          <p className="text-[12px] font-medium tracking-[0.02em] text-muted-foreground">
            Response lift vs prior window
          </p>
          <p
            className={cn(
              "mt-2 font-mono tabular-nums text-[30px] font-semibold tracking-[-0.04em] leading-none sm:text-[36px]",
              analytics.responseLift > 0
                ? "text-emerald-700 dark:text-emerald-300"
                : analytics.responseLift < 0
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-foreground"
            )}
          >
            {formatSignedPoints(analytics.responseLift)}
          </p>
          <p className="mt-3 max-w-[58ch] text-[16px] leading-6 text-foreground sm:text-[17px] sm:leading-7">
            Response rate is {formatPercent(analytics.overallResponseRate)} over {formatCompactNumber(analytics.generatedSent)} sends, versus {formatPercent(analytics.comparisonResponseRate)} in the prior {baselineWindowDays}-day window.
          </p>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">{benchmarkSignal.label}</span>
            {" · "}
            {benchmarkSignal.detail}
          </p>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card">
          <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <ExecutiveMetric
              label="Sent without edits"
              value={formatPercent(analytics.cleanAcceptRate)}
              supporting={formatDeltaSentence(acceptLift, "higher accept rate", "lower accept rate", "pts", analytics.comparisonWindowLabel)}
              tone="positive"
              tooltip="Drafts the reviewer approved and sent without editing the AI's draft."
            />
            <ExecutiveMetric
              label="Needs edits"
              value={formatPercent(analytics.editedAcceptRate)}
              supporting={formatDeltaSentence(
                editedLift,
                "higher edit rate",
                "lower edit rate",
                "pts",
                analytics.comparisonWindowLabel
              )}
              tone="negative"
              tooltip="Drafts the reviewer changed before sending instead of shipping the AI draft as-is."
            />
            <ExecutiveMetric
              label="AI-generated sends"
              value={formatCompactNumber(analytics.generatedSent)}
              supporting={`${formatSignedCount(generatedSentDelta)} sends vs ${analytics.comparisonWindowLabel}.`}
              tooltip="Drafts the AI produced and the reviewer approved for sending in the selected window."
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_360px]">
          <BenchmarkTrendChart data={analytics.trendSeries} windowDays={baselineWindowDays} />

          <section className="rounded-[28px] border border-border/70 bg-card px-6 py-4">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-medium tracking-[0.02em] text-muted-foreground">
                <LiveDot />
                Live workflow pulse
              </p>
              <h3 className="mt-1 text-[18px] font-medium tracking-tight text-foreground">Current review queue</h3>
            </div>
            <p className="mt-2 max-w-[38ch] text-[14px] leading-6 text-muted-foreground">
              {liveQueueSignal}
            </p>

            <div className="mt-4 divide-y divide-border/70">
              <div className="pb-3">
                <PulseMetric
                  label="Pending review"
                  value={formatCompactNumber(summary.pendingReview)}
                  detail="Drafts awaiting an SDR decision right now."
                  tooltip="Drafts the agent produced that no reviewer has approved or skipped yet."
                />
              </div>
              <div className="py-3">
                <PulseMetric
                  label="Sent drafts"
                  value={formatCompactNumber(summary.sent)}
                  detail={`${summary.decidedCount} drafts decided in the current sample.`}
                  tooltip="Drafts the reviewer sent. Excludes drafts that were skipped."
                />
              </div>
              <div className="pt-3">
                <PulseMetric
                  label="Send rate"
                  value={formatPercent(summary.approvedSendRate)}
                  detail={`${summary.sent} sent vs ${summary.reviewed} skipped in the current sample.`}
                  tooltip="Share of decided drafts that were sent rather than skipped."
                />
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <InsightList title="Highest reply-rate plays" tone="positive" rows={analytics.topPlays} />
          <InsightList title="Highest edit-rate plays" tone="negative" rows={analytics.frictionPlays} />
        </section>
      </div>
    </div>
  );
}
