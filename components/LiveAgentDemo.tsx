"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Play as PlayIcon,
  Sparkles,
  X,
} from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineAgentUIMessage } from "@/lib/pipeline/pipeline-agent";
import type { LeadInput, LeadSource, PlayType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INPUT,
  LEAD_SOURCE_OPTIONS,
  PLAY_OPTIONS,
} from "@/components/live-agent/constants";
import type {
  ExtractSignalsPart,
  GenerateDraftPart,
  PersistJobPart,
  PlanAnglePart,
  RunResearchPart,
  TracePart,
  TraceNode,
} from "@/components/live-agent/types";
import { FieldLabel } from "@/components/live-agent/helpers";
import {
  ExtractSignalsCard,
  GenerateDraftCard,
  PersistJobCard,
  PlanAngleCard,
  RunResearchCard,
} from "@/components/live-agent/tool-cards";
import {
  getPartStatus,
  PIPELINE_PHASES,
  type PhaseName,
  type ToolPartStatus,
} from "@/components/live-agent/phase-panel";
import { getRunStatusViewModel } from "@/components/live-agent/run-status";
import { ArchitectureSection } from "@/components/live-agent/architecture-section";

// ─── Horizontal phase progress bar ───────────────────────────────────────────

function PipelineProgressBar({
  statuses,
  isRunning,
}: {
  statuses: Record<PhaseName, ToolPartStatus>;
  isRunning: boolean;
}) {
  return (
    <div className="flex items-start">
      {PIPELINE_PHASES.map((phase, i) => {
        const status = statuses[phase.id];
        const isLast = i === PIPELINE_PHASES.length - 1;

        return (
          <div key={phase.id} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* Left connector */}
              <div
                className={cn(
                  "h-px flex-1",
                  i === 0 ? "invisible" : "",
                  status === "done" ? "bg-emerald-400" : "bg-zinc-200",
                )}
              />
              {/* Circle */}
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  status === "done"
                    ? "border-emerald-500 bg-emerald-500"
                    : status === "running"
                      ? "border-blue-500 bg-white"
                      : status === "error"
                        ? "border-red-500 bg-red-50"
                        : "border-zinc-300 bg-white",
                )}
              >
                {status === "done" && (
                  <Check className="h-3 w-3 text-white" />
                )}
                {status === "running" && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                )}
                {status === "error" && (
                  <X className="h-3 w-3 text-red-500" />
                )}
              </div>
              {/* Right connector */}
              <div
                className={cn(
                  "h-px flex-1",
                  isLast ? "invisible" : "",
                  status === "done" ? "bg-emerald-400" : "bg-zinc-200",
                )}
              />
            </div>
            {/* Label */}
            <p
              className={cn(
                "mt-1.5 text-center text-[10px] font-medium transition-colors",
                status === "done"
                  ? "text-emerald-600"
                  : status === "running"
                    ? "text-blue-600"
                    : status === "error"
                      ? "text-red-600"
                      : "text-zinc-400",
              )}
            >
              {phase.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveAgentDemo({
  onOpenReviewJob,
}: {
  onOpenReviewJob?: (jobId: string) => void;
}) {
  const [form, setForm] = useState<LeadInput>(DEFAULT_INPUT);
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/jobs/stream",
        prepareSendMessagesRequest: ({ messages, body, trigger, messageId }) => ({
          body: {
            messages: messages.slice(-1),
            trigger,
            messageId,
            ...(body ?? {}),
          },
        }),
      }),
    [],
  );

  const { clearError, error, messages, sendMessage, setMessages, status } =
    useChat<PipelineAgentUIMessage>({ transport });

  const isRunning = status === "submitted" || status === "streaming";
  const freeformContext = form.freeformContext ?? "";
  const isSubmitDisabled = isRunning || freeformContext.trim().length === 0;

  const allParts = useMemo(
    () => messages.flatMap((m) => m.parts ?? []),
    [messages],
  );

  const researchTraceNodes = useMemo(() => {
    const latestNodes = new Map<string, TraceNode>();
    allParts
      .filter((part): part is TracePart => part.type === "data-trace-node")
      .forEach((part) => {
        latestNodes.set(part.data.id, part.data);
      });
    return [...latestNodes.values()].sort((l, r) => l.order - r.order);
  }, [allParts]);

  const phaseStatuses = useMemo(
    () =>
      Object.fromEntries(
        PIPELINE_PHASES.map((p) => [p.id, getPartStatus(allParts, p.toolType)]),
      ) as Record<PhaseName, ToolPartStatus>,
    [allParts],
  );

  const doneCount = Object.values(phaseStatuses).filter(
    (s) => s === "done",
  ).length;
  const hasError =
    Object.values(phaseStatuses).some((s) => s === "error") || !!error;
  const isDone = doneCount === PIPELINE_PHASES.length;
  const activePhase = PIPELINE_PHASES.find(
    (p) => phaseStatuses[p.id] === "running",
  );

  const persistedJobOutput = useMemo(() => {
    const completedPersistParts = allParts.filter(
      (part): part is Extract<PersistJobPart, { state: "output-available" }> =>
        part.type === "tool-persist_job" && part.state === "output-available",
    );
    const latestPart =
      completedPersistParts[completedPersistParts.length - 1];
    if (!latestPart || "error" in latestPart.output) return null;
    return latestPart.output;
  }, [allParts]);

  const notesPreview = useMemo(() => {
    const trimmed = freeformContext.trim();
    return trimmed.length <= 220 ? trimmed : `${trimmed.slice(0, 220)}…`;
  }, [freeformContext]);

  const runStatusView = getRunStatusViewModel({
    activePhaseLabel: activePhase?.label,
    hasError,
    isDone,
    isRunning,
    status,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const leadInput: LeadInput = {
      ...form,
      freeformContext: freeformContext.trim(),
      play: {
        ...form.play,
        context: form.play.context?.trim() || undefined,
      },
      companyDomain: form.companyDomain?.trim() || undefined,
    };
    if (!leadInput.freeformContext) return;
    clearError();
    setMessages([]);
    try {
      await sendMessage(
        {
          text: `Run the live outbound pipeline for ${leadInput.leadName} at ${leadInput.company}.`,
        },
        { body: { leadInput } },
      );
    } catch (submissionError) {
      console.error("Failed to start live run:", submissionError);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-6 py-6">

        {/* ── Section 1: Architecture ───────────────────────────────── */}
        <ArchitectureSection form={form} />

        {/* ── Section 2: Live Pipeline ──────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

          {/* Form */}
          <div className="border-b border-zinc-100 px-6 py-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Demo Path · Live Execution
                  </p>
                  <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-950">
                    Run the pipeline now
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
                    Fill in the lead below and hit Run. The{" "}
                    <span className="font-medium text-zinc-700">
                      ToolLoopAgent
                    </span>{" "}
                    will stream each stage live — research threads, signal
                    extraction, angle planning, and the final draft.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 self-start lg:self-center">
                  <Button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="gap-2"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                    {isRunning ? "Streaming…" : "Run pipeline"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isRunning}
                    onClick={() =>
                      setShowAdvancedInputs((c) => !c)
                    }
                  >
                    {showAdvancedInputs ? "Hide inputs" : "Customize input"}
                  </Button>
                </div>
              </div>

              {/* Sample lead preview */}
              <div className="rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-teal-700">
                      Sample lead loaded
                    </p>
                    <h3 className="mt-1 text-[15px] font-semibold text-zinc-950">
                      {form.leadName} · {form.company}
                    </h3>
                    <p className="mt-1 text-[12px] text-zinc-600">
                      {form.leadTitle}
                      {form.companyDomain ? ` · ${form.companyDomain}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-white/80 text-zinc-700">
                      {form.play.type.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className="bg-white/80 text-zinc-700">
                      {form.play.leadSource.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className="bg-white/80 text-zinc-700">
                      {form.play.label}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-zinc-700">
                  {notesPreview}
                </p>
              </div>

              {/* Advanced inputs */}
              {showAdvancedInputs && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Lead name</FieldLabel>
                    <Input
                      disabled={isRunning}
                      value={form.leadName}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, leadName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Lead title</FieldLabel>
                    <Input
                      disabled={isRunning}
                      value={form.leadTitle}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, leadTitle: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Company</FieldLabel>
                    <Input
                      disabled={isRunning}
                      value={form.company}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, company: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Company domain</FieldLabel>
                    <Input
                      disabled={isRunning}
                      value={form.companyDomain ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          companyDomain: e.target.value || undefined,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Play type</FieldLabel>
                    <select
                      disabled={isRunning}
                      value={form.play.type}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          play: { ...p.play, type: e.target.value as PlayType },
                        }))
                      }
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {PLAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Lead source</FieldLabel>
                    <select
                      disabled={isRunning}
                      value={form.play.leadSource}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          play: {
                            ...p.play,
                            leadSource: e.target.value as LeadSource,
                          },
                        }))
                      }
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {LEAD_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <FieldLabel>Play label</FieldLabel>
                    <Input
                      disabled={isRunning}
                      value={form.play.label}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          play: { ...p.play, label: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <FieldLabel>Play context</FieldLabel>
                    <Textarea
                      disabled={isRunning}
                      value={form.play.context ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          play: {
                            ...p.play,
                            context: e.target.value || undefined,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel>Freeform notes</FieldLabel>
                      <span className="text-[11px] text-zinc-500">Required</span>
                    </div>
                    <Textarea
                      required
                      disabled={isRunning}
                      value={freeformContext}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, freeformContext: e.target.value }))
                      }
                      className="min-h-40"
                      placeholder="Paste rich lead notes, call prep, event context, and any timing signal you want the pipeline to use."
                    />
                    <p className="text-[12px] leading-relaxed text-zinc-500">
                      The agent uses this field as its primary context — paste anything useful here.
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Phase progress bar */}
          {(isRunning || isDone || hasError) && (
            <div className="border-b border-zinc-100 px-6 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                  <p className="text-[11px] font-semibold text-zinc-600">
                    {runStatusView.headline}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("capitalize text-[10px]", runStatusView.badgeClassName)}
                >
                  {runStatusView.badgeLabel}
                </Badge>
              </div>
              <PipelineProgressBar statuses={phaseStatuses} isRunning={isRunning} />
            </div>
          )}

          {/* Agent trace */}
          <div className="px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Agent trace
                  </p>
                  <p className="text-[12px] text-zinc-500">
                    Streamed via AI Elements components
                  </p>
                </div>
              </div>
              {messages.length === 0 && (
                <p className="text-[11px] text-zinc-400">
                  Run the sample to stream the pipeline live
                </p>
              )}
            </div>

            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6">
                  <p className="text-[13px] font-medium text-zinc-700">
                    Timeline will stream here
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                    Research sub-agents, tool calls, structured outputs, and the
                    final queue write appear here in real time as the
                    ToolLoopAgent works through each phase.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent
                      className={cn(
                        message.role === "assistant" ? "gap-3" : "gap-2",
                      )}
                    >
                      {message.parts?.map((part, partIndex) => {
                        if (part.type === "text" && part.text?.trim()) {
                          return (
                            <MessageResponse
                              key={`${message.id}-text-${partIndex}`}
                              className={cn(
                                "text-[13px] leading-relaxed",
                                message.role === "assistant"
                                  ? "text-zinc-700"
                                  : "text-zinc-900",
                              )}
                            >
                              {part.text}
                            </MessageResponse>
                          );
                        }
                        if (part.type === "tool-run_research") {
                          return (
                            <RunResearchCard
                              key={`${message.id}-${partIndex}`}
                              part={part as RunResearchPart}
                              traceNodes={researchTraceNodes}
                            />
                          );
                        }
                        if (part.type === "tool-extract_signals") {
                          return (
                            <ExtractSignalsCard
                              key={`${message.id}-${partIndex}`}
                              part={part as ExtractSignalsPart}
                            />
                          );
                        }
                        if (part.type === "tool-plan_angle") {
                          return (
                            <PlanAngleCard
                              key={`${message.id}-${partIndex}`}
                              part={part as PlanAnglePart}
                            />
                          );
                        }
                        if (part.type === "tool-generate_draft") {
                          return (
                            <GenerateDraftCard
                              key={`${message.id}-${partIndex}`}
                              part={part as GenerateDraftPart}
                            />
                          );
                        }
                        if (part.type === "tool-persist_job") {
                          return (
                            <PersistJobCard
                              key={`${message.id}-${partIndex}`}
                              part={part as PersistJobPart}
                            />
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))
              )}

              {/* Persist success */}
              {persistedJobOutput && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-[12px] font-medium text-emerald-900">
                    Job saved to InstantDB and ready in Lead Review.
                  </p>
                  <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="font-mono text-[11px] text-emerald-800">
                      {persistedJobOutput.jobId} · run{" "}
                      {persistedJobOutput.pipelineRunId}
                    </p>
                    {onOpenReviewJob && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpenReviewJob(persistedJobOutput.jobId)
                        }
                      >
                        Open in Lead Review
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
              <div>
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-red-700">
                  Run failed
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-red-900">
                  {error.message}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
