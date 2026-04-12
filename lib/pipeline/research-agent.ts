import { Output, stepCountIs, tool, ToolLoopAgent } from "ai";
import { VERTEX_MODEL_IDS, vertexModels } from "@/lib/ai/vertex";
import {
  getTraceErrorMessage,
  nowIso,
  type PipelineTraceEmitter,
} from "@/lib/pipeline/live-trace";
import type {
  LeadInput,
  PlayType,
  ResearchPacket,
  SubAgentReport,
} from "@/lib/types";
import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import {
  researchPacketModelOutputSchema,
  runResearcherInputSchema,
} from "@/lib/pipeline/schemas";
import { runResearchThread } from "@/lib/pipeline/spawn-researcher";
import { yieldStreamFlush } from "@/lib/pipeline/yield-stream-flush";

function getFreeformContextBlock(freeformContext?: string) {
  const trimmed = freeformContext?.trim();

  if (!trimmed) {
    return "No freeform lead context was provided.";
  }

  return trimmed.slice(0, 8000);
}

function buildOrchestratorPrompt(leadInput: LeadInput) {
  return `
Prompt version: ${PROMPT_VERSIONS.researchOrchestrator}

You are the research orchestrator for an SDR outbound personalization pipeline.

Lead:
- Name: ${leadInput.leadName}
- Title: ${leadInput.leadTitle}
- Company: ${leadInput.company}
- Company domain: ${leadInput.companyDomain ?? "unknown"}
- Play type: ${leadInput.play.type}
- Play label: ${leadInput.play.label}
- Play context: ${leadInput.play.context ?? "none"}
- Lead source: ${leadInput.play.leadSource}

Unstructured lead context (from CRM / rep notes — treat as primary evidence for enrichment):
"""
${getFreeformContextBlock(leadInput.freeformContext)}
"""

Your job:
1. Decide dynamically which research threads are worth running.
2. Spawn 2 to 4 targeted sub-researchers.
3. Read only their summaries in your own context.
4. If coverage is still weak, spawn one gap-filling thread.
5. Return thread summaries, an orchestrator summary, and an uncertainty note.

Guidance:
- Always cover company context plus one person/play-specific angle unless the evidence clearly suggests a better split.
- Thin-source leads should still get a usable packet; note uncertainty instead of blocking.
- Keep the parent summary concise and decision-oriented.
- The subagent tool returns the full report to the runtime, but you should only reason over the summary you are shown.
  `;
}

const PLAY_SPECIFIC_GOALS: Record<PlayType, string> = {
  event:
    "Find context around the event, what the lead likely cared about, and how it connects to the company's current frontend or platform work.",
  hiring_signal:
    "Find hiring plans that imply frontend platform, developer productivity, or deployment workflow needs.",
  outbound_prospecting:
    "Find the strongest play-specific reason the timing could matter right now.",
  plg_signup:
    "Find evidence of active evaluation, preview workflow concerns, and team coordination signals.",
  social_post:
    "Find the strongest play-specific reason the timing could matter right now.",
  tech_migration:
    "Find the strongest play-specific reason the timing could matter right now.",
  web_intent:
    "Find the strongest play-specific reason the timing could matter right now.",
};

function buildFallbackThreads(leadInput: LeadInput) {
  const companyDomain = leadInput.companyDomain ? [leadInput.companyDomain] : [];
  const playSpecificGoal = PLAY_SPECIFIC_GOALS[leadInput.play.type];

  return [
    {
      topic: "person-context",
      researchGoal: "Find recent public signals about the lead's priorities, role scope, or stated technical interests.",
      queryHints: [
        `${leadInput.leadName} ${leadInput.company} ${leadInput.leadTitle}`,
        `${leadInput.leadName} ${leadInput.company} engineering`,
      ],
      includeDomains: [],
    },
    {
      topic: "company-context",
      researchGoal: "Find the most relevant company-level frontend, platform, product, or hiring context.",
      queryHints: [
        `${leadInput.company} engineering blog`,
        `${leadInput.company} careers platform frontend`,
        `${leadInput.company} next.js preview deployment`,
      ],
      includeDomains: companyDomain,
    },
    {
      topic: "play-context",
      researchGoal: playSpecificGoal,
      queryHints: [
        `${leadInput.company} ${leadInput.play.label}`,
        `${leadInput.company} ${leadInput.play.context ?? leadInput.play.label}`,
      ],
      includeDomains: companyDomain,
    },
  ];
}

function slugifyTraceId(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "research-thread";
}

function formatTraceTopic(topic: string) {
  return topic
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function trimFindingForTrace(finding: SubAgentReport["findings"][number]) {
  const rawQuote =
    finding.rawQuote && finding.rawQuote.length > 240
      ? `${finding.rawQuote.slice(0, 240)}…`
      : finding.rawQuote;

  return {
    ...finding,
    rawQuote,
  };
}

export async function runResearchAgent(input: {
  leadInput: LeadInput;
  abortSignal?: AbortSignal;
  trace?: PipelineTraceEmitter;
}) {
  const reports: SubAgentReport[] = [];
  const stepTraces: unknown[] = [];
  const orchestratorNodeId = "research-orchestrator";
  const orchestratorStartedAt = nowIso();
  let threadCount = 0;

  input.trace?.({
    kind: "agent",
    id: orchestratorNodeId,
    scope: "research",
    agentType: "orchestrator",
    title: "Research orchestrator",
    subtitle: "Plans coverage and spawns focused research threads",
    status: "running",
    startedAt: orchestratorStartedAt,
    model: VERTEX_MODEL_IDS.orchestrator,
  });
  await yieldStreamFlush();

  async function runThreadWithTrace(args: {
    topic: string;
    researchGoal: string;
    queryHints: string[];
    includeDomains: string[];
  }) {
    const threadId = `research-thread-${++threadCount}-${slugifyTraceId(args.topic)}`;
    const startedAt = nowIso();

    input.trace?.({
      kind: "agent",
      id: threadId,
      parentId: orchestratorNodeId,
      scope: "research",
      agentType: "subagent",
      title: `Sub-agent · ${formatTraceTopic(args.topic)}`,
      subtitle: "Focused evidence gathering",
      status: "running",
      startedAt,
      model: VERTEX_MODEL_IDS.researcher,
      topic: args.topic,
      goal: args.researchGoal,
      queryHints: args.queryHints,
      includeDomains: args.includeDomains,
    });
    await yieldStreamFlush();

    try {
      const result = await runResearchThread({
        leadInput: input.leadInput,
        topic: args.topic,
        researchGoal: args.researchGoal,
        queryHints: args.queryHints,
        includeDomains: args.includeDomains,
        abortSignal: input.abortSignal,
        trace: input.trace,
        traceParentId: threadId,
      });

      reports.push(result.report);
      stepTraces.push({ topic: result.report.topic, steps: result.steps });

      input.trace?.({
        kind: "agent",
        id: threadId,
        parentId: orchestratorNodeId,
        scope: "research",
        agentType: "subagent",
        title: `Sub-agent · ${formatTraceTopic(args.topic)}`,
        subtitle: "Focused evidence gathering",
        status: "completed",
        startedAt,
        completedAt: nowIso(),
        model: VERTEX_MODEL_IDS.researcher,
        topic: args.topic,
        goal: args.researchGoal,
        queryHints: args.queryHints,
        includeDomains: args.includeDomains,
        summary: result.report.summary,
        findings: result.report.findings.slice(0, 5).map(trimFindingForTrace),
        gaps: result.report.gaps,
      });
      await yieldStreamFlush();

      return result;
    } catch (error) {
      input.trace?.({
        kind: "agent",
        id: threadId,
        parentId: orchestratorNodeId,
        scope: "research",
        agentType: "subagent",
        title: `Sub-agent · ${formatTraceTopic(args.topic)}`,
        subtitle: "Focused evidence gathering",
        status: "error",
        startedAt,
        completedAt: nowIso(),
        model: VERTEX_MODEL_IDS.researcher,
        topic: args.topic,
        goal: args.researchGoal,
        queryHints: args.queryHints,
        includeDomains: args.includeDomains,
        error: getTraceErrorMessage(error),
      });
      await yieldStreamFlush();

      throw error;
    }
  }

  const spawnResearcher = tool({
    description: "Spawn a focused research subagent for one topic and receive a concise summary back.",
    inputSchema: runResearcherInputSchema,
    execute: async ({ topic, researchGoal, queryHints, includeDomains }) => {
      const result = await runThreadWithTrace({
        topic,
        researchGoal,
        queryHints,
        includeDomains,
      });
      return result.report;
    },
    toModelOutput: ({ output }) => ({
      type: "content",
      value: [{ type: "text", text: output.summary }],
    }),
  });

  const orchestrator = new ToolLoopAgent({
    model: vertexModels.orchestrator,
    instructions: "You coordinate research threads for outbound lead enrichment and decide when coverage is sufficient.",
    tools: {
      spawn_researcher: spawnResearcher,
    },
    output: Output.object({
      schema: researchPacketModelOutputSchema,
    }),
    stopWhen: stepCountIs(10),
  });

  try {
    const result = await orchestrator.generate({
      prompt: buildOrchestratorPrompt(input.leadInput),
      abortSignal: input.abortSignal,
    });

    if (reports.length === 0) {
      await Promise.all(
        buildFallbackThreads(input.leadInput).map((thread) =>
          runThreadWithTrace({
            topic: thread.topic,
            researchGoal: thread.researchGoal,
            queryHints: thread.queryHints,
            includeDomains: thread.includeDomains,
          }),
        ),
      );
    }

    const output = result.output;
    const packet: ResearchPacket = {
      leadInput: input.leadInput,
      reports,
      threadSummaries:
        output.threadSummaries.length > 0
          ? output.threadSummaries
          : reports.map((report) => report.summary),
      orchestratorSummary:
        output.orchestratorSummary ||
        "Used fallback research planning after the orchestrator returned without spawning any research threads.",
      uncertainty: output.uncertainty,
    };

    input.trace?.({
      kind: "agent",
      id: orchestratorNodeId,
      scope: "research",
      agentType: "orchestrator",
      title: "Research orchestrator",
      subtitle: "Plans coverage and spawns focused research threads",
      status: "completed",
      startedAt: orchestratorStartedAt,
      completedAt: nowIso(),
      model: VERTEX_MODEL_IDS.orchestrator,
      summary: packet.orchestratorSummary,
      uncertainty: packet.uncertainty,
    });
    await yieldStreamFlush();

    return {
      packet,
      steps: result.steps,
      threadTraces: stepTraces,
    };
  } catch (error) {
    input.trace?.({
      kind: "agent",
      id: orchestratorNodeId,
      scope: "research",
      agentType: "orchestrator",
      title: "Research orchestrator",
      subtitle: "Plans coverage and spawns focused research threads",
      status: "error",
      startedAt: orchestratorStartedAt,
      completedAt: nowIso(),
      model: VERTEX_MODEL_IDS.orchestrator,
      error: getTraceErrorMessage(error),
    });
    await yieldStreamFlush();

    throw error;
  }
}
