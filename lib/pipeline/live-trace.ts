import type { JSONValue } from "ai";
import type { infer as Infer } from "zod";
import type { Finding } from "@/lib/types";
import type {
  WebSearchOutput,
  WebSearchResult,
} from "@/lib/pipeline/tools/search-types";
export { nowIso } from "@/lib/time";

export type PipelineTraceStatus = "running" | "completed" | "error";

export type PipelineTraceToolName = "web_search" | "crm_lookup" | "product_signals";

type WebSearchInput = Infer<
  (typeof import("@/lib/pipeline/schemas"))["webSearchInputSchema"]
>;
type CrmLookupInput = Infer<
  (typeof import("@/lib/pipeline/schemas"))["crmLookupInputSchema"]
>;
type ProductSignalsInput = Infer<
  (typeof import("@/lib/pipeline/schemas"))["productSignalsInputSchema"]
>;
type CrmLookupOutput = ReturnType<
  (typeof import("@/lib/pipeline/tools/crm-lookup"))["lookupMockCrm"]
>;
type ProductSignalsOutput = ReturnType<
  (typeof import("@/lib/pipeline/tools/product-signals"))["getMockProductSignals"]
>;

export type PipelineTraceValue = JSONValue;

export type WebSearchTraceResult = Pick<
  WebSearchResult,
  "title" | "url" | "publishedDate" | "summary"
> & {
  highlights: string[];
};

export type WebSearchTraceOutput = Pick<
  WebSearchOutput,
  "query" | "provider" | "warnings"
> & {
  results: WebSearchTraceResult[];
};

export interface PipelineTraceToolInputMap {
  web_search: WebSearchInput;
  crm_lookup: CrmLookupInput;
  product_signals: ProductSignalsInput;
}

export interface PipelineTraceToolOutputMap {
  web_search: WebSearchTraceOutput;
  crm_lookup: CrmLookupOutput;
  product_signals: ProductSignalsOutput;
}

type PipelineTraceAgentNode = {
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
};

export type PipelineTraceToolNode<
  TToolName extends PipelineTraceToolName = PipelineTraceToolName,
> = {
  kind: "tool-call";
  id: string;
  parentId: string;
  order: number;
  scope: "research";
  title: string;
  toolName: TToolName;
  status: PipelineTraceStatus;
  startedAt: string;
  completedAt?: string;
  input: PipelineTraceToolInputMap[TToolName];
  output?: PipelineTraceToolOutputMap[TToolName];
  error?: string;
};

export type PipelineTraceNode =
  | PipelineTraceAgentNode
  | {
      [TToolName in PipelineTraceToolName]: PipelineTraceToolNode<TToolName>;
    }[PipelineTraceToolName];

export type PipelineTraceAgentNodeUpdate = Omit<PipelineTraceAgentNode, "order">;

export type PipelineTraceToolNodeUpdate<
  TToolName extends PipelineTraceToolName = PipelineTraceToolName,
> = Omit<PipelineTraceToolNode<TToolName>, "order">;

export type PipelineTraceNodeUpdate =
  | PipelineTraceAgentNodeUpdate
  | {
      [TToolName in PipelineTraceToolName]: PipelineTraceToolNodeUpdate<TToolName>;
    }[PipelineTraceToolName];

export type PipelineTraceDataParts = {
  "trace-node": PipelineTraceNode;
};

export interface PipelineTraceEmitter {
  (node: PipelineTraceAgentNodeUpdate): void;
  <TToolName extends PipelineTraceToolName>(node: PipelineTraceToolNodeUpdate<TToolName>): void;
}

export function getTraceErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown trace error";
}
