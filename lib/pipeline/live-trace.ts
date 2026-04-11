import type { Finding } from "@/lib/types";

export type PipelineTraceStatus = "running" | "completed" | "error";

export type PipelineTraceToolName = "web_search" | "crm_lookup" | "product_signals";

export type PipelineTraceNode =
  | {
      kind: "agent";
      id: string;
      parentId?: string;
      order: number;
      scope: "research";
      agentType: "orchestrator" | "subagent";
      title: string;
      subtitle?: string;
      status: PipelineTraceStatus;
      startedAt: string;
      completedAt?: string;
      model: string;
      topic?: string;
      goal?: string;
      queryHints?: string[];
      includeDomains?: string[];
      summary?: string;
      findings?: Finding[];
      gaps?: string[];
      uncertainty?: string;
      error?: string;
    }
  | {
      kind: "tool-call";
      id: string;
      parentId: string;
      order: number;
      scope: "research";
      title: string;
      toolName: PipelineTraceToolName;
      status: PipelineTraceStatus;
      startedAt: string;
      completedAt?: string;
      input: unknown;
      output?: unknown;
      error?: string;
    };

export type PipelineTraceNodeUpdate = PipelineTraceNode extends infer Node
  ? Node extends PipelineTraceNode
    ? Omit<Node, "order">
    : never
  : never;

export type PipelineTraceDataParts = {
  "trace-node": PipelineTraceNode;
};

export type PipelineTraceEmitter = (node: PipelineTraceNodeUpdate) => void;

export function getTraceErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown trace error";
}

export function nowIso() {
  return new Date().toISOString();
}
