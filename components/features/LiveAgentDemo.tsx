"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  useMemo,
  useState,
  useId,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  Play as PlayIcon,
  RotateCcw,
  Square,
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
} from "@/lib/pipeline/agent-ui-types";
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

function PipelineProgressBar({
  statuses,
}: {
  statuses: Record<PhaseName, ToolPartStatus>;
}) {
  return (
    <div className="flex items-start">
      {PIPELINE_PHASES.map((phase, i) => {
        const status = statuses[phase.id];
        const isLast = i === PIPELINE_PHASES.length - 1;

        return (
          <div key={phase.id} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  "h-px flex-1",
                  i === 0 ? "invisible" : "",
                  status === "done" ? "bg-emerald-400" : "bg-border",
                )}
              />
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  status === "done"
                    ? "border-emerald-500 bg-emerald-500"
                    : status === "running"
                      ? "border-blue-500 bg-card"
                      : status === "error"
                        ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                        : "border-border bg-card",
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
              <div
                className={cn(
                  "h-px flex-1",
                  isLast ? "invisible" : "",
                  status === "done" ? "bg-emerald-400" : "bg-border",
                )}
              />
            </div>
            <p
              className={cn(
                "mt-1.5 text-center text-[10px] font-medium transition-colors",
                status === "done"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : status === "running"
                    ? "text-blue-600 dark:text-blue-400"
                    : status === "error"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground/60",
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

export default function LiveAgentDemo({
  onOpenReviewJob,
}: {
  onOpenReviewJob?: (jobId: string) => void;
}) {
  const [form, setForm] = useState<LeadInput>(DEFAULT_INPUT);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [runWasStopped, setRunWasStopped] = useState(false);
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const fieldIdBase = useId();
  const fieldIds = useMemo(
    () => ({
      leadName: `${fieldIdBase}-lead-name`,
      leadTitle: `${fieldIdBase}-lead-title`,
      company: `${fieldIdBase}-company`,
      companyDomain: `${fieldIdBase}-company-domain`,
      playType: `${fieldIdBase}-play-type`,
      leadSource: `${fieldIdBase}-lead-source`,
      playLabel: `${fieldIdBase}-play-label`,
      playContext: `${fieldIdBase}-play-context`,
      freeformNotes: `${fieldIdBase}-freeform-notes`,
    }),
    [fieldIdBase],
  );

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

  const { clearError, error, messages, sendMessage, setMessages, status, stop } =
    useChat<PipelineAgentUIMessage>({ transport });

  const isRunning = status === "submitted" || status === "streaming";
  const freeformContext = form.freeformContext ?? "";
  const isSubmitDisabled = isRunning || freeformContext.trim().length === 0;
  const displayErrorMessage = error?.message ?? submissionError;

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
    Object.values(phaseStatuses).some((s) => s === "error") || displayErrorMessage != null;
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

  const latestSignalsOutput = useMemo(() => {
    const completedSignalParts = allParts.filter(
      (part): part is Extract<ExtractSignalsPart, { state: "output-available" }> =>
        part.type === "tool-extract_signals" && part.state === "output-available",
    );
    const latestPart = completedSignalParts[completedSignalParts.length - 1];
    if (!latestPart || "error" in latestPart.output) return null;
    return latestPart.output;
  }, [allParts]);

  const latestAngleOutput = useMemo(() => {
    const completedAngleParts = allParts.filter(
      (part): part is Extract<PlanAnglePart, { state: "output-available" }> =>
        part.type === "tool-plan_angle" && part.state === "output-available",
    );
    const latestPart = completedAngleParts[completedAngleParts.length - 1];
    if (!latestPart || "error" in latestPart.output) return null;
    return latestPart.output;
  }, [allParts]);

  const latestDraftOutput = useMemo(() => {
    const completedDraftParts = allParts.filter(
      (part): part is Extract<GenerateDraftPart, { state: "output-available" }> =>
        part.type === "tool-generate_draft" && part.state === "output-available",
    );
    const latestPart = completedDraftParts[completedDraftParts.length - 1];
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
  const playTypeLabel =
    PLAY_OPTIONS.find((option) => option.value === form.play.type)?.label ??
    form.play.type.replace(/_/g, " ");
  const leadSourceLabel =
    LEAD_SOURCE_OPTIONS.find(
      (option) => option.value === form.play.leadSource,
    )?.label ?? form.play.leadSource.replace(/_/g, " ");
  const proofPoints = [
    {
      title: "Live orchestration",
      description:
        "Run a seeded lead through the real research, signal ranking, angle planning, and draft generation flow.",
    },
    {
      title: "Inspectable evidence",
      description:
        "Open each streamed tool card to see the proof layer instead of trusting a black-box result.",
    },
    {
      title: "Production continuity",
      description:
        "The durable path below reuses the same payload and shared execution core once the live trace looks right.",
    },
  ];
  const submitHelperText = isRunning
    ? "The seeded sample is locked while the live run streams."
    : freeformContext.trim().length === 0
      ? "Add notes in Edit sample input to enable the run."
      : "The seeded sample already includes context, so you can run it immediately.";
  const traceHighlights = [
    latestSignalsOutput
      ? {
          label: "Top signal",
          value: latestSignalsOutput.topSignals[0]?.label ?? "Signals ranked",
          detail: `${latestSignalsOutput.signalCount} ranked · ${latestSignalsOutput.discardedCount} discarded`,
        }
      : null,
    latestAngleOutput
      ? {
          label: "Chosen angle",
          value: latestAngleOutput.angle,
          detail: `${latestAngleOutput.confidenceTier} confidence`,
        }
      : null,
    persistedJobOutput
      ? {
          label: "Review handoff",
          value: persistedJobOutput.jobId,
          detail: "Saved to Lead Review",
        }
      : latestDraftOutput
        ? {
            label: "Draft subject",
            value: latestDraftOutput.subject,
            detail: latestDraftOutput.highlightedSpan
              ? "Highlight span captured"
              : "Draft ready for review",
          }
        : activePhase
          ? {
              label: "Current focus",
              value: activePhase.label,
              detail: activePhase.description,
            }
          : null,
  ].filter((highlight): highlight is { label: string; value: string; detail: string } => highlight !== null);

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
    setSubmissionError(null);
    setRunWasStopped(false);
    setMessages([]);
    try {
      await sendMessage(
        {
          text: `Run the live outbound pipeline for ${leadInput.leadName} at ${leadInput.company}.`,
        },
        { body: { leadInput } },
      );
    } catch (err) {
      setSubmissionError(
        err instanceof Error
          ? err.message
          : "Failed to start live run",
      );
    }
  }

  function handleStopRun() {
    stop();
    setRunWasStopped(true);
    setSubmissionError(null);
  }

  function handleClearTrace() {
    stop();
    clearError();
    setSubmissionError(null);
    setRunWasStopped(false);
    setMessages([]);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 text-foreground">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-6 sm:px-6">
        <ArchitectureSection form={form} />

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/50 px-6 py-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Live Execution · Demo First
                    </p>
                    <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
                      Run the pipeline, then inspect why it worked
                    </h2>
                    <p className="mt-2 max-w-[66ch] text-[13px] leading-relaxed text-muted-foreground">
                      Start with the seeded lead to show the full research-to-draft
                      loop in one click. The streamed trace below is the proof
                      layer for the interviewer; the production mapping comes
                      after the run, once the logic is legible.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                      {isRunning ? "Streaming live run…" : "Run sample pipeline"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isRunning}
                      onClick={() => setShowAdvancedInputs((current) => !current)}
                      className="gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-150",
                          showAdvancedInputs && "rotate-90",
                        )}
                      />
                      {showAdvancedInputs ? "Hide advanced input" : "Edit sample input"}
                    </Button>
                    {isRunning ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleStopRun}
                        className="gap-2"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" />
                        Stop stream
                      </Button>
                    ) : messages.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearTrace}
                        className="gap-2"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset trace
                      </Button>
                    ) : null}
                  </div>

                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {submitHelperText}
                  </p>
                </div>

                <aside className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    What The Interviewer Should Notice
                  </p>
                  <div className="mt-3 space-y-3">
                    {proofPoints.map((point) => (
                      <div
                        key={point.title}
                        className="rounded-xl border border-border/80 bg-background/75 px-3 py-3"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Check className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-foreground">
                              {point.title}
                            </p>
                            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                              {point.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-4 dark:border-teal-800 dark:bg-teal-950/20">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-teal-700">
                      Seeded demo lead
                    </p>
                    <h3 className="mt-1 text-[15px] font-semibold text-foreground">
                      {form.leadName} · {form.company}
                    </h3>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {form.leadTitle}
                      {form.companyDomain ? ` · ${form.companyDomain}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-card/80 text-foreground/80">
                      {playTypeLabel}
                    </Badge>
                    <Badge variant="outline" className="bg-card/80 text-foreground/80">
                      {leadSourceLabel}
                    </Badge>
                    <Badge variant="outline" className="bg-card/80 text-foreground/80">
                      {form.play.label}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal-800 dark:text-teal-200">
                    Primary steering note
                  </p>
                  <Badge
                    variant="outline"
                    className="border-teal-200 bg-background/80 text-teal-800 dark:border-teal-800 dark:text-teal-200"
                  >
                    Used by live and durable paths
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedInputs(true)}
                    className="text-[11px] font-medium text-teal-800 underline-offset-4 hover:underline dark:text-teal-200"
                  >
                    Edit full note
                  </button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground/70">
                  This is the main note the agent uses to justify timing, pick an
                  angle, and write the final draft.
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-foreground/80">
                  {notesPreview}
                </p>
              </div>

              {showAdvancedInputs && (
                <div className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-4">
                  <div className="mb-4">
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Advanced Input
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      Use this only if you want to steer the payload. The seeded
                      sample is already tuned for the walkthrough.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel htmlFor={fieldIds.leadName}>Lead name</FieldLabel>
                      <Input
                        id={fieldIds.leadName}
                        disabled={isRunning}
                        value={form.leadName}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            leadName: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor={fieldIds.leadTitle}>Lead title</FieldLabel>
                      <Input
                        id={fieldIds.leadTitle}
                        disabled={isRunning}
                        value={form.leadTitle}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            leadTitle: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor={fieldIds.company}>Company</FieldLabel>
                      <Input
                        id={fieldIds.company}
                        disabled={isRunning}
                        value={form.company}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            company: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor={fieldIds.companyDomain}>Company domain</FieldLabel>
                      <Input
                        id={fieldIds.companyDomain}
                        disabled={isRunning}
                        value={form.companyDomain ?? ""}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            companyDomain: event.target.value || undefined,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor={fieldIds.playType}>Play type</FieldLabel>
                      <select
                        id={fieldIds.playType}
                        disabled={isRunning}
                        value={form.play.type}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            play: {
                              ...previous.play,
                              type: event.target.value as PlayType,
                            },
                          }))
                        }
                        className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:h-8"
                      >
                        {PLAY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor={fieldIds.leadSource}>Lead source</FieldLabel>
                      <select
                        id={fieldIds.leadSource}
                        disabled={isRunning}
                        value={form.play.leadSource}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            play: {
                              ...previous.play,
                              leadSource: event.target.value as LeadSource,
                            },
                          }))
                        }
                        className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:h-8"
                      >
                        {LEAD_SOURCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel htmlFor={fieldIds.playLabel}>Play label</FieldLabel>
                      <Input
                        id={fieldIds.playLabel}
                        disabled={isRunning}
                        value={form.play.label}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            play: { ...previous.play, label: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel htmlFor={fieldIds.playContext}>Play context</FieldLabel>
                      <Textarea
                        id={fieldIds.playContext}
                        disabled={isRunning}
                        value={form.play.context ?? ""}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            play: {
                              ...previous.play,
                              context: event.target.value || undefined,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel htmlFor={fieldIds.freeformNotes}>Freeform notes</FieldLabel>
                        <span className="text-[11px] text-muted-foreground">
                          Required
                        </span>
                      </div>
                      <Textarea
                        id={fieldIds.freeformNotes}
                        required
                        disabled={isRunning}
                        value={freeformContext}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            freeformContext: event.target.value,
                          }))
                        }
                        className="min-h-40 focus:border-teal-300 focus:ring-2 focus:ring-teal-200/60"
                        placeholder="Paste the lead notes, meeting context, or timing signal you want the pipeline to use."
                      />
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        This field is the main steering input for both the live
                        run and the durable production workflow.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {(isRunning || isDone || hasError) && (
            <div aria-live="polite" className="border-b border-border/50 px-6 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <p className="text-[11px] font-semibold text-muted-foreground">
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
              <PipelineProgressBar statuses={phaseStatuses} />
            </div>
          )}

          <div className="px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground/60" />
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Agent trace
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Streamed via AI Elements components
                  </p>
                </div>
              </div>
              {messages.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60">
                  Run the sample to stream the pipeline live
                </p>
              )}
            </div>

            <div className="space-y-4">
              {runWasStopped && !displayErrorMessage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-800 dark:bg-amber-950/40">
                  <p className="text-[12px] font-medium text-amber-900 dark:text-amber-100">
                    Live stream stopped early.
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
                    The partial trace is still visible, so you can inspect what
                    landed or restart the sample from the top.
                  </p>
                </div>
              )}

              {traceHighlights.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <div>
                      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Presenter Readout
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        The strongest proof points from the current run
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {traceHighlights.map((highlight) => (
                      <div
                        key={highlight.label}
                        className="rounded-lg border border-border bg-background/80 px-3 py-3"
                      >
                        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {highlight.label}
                        </p>
                        <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">
                          {highlight.value}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {highlight.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[13px] font-medium text-foreground/80">
                        Timeline will stream here
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        Start the sample run to show the interviewer how the
                        agent gathers evidence, ranks signals, commits to an
                        angle, and persists the finished job.
                      </p>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-5">
                      {PIPELINE_PHASES.map((phase, index) => (
                        <div
                          key={phase.id}
                          className="rounded-lg border border-border/80 bg-background/70 px-3 py-3"
                        >
                          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Step {index + 1}
                          </p>
                          <p className="mt-1 text-[12px] font-medium text-foreground">
                            {phase.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {phase.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
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
                                  ? "text-foreground/80"
                                  : "text-foreground",
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

              {persistedJobOutput && (
                <div
                  aria-live="polite"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4"
                >
                  <p className="text-[12px] font-medium text-emerald-900">
                    Live run finished. The job is now in Lead Review.
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

        {displayErrorMessage && (
          <section
            aria-live="polite"
            className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
              <div>
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-red-700">
                  Run failed
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-red-900">
                  {displayErrorMessage}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-red-800">
                  Retry the live run first. If the streaming route is unstable,
                  you can still show the durable workflow path below with the
                  same payload.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
