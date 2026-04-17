"use client";

import type { ReactNode } from "react";
import {
  Tool,
  ToolContent,
  ToolHeader,
  type ToolState,
} from "@/components/ai-elements/tool";
import type { PipelineTraceValue } from "@/lib/pipeline/live-trace";
import { cn } from "@/lib/utils";

export type { ToolState };

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

export function isRunningToolState(state: ToolState) {
  return state === "input-streaming" || state === "input-available";
}

export function getToolPartErrorText(part: { state?: string; errorText?: string }) {
  return part.state === "output-error" ? part.errorText : undefined;
}

function shouldForceToolOpen(state: ToolState) {
  void state;
  return false;
}

function getDefaultToolOpen(state: ToolState) {
  return state === "input-streaming" || state === "input-available" || state === "output-error";
}

function isTraceRecord(
  value: PipelineTraceValue,
): value is Record<string, PipelineTraceValue | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatCompactValue(value: PipelineTraceValue): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 3)
      .map((item) => formatCompactValue(item))
      .filter((item): item is string => Boolean(item))
      .join(" · ");
  }
  if (isTraceRecord(value)) {
    const entries = Object.entries(value)
      .filter((entry): entry is [string, PipelineTraceValue] => entry[1] != null)
      .slice(0, 2)
      .map(([key, entry]) => `${key}: ${formatCompactValue(entry)}`);
    return entries.join(" · ");
  }
  return null;
}

export function formatTimestampLabel(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function PayloadDisclosure({
  label,
  value,
}: {
  label: string;
  value: PipelineTraceValue;
}) {
  if (value == null) return null;
  return (
    <details className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </summary>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/80">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function PipelineToolRow({
  type,
  title,
  state,
  icon,
  description,
  trailing,
  children,
  className,
  contentClassName,
  defaultOpen,
  forceOpen,
}: {
  type: string;
  title: string;
  state: ToolState;
  icon: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}) {
  return (
    <Tool
      key={`${type}-${state}`}
      defaultOpen={defaultOpen ?? getDefaultToolOpen(state)}
      forceOpen={forceOpen ?? shouldForceToolOpen(state)}
      className={cn("border-border/70 bg-card shadow-none", className)}
    >
      <ToolHeader
        type={type}
        state={state}
        title={title}
        icon={icon}
        description={description}
        trailing={trailing}
      />
      {children ? <ToolContent className={contentClassName}>{children}</ToolContent> : null}
    </Tool>
  );
}
