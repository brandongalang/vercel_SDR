"use client";

import type { ReactElement } from "react";
import { Cpu } from "lucide-react";
import { DeltaBadge } from "@/components/dspy/shared";
import type { DspyCompileRun } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CompileRunCardBadge {
  label: string;
  className: string;
}

export function CompileRunCard(input: {
  run: DspyCompileRun;
  badge?: CompileRunCardBadge | null;
  containerClassName?: string;
  positiveMetricLabel: string;
  showDeltas?: boolean;
  note?: string;
}): ReactElement {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(input.run.compiledAt));

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-5 py-4 shadow-sm",
        input.containerClassName,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="text-[13px] font-semibold text-foreground">
              {input.run.optimizer}
            </span>
            {input.badge ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em]",
                  input.badge.className,
                )}
              >
                {input.badge.label}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {date} · {input.run.trainWindowDays}-day lookback · {input.run.jobsUsed} drafts
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
            {input.run.promptVersionBefore} → {input.run.promptVersionAfter}
          </p>
        </div>
        {input.showDeltas === false ? (
          input.note ? (
            <p className="max-w-[260px] text-right text-[11px] leading-relaxed text-muted-foreground">
              {input.note}
            </p>
          ) : null
        ) : (
          <div className="flex shrink-0 flex-wrap gap-3">
            <div className="text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                Approved as-is
              </p>
              <div className="mt-1 flex justify-center">
                <DeltaBadge value={input.run.deltas.cleanAcceptRate} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                Edits needed
              </p>
              <div className="mt-1 flex justify-center">
                <DeltaBadge value={input.run.deltas.editRate} invert />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                {input.positiveMetricLabel}
              </p>
              <div className="mt-1 flex justify-center">
                <DeltaBadge value={input.run.deltas.positiveRate} />
              </div>
            </div>
            {input.run.deltas.replyRate != null ? (
              <div className="text-center">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                  Reply rate
                </p>
                <div className="mt-1 flex justify-center">
                  <DeltaBadge value={input.run.deltas.replyRate} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
