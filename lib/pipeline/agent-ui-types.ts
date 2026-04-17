import type { PipelineTraceNode } from "@/lib/pipeline/live-trace";
import type { PipelineAgentUIMessage } from "@/lib/pipeline/pipeline-agent";

export type MessagePart = PipelineAgentUIMessage["parts"][number];
export type RunResearchPart = Extract<MessagePart, { type: "tool-run_research" }>;
export type ExtractSignalsPart = Extract<MessagePart, { type: "tool-extract_signals" }>;
export type PlanAnglePart = Extract<MessagePart, { type: "tool-plan_angle" }>;
export type GenerateDraftPart = Extract<MessagePart, { type: "tool-generate_draft" }>;
export type PersistJobPart = Extract<MessagePart, { type: "tool-persist_job" }>;
export type TracePart = Extract<MessagePart, { type: "data-trace-node" }>;

export type TraceNode = PipelineTraceNode;
export type AgentTraceNode = Extract<TraceNode, { kind: "agent" }>;
export type OrchestratorTraceNode = AgentTraceNode & { agentType: "orchestrator" };
export type SubagentTraceNode = AgentTraceNode & { agentType: "subagent" };
export type ResearchToolNode = Extract<TraceNode, { kind: "tool-call" }>;
