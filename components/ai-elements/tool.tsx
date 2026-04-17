"use client";

import {
  createContext,
  isValidElement,
  useContext,
  useId,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import type { PipelineTraceValue } from "@/lib/pipeline/live-trace";
import { cn } from "@/lib/utils";

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "idle";

type ToolContextValue = {
  contentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ToolContext = createContext<ToolContextValue | null>(null);

function useToolContext() {
  const context = useContext(ToolContext);

  if (!context) {
    throw new Error("Tool components must be used within <Tool>.");
  }

  return context;
}

function getStatusBadge(state: ToolState) {
  switch (state) {
    case "input-streaming":
      return {
        label: "Streaming",
        className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        icon: Loader2,
        iconClassName: "animate-spin",
      };
    case "input-available":
      return {
        label: "Running",
        className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        icon: Loader2,
        iconClassName: "animate-spin",
      };
    case "output-available":
      return {
        label: "Done",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        icon: CheckCircle2,
        iconClassName: "",
      };
    case "output-error":
      return {
        label: "Error",
        className: "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15",
        icon: AlertTriangle,
        iconClassName: "",
      };
    default:
      return {
        label: "Idle",
        className: "border-border bg-muted/50 text-muted-foreground",
        icon: ChevronDown,
        iconClassName: "",
      };
  }
}

type ToolProps = HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean;
  forceOpen?: boolean;
};

function Tool({
  children,
  className,
  defaultOpen = false,
  forceOpen = false,
  ...props
}: ToolProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const resolvedOpen = forceOpen || open;

  return (
    <ToolContext.Provider
      value={{
        contentId,
        open: resolvedOpen,
        setOpen,
      }}
    >
      <div
        data-slot="tool"
        className={cn(
          "overflow-hidden rounded-lg border border-border/70 bg-card/95 shadow-none backdrop-blur-sm",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ToolContext.Provider>
  );
}

type ToolHeaderProps = {
  type: string;
  state: ToolState;
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

function ToolHeader({
  type,
  state,
  title,
  description,
  icon,
  trailing,
  className,
}: ToolHeaderProps) {
  const { contentId, open, setOpen } = useToolContext();
  const badge = getStatusBadge(state);
  const BadgeIcon = badge.icon;

  return (
    <button
      type="button"
      aria-controls={contentId}
      aria-expanded={open}
      className={cn(
        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
        className,
      )}
      onClick={() => setOpen(!open)}
    >
      {icon ? (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-medium text-foreground">{title ?? type}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide",
              badge.className,
            )}
          >
            <BadgeIcon className={cn("h-3 w-3", badge.iconClassName)} />
            {badge.label}
          </span>
          {trailing}
        </div>

        {description ? (
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</div>
        ) : null}
      </div>

      <ChevronDown
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

function ToolContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { contentId, open } = useToolContext();

  if (!open) {
    return null;
  }

  return (
    <div
      id={contentId}
      data-slot="tool-content"
      className={cn("border-t border-border/60 px-3 pb-3 pt-2.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type ToolRenderableValue = PipelineTraceValue | ReactNode;

function renderValue(value: ToolRenderableValue) {
  if (isValidElement(value)) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/80">
        {String(value)}
      </div>
    );
  }

  if (value == null) {
    return null;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/80">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ToolSection({
  title,
  children,
  className,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 dark:border-destructive/40 dark:bg-destructive/15"
          : "border-border bg-muted/40",
        className,
      )}
    >
      <p
        className={cn(
          "text-[10px] font-mono font-semibold uppercase tracking-[0.12em]",
          tone === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ToolInput({
  input,
  title = "Input",
  className,
}: {
  input: PipelineTraceValue;
  title?: string;
  className?: string;
}) {
  if (input == null) {
    return null;
  }

  return (
    <ToolSection title={title} className={className}>
      {renderValue(input)}
    </ToolSection>
  );
}

function ToolOutput({
  output,
  errorText,
  title,
  className,
}: {
  output?: ToolRenderableValue;
  errorText?: string;
  title?: string;
  className?: string;
}) {
  if (errorText) {
    return (
      <ToolSection title={title ?? "Error"} tone="error" className={className}>
        <div className="text-[12px] leading-relaxed text-destructive">{errorText}</div>
      </ToolSection>
    );
  }

  if (output == null) {
    return null;
  }

  return (
    <ToolSection title={title ?? "Output"} className={className}>
      {renderValue(output)}
    </ToolSection>
  );
}

export { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput };
