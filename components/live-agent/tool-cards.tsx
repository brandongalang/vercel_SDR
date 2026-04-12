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
} from "@/components/live-agent/types";
import type { ToolState } from "@/components/ai-elements/tool";

export function RunResearchCard({
  part,
  traceNodes,
}: {
  part: RunResearchPart;
  traceNodes: TraceNode[];
}) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<RunResearchPart, { state: "output-available" }>).output
      : null;
  const errorText = getToolPartErrorText(part);
  const summaryOutput =
    output ? (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[12px] text-emerald-900">
            <span className="font-medium">{output.threadsCompleted} threads</span> completed
          </p>
          <MessageResponse className="mt-1 text-emerald-950">
            {output.orchestratorSummary}
          </MessageResponse>
        </div>

        {output.reports.length ? (
          <div className="space-y-2">
            {output.reports.map((report) => (
              <div
                key={report.topic}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2"
              >
                <p className="text-[12px] font-medium text-zinc-900">{report.topic}</p>
                <MessageResponse className="mt-1 text-zinc-600">{report.summary}</MessageResponse>
              </div>
            ))}
          </div>
        ) : null}

        {output.uncertainty ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-amber-700">
              Open question
            </p>
            <MessageResponse className="mt-1 text-amber-900">
              {output.uncertainty}
            </MessageResponse>
          </div>
        ) : null}
      </div>
    ) : isRunningToolState(state) ? (
      <MessageResponse className="text-amber-800">
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
      trailing={
        output ? (
          <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            {output.threadsCompleted} thread{output.threadsCompleted === 1 ? "" : "s"}
          </span>
        ) : null
      }
      description={summaryText}
    >
      <ToolOutput title="Research packet" output={summaryOutput} errorText={errorText} />
      <ResearchTimeline nodes={traceNodes} />
    </PipelineToolRow>
  );
}

export function ExtractSignalsCard({ part }: { part: ExtractSignalsPart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<ExtractSignalsPart, { state: "output-available" }>).output
      : null;
  const errorText = getToolPartErrorText(part);
  const description =
    output && !("error" in output)
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
      {output && !("error" in output) ? (
        <div className="space-y-3">
          <p className="text-[12px] text-emerald-900">
            <span className="font-medium">{output.signalCount}</span> signals ranked ·{" "}
            <span className="text-zinc-500">{output.discardedCount} discarded</span>
          </p>
          <div className="space-y-2">
            {output.topSignals.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-medium text-zinc-900">{signal.label}</p>
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-emerald-700">
                    {signal.strength}
                  </span>
                  <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                    {signal.category}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{signal.value}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span>{signal.source}</span>
                  {signal.signalDate ? <span>{signal.signalDate}</span> : null}
                  {signal.evidenceUrl ? (
                    <a href={signal.evidenceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      Evidence
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {output.discardedSignals.length ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Discarded signals
              </p>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-zinc-600">
                {output.discardedSignals.map((signal) => (
                  <li key={`${signal.label}-${signal.reason}`}>
                    • <span className="font-medium text-zinc-800">{signal.label}</span>: {signal.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {output && "error" in output ? (
        <p className="text-[12px] text-red-700">{output.error}</p>
      ) : null}
      {!output && errorText ? <p className="text-[12px] text-red-700">{errorText}</p> : null}
    </PipelineToolRow>
  );
}

export function PlanAngleCard({ part }: { part: PlanAnglePart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<PlanAnglePart, { state: "output-available" }>).output
      : null;
  const errorText = getToolPartErrorText(part);
  const description =
    output && !("error" in output)
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
      {output && !("error" in output) ? (
        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-medium text-zinc-900">{output.angle}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{output.whyNow}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
              {output.angleType.replace(/_/g, " ")}
            </span>
            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
              {output.confidenceTier} confidence
            </span>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Confidence summary
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{output.confidenceSummary}</p>
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-zinc-600">
              {output.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {output && "error" in output ? (
        <p className="text-[12px] text-red-700">{output.error}</p>
      ) : null}
      {!output && errorText ? <p className="text-[12px] text-red-700">{errorText}</p> : null}
    </PipelineToolRow>
  );
}

export function GenerateDraftCard({ part }: { part: GenerateDraftPart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<GenerateDraftPart, { state: "output-available" }>).output
      : null;
  const errorText = getToolPartErrorText(part);
  const description =
    output && !("error" in output)
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
      {output && !("error" in output) ? (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-zinc-900">{output.subject}</p>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-700">{output.body}</p>
          </div>
          {output.highlightedSpan ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-emerald-700">
                Highlighted span
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-emerald-950">
                {output.highlightedSpan}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {output && "error" in output ? (
        <p className="text-[12px] text-red-700">{output.error}</p>
      ) : null}
      {!output && errorText ? <p className="text-[12px] text-red-700">{errorText}</p> : null}
    </PipelineToolRow>
  );
}

export function PersistJobCard({ part }: { part: PersistJobPart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<PersistJobPart, { state: "output-available" }>).output
      : null;
  const errorText = getToolPartErrorText(part);
  const description =
    output && !("error" in output)
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
      {output && !("error" in output) ? (
        <div className="space-y-1">
          <p className="text-[12px] text-emerald-900">Job saved to review queue</p>
          <p className="font-mono text-[11px] text-zinc-500">
            {output.jobId} · run {output.pipelineRunId}
          </p>
        </div>
      ) : null}
      {output && "error" in output ? (
        <p className="text-[12px] text-red-700">{output.error}</p>
      ) : null}
      {!output && errorText ? <p className="text-[12px] text-red-700">{errorText}</p> : null}
    </PipelineToolRow>
  );
}
