"use client";

import {
  Brain,
  CheckCircle2,
  Clock3,
  Database,
  Globe,
  Loader2,
  Server,
  Sparkles,
} from "lucide-react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { MessageResponse } from "@/components/ai-elements/message";
import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@/components/ai-elements/task";
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

function getWorkflowTone(status: TraceNode["status"]) {
  if (status === "completed") {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
      textClassName: "text-zinc-800",
    };
  }

  if (status === "running") {
    return {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />,
      textClassName: "text-zinc-800",
    };
  }

  return {
    icon: <Clock3 className="h-3.5 w-3.5 text-zinc-400" />,
    textClassName: "text-zinc-500",
  };
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
          {output.results.slice(0, 4).map((result) => (
            <div key={`${result.url}-${result.title}`} className="rounded-md border border-zinc-200 bg-white px-3 py-2">
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
      className="rounded-md border-zinc-200/70 bg-white/90 shadow-none"
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
      className={node.status === "error" ? "text-red-700" : undefined}
      label={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">{node.topic ?? node.title}</span>
          <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            {toolNodes.length} tool{toolNodes.length === 1 ? "" : "s"}
          </span>
          {startedAt ? (
            <span className="text-[11px] text-zinc-500">started {startedAt}</span>
          ) : null}
          {completedAt ? (
            <span className="text-[11px] text-zinc-500">finished {completedAt}</span>
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
        <details className="rounded-md border border-zinc-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Raw tool activity ({toolNodes.length})
          </summary>
          <div className="mt-2 space-y-2">
            {toolNodes.map((toolNode) => (
              <ResearchToolCallCard key={toolNode.id} node={toolNode} />
            ))}
          </div>
        </details>
      ) : node.status === "running" ? (
        <MessageResponse className="text-amber-800">
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Summary
          </p>
          <MessageResponse className="mt-1 text-emerald-950">{node.summary}</MessageResponse>
        </div>
      ) : null}

      {node.findings?.length ? (
        <details className="rounded-md border border-zinc-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Key findings ({node.findings.length})
          </summary>
          <div className="mt-2 space-y-2">
            {node.findings.map((finding) => (
              <div
                key={`${finding.sourceUrl}-${finding.text}`}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
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
        </details>
      ) : null}

      {node.gaps?.length ? (
        <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-amber-700">
            Gaps ({node.gaps.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-amber-900">
            {node.gaps.map((gap) => (
              <li key={gap}>• {gap}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {node.error ? <MessageResponse className="text-red-900">{node.error}</MessageResponse> : null}
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
  const completedThreads = threads.filter((thread) => thread.status === "completed").length;
  const completedTools = toolNodes.filter((toolNode) => toolNode.status === "completed").length;
  const activeThread = threads.find((thread) => thread.status === "running");
  const taskTitle = orchestrator?.status === "completed"
    ? `Deep research complete · ${threads.length} threads · ${toolNodes.length} tool calls`
    : orchestrator?.status === "running"
      ? `Deep research running · ${threads.length} thread${threads.length === 1 ? "" : "s"} active`
      : "Deep research workflow";

  return (
    <div className="space-y-3">
      <Task defaultOpen={orchestrator?.status !== "completed"}>
        <TaskTrigger title={taskTitle} />
        <TaskContent>
          <WorkflowTaskItem
            label="Orchestrator planned coverage"
            status={orchestrator?.status ?? "running"}
            detail={
              orchestrator?.summary ??
              (orchestrator?.status === "running"
                ? "Planning coverage and launching focused research threads…"
                : "Waiting for the orchestrator to start.")
            }
          />
          <WorkflowTaskItem
            label={`${completedThreads}/${threads.length} research thread${threads.length === 1 ? "" : "s"} completed`}
            status={
              threads.length > 0 && completedThreads === threads.length ? "completed" : "running"
            }
            detail={
              activeThread
                ? `Active thread: ${activeThread.topic ?? activeThread.title}`
                : threads.length > 0
                  ? "All focused sub-agents have finished."
                  : "Waiting for the first sub-agent to start."
            }
          />
          <WorkflowTaskItem
            label={`${completedTools}/${toolNodes.length} tool call${toolNodes.length === 1 ? "" : "s"} completed`}
            status={
              toolNodes.length > 0 && completedTools === toolNodes.length ? "completed" : "running"
            }
            detail={
              toolNodes.length > 0
                ? "Search, CRM, and product-signal lookups stream underneath each thread."
                : "Tool calls will appear once sub-agents start gathering evidence."
            }
          />
          <WorkflowTaskItem
            label="Research packet synthesized"
            status={orchestrator?.status === "completed" ? "completed" : "running"}
            detail={
              orchestrator?.uncertainty
                ? `Remaining uncertainty: ${orchestrator.uncertainty}`
                : "The orchestrator will summarize findings once threads are complete."
            }
          />
        </TaskContent>
      </Task>

      <ChainOfThought defaultOpen={orchestrator?.status !== "completed"}>
        <ChainOfThoughtHeader>Deep research workflow</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          {orchestrator ? (
            <ChainOfThoughtStep
              icon={Brain}
              status={traceStatusToThoughtStatus(orchestrator.status)}
              label={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">Orchestrator</span>
                  <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                    {orchestrator.model}
                  </span>
                  {orchestrator.startedAt ? (
                    <span className="text-[11px] text-zinc-500">
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
            <MessageResponse className="text-amber-900">
              Remaining uncertainty: {orchestrator.uncertainty}
            </MessageResponse>
          ) : null}
              {orchestrator.error ? (
                <MessageResponse className="text-red-900">{orchestrator.error}</MessageResponse>
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
              <details className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-500">
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

function WorkflowTaskItem({
  label,
  status,
  detail,
}: {
  label: string;
  status: TraceNode["status"];
  detail: string;
}) {
  const tone = getWorkflowTone(status);

  return (
    <TaskItem className="text-zinc-700">
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{tone.icon}</span>
        <div>
          <p className={tone.textClassName}>{label}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{detail}</p>
        </div>
      </div>
    </TaskItem>
  );
}
