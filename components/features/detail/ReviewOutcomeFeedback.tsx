"use client";

import { MessageSquareText, SkipForward, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReviewOutcomeFeedbackKind = "approve_with_edits" | "skip";

function getFeedbackCopy(kind: ReviewOutcomeFeedbackKind) {
  if (kind === "skip") {
    return {
      title: "Optional skip feedback",
      description: "Why are you skipping this lead? A quick note helps us understand what made it a pass.",
      placeholder: "Missing relevance, weak timing, awkward tone, wrong persona...",
      accent: "border-amber-200/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20",
      iconClassName: "text-amber-700 dark:text-amber-300",
      primaryLabel: "Save note and skip",
      secondaryLabel: "Skip without feedback",
      Icon: SkipForward,
    };
  }

  return {
    title: "Optional edit feedback",
    description: "What made your version better? A sentence or two is enough.",
    placeholder: "Tightened the opener, reduced certainty, made the CTA feel more natural...",
    accent: "border-teal-200/80 bg-teal-50/70 dark:border-teal-900 dark:bg-teal-950/20",
    iconClassName: "text-teal-700 dark:text-teal-300",
    primaryLabel: "Save note and approve",
    secondaryLabel: "Approve without feedback",
    Icon: WandSparkles,
  };
}

export function ReviewOutcomeFeedback({
  kind,
  value,
  onChange,
  onSubmit,
  onContinueWithoutFeedback,
}: {
  kind: ReviewOutcomeFeedbackKind;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onContinueWithoutFeedback: () => void;
}) {
  const copy = getFeedbackCopy(kind);
  const Icon = copy.Icon;

  return (
    <section
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        copy.accent,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 bg-background/80">
          <Icon className={cn("h-4 w-4", copy.iconClassName)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-foreground">{copy.title}</p>
              <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                <MessageSquareText className="h-3 w-3" aria-hidden />
                Every 12 actions
              </span>
            </div>
            <p className="max-w-[72ch] text-[12px] leading-relaxed text-muted-foreground">
              {copy.description}
            </p>
          </div>

          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={copy.placeholder}
            className="min-h-[92px] w-full resize-y rounded-lg border border-border bg-background/95 px-3 py-2.5 text-[13px] leading-relaxed text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            aria-label={copy.title}
            autoFocus
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Optional. The action still completes if you skip the note.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onContinueWithoutFeedback}>
                {copy.secondaryLabel}
              </Button>
              <Button type="button" size="sm" onClick={onSubmit}>
                {copy.primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
