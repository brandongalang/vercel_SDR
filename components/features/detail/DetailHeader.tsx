"use client";

import type { OutboundJob } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatLeadSource } from "@/lib/format";
import {
  ChevronLeft,
  Info,
  Send,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCompanySize(size?: string): string {
  const labels: Record<string, string> = {
    smb: "SMB",
    mid_market: "Mid-market",
    enterprise: "Enterprise",
    startup: "Startup",
  };
  return size ? (labels[size] ?? size.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) : "Unknown";
}

function ReviewMetadata({ job }: { job: OutboundJob }) {
  const gov =
    job.governance === "review_required"
      ? {
          label: "Review suggested",
          Icon: ShieldAlert,
          className: "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200",
          iconClassName: "text-amber-700 dark:text-amber-400",
        }
      : {
          label: "Auto-send candidates",
          Icon: ShieldCheck,
          className: "border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200",
          iconClassName: "text-sky-600 dark:text-sky-400",
        };
  const GovIcon = gov.Icon;

  const tierStyleMap: Record<string, string> = {
    high: "text-emerald-800 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
    medium: "text-blue-800 border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  };
  const tierStyles = tierStyleMap[job.confidence.tier] ?? "text-muted-foreground border-border bg-muted";
  const signalLabel = job.confidence.tier === "high" ? "Strong Relevance" : job.confidence.tier === "medium" ? "Moderate Relevance" : "Weak Relevance";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Routing</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                  gov.className
                )}
              >
                <GovIcon size={12} className={gov.iconClassName} aria-hidden />
                {gov.label}
              </button>
            }
          />
          <TooltipContent side="bottom" className="max-w-xs text-left">
            {job.governance === "review_required"
              ? "Human review required before sending. Enterprise accounts or low-signal leads always require a review pass."
              : "Eligible for automated sending based on signal strength and account size. Still benefits from a quick review."}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Signal</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                  tierStyles
                )}
              >
                {signalLabel}
                <Info size={11} className="opacity-60" aria-hidden />
              </button>
            }
          />
          <TooltipContent side="bottom" className="max-w-sm text-left leading-snug">
            <p className="mb-1.5 font-medium text-background">{job.confidence.summary}</p>
            {job.confidence.reasons && job.confidence.reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-[11px] opacity-95">
                {job.confidence.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Account</span>
        <span className="inline-flex items-center rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
          {formatCompanySize(job.companySize)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Source</span>
        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {formatLeadSource(job.play.leadSource)}
        </span>
      </div>
    </div>
  );
}

export function DetailHeader({
  job,
  onBackToQueue,
}: {
  job: OutboundJob;
  onBackToQueue?: () => void;
}) {
  const isDone = job.status !== "pending_review";
  const feedbackCaptured = job.feedback?.edited === true;
  const hasStructuredFeedback = feedbackCaptured || Boolean(job.feedback?.editorNote);

  return (
    <div className="z-20 shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
      {onBackToQueue && (
        <div className="mb-3 flex md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
            onClick={onBackToQueue}
          >
            <ChevronLeft size={18} aria-hidden />
            Queue
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {job.status === "reviewed"
              ? "Skipped lead"
              : job.status === "pending_review"
                ? "Draft under review"
                : "Sent lead"}
          </p>
          <h2 className="text-lg font-semibold text-foreground tracking-tight truncate">{job.lead.name}</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="text-foreground/80">{job.company}</span>
            <span className="text-muted-foreground/30 mx-2">·</span>
            {job.lead.title}
          </p>

          {isDone && (
            <div className="mt-4 border-t border-border/60 pt-3">
              <ReviewMetadata job={job} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          {!isDone && (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 lg:max-w-[34rem]">
              <ReviewMetadata job={job} />
            </div>
          )}
          {isDone && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium",
                  job.status === "sent_stub"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                    : "bg-muted border-border text-muted-foreground"
                )}
              >
                {job.status === "reviewed" && <><SkipForward size={12} aria-hidden /> Skipped</>}
                {job.status === "sent_stub" && <><Send size={12} aria-hidden /> Sent</>}
              </span>
              {job.status === "sent_stub" && hasStructuredFeedback && (
                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
                  {feedbackCaptured ? "Edits logged" : "Feedback noted"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
