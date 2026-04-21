"use client";

import type { OutboundJob } from "@/lib/types";
import { Send, SkipForward } from "lucide-react";

export function ReviewStatusBanner({ job }: { job: OutboundJob }) {
  if (job.status === "pending_review") return null;

  if (job.status === "reviewed") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-start gap-3">
        <SkipForward size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Skipped — not approved for send</p>
          <p className="text-xs mt-0.5 text-muted-foreground">Skipped in active triage. Angle and evidence stay visible for audit.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-950 flex items-start gap-3 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-200">
      <Send size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
      <div>
        <p className="font-medium">Sent — first touch logged</p>
        <p className="text-xs mt-0.5 text-teal-900/90 dark:text-teal-300">
          {job.outcome == null
            ? "Connect email or CRM sync to populate reply and meeting outcomes for Insights."
            : [
                job.outcome.replied === true ? "Reply received" : "No reply yet",
                job.outcome.positive === true ? "Positive outcome logged" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>
    </div>
  );
}
