"use client";

import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Database,
  Globe,
  Loader2,
  PenTool,
  Play as PlayIcon,
  Server,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PipelinePhaseRecord } from "@/lib/pipeline/run-job";
import type { LeadInput, LeadSource, OutboundJob, PipelinePhase, PlayType } from "@/lib/types";
import { cn } from "@/lib/utils";

type StreamData = {
  phase: {
    phase: PipelinePhaseRecord;
    detail?: string;
  };
  research: {
    threadSummaries: string[];
    orchestratorSummary: string;
    uncertainty?: string;
  };
  job: {
    jobId: string;
    pipelineRunId: string;
    job: OutboundJob;
  };
  error: {
    message: string;
    phase?: string;
    pipelineRunId?: string;
  };
};

type LiveDemoMessage = UIMessage<never, StreamData>;
type PhaseState = Record<PipelinePhase, StreamData["phase"]>;
type ResearchState = StreamData["research"];
type JobState = StreamData["job"];
type ErrorState = StreamData["error"];

type WorkflowPhaseConfig = {
  id: PipelinePhase;
  label: string;
  icon: LucideIcon;
  detail: string;
};

const WORKFLOW_PHASES: WorkflowPhaseConfig[] = [
  {
    id: "ingest",
    label: "Ingest lead",
    icon: Database,
    detail: "Validate the lead payload and open a fresh pipeline run.",
  },
  {
    id: "research",
    label: "Research",
    icon: Globe,
    detail: "Stream thread summaries while the orchestrator fans out research.",
  },
  {
    id: "signals",
    label: "Extract signals",
    icon: Server,
    detail: "Rank evidence into the typed signals that drive the draft.",
  },
  {
    id: "angle",
    label: "Plan angle",
    icon: Crosshair,
    detail: "Choose the hook, explain the why-now, and score confidence.",
  },
  {
    id: "draft",
    label: "Draft",
    icon: PenTool,
    detail: "Generate the outbound email and prepare the persisted job payload.",
  },
  {
    id: "persist",
    label: "Persist",
    icon: Database,
    detail: "Write the job and audit record to InstantDB.",
  },
  {
    id: "done",
    label: "Done",
    icon: CheckCircle2,
    detail: "Finalize the live run and hand the completed job back to the UI.",
  },
];

const PLAY_OPTIONS: Array<{ value: PlayType; label: string }> = [
  { value: "event", label: "Event" },
  { value: "plg_signup", label: "PLG signup" },
  { value: "hiring_signal", label: "Hiring signal" },
  { value: "tech_migration", label: "Tech migration" },
  { value: "web_intent", label: "Web intent" },
  { value: "social_post", label: "Social post" },
  { value: "outbound_prospecting", label: "Outbound prospecting" },
];

const LEAD_SOURCE_OPTIONS: Array<{ value: LeadSource; label: string }> = [
  { value: "marketing_event_scan", label: "Marketing event scan" },
  { value: "marketing_event_form", label: "Marketing event form" },
  { value: "plg_product", label: "PLG product" },
  { value: "crm_outbound", label: "CRM outbound" },
  { value: "social_listening", label: "Social listening" },
  { value: "web_deanonymization", label: "Web deanonymization" },
  { value: "inbound_request", label: "Inbound request" },
];

const DEFAULT_INPUT: LeadInput = {
  leadName: "Marcus Webb",
  leadTitle: "Engineering Manager, Frontend Platform",
  company: "Figma",
  companyDomain: "figma.com",
  freeformContext:
    "Met Marcus during the Vercel Ship 2026 breakout. He mentioned their frontend platform team is trying to speed up design system releases, keep preview environments dependable for designers, and reduce the review friction between design and engineering. The team also has an internal push to improve perceived performance before a larger enterprise rollout this quarter.",
  play: {
    type: "event",
    label: "Vercel Ship 2026",
    context: "Attended the preview workflows breakout and follow-up workshop",
    leadSource: "marketing_event_scan",
  },
};

function createInitialPhaseState(): PhaseState {
  return WORKFLOW_PHASES.reduce((acc, phase) => {
    acc[phase.id] = {
      phase: {
        id: phase.id,
        label: phase.label,
        status: "pending",
      },
    };
    return acc;
  }, {} as PhaseState);
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[11px] font-mono uppercase tracking-[0.12em] text-zinc-500">{children}</label>;
}

function formatLeadSource(source: LeadSource) {
  return source.replace(/_/g, " ");
}

function formatPhaseStatus(status: PipelinePhaseRecord["status"]) {
  switch (status) {
    case "running":
      return "Streaming";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Waiting";
  }
}

function getPhaseClasses(status: PipelinePhaseRecord["status"]) {
  switch (status) {
    case "running":
      return {
        ring: "border-amber-200 bg-amber-50 text-amber-700",
        badge: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "completed":
      return {
        ring: "border-emerald-200 bg-emerald-50 text-emerald-700",
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "failed":
      return {
        ring: "border-red-200 bg-red-50 text-red-700",
        badge: "border-red-200 bg-red-50 text-red-700",
      };
    default:
      return {
        ring: "border-zinc-200 bg-zinc-50 text-zinc-500",
        badge: "border-zinc-200 bg-zinc-50 text-zinc-500",
      };
  }
}

function formatDuration(durationMs?: number) {
  if (!durationMs) {
    return null;
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

export default function LiveAgentDemo() {
  const [form, setForm] = useState<LeadInput>(DEFAULT_INPUT);
  const [phases, setPhases] = useState<PhaseState>(() => createInitialPhaseState());
  const [research, setResearch] = useState<ResearchState | null>(null);
  const [result, setResult] = useState<JobState | null>(null);
  const [runError, setRunError] = useState<ErrorState | null>(null);

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

  const { clearError, error, sendMessage, setMessages, status } = useChat<LiveDemoMessage>({
    transport,
    onData: (part) => {
      switch (part.type) {
        case "data-phase": {
          setPhases((prev) => ({
            ...prev,
            [part.data.phase.id]: part.data,
          }));

          if (part.data.phase.status === "failed") {
            setRunError((prev) =>
              prev ?? {
                message: part.data.detail ?? `${part.data.phase.label} failed.`,
                phase: part.data.phase.id,
              },
            );
          }
          break;
        }
        case "data-research": {
          setResearch(part.data);
          break;
        }
        case "data-job": {
          setResult(part.data);
          setRunError(null);
          break;
        }
        case "data-error": {
          setRunError(part.data);
          break;
        }
      }
    },
    onError: (streamError) => {
      setRunError((prev) => prev ?? { message: streamError.message });
    },
  });

  const isRunning = status === "submitted" || status === "streaming";
  const freeformContext = form.freeformContext ?? "";
  const isSubmitDisabled = isRunning || freeformContext.trim().length === 0;
  const effectiveError = runError ?? (error ? { message: error.message } : null);
  const completedPhaseCount = WORKFLOW_PHASES.filter(({ id }) => phases[id].phase.status === "completed").length;
  const progressPercent = Math.round((completedPhaseCount / WORKFLOW_PHASES.length) * 100);
  const activePhase =
    WORKFLOW_PHASES.find(({ id }) => phases[id].phase.status === "running") ??
    [...WORKFLOW_PHASES].reverse().find(({ id }) => phases[id].phase.status !== "pending");
  const researchSummary =
    research ??
    (result
      ? {
          threadSummaries: result.job.researchRun.threadSummaries,
          orchestratorSummary: result.job.researchRun.orchestratorSummary,
          uncertainty: result.job.researchRun.uncertainty,
        }
      : null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    if (!leadInput.freeformContext) {
      return;
    }

    setPhases(createInitialPhaseState());
    setResearch(null);
    setResult(null);
    setRunError(null);
    clearError();
    setMessages([]);

    try {
      await sendMessage(
        {
          text: `Run the live outbound pipeline for ${leadInput.leadName} at ${leadInput.company}.`,
        },
        {
          body: {
            leadInput,
          },
        },
      );
    } catch (submissionError) {
      setRunError({
        message: submissionError instanceof Error ? submissionError.message : "Failed to start live run.",
      });
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden border-t border-zinc-200 bg-zinc-50 text-zinc-900">
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-100/60 p-6">
        <div className="flex items-center gap-2">
          <PlayIcon className="h-4 w-4 text-zinc-900" />
          <h2 className="text-[12px] font-semibold">Live pipeline</h2>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
          This streams the real demo route, updates each phase live, and writes the finished job into the review queue.
        </p>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">Run status</p>
              <p className="mt-1 text-[15px] font-medium text-zinc-950">
                {isRunning
                  ? activePhase
                    ? `${activePhase.label} in progress`
                    : "Submitting live run"
                  : effectiveError
                    ? "Run failed"
                    : result
                      ? "Run completed"
                      : "Ready to stream"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "capitalize",
                effectiveError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : result
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isRunning
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600",
              )}
            >
              {effectiveError ? "Failed" : result ? "Completed" : isRunning ? status : "Idle"}
            </Badge>
          </div>
          <div className="mt-4 h-2 rounded-full bg-zinc-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                effectiveError ? "bg-red-500" : result ? "bg-emerald-500" : "bg-amber-500",
              )}
              style={{ width: `${Math.max(progressPercent, isRunning ? 8 : 0)}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-zinc-600">
            {activePhase ? phases[activePhase.id].detail ?? activePhase.detail : "Your next run will stream updates here."}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {WORKFLOW_PHASES.map((stage) => {
            const Icon = stage.icon;
            const state = phases[stage.id];
            const statusClasses = getPhaseClasses(state.phase.status);
            const duration = formatDuration(state.phase.durationMs);

            return (
              <div key={stage.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      statusClasses.ring,
                    )}
                  >
                    {state.phase.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : state.phase.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : state.phase.status === "failed" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-zinc-900">{stage.label}</p>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                          statusClasses.badge,
                        )}
                      >
                        {formatPhaseStatus(state.phase.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">{state.detail ?? stage.detail}</p>
                    {duration ? <p className="mt-2 text-[11px] text-zinc-500">Duration: {duration}</p> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-6 py-6">
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
                    Structured fields keep the demo consistent; the required notes field is the rich context the stream
                    route expects.
                  </p>
                </div>
                <Button type="submit" disabled={isSubmitDisabled} className="gap-2 self-start lg:self-center">
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                  {isRunning ? "Streaming…" : "Run live agent"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Lead name</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.leadName}
                    onChange={(event) => setForm((prev) => ({ ...prev, leadName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Lead title</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.leadTitle}
                    onChange={(event) => setForm((prev) => ({ ...prev, leadTitle: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Company</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.company}
                    onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Company domain</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.companyDomain ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDomain: event.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Play type</FieldLabel>
                  <select
                    disabled={isRunning}
                    value={form.play.type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        play: {
                          ...prev.play,
                          type: event.target.value as PlayType,
                        },
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {PLAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Lead source</FieldLabel>
                  <select
                    disabled={isRunning}
                    value={form.play.leadSource}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        play: {
                          ...prev.play,
                          leadSource: event.target.value as LeadSource,
                        },
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {LEAD_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Play label</FieldLabel>
                  <Input
                    disabled={isRunning}
                    value={form.play.label}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        play: {
                          ...prev.play,
                          label: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Play context</FieldLabel>
                  <Textarea
                    disabled={isRunning}
                    value={form.play.context ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        play: {
                          ...prev.play,
                          context: event.target.value || undefined,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Freeform notes</FieldLabel>
                    <span className="text-[11px] text-zinc-500">Required for the demo stream</span>
                  </div>
                  <Textarea
                    required
                    disabled={isRunning}
                    value={freeformContext}
                    onChange={(event) => setForm((prev) => ({ ...prev, freeformContext: event.target.value }))}
                    className="min-h-40"
                    placeholder="Paste rich lead notes, call prep, event context, and any timing signal you want the pipeline to use."
                  />
                  <p className="text-[12px] leading-relaxed text-zinc-500">
                    Add any messy notes here — the stream route validates this field before it starts the live run.
                  </p>
                </div>
              </div>
            </form>
          </section>

          {effectiveError ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
                <div>
                  <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-red-700">Run failed</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-red-900">{effectiveError.message}</p>
                  {effectiveError.phase ? <p className="mt-2 text-[12px] text-red-800">Phase: {effectiveError.phase}</p> : null}
                  {effectiveError.pipelineRunId ? (
                    <p className="mt-1 text-[12px] text-red-800">Pipeline run: {effectiveError.pipelineRunId}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Research stream
                </p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-950">
                  {researchSummary ? "Live research updates" : "Research summaries will land here"}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                  {researchSummary
                    ? researchSummary.orchestratorSummary
                    : isRunning
                      ? "Waiting for the research phase to finish and stream its summaries."
                      : "Start a run to watch thread summaries stream in before the final job is written."}
                </p>
              </div>
              <Badge variant="outline" className="self-start border-zinc-200 bg-zinc-50 text-zinc-600">
                {researchSummary ? `${researchSummary.threadSummaries.length} threads` : "No research yet"}
              </Badge>
            </div>

            {researchSummary ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">Thread summaries</p>
                  <ul className="mt-3 space-y-2">
                    {researchSummary.threadSummaries.map((summary, index) => (
                      <li
                        key={`${summary}-${index}`}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[12px] leading-relaxed text-zinc-700"
                      >
                        {summary}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">Orchestrator summary</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-700">{researchSummary.orchestratorSummary}</p>
                  </div>
                  {researchSummary.uncertainty ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-700">Open question</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-amber-900">{researchSummary.uncertainty}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          {result ? (
            <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Latest completed run
                  </p>
                  <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-950">
                    {result.job.company} · {result.job.lead.name}
                  </h2>
                  <p className="mt-1 text-[13px] text-zinc-600">
                    Queue status: <span className="font-medium text-zinc-900">{result.job.status}</span> · governance{" "}
                    <span className="font-medium text-zinc-900">{result.job.governance}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                  Saved job <span className="font-medium">{result.jobId}</span> · pipeline run{" "}
                  <span className="font-medium">{result.pipelineRunId}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">Angle</p>
                    <p className="mt-2 text-[15px] font-medium text-zinc-900">{result.job.angle}</p>
                    <p className="mt-3 text-[12px] leading-relaxed text-zinc-600">{result.job.whyNow}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">Draft subject</p>
                    <p className="mt-2 text-[15px] font-medium text-zinc-900">{result.job.draft.subject}</p>
                    <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">
                      {result.job.draft.body}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">Run summary</p>
                    <div className="mt-3 grid gap-2">
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Confidence</p>
                        <p className="mt-1 text-[13px] font-medium text-zinc-900">{result.job.confidence.tier}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Signals</p>
                        <p className="mt-1 text-[13px] font-medium text-zinc-900">{result.job.signals.length}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Lead source</p>
                        <p className="mt-1 text-[13px] font-medium text-zinc-900">
                          {formatLeadSource(result.job.play.leadSource)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">Research thread summaries</p>
                    <ul className="mt-3 space-y-2">
                      {result.job.researchRun.threadSummaries.map((summary, index) => (
                        <li
                          key={`${summary}-${index}`}
                          className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-700"
                        >
                          {summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
