"use client";

import { type ElementType, type ReactElement } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Database,
  Globe,
  Loader2,
  PenTool,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineAgentUIMessage } from "@/lib/pipeline/pipeline-agent";

export type PhaseName = "research" | "signals" | "angle" | "draft" | "persist";
export type ToolPartStatus = "idle" | "running" | "done" | "error";

export type PhaseInfo = {
  id: PhaseName;
  label: string;
  toolType: string;
  icon: ElementType;
  description: string;
};

type PhaseStatusPresentation = {
  badgeClassName: string;
  containerClassName: string;
  label: string;
};

export const PIPELINE_PHASES: PhaseInfo[] = [
  {
    id: "research",
    label: "Research",
    toolType: "tool-run_research",
    icon: Globe,
    description: "Web search, CRM lookup, and product signals across 2–4 focused threads.",
  },
  {
    id: "signals",
    label: "Extract signals",
    toolType: "tool-extract_signals",
    icon: Server,
    description: "Rank evidence into typed, scored signals for the angle planner.",
  },
  {
    id: "angle",
    label: "Plan angle",
    toolType: "tool-plan_angle",
    icon: Crosshair,
    description: "Choose the strongest hook and timing justification.",
  },
  {
    id: "draft",
    label: "Generate draft",
    toolType: "tool-generate_draft",
    icon: PenTool,
    description: "Write a first-touch outbound email from the angle and signals.",
  },
  {
    id: "persist",
    label: "Save to queue",
    toolType: "tool-persist_job",
    icon: Database,
    description: "Write the job and audit record to InstantDB.",
  },
];

const PHASE_STATUS_PRESENTATION: Record<ToolPartStatus, PhaseStatusPresentation> = {
  idle: {
    badgeClassName: "border-zinc-200 bg-zinc-50 text-zinc-500",
    containerClassName: "border-zinc-200 bg-zinc-50 text-zinc-400",
    label: "Waiting",
  },
  running: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    containerClassName: "border-amber-200 bg-amber-50 text-amber-700",
    label: "Running",
  },
  done: {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    containerClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Done",
  },
  error: {
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    containerClassName: "border-red-200 bg-red-50 text-red-700",
    label: "Error",
  },
};

function renderPhaseStatusIcon(
  status: ToolPartStatus,
  Icon: ElementType,
): ReactElement {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (status === "error") {
    return <AlertTriangle className="h-4 w-4" />;
  }

  return <Icon className="h-4 w-4" />;
}

export function getPartStatus(
  parts: PipelineAgentUIMessage["parts"],
  toolType: string,
): ToolPartStatus {
  const part = parts.find((p) => p.type === toolType);
  if (!part) return "idle";
  const s = (part as { state: string }).state;
  if (s === "output-available") return "done";
  if (s === "output-error") return "error";
  return "running";
}

export function PhaseRow({ phase, status }: { phase: PhaseInfo; status: ToolPartStatus }) {
  const Icon = phase.icon;
  const presentation = PHASE_STATUS_PRESENTATION[status];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
            presentation.containerClassName,
          )}
        >
          {renderPhaseStatusIcon(status, Icon)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-zinc-900">{phase.label}</p>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                presentation.badgeClassName,
              )}
            >
              {presentation.label}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{phase.description}</p>
        </div>
      </div>
    </div>
  );
}
