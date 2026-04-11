import { Output, stepCountIs, tool, ToolLoopAgent } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import type { LeadInput, ResearchPacket, SubAgentReport } from "@/lib/types";
import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import {
  researchPacketModelOutputSchema,
  runResearcherInputSchema,
} from "@/lib/pipeline/schemas";
import { runResearchThread } from "@/lib/pipeline/spawn-researcher";

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

function buildFallbackThreads(leadInput: LeadInput) {
  const companyDomain = leadInput.companyDomain ? [leadInput.companyDomain] : [];
  const playSpecificGoal =
    leadInput.play.type === "event"
      ? "Find context around the event, what the lead likely cared about, and how it connects to the company's current frontend or platform work."
      : leadInput.play.type === "plg_signup"
        ? "Find evidence of active evaluation, preview workflow concerns, and team coordination signals."
        : leadInput.play.type === "hiring_signal"
          ? "Find hiring plans that imply frontend platform, developer productivity, or deployment workflow needs."
          : "Find the strongest play-specific reason the timing could matter right now.";

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

export async function runResearchAgent(input: {
  leadInput: LeadInput;
  abortSignal?: AbortSignal;
}) {
  const reports: SubAgentReport[] = [];
  const stepTraces: unknown[] = [];

  const spawnResearcher = tool({
    description: "Spawn a focused research subagent for one topic and receive a concise summary back.",
    inputSchema: runResearcherInputSchema,
    execute: async ({ topic, researchGoal, queryHints, includeDomains }, { abortSignal }) => {
      const result = await runResearchThread({
        leadInput: input.leadInput,
        topic,
        researchGoal,
        queryHints,
        includeDomains,
        abortSignal,
      });

      reports.push(result.report);
      stepTraces.push({ topic, steps: result.steps });

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

  const result = await orchestrator.generate({
    prompt: buildOrchestratorPrompt(input.leadInput),
    abortSignal: input.abortSignal,
  });

  if (reports.length === 0) {
    const fallbackResults = await Promise.all(
      buildFallbackThreads(input.leadInput).map((thread) =>
        runResearchThread({
          leadInput: input.leadInput,
          topic: thread.topic,
          researchGoal: thread.researchGoal,
          queryHints: thread.queryHints,
          includeDomains: thread.includeDomains,
          abortSignal: input.abortSignal,
        }),
      ),
    );

    reports.push(...fallbackResults.map((thread) => thread.report));
    stepTraces.push(
      ...fallbackResults.map((thread) => ({
        topic: thread.report.topic,
        steps: thread.steps,
      })),
    );
  }

  const output = result.output;
  const packet: ResearchPacket = {
    leadInput: input.leadInput,
    reports,
    threadSummaries: output.threadSummaries.length > 0 ? output.threadSummaries : reports.map((report) => report.summary),
    orchestratorSummary:
      output.orchestratorSummary ||
      "Used fallback research planning after the orchestrator returned without spawning any research threads.",
    uncertainty: output.uncertainty,
  };

  return {
    packet,
    steps: result.steps,
    threadTraces: stepTraces,
  };
}
