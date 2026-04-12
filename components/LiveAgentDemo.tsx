"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Play as PlayIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineAgentUIMessage } from "@/lib/pipeline/pipeline-agent";
import type { LeadInput, LeadSource, PlayType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DEFAULT_INPUT, LEAD_SOURCE_OPTIONS, PLAY_OPTIONS } from "@/components/live-agent/constants";
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
  PhaseRow,
  PIPELINE_PHASES,
  type PhaseName,
  type ToolPartStatus,
} from "@/components/live-agent/phase-panel";

export default function LiveAgentDemo() {
  const [form, setForm] = useState<LeadInput>(DEFAULT_INPUT);

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

    return [...latestNodes.values()].sort((left, right) => left.order - right.order);
  }, [allParts]);

  const phaseStatuses = useMemo(
    () =>
      Object.fromEntries(
        PIPELINE_PHASES.map((p) => [p.id, getPartStatus(allParts, p.toolType)]),
      ) as Record<PhaseName, ToolPartStatus>,
    [allParts],
  );

  const doneCount = Object.values(phaseStatuses).filter((s) => s === "done").length;
  const progressPercent = Math.round((doneCount / PIPELINE_PHASES.length) * 100);
  const activePhase = PIPELINE_PHASES.find((p) => phaseStatuses[p.id] === "running");
  const hasError = Object.values(phaseStatuses).some((s) => s === "error") || !!error;
  const isDone = doneCount === PIPELINE_PHASES.length;

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
    <div className="flex min-h-0 w-full flex-1 overflow-hidden border-t border-zinc-200 bg-zinc-50 text-zinc-900">
      {/* Left panel — pipeline phases */}
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-100/60 p-6">
        <div className="flex items-center gap-2">
          <PlayIcon className="h-4 w-4 text-zinc-900" />
          <h2 className="text-[12px] font-semibold">Live pipeline</h2>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
          Each phase below updates live as the agent calls its corresponding tool, while the
          trace panel exposes spawned research sub-agents and their payloads.
        </p>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Run status
              </p>
              <p className="mt-1 text-[15px] font-medium text-zinc-950">
                {isRunning
                  ? activePhase
                    ? `${activePhase.label} in progress`
                    : "Submitting live run"
                  : hasError
                    ? "Run failed"
                    : isDone
                      ? "Run completed"
                      : "Ready to stream"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "capitalize",
                hasError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isRunning
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600",
              )}
            >
              {hasError ? "Failed" : isDone ? "Completed" : isRunning ? status : "Idle"}
            </Badge>
          </div>
          <div className="mt-4 h-2 rounded-full bg-zinc-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                hasError ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-amber-500",
              )}
              style={{ width: `${Math.max(progressPercent, isRunning ? 8 : 0)}%` }}
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {PIPELINE_PHASES.map((phase) => (
            <PhaseRow key={phase.id} phase={phase} status={phaseStatuses[phase.id]} />
          ))}
        </div>
      </div>

      {/* Right panel — form + live agent trace */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-6 py-6">
          {/* Form */}
          <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Run a live lead
                  </p>
                  <h1 className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-950">
                    Create one real outbound job through the streaming demo pipeline
                  </h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                    Structured fields keep the demo consistent; the notes field provides rich context for the agent.
                  </p>
                </div>
                <Button type="submit" disabled={isSubmitDisabled} className="gap-2 self-start lg:self-center">
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayIcon className="h-4 w-4" />
                  )}
                  {isRunning ? "Streaming…" : "Run live agent"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Lead name</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.leadName}
                    onChange={(e) => setForm((prev) => ({ ...prev, leadName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Lead title</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.leadTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, leadTitle: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Company</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.company}
                    onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Company domain</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.companyDomain ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
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
                      setForm((prev) => ({
                        ...prev,
                        play: { ...prev.play, type: e.target.value as PlayType },
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
                      setForm((prev) => ({
                        ...prev,
                        play: { ...prev.play, leadSource: e.target.value as LeadSource },
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
                      setForm((prev) => ({
                        ...prev,
                        play: { ...prev.play, label: e.target.value },
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
                      setForm((prev) => ({
                        ...prev,
                        play: { ...prev.play, context: e.target.value || undefined },
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
                      setForm((prev) => ({ ...prev, freeformContext: e.target.value }))
                    }
                    className="min-h-40"
                    placeholder="Paste rich lead notes, call prep, event context, and any timing signal you want the pipeline to use."
                  />
                  <p className="text-[12px] leading-relaxed text-zinc-500">
                    The agent uses this field as its primary context — paste anything useful here.
                  </p>
                </div>
              </div>
            </form>
          </section>

          {/* Live agent trace */}
          <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-500" />
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Agent trace
                </p>
              </div>
              {messages.length === 0 ? (
                <p className="text-[11px] text-zinc-400">
                  Submit the form above to stream the pipeline live
                </p>
              ) : null}
            </div>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6">
                  <p className="text-[13px] font-medium text-zinc-700">Timeline will stream here</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                    Rows appear only when the live agent starts each phase, with research threads and tool calls nested underneath.
                  </p>
                </div>
              ) : (
                messages.map((message) =>
                  message.parts?.map((part, partIndex) => {
                    if (part.type === "text" && part.text?.trim()) {
                      return (
                        <div
                          key={`${message.id}-text-${partIndex}`}
                          className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
                        >
                          <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wide text-zinc-400">
                            Orchestrator
                          </p>
                          <p className="text-[13px] leading-relaxed text-zinc-700">{part.text}</p>
                        </div>
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
                    if (part.type === "data-trace-node" || part.type === "step-start") {
                      return null;
                    }
                    return null;
                  })
                )
              )}
            </div>
          </section>

          {error ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
                <div>
                  <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-red-700">
                    Run failed
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-red-900">{error.message}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
