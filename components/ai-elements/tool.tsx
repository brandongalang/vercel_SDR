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

export function getStatusBadge(state: ToolState) {
  switch (state) {
    case "input-streaming":
      return {
        label: "Streaming",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: Loader2,
        iconClassName: "animate-spin",
      };
    case "input-available":
      return {
        label: "Running",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: Loader2,
        iconClassName: "animate-spin",
      };
    case "output-available":
      return {
        label: "Done",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
        iconClassName: "",
      };
    case "output-error":
      return {
        label: "Error",
        className: "border-red-200 bg-red-50 text-red-700",
        icon: AlertTriangle,
        iconClassName: "",
      };
    default:
      return {
        label: "Idle",
        className: "border-zinc-200 bg-zinc-50 text-zinc-500",
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
        className={cn("overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm", className)}
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
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50/80",
        className,
      )}
      onClick={() => setOpen(!open)}
    >
      {icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-zinc-950">{title ?? type}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
              badge.className,
            )}
          >
            <BadgeIcon className={cn("h-3 w-3", badge.iconClassName)} />
            {badge.label}
          </span>
          {trailing}
        </div>

        {description ? (
          <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">{description}</div>
        ) : null}
      </div>

      <ChevronDown
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform",
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
      className={cn("border-t border-zinc-200 px-4 py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function renderValue(value: unknown) {
  if (isValidElement(value)) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-zinc-700">
        {String(value)}
      </div>
    );
  }

  if (value == null) {
    return null;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-700">
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
        "rounded-lg border px-3 py-2",
        tone === "error"
          ? "border-red-200 bg-red-50"
          : "border-zinc-200 bg-zinc-50",
        className,
      )}
    >
      <p
        className={cn(
          "text-[10px] font-mono font-semibold uppercase tracking-[0.12em]",
          tone === "error" ? "text-red-700" : "text-zinc-500",
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
  input: unknown;
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
  output?: unknown;
  errorText?: string;
  title?: string;
  className?: string;
}) {
  if (errorText) {
    return (
      <ToolSection title={title ?? "Error"} tone="error" className={className}>
        <div className="text-[12px] leading-relaxed text-red-900">{errorText}</div>
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
