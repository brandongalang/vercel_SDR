"use client";

import { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { getPlayConfig } from "@/lib/play-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SkipForward, CheckCircle } from "lucide-react";
import { formatRelativeUpdated } from "@/lib/format";

interface QueueListProps {
  jobs: OutboundJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onApproveJob: (jobId: string) => void;
  onArchiveJob: (jobId: string) => void;
}

function confidenceChipClass(tier: OutboundJob["confidence"]["tier"]) {
  if (tier === "high") return "bg-emerald-500 text-white";
  if (tier === "medium") return "bg-amber-400 text-white";
  return "bg-zinc-300 text-zinc-700";
}

function tierLetter(tier: OutboundJob["confidence"]["tier"]) {
  if (tier === "high") return "H";
  if (tier === "medium") return "M";
  return "L";
}

function mostRecentUpdated(sectionJobs: OutboundJob[]): string | null {
  if (sectionJobs.length === 0) return null;
  const latest = sectionJobs.reduce((a, b) =>
    new Date(a.timestamps.updated) > new Date(b.timestamps.updated) ? a : b
  );
  return formatRelativeUpdated(latest.timestamps.updated);
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
        isSelected ? "bg-zinc-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" : "hover:bg-zinc-50/80",
        !isPending && !isSelected && "opacity-[0.72]"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex-1 min-w-0 text-left flex items-center gap-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isPending ? "pl-2 pr-2 py-2.5" : "pl-3 pr-3 py-2",
          isSelected ? "border-l-[3px] border-l-zinc-900" : "border-l-[3px] border-l-transparent"
        )}
      >
        {isPending ? (
          <>
            {/* Zone 1 — Confidence chip */}
            <div
              className="flex shrink-0 w-9 items-center justify-center self-stretch"
              aria-label={`Confidence ${job.confidence.tier}`}
            >
              <span
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-[11px]",
                  confidenceChipClass(job.confidence.tier)
                )}
              >
                {tierLetter(job.confidence.tier)}
              </span>
            </div>

            {/* Zone 2 — Identity + context */}
            <div className="min-w-0 flex-1 px-2">
              <p className="font-semibold text-[13px] text-zinc-900 tracking-tight truncate leading-tight">
                {job.lead.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[12px] text-zinc-500 truncate max-w-[90px]">{job.company}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[10px] font-mono uppercase tracking-wide shrink-0",
                    atConfig.color
                  )}
                >
                  {atConfig.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[10px] font-mono font-semibold shrink-0",
                    playConfig.color
                  )}
                >
                  {playConfig.icon}
                  {playConfig.label}
                </span>
              </div>
            </div>

            {/* Zone 3 — spacer for hover quick-actions overlay */}
            <div className="shrink-0 w-[68px]" aria-hidden />
          </>
        ) : (
          /* Done row — single scanline */
          <>
            <div className="min-w-0 flex-1 flex items-center gap-1.5 min-h-[42px]">
              {(job.status === "approved" || job.status === "sent_stub") && (
                <CheckCircle size={13} className="text-emerald-600 shrink-0" aria-hidden />
              )}
              {job.status === "reviewed" && (
                <SkipForward size={12} className="text-muted-foreground shrink-0 opacity-80" aria-hidden />
              )}
              <span className="font-semibold text-[13px] text-zinc-900 tracking-tight truncate">
                {job.lead.name}
              </span>
              <span className="text-zinc-400 shrink-0 text-[11px]">·</span>
              <span className="text-[12px] text-zinc-500 truncate">{job.company}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[10px] font-mono uppercase tracking-wide shrink-0",
                  atConfig.color
                )}
              >
                {atConfig.label}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase font-mono rounded-sm px-1.5 py-0 h-5 shrink-0 border ml-2",
                job.status === "approved" || job.status === "sent_stub"
                  ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                  : "text-zinc-600 bg-zinc-100 border-zinc-200"
              )}
            >
              {job.status === "approved" ? "Approved" : job.status === "sent_stub" ? "Sent" : "Skipped"}
            </Badge>
          </>
        )}
      </button>

      {isPending && (
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity duration-150">
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
                  aria-label="Skip — mark not approved for send"
                >
                  <SkipForward size={14} />
                </Button>
              }
            />
            <TooltipContent side="right" className="max-w-[220px] text-left">
              Skip — mark not approved for send. Moves to the Skipped section and selects the next pending lead.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  sectionJobs,
  className,
}: {
  title: string;
  sectionJobs: OutboundJob[];
  className: string;
}) {
  const updated = mostRecentUpdated(sectionJobs);
  return (
    <div className={cn("sticky top-0 z-10 px-4 py-2 border-b", className)}>
      <span className="text-[12px] font-semibold">{title}</span>
      {updated && (
        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
          {sectionJobs.length} lead{sectionJobs.length !== 1 ? "s" : ""} · updated {updated}
        </p>
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
    <div className="flex min-h-[40vh] flex-1 flex-col overflow-hidden border-b border-border bg-card shadow-[0_4px_12px_-4px_rgba(0,0,0,0.06)] md:min-h-0 md:w-[min(100%,380px)] md:flex-none md:border-b-0 md:border-r md:shadow-[2px_0_12px_-4px_rgba(0,0,0,0.06)]">
      <div className="shrink-0 px-4 py-3.5 border-b border-border bg-card">
        <h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
          Review queue
        </h2>
        <p className="text-[12px] text-zinc-500 mt-0.5 tabular-nums">
          {jobs.filter((j) => j.status === "pending_review").length} pending
          <span className="text-zinc-300 font-normal mx-1">·</span>
          {jobs.length} total
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {needsReview.length > 0 && (
          <section className="mb-1">
            <SectionHeader
              title={`Needs review first (${needsReview.length})`}
              sectionJobs={needsReview}
              className="text-amber-900 bg-amber-50 border-amber-200/80"
            />
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
            <SectionHeader
              title={`Auto-eligible (${autoEligible.length})`}
              sectionJobs={autoEligible}
              className="text-slate-700 bg-slate-100 border-slate-200"
            />
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
            <SectionHeader
              title={`Approved (${approved.length})`}
              sectionJobs={approved}
              className="text-emerald-900 bg-emerald-50 border-emerald-200/90"
            />
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
            <SectionHeader
              title={`Skipped (${reviewedOnly.length})`}
              sectionJobs={reviewedOnly}
              className="text-zinc-600 bg-zinc-100 border-zinc-200"
            />
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
