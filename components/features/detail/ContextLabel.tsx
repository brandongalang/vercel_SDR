"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ContextLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/65 transition-colors hover:text-muted-foreground">
              <Info size={12} aria-hidden />
            </span>
          }
        />
        <TooltipContent side="top" className="max-w-[220px] text-left leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
