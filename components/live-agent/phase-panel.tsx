"use client";

import { type ElementType } from "react";
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
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
            isRunning && "border-amber-200 bg-amber-50 text-amber-700",
            isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
            isError && "border-red-200 bg-red-50 text-red-700",
            status === "idle" && "border-zinc-200 bg-zinc-50 text-zinc-400",
          )}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isError ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-zinc-900">{phase.label}</p>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                isRunning && "border-amber-200 bg-amber-50 text-amber-700",
                isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
                isError && "border-red-200 bg-red-50 text-red-700",
                status === "idle" && "border-zinc-200 bg-zinc-50 text-zinc-500",
              )}
            >
              {isRunning ? "Running" : isDone ? "Done" : isError ? "Error" : "Waiting"}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{phase.description}</p>
        </div>
      </div>
    </div>
  );
}
