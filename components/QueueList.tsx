"use client";

import { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { getPlayConfig } from "@/lib/play-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Archive, CheckCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatRelativeUpdated } from "@/lib/format";

interface QueueListProps {
  jobs: OutboundJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onApproveJob: (jobId: string) => void;
  onArchiveJob: (jobId: string) => void;
}

function governanceMeta(g: OutboundJob["governance"]) {
  if (g === "review_required") {
    return {
      label: "Review",
      short: "Review required",
      Icon: ShieldAlert,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    label: "Auto",
    short: "Auto-eligible",
    Icon: ShieldCheck,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

function confidenceAccent(tier: OutboundJob["confidence"]["tier"]) {
  if (tier === "high") return "text-emerald-700";
  if (tier === "medium") return "text-amber-700";
  return "text-zinc-400";
}

function confidenceBarClass(tier: OutboundJob["confidence"]["tier"]) {
  if (tier === "high") return "bg-emerald-500";
  if (tier === "medium") return "bg-amber-500";
  return "bg-zinc-300";
}

function tierLabel(tier: OutboundJob["confidence"]["tier"]) {
  if (tier === "high") return "High";
  if (tier === "medium") return "Med";
  return "Low";
}

function formatLeadSource(source: OutboundJob["play"]["leadSource"]) {
  return source.replace(/_/g, " ");
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
  const gov = governanceMeta(job.governance);
  const GovIcon = gov.Icon;

  return (
    <div
      className={cn(
        "relative flex border-b border-border transition-colors",
        isSelected ? "bg-zinc-100" : "hover:bg-zinc-50/80",
        !isPending && !isSelected && "opacity-[0.72]"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex-1 min-w-0 text-left flex gap-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isPending ? "pl-2 pr-2 py-3" : "px-4 py-3.5",
          isSelected ? "border-l-[3px] border-l-zinc-900" : "border-l-[3px] border-l-transparent"
        )}
      >
        {isPending && (
          <div
            className="flex shrink-0 w-12 flex-row items-center justify-center gap-1.5 border-r border-border/50 pr-2 mr-1 self-stretch py-3"
            aria-label={`Plan confidence ${job.confidence.tier}`}
          >
            <span
              className={cn("w-1 h-10 shrink-0 rounded-full", confidenceBarClass(job.confidence.tier))}
            />
            <span
              className={cn(
                "text-[9px] font-mono font-bold uppercase tracking-wide leading-none",
                confidenceAccent(job.confidence.tier)
              )}
            >
              {tierLabel(job.confidence.tier)}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1 py-3 pr-1 pl-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0 pr-16">
                {(job.status === "approved" || job.status === "sent_stub") && (
                  <CheckCircle size={14} className="text-emerald-600 shrink-0" aria-hidden />
                )}
                {job.status === "reviewed" && (
                  <Archive size={13} className="text-muted-foreground shrink-0 opacity-80" aria-hidden />
                )}
                <span className="font-semibold text-[13px] text-zinc-900 tracking-tight truncate">
                  {job.lead.name}
                </span>
              </div>
              <p className="text-[12px] text-zinc-500 truncate mt-0.5">{job.company}</p>
            </div>
            {!isPending && (
              <Badge
                variant="outline"
              className={cn(
                "text-[10px] uppercase font-mono rounded-sm px-1.5 py-0 h-5 shrink-0 border",
                job.status === "approved" || job.status === "sent_stub"
                  ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                  : "text-zinc-600 bg-zinc-100 border-zinc-200"
              )}
              >
                {job.status === "approved" ? "Approved" : job.status === "sent_stub" ? "Sent" : "Reviewed"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                atConfig.color
              )}
            >
              {atConfig.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold",
                playConfig.color
              )}
            >
              {playConfig.icon}
              {playConfig.label}
            </span>
            {isPending && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono",
                  gov.className
                )}
                title={gov.short}
              >
                <GovIcon size={11} className="opacity-90 shrink-0" aria-hidden />
                {gov.label}
              </span>
            )}
          </div>

          <p
            className="text-[11px] text-zinc-600 leading-snug mt-2 line-clamp-2 text-left"
            title={job.whyNow}
          >
            {job.whyNow}
          </p>

          <div className="flex items-center justify-between gap-2 mt-2 text-[10px] font-mono text-muted-foreground/70">
            <span className="truncate">
              {formatLeadSource(job.play.leadSource)}
            </span>
            <span className="shrink-0 tabular-nums">{formatRelativeUpdated(job.timestamps.updated)}</span>
          </div>
        </div>
      </button>

      {isPending && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove();
                  }}
                  aria-label="Approve draft"
                >
                  <CheckCircle size={14} />
                </Button>
              }
            />
            <TooltipContent side="left" className="max-w-[220px] text-left">
              Approve draft — keep this recommendation moving. Uses the same current draft shown in the panel, including any edits.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive();
                  }}
                  aria-label="Archive — move to reviewed"
                >
                  <Archive size={14} />
                </Button>
              }
            />
            <TooltipContent side="left" className="max-w-[220px] text-left">
              Archive — mark reviewed without approving send. Moves to the Reviewed section and selects the next pending lead.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export default function QueueList({ jobs, selectedJobId, onSelectJob, onApproveJob, onArchiveJob }: QueueListProps) {
  const needsReview = jobs.filter((j) => j.governance === "review_required" && j.status === "pending_review");
  const autoEligible = jobs.filter((j) => j.governance === "auto_eligible" && j.status === "pending_review");
  const approved = jobs.filter((j) => j.status === "approved" || j.status === "sent_stub");
  const reviewedOnly = jobs.filter((j) => j.status === "reviewed");

  return (
    <div className="w-[min(100%,380px)] shrink-0 border-r border-border bg-card flex flex-col overflow-hidden min-h-0 shadow-[2px_0_12px_-4px_rgba(0,0,0,0.06)]">
      <div className="shrink-0 px-4 py-3.5 border-b border-border bg-card">
        <h2 className="text-[11px] font-mono tracking-[0.12em] uppercase font-semibold text-zinc-500">
          Review queue
        </h2>
        <p className="text-[13px] text-zinc-800 font-medium mt-1 tabular-nums">
          {jobs.filter((j) => j.status === "pending_review").length} pending
          <span className="text-zinc-400 font-normal"> · </span>
          {jobs.length} total
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {needsReview.length > 0 && (
          <section className="mb-1">
            <div className="sticky top-0 z-10 px-4 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-amber-900 bg-amber-50 border-b border-amber-200/80">
              Needs review first ({needsReview.length})
            </div>
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
          </section>
        )}

        {autoEligible.length > 0 && (
          <section className="mb-1">
            <div className="sticky top-0 z-10 px-4 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-700 bg-slate-100 border-b border-slate-200">
              Auto-eligible ({autoEligible.length})
            </div>
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
          </section>
        )}

        {approved.length > 0 && (
          <section className="mb-1">
            <div className="sticky top-0 z-10 px-4 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-900 bg-emerald-50 border-b border-emerald-200/90">
              Approved ({approved.length})
            </div>
            {approved.map((job) => (
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
        )}

        {reviewedOnly.length > 0 && (
          <section>
            <div className="sticky top-0 z-10 px-4 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 bg-zinc-100 border-b border-zinc-200">
              Reviewed ({reviewedOnly.length})
            </div>
            {reviewedOnly.map((job) => (
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
        )}
      </div>
    </div>
  );
}
