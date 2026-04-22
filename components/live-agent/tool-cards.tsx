"use client";

import { Crosshair, Database, Globe, PenTool, Server } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { ToolOutput } from "@/components/ai-elements/tool";
import {
  getToolPartErrorText,
  isRunningToolState,
  PipelineToolRow,
} from "@/components/live-agent/helpers";
import { ResearchTimeline } from "@/components/live-agent/research-timeline";
import type {
  ExtractSignalsPart,
  GenerateDraftPart,
  PersistJobPart,
  PlanAnglePart,
  RunResearchPart,
  TraceNode,
} from "@/lib/pipeline/agent-ui-types";
import type { ToolState } from "@/components/ai-elements/tool";

type ToolCardError = { error: string };
type RunResearchOutput = Extract<RunResearchPart, { state: "output-available" }>["output"];
type ExtractSignalsOutput = Exclude<
  Extract<ExtractSignalsPart, { state: "output-available" }>["output"],
  ToolCardError
>;
type PlanAngleOutput = Exclude<
  Extract<PlanAnglePart, { state: "output-available" }>["output"],
  ToolCardError
>;
type GenerateDraftOutput = Exclude<
  Extract<GenerateDraftPart, { state: "output-available" }>["output"],
  ToolCardError
>;
type PersistJobOutput = Exclude<
  Extract<PersistJobPart, { state: "output-available" }>["output"],
  ToolCardError
>;

function isToolCardError(value: unknown): value is ToolCardError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

function splitToolCardOutput<TOutput>(
  output: TOutput | ToolCardError | null,
  errorText?: string,
) {
  if (isToolCardError(output)) {
    return { output: null as TOutput | null, errorText: output.error };
  }

  return { output, errorText: errorText ?? null };
}

function ToolCardErrorMessage({ errorText }: { errorText: string | null }) {
  return errorText ? <p className="text-[12px] text-destructive">{errorText}</p> : null;
}

export function RunResearchCard({
  part,
  traceNodes,
}: {
  part: RunResearchPart;
  traceNodes: TraceNode[];
}) {
  const state = part.state as ToolState;
  const rawOutput =
    state === "output-available"
      ? (part as Extract<RunResearchPart, { state: "output-available" }>).output
      : null;
  const { output, errorText } = splitToolCardOutput<RunResearchOutput>(
    rawOutput,
    getToolPartErrorText(part),
  );
  const summaryOutput =
    output ? (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="text-[12px] text-emerald-900 dark:text-emerald-200">
            <span className="font-medium">{output.threadsCompleted} threads</span> completed
          </p>
          <MessageResponse className="mt-1 text-emerald-950 dark:text-emerald-100">
            {output.orchestratorSummary}
          </MessageResponse>
        </div>

        {output.uncertainty ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Open question
            </p>
            <MessageResponse className="mt-1 text-amber-900 dark:text-amber-100">
              {output.uncertainty}
            </MessageResponse>
          </div>
        ) : null}
      </div>
    ) : isRunningToolState(state) ? (
      <MessageResponse className="text-amber-800 dark:text-amber-300">
        Spawning research threads and synthesizing findings…
      </MessageResponse>
    ) : null;
  const summaryText = output
    ? `${output.threadsCompleted} thread${output.threadsCompleted === 1 ? "" : "s"} completed`
    : isRunningToolState(state)
      ? "Spawning research threads and streaming live tool calls."
      : "Spawn focused sub-agents and stream their live tool calls.";

  return (
    <PipelineToolRow
      type={part.type}
      title="Run research"
      state={state}
      icon={<Globe className="h-4 w-4" />}
      contentClassName="space-y-4"
      defaultOpen={true}
      forceOpen={isRunningToolState(state)}
      trailing={
        output ? (
          <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            {output.threadsCompleted} thread{output.threadsCompleted === 1 ? "" : "s"}
          </span>
        ) : null
      }
      description={summaryText}
    >
      <ToolOutput title="Research packet" output={summaryOutput} errorText={errorText ?? undefined} />
      <ResearchTimeline nodes={traceNodes} />
    </PipelineToolRow>
  );
}

export function ExtractSignalsCard({ part }: { part: ExtractSignalsPart }) {
  const state = part.state as ToolState;
  const rawOutput =
    state === "output-available"
      ? (part as Extract<ExtractSignalsPart, { state: "output-available" }>).output
      : null;
  const { output, errorText } = splitToolCardOutput<ExtractSignalsOutput>(
    rawOutput,
    getToolPartErrorText(part),
  );
  const description =
    output
      ? `${output.signalCount} ranked · ${output.discardedCount} discarded`
      : isRunningToolState(state)
        ? "Ranking research findings into scored signals…"
        : "Rank research into scored signals.";

  return (
    <PipelineToolRow
      type={part.type}
      title="Extract signals"
      state={state}
      icon={<Server className="h-4 w-4" />}
      contentClassName="space-y-3"
      description={description}
    >
      {output ? (
        <div className="space-y-3">
          <p className="text-[12px] text-emerald-900 dark:text-emerald-200">
            <span className="font-medium">{output.signalCount}</span> signals ranked ·{" "}
            <span className="text-muted-foreground">{output.discardedCount} discarded</span>
          </p>
          <div className="space-y-2">
            {output.topSignals.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-border bg-card/80 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-medium text-foreground">{signal.label}</p>
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {signal.strength}
                  </span>
                  <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {signal.category}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{signal.value}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{signal.source}</span>
                  {signal.signalDate ? <span>{signal.signalDate}</span> : null}
                  {signal.evidenceUrl ? (
                    <a
                      href={signal.evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      aria-label={`Open evidence for ${signal.label}`}
                    >
                      Open evidence
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {output.discardedSignals.length ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Discarded signals
              </p>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-foreground/80">
                {output.discardedSignals.map((signal) => (
                  <li key={`${signal.label}-${signal.reason}`}>
                    • <span className="font-medium text-foreground">{signal.label}</span>: {signal.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <ToolCardErrorMessage errorText={errorText} />
    </PipelineToolRow>
  );
}

export function PlanAngleCard({ part }: { part: PlanAnglePart }) {
  const state = part.state as ToolState;
  const rawOutput =
    state === "output-available"
      ? (part as Extract<PlanAnglePart, { state: "output-available" }>).output
      : null;
  const { output, errorText } = splitToolCardOutput<PlanAngleOutput>(
    rawOutput,
    getToolPartErrorText(part),
  );
  const description =
    output
      ? output.angle
      : isRunningToolState(state)
        ? "Choosing the strongest outbound angle…"
        : "Choose the best outbound angle.";

  return (
    <PipelineToolRow
      type={part.type}
      title="Plan angle"
      state={state}
      icon={<Crosshair className="h-4 w-4" />}
      contentClassName="space-y-3"
      description={description}
    >
      {output ? (
        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-medium text-foreground">{output.angle}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{output.whyNow}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {output.angleType.replace(/_/g, " ")}
            </span>
            <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {output.confidenceTier} confidence
            </span>
          </div>
          <div className="rounded-lg border border-border bg-card/80 px-3 py-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Confidence summary
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{output.confidenceSummary}</p>
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-foreground/80">
              {output.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <ToolCardErrorMessage errorText={errorText} />
    </PipelineToolRow>
  );
}

export function GenerateDraftCard({ part }: { part: GenerateDraftPart }) {
  const state = part.state as ToolState;
  const rawOutput =
    state === "output-available"
      ? (part as Extract<GenerateDraftPart, { state: "output-available" }>).output
      : null;
  const { output, errorText } = splitToolCardOutput<GenerateDraftOutput>(
    rawOutput,
    getToolPartErrorText(part),
  );
  const description =
    output
      ? output.subject
      : isRunningToolState(state)
        ? "Writing the personalized outbound email…"
        : "Generate the outbound draft.";

  return (
    <PipelineToolRow
      type={part.type}
      title="Generate draft"
      state={state}
      icon={<PenTool className="h-4 w-4" />}
      contentClassName="space-y-3"
      description={description}
    >
      {output ? (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-foreground">{output.subject}</p>
          <div className="rounded-lg border border-border bg-card/80 px-3 py-3">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">{output.body}</p>
          </div>
          {output.highlightedSpan ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                Highlighted span
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-emerald-950 dark:text-emerald-100">
                {output.highlightedSpan}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <ToolCardErrorMessage errorText={errorText} />
    </PipelineToolRow>
  );
}

export function PersistJobCard({ part }: { part: PersistJobPart }) {
  const state = part.state as ToolState;
  const rawOutput =
    state === "output-available"
      ? (part as Extract<PersistJobPart, { state: "output-available" }>).output
      : null;
  const { output, errorText } = splitToolCardOutput<PersistJobOutput>(
    rawOutput,
    getToolPartErrorText(part),
  );
  const description =
    output
      ? `Job ${output.jobId}`
      : isRunningToolState(state)
        ? "Writing job and audit record to the queue…"
        : "Save the completed job to the queue.";

  return (
    <PipelineToolRow
      type={part.type}
      title="Save to queue"
      state={state}
      icon={<Database className="h-4 w-4" />}
      contentClassName="space-y-3"
      description={description}
    >
      {output ? (
        <div className="space-y-1">
          <p className="text-[12px] text-emerald-900 dark:text-emerald-200">Job saved to review queue</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {output.jobId} · run {output.pipelineRunId}
          </p>
        </div>
      ) : null}
      <ToolCardErrorMessage errorText={errorText} />
    </PipelineToolRow>
  );
}
