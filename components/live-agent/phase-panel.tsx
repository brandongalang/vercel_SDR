"use client";

import { type ElementType } from "react";
import {
  Crosshair,
  Database,
  Globe,
  PenTool,
  Server,
} from "lucide-react";
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
