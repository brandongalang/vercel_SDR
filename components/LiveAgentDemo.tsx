"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useMemo, useState, type ElementType, type FormEvent, type ReactNode } from "react";
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
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineAgentUIMessage } from "@/lib/pipeline/pipeline-agent";
import type { PipelineTraceNode } from "@/lib/pipeline/live-trace";
import type { LeadInput, LeadSource, PlayType } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error" | "idle";

// ─── Constants ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-[11px] font-mono uppercase tracking-[0.12em] text-zinc-500">
      {children}
    </label>
  );
}

function ToolCardShell({
  icon: Icon,
  label,
  state,
  children,
}: {
  icon: ElementType;
  label: string;
  state: ToolState;
  children?: ReactNode;
}) {
  const isRunning = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";
  const isError = state === "output-error";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-sm transition-colors",
        isRunning && "border-amber-200 bg-amber-50",
        isDone && "border-emerald-200 bg-emerald-50",
        isError && "border-red-200 bg-red-50",
        !isRunning && !isDone && !isError && "border-zinc-200 bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
            isRunning && "border-amber-300 bg-amber-100 text-amber-700",
            isDone && "border-emerald-300 bg-emerald-100 text-emerald-700",
            isError && "border-red-300 bg-red-100 text-red-700",
            !isRunning && !isDone && !isError && "border-zinc-200 bg-zinc-50 text-zinc-500",
          )}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isError ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-zinc-900">{label}</p>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                isRunning && "border-amber-200 bg-amber-50 text-amber-700",
                isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
                isError && "border-red-200 bg-red-50 text-red-700",
                !isRunning && !isDone && !isError && "border-zinc-200 bg-zinc-50 text-zinc-500",
              )}
            >
              {isRunning ? "Running" : isDone ? "Done" : isError ? "Error" : "Pending"}
            </span>
          </div>
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

// ─── Idle preview card ─────────────────────────────────────────────────────────

function IdleToolCard({
  icon,
  label,
  description,
}: {
  icon: ElementType;
  label: string;
  description: string;
}) {
  return (
    <ToolCardShell icon={icon} label={label} state="idle">
      <p className="text-[12px] leading-relaxed text-zinc-400">{description}</p>
    </ToolCardShell>
  );
}

// ─── Tool Cards ────────────────────────────────────────────────────────────────

type MessagePart = PipelineAgentUIMessage["parts"][number];
type RunResearchPart = Extract<MessagePart, { type: "tool-run_research" }>;
type ExtractSignalsPart = Extract<MessagePart, { type: "tool-extract_signals" }>;
type PlanAnglePart = Extract<MessagePart, { type: "tool-plan_angle" }>;
type GenerateDraftPart = Extract<MessagePart, { type: "tool-generate_draft" }>;
type PersistJobPart = Extract<MessagePart, { type: "tool-persist_job" }>;
type TracePart = Extract<MessagePart, { type: "data-trace-node" }>;
type TraceNode = PipelineTraceNode;
type AgentTraceNode = Extract<TraceNode, { kind: "agent" }>;
type OrchestratorTraceNode = AgentTraceNode & { agentType: "orchestrator" };
type SubagentTraceNode = AgentTraceNode & { agentType: "subagent" };
type ResearchToolNode = Extract<TraceNode, { kind: "tool-call" }>;

function traceStatusToToolState(status: TraceNode["status"]): ToolState {
  if (status === "completed") return "output-available";
  if (status === "error") return "output-error";
  return "input-available";
}

function formatTimestampLabel(value?: string) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function PayloadDisclosure({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;

  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </summary>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ResearchToolOutput({ node }: { node: ResearchToolNode }) {
  if (node.toolName === "web_search" && node.output) {
    const output = node.output as {
      query: string;
      results: Array<{
        title: string;
        url: string;
        publishedDate?: string;
        summary?: string;
        highlights?: string[];
      }>;
    };

    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-zinc-900">
          {output.results.length} result{output.results.length === 1 ? "" : "s"} for {output.query}
        </p>
        <div className="space-y-2">
          {output.results.map((result) => (
            <div key={`${result.url}-${result.title}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-medium text-zinc-900 hover:underline"
              >
                {result.title}
              </a>
              {result.publishedDate ? (
                <p className="mt-1 text-[11px] text-zinc-500">{result.publishedDate}</p>
              ) : null}
              {result.summary ? (
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{result.summary}</p>
              ) : null}
              {result.highlights?.length ? (
                <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-zinc-600">
                  {result.highlights.map((highlight) => (
                    <li key={highlight}>• {highlight}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (node.toolName === "crm_lookup" && node.output) {
    const output = node.output as {
      lifecycleStage: string;
      owner: string;
      segment: string;
      accountPriority: string;
      notes: string[];
      pseudoSourceUrl: string;
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {[output.lifecycleStage, output.segment, output.accountPriority].map((value) => (
            <span
              key={value}
              className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-600"
            >
              {value.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        <p className="text-[12px] text-zinc-600">Owner: {output.owner}</p>
        <ul className="space-y-1 text-[12px] leading-relaxed text-zinc-600">
          {output.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (node.toolName === "product_signals" && node.output) {
    const output = node.output as {
      signalSource: string;
      summary: string;
      items: Array<{
        label: string;
        detail: string;
        observedAt?: string;
        pseudoSourceUrl?: string;
      }>;
    };

    return (
      <div className="space-y-2">
        <p className="text-[12px] leading-relaxed text-zinc-600">{output.summary}</p>
        <div className="space-y-2">
          {output.items.map((item) => (
            <div key={`${item.label}-${item.observedAt ?? "na"}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <p className="text-[12px] font-medium text-zinc-900">{item.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{item.detail}</p>
              {item.observedAt ? (
                <p className="mt-1 text-[11px] text-zinc-500">{item.observedAt}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function ResearchToolCallCard({ node }: { node: ResearchToolNode }) {
  const icon = node.toolName === "web_search" ? Globe : node.toolName === "crm_lookup" ? Database : Server;
  const startedAt = formatTimestampLabel(node.startedAt);
  const completedAt = formatTimestampLabel(node.completedAt);

  return (
    <ToolCardShell icon={icon} label={node.title} state={traceStatusToToolState(node.status)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span className="font-mono uppercase tracking-wide">{node.toolName.replace(/_/g, " ")}</span>
          {startedAt ? <span>started {startedAt}</span> : null}
          {completedAt ? <span>finished {completedAt}</span> : null}
        </div>

        {node.status === "running" ? (
          <p className="text-[12px] text-amber-800">Tool call is running with live payload capture.</p>
        ) : null}

        <PayloadDisclosure label="Tool input" value={node.input} />

        {node.output ? <ResearchToolOutput node={node} /> : null}
        {node.output ? <PayloadDisclosure label="Tool payload" value={node.output} /> : null}

        {node.error ? <p className="text-[12px] text-red-700">{node.error}</p> : null}
      </div>
    </ToolCardShell>
  );
}

function ResearchSubagentCard({
  node,
  toolNodes,
}: {
  node: SubagentTraceNode;
  toolNodes: ResearchToolNode[];
}) {
  const startedAt = formatTimestampLabel(node.startedAt);
  const completedAt = formatTimestampLabel(node.completedAt);

  return (
    <ToolCardShell icon={Globe} label={node.title} state={traceStatusToToolState(node.status)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          {node.topic ? <span className="font-mono uppercase tracking-wide">{node.topic}</span> : null}
          {startedAt ? <span>started {startedAt}</span> : null}
          {completedAt ? <span>finished {completedAt}</span> : null}
        </div>

        {node.goal ? <p className="text-[12px] leading-relaxed text-zinc-600">{node.goal}</p> : null}

        {node.queryHints?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {node.queryHints.map((hint) => (
              <span
                key={hint}
                className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-mono text-zinc-600"
              >
                {hint}
              </span>
            ))}
          </div>
        ) : null}

        {toolNodes.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Tool calls
            </p>
            {toolNodes.map((toolNode) => (
              <ResearchToolCallCard key={toolNode.id} node={toolNode} />
            ))}
          </div>
        ) : node.status === "running" ? (
          <p className="text-[12px] text-amber-800">Waiting on the first tool call from this sub-agent…</p>
        ) : null}

        {node.summary ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Summary
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-emerald-950">{node.summary}</p>
          </div>
        ) : null}

        {node.findings?.length ? (
          <div className="space-y-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Key findings
            </p>
            {node.findings.map((finding) => (
              <div key={`${finding.sourceUrl}-${finding.text}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <p className="text-[12px] leading-relaxed text-zinc-800">{finding.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span className="font-mono uppercase tracking-wide">{finding.confidence} confidence</span>
                  {finding.date ? <span>{finding.date}</span> : null}
                  <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    Source
                  </a>
                </div>
                {finding.rawQuote ? (
                  <p className="mt-2 border-l-2 border-zinc-200 pl-3 text-[12px] italic leading-relaxed text-zinc-600">
                    {finding.rawQuote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {node.gaps?.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-amber-700">
              Gaps
            </p>
            <ul className="mt-1 space-y-1 text-[12px] leading-relaxed text-amber-900">
              {node.gaps.map((gap) => (
                <li key={gap}>• {gap}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <PayloadDisclosure
          label="Sub-agent config"
          value={{
            topic: node.topic,
            goal: node.goal,
            queryHints: node.queryHints,
            includeDomains: node.includeDomains,
            model: node.model,
          }}
        />

        {node.error ? <p className="text-[12px] text-red-700">{node.error}</p> : null}
      </div>
    </ToolCardShell>
  );
}

function ResearchOrchestratorCard({
  node,
  threadCount,
}: {
  node: OrchestratorTraceNode;
  threadCount: number;
}) {
  const startedAt = formatTimestampLabel(node.startedAt);
  const completedAt = formatTimestampLabel(node.completedAt);

  return (
    <ToolCardShell icon={Sparkles} label={node.title} state={traceStatusToToolState(node.status)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span className="font-mono uppercase tracking-wide">{node.model}</span>
          {startedAt ? <span>started {startedAt}</span> : null}
          {completedAt ? <span>finished {completedAt}</span> : null}
        </div>
        <p className="text-[12px] text-zinc-600">
          Spawned <span className="font-medium text-zinc-900">{threadCount}</span> focused research thread
          {threadCount === 1 ? "" : "s"}.
        </p>
        {node.summary ? (
          <p className="text-[12px] leading-relaxed text-zinc-700">{node.summary}</p>
        ) : node.status === "running" ? (
          <p className="text-[12px] text-amber-800">Planning coverage and deciding which threads to launch…</p>
        ) : null}
        {node.uncertainty ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-amber-700">
              Remaining uncertainty
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-950">{node.uncertainty}</p>
          </div>
        ) : null}
        {node.error ? <p className="text-[12px] text-red-700">{node.error}</p> : null}
      </div>
    </ToolCardShell>
  );
}

function ResearchTracePanel({ nodes }: { nodes: TraceNode[] }) {
  const orchestrator = nodes.find(
    (node): node is OrchestratorTraceNode =>
      node.kind === "agent" && node.agentType === "orchestrator",
  );
  const threads = nodes.filter(
    (node): node is SubagentTraceNode =>
      node.kind === "agent" && node.agentType === "subagent",
  );
  const toolNodes = nodes.filter((node): node is ResearchToolNode => node.kind === "tool-call");

  if (!orchestrator && threads.length === 0 && toolNodes.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex items-center gap-2 pb-3">
        <Sparkles className="h-4 w-4 text-zinc-500" />
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Nested research trace
        </p>
      </div>
      <div className="space-y-3">
        {orchestrator ? <ResearchOrchestratorCard node={orchestrator} threadCount={threads.length} /> : null}
        {threads.map((thread) => (
          <ResearchSubagentCard
            key={thread.id}
            node={thread}
            toolNodes={toolNodes.filter((node) => node.parentId === thread.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RunResearchCard({
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

  return (
    <ToolCardShell icon={Globe} label="Run research" state={state}>
      <div className="space-y-3">
        {(state === "input-streaming" || state === "input-available") ? (
          <p className="text-[12px] text-amber-800">
            Spawning research threads and synthesizing findings…
          </p>
        ) : null}

        {output ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[12px] text-emerald-900">
                <span className="font-medium">{output.threadsCompleted} threads</span> completed
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-emerald-950">
                {output.orchestratorSummary}
              </p>
            </div>

            {output.reports.length ? (
              <div className="space-y-2">
                {output.reports.map((report) => (
                  <div key={report.topic} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                    <p className="text-[12px] font-medium text-zinc-900">{report.topic}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{report.summary}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {output.uncertainty ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                <span className="font-mono font-semibold uppercase tracking-wide">Open question: </span>
                {output.uncertainty}
              </p>
            ) : null}
          </div>
        ) : null}

        <ResearchTracePanel nodes={traceNodes} />
      </div>
    </ToolCardShell>
  );
}

function ExtractSignalsCard({ part }: { part: ExtractSignalsPart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<ExtractSignalsPart, { state: "output-available" }>).output
      : null;

  return (
    <ToolCardShell icon={Server} label="Extract signals" state={state}>
      {(state === "input-streaming" || state === "input-available") ? (
        <p className="text-[12px] text-amber-800">Ranking research findings into scored signals…</p>
      ) : null}
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
    </ToolCardShell>
  );
}

function PlanAngleCard({ part }: { part: PlanAnglePart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<PlanAnglePart, { state: "output-available" }>).output
      : null;

  return (
    <ToolCardShell icon={Crosshair} label="Plan angle" state={state}>
      {(state === "input-streaming" || state === "input-available") ? (
        <p className="text-[12px] text-amber-800">Choosing the strongest outbound angle…</p>
      ) : null}
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
    </ToolCardShell>
  );
}

function GenerateDraftCard({ part }: { part: GenerateDraftPart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<GenerateDraftPart, { state: "output-available" }>).output
      : null;

  return (
    <ToolCardShell icon={PenTool} label="Generate draft" state={state}>
      {(state === "input-streaming" || state === "input-available") ? (
        <p className="text-[12px] text-amber-800">Writing the personalized outbound email…</p>
      ) : null}
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
    </ToolCardShell>
  );
}

function PersistJobCard({ part }: { part: PersistJobPart }) {
  const state = part.state as ToolState;
  const output =
    state === "output-available"
      ? (part as Extract<PersistJobPart, { state: "output-available" }>).output
      : null;

  return (
    <ToolCardShell icon={Database} label="Save to queue" state={state}>
      {(state === "input-streaming" || state === "input-available") ? (
        <p className="text-[12px] text-amber-800">Writing job and audit record to the queue…</p>
      ) : null}
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
    </ToolCardShell>
  );
}

// ─── Left panel phase derivation ───────────────────────────────────────────────

type PhaseName = "research" | "signals" | "angle" | "draft" | "persist";
type ToolPartStatus = "idle" | "running" | "done" | "error";

type PhaseInfo = {
  id: PhaseName;
  label: string;
  toolType: string;
  icon: ElementType;
  description: string;
};

const PIPELINE_PHASES: PhaseInfo[] = [
  {
    id: "research",
    label: "Research",
    toolType: "tool-run_research",
    icon: Globe,
    description: "Web search, CRM lookup, and product signals across 2–4 focused threads.",
  },
  {
    id: "signals",
    label: "Extract signals",
    toolType: "tool-extract_signals",
    icon: Server,
    description: "Rank evidence into typed, scored signals for the angle planner.",
  },
  {
    id: "angle",
    label: "Plan angle",
    toolType: "tool-plan_angle",
    icon: Crosshair,
    description: "Choose the strongest hook and timing justification.",
  },
  {
    id: "draft",
    label: "Generate draft",
    toolType: "tool-generate_draft",
    icon: PenTool,
    description: "Write a first-touch outbound email from the angle and signals.",
  },
  {
    id: "persist",
    label: "Save to queue",
    toolType: "tool-persist_job",
    icon: Database,
    description: "Write the job and audit record to InstantDB.",
  },
];

function getPartStatus(parts: PipelineAgentUIMessage["parts"], toolType: string): ToolPartStatus {
  const part = parts.find((p) => p.type === toolType);
  if (!part) return "idle";
  const s = (part as { state: string }).state;
  if (s === "output-available") return "done";
  if (s === "output-error") return "error";
  return "running";
}

function PhaseRow({ phase, status }: { phase: PhaseInfo; status: ToolPartStatus }) {
  const Icon = phase.icon;
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
            isRunning && "border-amber-200 bg-amber-50 text-amber-700",
            isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
            isError && "border-red-200 bg-red-50 text-red-700",
            status === "idle" && "border-zinc-200 bg-zinc-50 text-zinc-400",
          )}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isError ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-zinc-900">{phase.label}</p>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                isRunning && "border-amber-200 bg-amber-50 text-amber-700",
                isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
                isError && "border-red-200 bg-red-50 text-red-700",
                status === "idle" && "border-zinc-200 bg-zinc-50 text-zinc-500",
              )}
            >
              {isRunning ? "Running" : isDone ? "Done" : isError ? "Error" : "Waiting"}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{phase.description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

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
  const researchTraceNodes = useMemo(
    () =>
      allParts
        .filter((part): part is TracePart => part.type === "data-trace-node")
        .map((part) => part.data)
        .sort((left, right) => left.order - right.order),
    [allParts],
  );

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

          {/* Live agent trace — always visible; shows idle previews before first run */}
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
                PIPELINE_PHASES.map((phase) => (
                  <IdleToolCard
                    key={phase.id}
                    icon={phase.icon}
                    label={phase.label}
                    description={phase.description}
                  />
                ))
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
