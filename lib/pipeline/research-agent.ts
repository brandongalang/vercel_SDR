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
- First verify the exact person/company match. If the company name is generic or shared by multiple businesses, use the company domain and the lead's role to reject same-name entities before broader research.
- Always cover company context plus one person/play-specific angle unless the evidence clearly suggests a better split.
- Prefer 2 to 4 reinforcing findings that could support one credible outbound angle, not a wide market scan.
- For outbound prospecting and social-post style leads, bias toward recent public writing, speaking, shipping, hiring, or product-building signals from the lead before generic company overviews.
- Prefer first-party domains, lead-authored posts/newsletters/profiles, named event pages, public code/product artifacts, or official company pages. Use directory/enrichment sites only as lightweight title confirmation when stronger sources are unavailable.
- Do not force a Vercel narrative in research. Return the strongest concrete signal cluster and note when the product connection is indirect.
- Thin-source leads should still get a usable packet; note uncertainty instead of blocking.
- Keep the parent summary concise, concrete, and decision-oriented.
- The subagent tool returns the full report to the runtime, but you should only reason over the summary you are shown.
  `;
}

const PLAY_SPECIFIC_GOALS: Record<PlayType, string> = {
  event:
    "Find what the lead engaged with at the event, what they likely cared about, and how it maps to an active product, platform, or operational initiative.",
  hiring_signal:
    "Find hiring plans that imply near-term tooling, workflow, AI, product, or platform needs.",
  outbound_prospecting:
    "Find recent public writing, speaking, shipping, or product-building signals that show what the lead cares about right now and why the timing matters.",
  plg_signup:
    "Find evidence of active evaluation, preview workflow concerns, and team coordination signals.",
  social_post:
    "Find the post, thread, article, or comment from the lead and the concrete workflow or product implication it points to.",
  tech_migration:
    "Find explicit framework, stack, migration, or modernization signals and the operational consequence that likely follows.",
  web_intent:
    "Find the strongest play-specific reason the timing could matter right now, but translate anonymous or indirect intent into a practical question rather than a surveillance-heavy claim.",
};

function buildSiteQuery(domain: string | undefined, query: string) {
  return domain ? `site:${domain} ${query}` : query;
}

function buildPersonQueryHints(leadInput: LeadInput) {
  return [
    `"${leadInput.leadName}" ${leadInput.company} ${leadInput.leadTitle}`,
    `"${leadInput.leadName}" ${leadInput.company} LinkedIn`,
    `"${leadInput.leadName}" ${leadInput.company} post thread substack interview`,
  ];
}

function buildCompanyQueryHints(leadInput: LeadInput) {
  return [
    buildSiteQuery(leadInput.companyDomain, `${leadInput.company} engineering`),
    buildSiteQuery(leadInput.companyDomain, `${leadInput.company} blog product launch`),
    buildSiteQuery(leadInput.companyDomain, `${leadInput.company} careers`),
  ];
}

function buildPlayQueryHints(leadInput: LeadInput) {
  switch (leadInput.play.type) {
    case "event":
      return [
        `"${leadInput.leadName}" ${leadInput.company} ${leadInput.play.label}`,
        `${leadInput.company} ${leadInput.play.context ?? leadInput.play.label}`,
      ];
    case "hiring_signal":
      return [
        buildSiteQuery(leadInput.companyDomain, `${leadInput.company} careers`),
        `${leadInput.company} hiring ${leadInput.play.context ?? "platform product engineering"}`,
      ];
    case "social_post":
      return [
        `"${leadInput.leadName}" ${leadInput.company} LinkedIn post`,
        `"${leadInput.leadName}" ${leadInput.company} Threads`,
        `"${leadInput.leadName}" ${leadInput.company} newsletter article`,
      ];
    case "tech_migration":
      return [
        `${leadInput.company} migration engineering`,
        `${leadInput.company} ${leadInput.play.context ?? "Next.js React platform migration"}`,
      ];
    case "web_intent":
      return [
        `${leadInput.company} ${leadInput.play.context ?? leadInput.play.label}`,
        `${leadInput.company} docs pricing product evaluation`,
      ];
    case "plg_signup":
      return [
        `${leadInput.company} ${leadInput.play.label}`,
        `${leadInput.company} ${leadInput.play.context ?? "product rollout launch"}`,
      ];
    case "outbound_prospecting":
    default:
      return [
        `"${leadInput.leadName}" ${leadInput.company} AI product`,
        `"${leadInput.leadName}" ${leadInput.company} workshop panel podcast`,
        `"${leadInput.leadName}" ${leadInput.company} build ship prototype`,
      ];
  }
}

function buildFallbackThreads(leadInput: LeadInput) {
  const companyDomain = leadInput.companyDomain ? [leadInput.companyDomain] : [];
  const playSpecificGoal = PLAY_SPECIFIC_GOALS[leadInput.play.type];

  return [
    {
      topic: "person-context",
      researchGoal: "Find recent public signals about the lead's priorities, role scope, or stated technical interests.",
      queryHints: buildPersonQueryHints(leadInput),
      includeDomains: [],
    },
    {
      topic: "company-context",
      researchGoal: "Find the most relevant company-level product, platform, hiring, or operational context tied to how the team ships.",
      queryHints: buildCompanyQueryHints(leadInput),
      includeDomains: companyDomain,
    },
    {
      topic: "play-context",
      researchGoal: playSpecificGoal,
      queryHints: buildPlayQueryHints(leadInput),
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
