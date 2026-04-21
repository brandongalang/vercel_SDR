"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function renderBodyWithHighlight(body: string, span?: string) {
  if (!span) return <span className="whitespace-pre-wrap leading-relaxed">{body}</span>;
  const idx = body.indexOf(span);
  if (idx === -1) return <span className="whitespace-pre-wrap leading-relaxed">{body}</span>;
  const before = body.slice(0, idx);
  const after = body.slice(idx + span.length);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {before}
      <mark className="bg-cyan-100/60 text-zinc-900 dark:bg-cyan-900/40 dark:border-cyan-600/60 dark:text-cyan-100 rounded-[3px] px-0.5 not-italic border-b border-cyan-400/80">
        {span}
      </mark>
      {after}
    </span>
  );
}

export function DraftSection({
  job,
  isDone,
  draftHasEdits,
  onDraftUpdate,
  onResetDraft,
  regenerateNote,
  regenOpen,
  onRegenToggle,
  regenWorkspace,
}: {
  job: OutboundJob;
  isDone: boolean;
  draftHasEdits: boolean;
  onDraftUpdate: (jobId: string, draft: OutboundJob["draft"]) => void;
  onResetDraft: () => void;
  regenerateNote?: string;
  regenOpen: boolean;
  onRegenToggle: () => void;
  regenWorkspace: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const atConfig = ANGLE_CONFIG[job.angleType] ?? ANGLE_CONFIG.generic;

  return (
    <section className="space-y-4">
      <div className="min-w-0 space-y-1 px-0.5">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          At a glance
        </p>
        <p className="max-w-[72ch] text-[13px] leading-relaxed text-foreground/90">
          {job.whyNow ?? job.angle}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-foreground tracking-tight">
              Generated draft
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold",
                atConfig.color
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", atConfig.dot)} aria-hidden />
              {atConfig.label}
            </span>
            {job.outreach?.personAngleStrength && job.outreach.personAngleStrength !== "none" && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                ★ Personal hook
              </span>
            )}
          </div>
        </div>

        {!isDone && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={regenOpen ? "secondary" : "outline"}
              size="sm"
              onClick={onRegenToggle}
            >
              <RotateCcw size={13} />
              {regenOpen ? "Close regenerate" : "Try another version"}
            </Button>
          </div>
        )}
      </div>

      {!isDone && regenOpen && regenWorkspace}

      {draftHasEdits && !isDone && (
        <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200/80 rounded-md px-2 py-1.5 w-fit dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800/80">
          Draft edited — approving keeps these changes.
        </p>
      )}

      <div
        className={cn(
          "rounded-xl border bg-card shadow-sm overflow-hidden transition-colors",
          isEditing ? "border-teal-300" : "border-border hover:border-border/80"
        )}
      >
        <div className="space-y-3 p-4">
          {isEditing ? (
            <input
              className="w-full text-[15px] font-medium bg-secondary/40 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
              value={job.draft.subject}
              onChange={(e) =>
                onDraftUpdate(job.id, { ...job.draft, subject: e.target.value })
              }
              aria-label="Email subject"
            />
          ) : (
            <button
              type="button"
              disabled={isDone}
              onClick={() => {
                if (!isDone) {
                  setIsEditing(true);
                  setTimeout(() => bodyRef.current?.focus(), 50);
                }
              }}
              className={cn(
                "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 -mx-2 -my-1.5 text-left transition-colors",
                !isDone && "cursor-text hover:bg-muted/40"
              )}
              aria-label={isDone ? "Email subject" : "Click to edit email subject"}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 shrink-0">Subject</span>
              <span className="text-[15px] font-semibold text-foreground">{job.draft.subject}</span>
            </button>
          )}

          <div
            className={cn(
              "flex max-h-[min(640px,70vh)] min-h-[200px] flex-col overflow-hidden rounded-xl border transition-shadow focus-within:ring-2 focus-within:ring-ring/50 md:max-h-[min(640px,64vh)] md:min-h-[340px]",
              isEditing
                ? "border-teal-300 ring-1 ring-teal-200/70 bg-card"
                : "border-border bg-card hover:border-border/80",
              !isDone && !isEditing && "cursor-text hover:bg-muted/10"
            )}
          >
            {isEditing ? (
              <textarea
                ref={bodyRef}
                className="min-h-[200px] w-full flex-1 resize-none bg-transparent p-5 text-[15px] leading-relaxed text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:min-h-[320px]"
                value={job.draft.body}
                onChange={(e) =>
                  onDraftUpdate(job.id, { ...job.draft, body: e.target.value, highlightedSpan: undefined })
                }
                aria-label="Email body"
              />
            ) : (
              <button
                type="button"
                disabled={isDone}
                onClick={() => {
                  if (!isDone) {
                    setIsEditing(true);
                    setTimeout(() => bodyRef.current?.focus(), 50);
                  }
                }}
                className={cn(
                  "w-full flex-1 overflow-y-auto p-5 text-left text-[15px] leading-relaxed text-foreground transition-colors",
                  !isDone && "cursor-text hover:bg-muted/30"
                )}
                aria-label={isDone ? "Email body" : "Click to edit email body"}
              >
                {renderBodyWithHighlight(job.draft.body, job.draft.highlightedSpan)}
              </button>
            )}
          </div>

          {draftHasEdits && !isDone && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-1 h-8"
              onClick={() => {
                onResetDraft();
                setIsEditing(false);
              }}
            >
              <RotateCcw size={13} />
              Reset to original draft
            </Button>
          )}
          {regenerateNote && !isDone && (
            <p className="text-[12px] text-muted-foreground bg-muted/60 rounded-md px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">Regenerate note</span>
              <span className="block mt-0.5 text-foreground/90">{regenerateNote}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
