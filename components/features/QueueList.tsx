"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { getPlayConfig } from "@/lib/play-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, ChevronDown, Inbox, Loader2, SkipForward } from "lucide-react";
import { formatRelativeUpdated } from "@/lib/format";

interface QueueListProps {
  jobs: OutboundJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onApproveJob: (jobId: string) => void;
  onArchiveJob: (jobId: string) => void;
  state: "loading" | "error" | "empty" | "ready";
  errorMessage?: string;
  queueView: "queue" | "history";
  onQueueViewChange: (value: "queue" | "history") => void;
  historyFilter: "all" | "sent_today" | "skipped";
  onHistoryFilterChange: (value: "all" | "sent_today" | "skipped") => void;
}

const SIZE_CHIP: Record<string, { className: string; text: string }> = {
  enterprise: { className: "border-blue-200 bg-blue-100/50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300", text: "ENT" },
  mid_market: { className: "border-indigo-200 bg-indigo-100/50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300", text: "MID" },
  smb: { className: "border-emerald-200 bg-emerald-100/50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300", text: "SMB" },
  startup: { className: "border-amber-200 bg-amber-100/50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300", text: "STP" },
};
const SIZE_CHIP_DEFAULT = { className: "bg-muted/50 text-muted-foreground border-border", text: "---" };
type QueueAngleConfig = (typeof ANGLE_CONFIG)[keyof typeof ANGLE_CONFIG];
type QueuePlayConfig = ReturnType<typeof getPlayConfig>;

function sizeChipClass(size?: string) {
  return (SIZE_CHIP[size ?? ""] ?? SIZE_CHIP_DEFAULT).className;
}

function sizeText(size?: string) {
  return (SIZE_CHIP[size ?? ""] ?? SIZE_CHIP_DEFAULT).text;
}

function mostRecentUpdated(sectionJobs: OutboundJob[]): string | null {
  if (sectionJobs.length === 0) return null;
  const latest = sectionJobs.reduce((a, b) =>
    new Date(a.timestamps.updated) > new Date(b.timestamps.updated) ? a : b
  );
  return formatRelativeUpdated(latest.timestamps.updated);
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sentAtMs(job: OutboundJob): number | null {
  const raw = job.timestamps.sentAt;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/** Recomputes at midnight local time (checked every minute while the queue is mounted). */
function useStartOfTodayMs(): number {
  const [t, setT] = useState(startOfTodayMs);
  useEffect(() => {
    const id = window.setInterval(() => setT(startOfTodayMs()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

function updatedAtMs(job: OutboundJob): number {
  return Date.parse(job.timestamps.updated) || 0;
}

function CompanySizeChip({ companySize }: { companySize?: string }) {
  return (
    <div
      className="flex w-10 shrink-0 flex-col items-center justify-center gap-0.5 self-stretch"
      title={`Company Size: ${companySize || "Unknown"}`}
    >
      <span
        aria-label={`Company size: ${companySize || "unknown"}`}
        className={cn(
          "flex h-[22px] w-8 items-center justify-center rounded border font-mono text-[10px] font-bold shadow-sm",
          sizeChipClass(companySize),
        )}
      >
        {sizeText(companySize)}
      </span>
    </div>
  );
}

function QueueStatusBadge({ status }: { status: OutboundJob["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "mr-1 h-5 shrink-0 self-center rounded-sm border px-1.5 py-0 font-mono text-[11px]",
        status === "sent_stub"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {status === "sent_stub" ? "Sent" : "Skipped"}
    </Badge>
  );
}

function QueueRowSummary({
  job,
  atConfig,
  playConfig,
  trailing,
}: {
  job: OutboundJob;
  atConfig: QueueAngleConfig;
  playConfig: QueuePlayConfig;
  trailing?: ReactNode;
}) {
  return (
    <>
      <CompanySizeChip companySize={job.companySize} />
      <div className="min-w-0 flex-1 px-2">
        <p className="truncate text-[14px] font-semibold leading-tight tracking-tight text-foreground">
          {job.lead.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-muted-foreground">
          <span className="max-w-[108px] truncate text-[12px]">{job.company}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground/35">·</span>
          <span className="inline-flex items-center gap-1 truncate text-[11px]">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", atConfig.dot)} />
            {atConfig.label}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground/35">·</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground/90">
            {playConfig.icon}
            {playConfig.label}
          </span>
        </div>
      </div>
      {trailing ?? <div className="w-2 shrink-0" aria-hidden />}
    </>
  );
}

function QueueRow({
  job,
  isSelected,
  onSelect,
  onApprove,
  onArchive,
}: {
  job: OutboundJob;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onArchive: () => void;
}) {
  const isPending = job.status === "pending_review";
  const atConfig = ANGLE_CONFIG[job.angleType] ?? ANGLE_CONFIG.generic;
  const playConfig = getPlayConfig(job.play);

  return (
    <div
      className={cn(
        "group relative flex border-b border-border transition-colors",
        isSelected ? "bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-none" : "hover:bg-muted/40",
        !isPending && !isSelected && "opacity-[0.72]"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex-1 min-w-0 text-left flex items-center gap-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isPending ? "pl-3 pr-2 py-2.5" : "pl-3 pr-2 py-2.5"
        )}
      >
        {isPending ? (
          <>
            <QueueRowSummary job={job} atConfig={atConfig} playConfig={playConfig} />
          </>
        ) : (
          <>
            <QueueRowSummary
              job={job}
              atConfig={atConfig}
              playConfig={playConfig}
              trailing={<QueueStatusBadge status={job.status} />}
            />
          </>
        )}
      </button>

      {isPending && (
        <div className="flex shrink-0 items-center gap-1 pr-2 py-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove();
                  }}
                  aria-label="Approve draft"
                >
                  <CheckCircle size={14} />
                  <span>Approve</span>
                </Button>
              }
            />
            <TooltipContent side="left" className="max-w-[220px] text-left">
              Approve and mark sent. In production this would enqueue your ESP; in this demo it updates InstantDB immediately and moves the lead to Sent.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive();
                  }}
                  aria-label="Skip — mark not approved for send"
                >
                  <SkipForward size={14} />
                  <span>Skip</span>
                </Button>
              }
            />
            <TooltipContent side="right" className="max-w-[220px] text-left">
              Skip — mark not approved for send. It leaves the active queue and stays available in History for audit.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

type QueueSectionKey = "needs_review" | "auto_eligible";

function CollapsibleQueueSection({
  sectionKey,
  title,
  sectionJobs,
  headerClassName,
  open,
  onOpenChange,
  children,
}: {
  sectionKey: QueueSectionKey;
  title: string;
  sectionJobs: OutboundJob[];
  headerClassName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const updated = mostRecentUpdated(sectionJobs);
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} data-section={sectionKey}>
      <CollapsibleTrigger
        className={cn(
          "sticky top-0 z-10 flex w-full items-start gap-2 border-b px-4 py-2 text-left outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          headerClassName,
        )}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 opacity-70 transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-semibold">{title}</h3>
          {updated ? (
            <p className="mt-0.5 text-[10px] font-mono opacity-75">
              {sectionJobs.length} lead{sectionJobs.length !== 1 ? "s" : ""} · updated {updated}
            </p>
          ) : null}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function QueuePlaceholder({
  state,
  errorMessage,
  queueView,
  historyFilter,
}: {
  state: QueueListProps["state"];
  errorMessage?: string;
  queueView: QueueListProps["queueView"];
  historyFilter: QueueListProps["historyFilter"];
}) {
  if (state === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="max-w-[240px] space-y-3 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          <div>
            <p className="text-[13px] font-medium text-foreground">Loading leads…</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Connecting to InstantDB and fetching the latest review queue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="max-w-[260px] space-y-3 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-destructive" aria-hidden />
          <div>
            <p className="text-[13px] font-medium text-foreground">Queue unavailable</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {errorMessage ?? "The review queue could not load right now."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const emptyConfig =
    queueView === "queue"
      ? {
          title: "Queue clear",
          description: "There are no AI-generated drafts waiting for review right now.",
        }
      : historyFilter === "sent_today"
        ? {
            title: "No sends logged today",
            description: "Sent drafts will appear here after the first demo send runs.",
          }
        : historyFilter === "skipped"
          ? {
              title: "No skipped leads yet",
              description: "Skipped drafts stay available here so reviewers can audit why they were passed over.",
            }
          : {
              title: "No history yet",
              description: "Completed review activity will appear here once drafts are sent or skipped.",
            };

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-8">
      <div className="max-w-[240px] space-y-3 text-center">
        <Inbox className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-[13px] font-medium text-foreground">{emptyConfig.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {emptyConfig.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function QueueList({
  jobs,
  selectedJobId,
  onSelectJob,
  onApproveJob,
  onArchiveJob,
  state,
  errorMessage,
  queueView,
  onQueueViewChange,
  historyFilter,
  onHistoryFilterChange,
}: QueueListProps) {
  const todayStart = useStartOfTodayMs();
  const needsReview = jobs.filter((j) => j.governance === "review_required" && j.status === "pending_review");
  const autoEligible = jobs.filter((j) => j.governance === "auto_eligible" && j.status === "pending_review");
  const sentStub = jobs.filter((j) => j.status === "sent_stub");
  const sentToday = sentStub.filter((j) => {
    const t = sentAtMs(j);
    return t == null || t >= todayStart;
  });
  const reviewedOnly = jobs.filter((j) => j.status === "reviewed");
  const pendingCount = needsReview.length + autoEligible.length;
  const completedCount = sentStub.length + reviewedOnly.length;
  const skippedCount = reviewedOnly.length;
  const historyJobs = [...sentStub, ...reviewedOnly].sort((a, b) => updatedAtMs(b) - updatedAtMs(a));
  const visibleHistoryJobs =
    historyFilter === "sent_today"
      ? sentToday
      : historyFilter === "skipped"
        ? reviewedOnly
        : historyJobs;
  const queueJobsVisible = queueView === "queue" ? pendingCount : visibleHistoryJobs.length;

  function getQueueMeta() {
    switch (state) {
      case "loading":
        return "Connecting to InstantDB…";
      case "error":
        return "Queue unavailable";
      case "empty":
        return "No leads yet";
      default:
        return queueView === "queue"
          ? `${pendingCount} awaiting review · ${needsReview.length} suggested · ${autoEligible.length} auto-send`
          : `${completedCount} completed · ${sentToday.length} sent today · ${skippedCount} skipped`;
    }
  }
  const queueMeta = getQueueMeta();

  const [sectionOpen, setSectionOpen] = useState<Partial<Record<QueueSectionKey, boolean>>>({});
  const sectionExpanded = (key: QueueSectionKey) => sectionOpen[key] !== false;
  const setSectionExpanded = (key: QueueSectionKey, value: boolean) =>
    setSectionOpen((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border bg-muted/30 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.06)] md:border-b-0 md:border-r md:shadow-[2px_0_12px_-4px_rgba(0,0,0,0.06)]">
      <div className="shrink-0 px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-foreground tracking-tight">
              {queueView === "queue" ? "Review queue" : "History"}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">{queueMeta}</p>
          </div>
          <div className="flex shrink-0 items-center rounded-lg border border-border/80 bg-background/80 p-1 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={queueView === "queue"}
              className={cn(
                "h-7 rounded-md px-2.5 text-[11px] font-medium",
                queueView === "queue" && "bg-muted text-foreground shadow-sm"
              )}
              onClick={() => onQueueViewChange("queue")}
            >
              Queue
              <span className="font-mono text-[10px] text-muted-foreground">{pendingCount}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={queueView === "history"}
              className={cn(
                "h-7 rounded-md px-2.5 text-[11px] font-medium",
                queueView === "history" && "bg-muted text-foreground shadow-sm"
              )}
              onClick={() => onQueueViewChange("history")}
            >
              History
              <span className="font-mono text-[10px] text-muted-foreground">{completedCount}</span>
            </Button>
          </div>
        </div>
        {state === "ready" && queueView === "history" && completedCount > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["all", "All", completedCount],
              ["sent_today", "Sent Today", sentToday.length],
              ["skipped", "Skipped", skippedCount],
            ] as const).map(([value, label, count]) => (
              <Button
                key={value}
                type="button"
                variant={historyFilter === value ? "secondary" : "outline"}
                size="sm"
                aria-pressed={historyFilter === value}
                className="h-7 rounded-full px-3 text-[11px]"
                onClick={() => onHistoryFilterChange(value)}
              >
                {label}
                <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {state !== "ready" ? (
          <QueuePlaceholder state={state} errorMessage={errorMessage} queueView={queueView} historyFilter={historyFilter} />
        ) : queueJobsVisible === 0 ? (
          <QueuePlaceholder state="ready" queueView={queueView} historyFilter={historyFilter} />
        ) : (
          queueView === "queue" ? (
            <>
              {needsReview.length > 0 && (
                <section className="mb-1">
                  <CollapsibleQueueSection
                    sectionKey="needs_review"
                    title={`Review suggested (${needsReview.length})`}
                    sectionJobs={needsReview}
                    headerClassName="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    open={sectionExpanded("needs_review")}
                    onOpenChange={(v) => setSectionExpanded("needs_review", v)}
                  >
                    {needsReview.map((job) => (
                      <QueueRow
                        key={job.id}
                        job={job}
                        isSelected={selectedJobId === job.id}
                        onSelect={() => onSelectJob(job.id)}
                        onApprove={() => onApproveJob(job.id)}
                        onArchive={() => onArchiveJob(job.id)}
                      />
                    ))}
                  </CollapsibleQueueSection>
                </section>
              )}

              {autoEligible.length > 0 && (
                <section>
                  <CollapsibleQueueSection
                    sectionKey="auto_eligible"
                    title={`Auto-send candidates (${autoEligible.length})`}
                    sectionJobs={autoEligible}
                    headerClassName="border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
                    open={sectionExpanded("auto_eligible")}
                    onOpenChange={(v) => setSectionExpanded("auto_eligible", v)}
                  >
                    {autoEligible.map((job) => (
                      <QueueRow
                        key={job.id}
                        job={job}
                        isSelected={selectedJobId === job.id}
                        onSelect={() => onSelectJob(job.id)}
                        onApprove={() => onApproveJob(job.id)}
                        onArchive={() => onArchiveJob(job.id)}
                      />
                    ))}
                  </CollapsibleQueueSection>
                </section>
              )}
            </>
          ) : (
            <section>
              <div className="sticky top-0 z-10 border-b border-border/70 bg-muted/45 px-4 py-2.5 backdrop-blur-sm">
                <p className="text-[12px] font-semibold text-foreground">
                  {historyFilter === "sent_today"
                    ? `Sent today (${sentToday.length})`
                    : historyFilter === "skipped"
                      ? `Skipped (${reviewedOnly.length})`
                      : `Recent activity (${visibleHistoryJobs.length})`}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {historyFilter === "sent_today"
                    ? "A quick slice of first touches logged since midnight local time."
                    : historyFilter === "skipped"
                      ? "Skipped drafts stay visible here so reviewers can audit decisions without cluttering triage."
                      : "Completed work stays in one audit stream instead of fragmenting the active queue."}
                </p>
              </div>
              {visibleHistoryJobs.map((job) => (
                <QueueRow
                  key={job.id}
                  job={job}
                  isSelected={selectedJobId === job.id}
                  onSelect={() => onSelectJob(job.id)}
                  onApprove={() => onApproveJob(job.id)}
                  onArchive={() => onArchiveJob(job.id)}
                />
              ))}
            </section>
          )
        )}
      </div>
    </div>
  );
}
