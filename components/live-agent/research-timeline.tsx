"use client";

import {
  Brain,
  Database,
  Globe,
  Server,
  Sparkles,
} from "lucide-react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { MessageResponse } from "@/components/ai-elements/message";
import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import {
  formatCompactValue,
  formatTimestampLabel,
  PayloadDisclosure,
  PipelineToolRow,
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

function traceStatusToThoughtStatus(
  status: TraceNode["status"],
): "complete" | "active" | "pending" {
  if (status === "completed") return "complete";
  if (status === "running") return "active";
  return "pending";
}

function ResearchToolOutput({ node }: { node: ResearchToolNode }) {
  if (node.toolName === "web_search" && node.output) {
    const output = node.output;

    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-foreground">
          {output.results.length} result{output.results.length === 1 ? "" : "s"} for {output.query}
        </p>
        <div className="space-y-2">
          {output.results.slice(0, 4).map((result) => (
            <div key={`${result.url}-${result.title}`} className="rounded-md border border-border bg-card/80 px-3 py-2">
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-medium text-foreground hover:underline"
                aria-label={`Open search result: ${result.title}`}
              >
                {result.title}
              </a>
              {result.publishedDate ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{result.publishedDate}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (node.toolName === "crm_lookup" && node.output) {
    const output = node.output;

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {[output.lifecycleStage, output.segment, output.accountPriority].map((value) => (
            <span
              key={value}
              className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground"
            >
              {value.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        <p className="text-[12px] text-foreground/80">Owner: {output.owner}</p>
        <ul className="space-y-1 text-[12px] leading-relaxed text-foreground/80">
          {output.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (node.toolName === "product_signals" && node.output) {
    const output = node.output;

    return (
      <div className="space-y-2">
        <p className="text-[12px] leading-relaxed text-foreground/80">{output.summary}</p>
        <div className="space-y-2">
          {output.items.map((item) => (
            <div key={`${item.label}-${item.observedAt ?? "na"}`} className="rounded-lg border border-border bg-card/80 px-3 py-2">
              <p className="text-[12px] font-medium text-foreground">{item.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{item.detail}</p>
              {item.observedAt ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{item.observedAt}</p>
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
      return node.output.results.length
        ? `${node.output.results.length} result${node.output.results.length === 1 ? "" : "s"} for ${node.output.query}`
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
  const output =
    node.output ? (
      <div className="space-y-3">
        <ResearchToolOutput node={node} />
        <PayloadDisclosure label="Raw payload" value={node.output} />
      </div>
    ) : node.status === "running" ? (
      <MessageResponse className="text-amber-800 dark:text-amber-300">
        Tool call is running with live payload capture.
      </MessageResponse>
    ) : null;

  return (
    <PipelineToolRow
      type={`tool-${node.toolName}`}
      title={node.title}
      state={state}
      icon={icon}
      className="rounded-md border-border/70 bg-card/90 shadow-none"
      contentClassName="space-y-3"
      defaultOpen={false}
      description={
        getResearchToolSummary(node)
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
    return toolCount > 0
      ? `${toolCount} tool call${toolCount === 1 ? "" : "s"} completed.`
      : "Research thread completed.";
  }
  return toolCount > 0
    ? `${toolCount} tool call${toolCount === 1 ? "" : "s"} streaming.`
    : "Preparing first tool call…";
}

function ResearchSubagentStep({
  node,
  toolNodes,
}: {
  node: SubagentTraceNode;
  toolNodes: ResearchToolNode[];
}) {
  const thoughtStatus = traceStatusToThoughtStatus(node.status);
  const startedAt = formatTimestampLabel(node.startedAt);
  const completedAt = formatTimestampLabel(node.completedAt);

  return (
    <ChainOfThoughtStep
      icon={Globe}
      status={thoughtStatus}
      className={node.status === "error" ? "text-destructive" : undefined}
      label={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{node.topic ?? node.title}</span>
          <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            {toolNodes.length} tool{toolNodes.length === 1 ? "" : "s"}
          </span>
          {startedAt ? (
            <span className="text-[11px] text-muted-foreground">started {startedAt}</span>
          ) : null}
          {completedAt ? (
            <span className="text-[11px] text-muted-foreground">finished {completedAt}</span>
          ) : null}
        </div>
      }
      description={
        getSubagentSummary(node, toolNodes.length)
      }
    >
      {node.queryHints?.length ? (
        <ChainOfThoughtSearchResults>
          {node.queryHints.map((hint) => (
            <ChainOfThoughtSearchResult key={hint}>{hint}</ChainOfThoughtSearchResult>
          ))}
        </ChainOfThoughtSearchResults>
      ) : null}

      {toolNodes.length > 0 ? (
        <details className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Raw tool activity ({toolNodes.length})
          </summary>
          <div className="mt-2 space-y-2">
            {toolNodes.map((toolNode) => (
              <ResearchToolCallCard key={toolNode.id} node={toolNode} />
            ))}
          </div>
        </details>
      ) : node.status === "running" ? (
        <MessageResponse className="text-amber-800 dark:text-amber-300">
          Waiting on the first tool call from this sub-agent…
        </MessageResponse>
      ) : null}

      <PayloadDisclosure
        label="Thread config"
        value={{
          topic: node.topic,
          goal: node.goal,
          queryHints: node.queryHints,
          includeDomains: node.includeDomains,
          model: node.model,
        }}
      />

      {node.summary ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
            Summary
          </p>
          <MessageResponse className="mt-1 text-emerald-950 dark:text-emerald-100">{node.summary}</MessageResponse>
        </div>
      ) : null}

      {node.findings?.length ? (
        <details className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Key findings ({node.findings.length})
          </summary>
          <div className="mt-2 space-y-2">
            {node.findings.map((finding) => (
              <div
                key={`${finding.sourceUrl}-${finding.text}`}
                className="rounded-md border border-border bg-muted/40 px-3 py-2"
              >
                <MessageResponse className="text-foreground/90">{finding.text}</MessageResponse>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono uppercase tracking-wide">
                    {finding.confidence} confidence
                  </span>
                  {finding.date ? <span>{finding.date}</span> : null}
                  <a
                    href={finding.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    aria-label={`Open source for finding: ${finding.text}`}
                  >
                    Open source
                  </a>
                </div>
                {finding.rawQuote ? (
                  <MessageResponse className="mt-2 rounded-md border border-border bg-background/70 px-3 py-2 italic text-muted-foreground">
                    {finding.rawQuote}
                  </MessageResponse>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {node.gaps?.length ? (
        <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
          <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            Gaps ({node.gaps.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-amber-900 dark:text-amber-100">
            {node.gaps.map((gap) => (
              <li key={gap}>• {gap}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {node.error ? <MessageResponse className="text-destructive">{node.error}</MessageResponse> : null}
    </ChainOfThoughtStep>
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
  const completedTools = toolNodes.filter((toolNode) => toolNode.status === "completed").length;
  const workflowTitle = orchestrator?.status === "completed"
    ? `Deep research complete · ${threads.length} threads · ${toolNodes.length} tool calls`
    : orchestrator?.status === "running"
      ? `Deep research running · ${threads.length} thread${threads.length === 1 ? "" : "s"} active`
      : "Deep research";

  return (
    <div className="space-y-3">
      <ChainOfThought defaultOpen={true}>
        <ChainOfThoughtContent>
          {orchestrator ? (
            <ChainOfThoughtStep
              icon={Brain}
              status={traceStatusToThoughtStatus(orchestrator.status)}
              label={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{workflowTitle}</span>
                  <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {orchestrator.model}
                  </span>
                  <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {threads.length} thread{threads.length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {completedTools}/{toolNodes.length} tool call{toolNodes.length === 1 ? "" : "s"}
                  </span>
                  {orchestrator.startedAt ? (
                    <span className="text-[11px] text-muted-foreground">
                      {formatTimestampLabel(orchestrator.startedAt)}
                    </span>
                  ) : null}
                </div>
              }
              description={
                orchestrator.summary ??
                (orchestrator.status === "running"
                  ? "Planning coverage and delegating focused research threads."
                  : `Spawned ${threads.length} focused research thread${threads.length === 1 ? "" : "s"}.`)
              }
            >
              {threads.length > 0 ? (
                <ChainOfThoughtSearchResults>
                  {threads.map((thread) => (
                    <ChainOfThoughtSearchResult key={thread.id}>
                      {thread.topic ?? thread.title}
                    </ChainOfThoughtSearchResult>
                  ))}
                </ChainOfThoughtSearchResults>
              ) : null}
              {orchestrator.uncertainty ? (
                <MessageResponse className="text-amber-900 dark:text-amber-100">
                  Remaining uncertainty: {orchestrator.uncertainty}
                </MessageResponse>
              ) : null}
              {orchestrator.error ? (
                <MessageResponse className="text-destructive">{orchestrator.error}</MessageResponse>
              ) : null}
            </ChainOfThoughtStep>
          ) : null}

          {threads.map((thread) => (
            <ResearchSubagentStep
              key={thread.id}
              node={thread}
              toolNodes={toolNodes.filter((toolNode) => toolNode.parentId === thread.id)}
            />
          ))}

          {orphanTools.length > 0 ? (
            <ChainOfThoughtStep
              icon={Sparkles}
              status={completedTools === orphanTools.length ? "complete" : "active"}
              label="Direct tool activity"
              description="These tool calls were emitted outside a tracked sub-agent thread."
            >
              <details className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Raw tool activity ({orphanTools.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {orphanTools.map((toolNode) => (
                    <ResearchToolCallCard key={toolNode.id} node={toolNode} />
                  ))}
                </div>
              </details>
            </ChainOfThoughtStep>
          ) : null}
        </ChainOfThoughtContent>
      </ChainOfThought>
    </div>
  );
}
