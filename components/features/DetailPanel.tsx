"use client";

import { useState } from "react";
import type { OutboundJob } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  Inbox,
  Loader2,
  ChevronLeft,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailHeader } from "./detail/DetailHeader";
import { ReviewStatusBanner } from "./detail/ReviewStatusBanner";
import { DraftSection } from "./detail/DraftSection";
import { RegenerationWorkspace } from "./detail/RegenerationWorkspace";
import { AngleContextSection } from "./detail/AngleContextSection";

function DetailPanelEmptyState({
  state,
  errorMessage,
  isLoadingSlow,
  onBackToQueue,
}: {
  state: "loading" | "error" | "empty" | "complete" | "idle" | "ready";
  errorMessage?: string;
  isLoadingSlow?: boolean;
  onBackToQueue?: () => void;
}) {
  function getEmptyStateConfig() {
    switch (state) {
      case "loading":
        return {
          Icon: Loader2,
          iconClassName: "animate-spin text-muted-foreground",
          title: "Loading lead review queue",
          description: "Connecting to InstantDB and pulling the latest drafted leads into review.",
          detail: isLoadingSlow
            ? "This is taking longer than usual. You can still switch to Analytics, DSPy, or Live Agent while the queue connects."
            : undefined,
        };
      case "error":
        return {
          Icon: AlertTriangle,
          iconClassName: "text-destructive",
          title: "Couldn't load the review queue",
          description: errorMessage ?? "The review queue is unavailable right now.",
          detail: "You can still use the other demo surfaces while this connection issue is unresolved.",
        };
      case "empty":
        return {
          Icon: Inbox,
          iconClassName: "text-muted-foreground",
          title: "No leads in review yet",
          description: "Run the live pipeline to create a lead, or reseed demo data if this environment supports it.",
          detail: undefined,
        };
      case "complete":
        return {
          Icon: CheckCircle,
          iconClassName: "text-emerald-600",
          title: "All caught up",
          description: "There are no AI-generated drafts waiting for review.",
          detail: "Switch to History to audit sent or skipped leads without bringing them back into the active queue.",
        };
      default:
        return {
          Icon: Inbox,
          iconClassName: "text-muted-foreground",
          title: "Select a lead",
          description: "Choose a lead in the queue to review the draft and supporting evidence.",
          detail: undefined,
        };
    }
  }
  const config = getEmptyStateConfig();
  const Icon = config.Icon;

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/15 px-6 min-h-0">
      <div className="max-w-[360px] space-y-3 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
          <Icon className={cn("h-5 w-5", config.iconClassName)} aria-hidden />
        </div>
        <div className="space-y-1.5">
          <p className="text-[14px] font-medium text-foreground">{config.title}</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {config.description}
          </p>
          {config.detail && (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {config.detail}
            </p>
          )}
          {onBackToQueue && (
            <div className="pt-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onBackToQueue}>
                <ChevronLeft size={16} aria-hidden />
                Back to queue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DetailPanel({
  job,
  onApprove,
  onArchive,
  onDraftUpdate,
  onResetDraft,
  onRegenerateNote,
  draftHasEdits,
  regenerateNote,
  onBackToQueue,
  state,
  errorMessage,
  isLoadingSlow,
}: {
  job: OutboundJob | null;
  onApprove: (jobId: string, payload: { subject: string; body: string; edited: boolean; editorNote?: string }) => void;
  onArchive: (jobId: string) => void;
  onDraftUpdate: (jobId: string, draft: OutboundJob["draft"]) => void;
  onResetDraft: (jobId: string) => void;
  onRegenerateNote: (jobId: string, note: string | undefined) => void;
  draftHasEdits: boolean;
  regenerateNote?: string;
  onBackToQueue?: () => void;
  state: "loading" | "error" | "empty" | "complete" | "idle" | "ready";
  errorMessage?: string;
  isLoadingSlow?: boolean;
}) {
  const [regenOpen, setRegenOpen] = useState(false);

  if (!job) {
    return (
      <DetailPanelEmptyState
        state={state}
        errorMessage={errorMessage}
        isLoadingSlow={isLoadingSlow}
        onBackToQueue={onBackToQueue}
      />
    );
  }

  const isDone = job.status !== "pending_review";
  const showReviewState = draftHasEdits;

  const handleApprove = () => {
    onApprove(job.id, {
      subject: job.draft.subject,
      body: job.draft.body,
      edited: draftHasEdits,
      editorNote: regenerateNote,
    });
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background min-h-0 overflow-hidden">
        <DetailHeader job={job} onBackToQueue={onBackToQueue} />

        <div className="flex-1 overflow-y-auto min-h-0 bg-muted/40">
          <div className="mx-auto w-full max-w-[1380px] space-y-8 px-4 py-6 pb-4 sm:px-6">
            <ReviewStatusBanner job={job} />

            <DraftSection
              job={job}
              isDone={isDone}
              draftHasEdits={draftHasEdits}
              onDraftUpdate={onDraftUpdate}
              onResetDraft={() => onResetDraft(job.id)}
              regenerateNote={regenerateNote}
              regenOpen={regenOpen}
              onRegenToggle={() => setRegenOpen((open) => !open)}
              regenWorkspace={
                <RegenerationWorkspace
                  job={job}
                  onDraftUpdate={onDraftUpdate}
                  onRegenerateNote={onRegenerateNote}
                />
              }
            />

            <AngleContextSection job={job} />
          </div>
        </div>

        {!isDone && (
          <div className="shrink-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-2.5 [will-change:backdrop-filter]">
            <div
              className={cn(
                "mx-auto flex w-full max-w-[1380px] items-center gap-3",
                showReviewState ? "justify-between" : "justify-end"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {draftHasEdits && (
                  <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-1 shrink-0 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800">
                    Draft edited
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
                  )}
                  onClick={handleApprove}
                >
                  <CheckCircle size={13} />
                  {draftHasEdits ? "Approve with edits" : "Approve draft"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  onClick={() => onArchive(job.id)}
                >
                  <SkipForward size={13} />
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
