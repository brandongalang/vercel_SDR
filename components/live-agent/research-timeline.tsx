"use client";

import { Database, Globe, Server } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import {
  formatCompactValue,
  formatTimestampLabel,
  PayloadDisclosure,
  PipelineToolRow,
  TimelineBranch,
} from "@/components/live-agent/helpers";
import type {
  OrchestratorTraceNode,
  ResearchToolNode,
  SubagentTraceNode,
  TraceNode,
} from "@/components/live-agent/types";
import type { ToolState } from "@/components/ai-elements/tool";

function traceStatusToToolState(status: TraceNode["status"]): ToolState {
  if (status === "completed") return "output-available";
  if (status === "error") return "output-error";
  return "input-available";
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

function getResearchToolSummary(node: ResearchToolNode) {
  if (node.status === "error") {
    return node.error ?? "Tool call failed.";
  }

  if (node.status === "completed" && node.output) {
    if (node.toolName === "web_search") {
      const output = node.output as { results?: Array<unknown>; query?: string };
      return output.results?.length
        ? `${output.results.length} result${output.results.length === 1 ? "" : "s"} for ${output.query ?? "query"}`
        : "Search finished.";
    }
    return formatCompactValue(node.output) ?? "Output captured.";
  }

  return formatCompactValue(node.input) ?? "Streaming tool payload…";
}

function ResearchToolCallCard({ node }: { node: ResearchToolNode }) {
  const state = traceStatusToToolState(node.status);
  const icon =
    node.toolName === "web_search" ? (
      <Globe className="h-4 w-4" />
    ) : node.toolName === "crm_lookup" ? (
      <Database className="h-4 w-4" />
    ) : (
      <Server className="h-4 w-4" />
    );
  const startedAt = formatTimestampLabel(node.startedAt);
  const completedAt = formatTimestampLabel(node.completedAt);
  const output =
    node.output ? (
      <div className="space-y-3">
        <ResearchToolOutput node={node} />
        <PayloadDisclosure label="Raw payload" value={node.output} />
      </div>
    ) : node.status === "running" ? (
      <MessageResponse className="text-amber-800">
        Tool call is running with live payload capture.
      </MessageResponse>
    ) : null;

  return (
    <PipelineToolRow
      type={`tool-${node.toolName}`}
      title={node.title}
      state={state}
      icon={icon}
      className="rounded-lg border-zinc-200/80 bg-white shadow-none"
      contentClassName="space-y-3"
      description={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono uppercase tracking-wide">
              {node.toolName.replace(/_/g, " ")}
            </span>
            {startedAt ? <span>started {startedAt}</span> : null}
            {completedAt ? <span>finished {completedAt}</span> : null}
          </div>
          <p className="text-zinc-600">{getResearchToolSummary(node)}</p>
        </div>
      }
    >
      <ToolInput input={node.input} />
      <ToolOutput
        title="Output"
        output={output}
        errorText={node.status === "error" && !node.output ? node.error : undefined}
      />
    </PipelineToolRow>
  );
}

function getSubagentSummary(node: SubagentTraceNode, toolCount: number) {
  if (node.status === "error") {
    return node.error ?? "Sub-agent failed.";
  }
  if (node.summary) {
    return node.summary;
  }
  if (node.status === "completed") {
    return `${toolCount} tool call${toolCount === 1 ? "" : "s"} completed.`;
  }
  return toolCount > 0
    ? `${toolCount} tool call${toolCount === 1 ? "" : "s"} streaming.`
    : "Preparing first tool call…";
}

function ResearchSubagentCard({
  node,
  toolNodes,
}: {
  node: SubagentTraceNode;
  toolNodes: ResearchToolNode[];
}) {
  const state = traceStatusToToolState(node.status);
  const startedAt = formatTimestampLabel(node.startedAt);
  const completedAt = formatTimestampLabel(node.completedAt);

  return (
    <PipelineToolRow
      type="subagent"
      title={node.title}
      state={state}
      icon={<Globe className="h-4 w-4" />}
      className="rounded-lg border-zinc-200/80 bg-zinc-50/70 shadow-none"
      contentClassName="space-y-3"
      trailing={
        <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
          {toolNodes.length} tool{toolNodes.length === 1 ? "" : "s"}
        </span>
      }
      description={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {node.topic ? (
              <span className="font-mono uppercase tracking-wide">{node.topic}</span>
            ) : null}
            {startedAt ? <span>started {startedAt}</span> : null}
            {completedAt ? <span>finished {completedAt}</span> : null}
          </div>
          <p className="text-zinc-600">{getSubagentSummary(node, toolNodes.length)}</p>
        </div>
      }
    >
      <ToolInput
        title="Sub-agent config"
        input={{
          topic: node.topic,
          goal: node.goal,
          queryHints: node.queryHints,
          includeDomains: node.includeDomains,
          model: node.model,
        }}
      />

      {toolNodes.length > 0 ? (
        <div className="space-y-2">
          {toolNodes.map((toolNode) => (
            <TimelineBranch key={toolNode.id} level={2}>
              <ResearchToolCallCard node={toolNode} />
            </TimelineBranch>
          ))}
        </div>
      ) : node.status === "running" ? (
        <MessageResponse className="text-amber-800">
          Waiting on the first tool call from this sub-agent…
        </MessageResponse>
      ) : null}

      {node.summary ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Summary
          </p>
          <MessageResponse className="mt-1 text-emerald-950">{node.summary}</MessageResponse>
        </div>
      ) : null}

      {node.findings?.length ? (
        <div className="space-y-2">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Key findings
          </p>
          {node.findings.map((finding) => (
            <div
              key={`${finding.sourceUrl}-${finding.text}`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2"
            >
              <MessageResponse className="text-zinc-800">{finding.text}</MessageResponse>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span className="font-mono uppercase tracking-wide">
                  {finding.confidence} confidence
                </span>
                {finding.date ? <span>{finding.date}</span> : null}
                <a
                  href={finding.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Source
                </a>
              </div>
              {finding.rawQuote ? (
                <MessageResponse className="mt-2 border-l-2 border-zinc-200 pl-3 italic text-zinc-600">
                  {finding.rawQuote}
                </MessageResponse>
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

      {node.error ? <MessageResponse className="text-red-900">{node.error}</MessageResponse> : null}
    </PipelineToolRow>
  );
}

export function ResearchTimeline({ nodes }: { nodes: TraceNode[] }) {
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

  const orphanTools = toolNodes.filter(
    (toolNode) => !threads.some((thread) => thread.id === toolNode.parentId),
  );

  return (
    <div className="space-y-3">
      {orchestrator ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
            <span>{orchestrator.model}</span>
            {orchestrator.startedAt ? (
              <span>{formatTimestampLabel(orchestrator.startedAt)}</span>
            ) : null}
          </div>
          <MessageResponse className="mt-2 text-zinc-700">
            {orchestrator.summary
              ? orchestrator.summary
              : orchestrator.status === "running"
                ? "Planning coverage and launching focused research threads…"
                : `Spawned ${threads.length} focused research thread${threads.length === 1 ? "" : "s"}.`}
          </MessageResponse>
          {orchestrator.uncertainty ? (
            <MessageResponse className="mt-2 text-amber-900">
              Remaining uncertainty: {orchestrator.uncertainty}
            </MessageResponse>
          ) : null}
          {orchestrator.error ? (
            <MessageResponse className="mt-2 text-red-900">{orchestrator.error}</MessageResponse>
          ) : null}
        </div>
      ) : null}

      {threads.length > 0 ? (
        <div className="space-y-2">
          {threads.map((thread) => (
            <TimelineBranch key={thread.id} level={1}>
              <ResearchSubagentCard
                node={thread}
                toolNodes={toolNodes.filter((toolNode) => toolNode.parentId === thread.id)}
              />
            </TimelineBranch>
          ))}
        </div>
      ) : orchestrator?.status === "running" ? (
        <MessageResponse className="pl-6 text-amber-800">
          Waiting for the first sub-agent to start…
        </MessageResponse>
      ) : null}

      {orphanTools.length > 0 ? (
        <div className="space-y-2">
          {orphanTools.map((toolNode) => (
            <TimelineBranch key={toolNode.id} level={1}>
              <ResearchToolCallCard node={toolNode} />
            </TimelineBranch>
          ))}
        </div>
      ) : null}
    </div>
  );
}
