"use client";

import type { ReactNode } from "react";
import {
  Tool,
  ToolContent,
  ToolHeader,
  type ToolState,
} from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

export type { ToolState };

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-[11px] font-mono uppercase tracking-[0.12em] text-zinc-500">
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

export function shouldForceToolOpen(state: ToolState) {
  void state;
  return false;
}

export function getDefaultToolOpen(state: ToolState) {
  return state === "input-streaming" || state === "input-available" || state === "output-error";
}

export function formatCompactValue(value: unknown): string | null {
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
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry != null)
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

export function PayloadDisclosure({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <details className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </summary>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function TimelineBranch({
  children,
  level = 1,
}: {
  children: ReactNode;
  level?: 1 | 2;
}) {
  return (
    <div className={cn("relative", level === 1 ? "pl-6" : "pl-11")}>
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-0 bottom-0 w-px bg-zinc-200",
          level === 1 ? "left-[11px]" : "left-[31px]",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-5 h-px bg-zinc-200",
          level === 1 ? "left-[11px] w-3" : "left-[31px] w-4",
        )}
      />
      {children}
    </div>
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
      className={cn("border-zinc-200/80 bg-white shadow-none", className)}
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
