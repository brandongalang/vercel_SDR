import { Output, stepCountIs, tool, ToolLoopAgent } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import {
  getTraceErrorMessage,
  nowIso,
  type PipelineTraceEmitter,
} from "@/lib/pipeline/live-trace";
import type { LeadInput, SubAgentReport } from "@/lib/types";
import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import {
  crmLookupInputSchema,
  productSignalsInputSchema,
  runResearcherInputSchema,
  subAgentReportSchema,
  webSearchInputSchema,
} from "@/lib/pipeline/schemas";
import { lookupMockCrm } from "@/lib/pipeline/tools/crm-lookup";
import { getMockProductSignals } from "@/lib/pipeline/tools/product-signals";
import { exaSearch } from "@/lib/pipeline/tools/web-search";
import { yieldStreamFlush } from "@/lib/pipeline/yield-stream-flush";

function buildResearchPrompt(input: {
  leadInput: LeadInput;
  topic: string;
  researchGoal: string;
  queryHints: string[];
  includeDomains: string[];
}) {
  const { leadInput, topic, researchGoal, queryHints, includeDomains } = input;

  return `
Prompt version: ${PROMPT_VERSIONS.researchThread}

Lead:
- Name: ${leadInput.leadName}
- Title: ${leadInput.leadTitle}
- Company: ${leadInput.company}
- Company domain: ${leadInput.companyDomain ?? "unknown"}
- Play type: ${leadInput.play.type}
- Play label: ${leadInput.play.label}
- Play context: ${leadInput.play.context ?? "none"}
- Lead source: ${leadInput.play.leadSource}

Research topic: ${topic}
Research goal: ${researchGoal}

Helpful query hints:
${queryHints.length > 0 ? queryHints.map((query) => `- ${query}`).join("\n") : "- None provided"}

Helpful domain constraints:
${includeDomains.length > 0 ? includeDomains.map((domain) => `- ${domain}`).join("\n") : "- None provided"}

Return a structured report for this topic only.
Use up to 5 tool calls.
Prefer recent, specific, source-backed findings.
Every finding must keep the fact, source URL, optional date, optional quote, and confidence together.
If evidence is weak, return weaker findings instead of inventing stronger ones.
Make the summary compact because it will be shown to a parent orchestrator.
`;
}

function trimWebSearchForTrace(output: Awaited<ReturnType<typeof exaSearch>>) {
  return {
    query: output.query,
    results: output.results.slice(0, 3).map((result) => ({
      title: result.title,
      url: result.url,
      publishedDate: result.publishedDate,
      summary: result.summary,
      highlights: result.highlights.slice(0, 2),
    })),
  };
}

export async function runResearchThread(input: {
  leadInput: LeadInput;
  topic: string;
  researchGoal: string;
  queryHints?: string[];
  includeDomains?: string[];
  abortSignal?: AbortSignal;
  trace?: PipelineTraceEmitter;
  traceParentId?: string;
}) {
  runResearcherInputSchema.parse({
    topic: input.topic,
    researchGoal: input.researchGoal,
    queryHints: input.queryHints ?? [],
    includeDomains: input.includeDomains ?? [],
  });

  let toolCallCount = 0;
  const nextToolTraceId = (toolName: "web_search" | "crm_lookup" | "product_signals") =>
    `${input.traceParentId ?? "research-thread"}:${toolName}:${++toolCallCount}`;

  const researcher = new ToolLoopAgent({
    model: vertexModels.researcher,
    instructions: `You are a focused research subagent.

Only investigate the single topic you were assigned.
Use the available tools to gather evidence.
Do not write marketing copy.
Do not mix facts from separate sources into one finding.
End with a concise, high-signal summary that can be handed back to a parent orchestrator.`,
    tools: {
      web_search: tool({
        description: "Search the public web for recent company, person, hiring, social, and product signals.",
        inputSchema: webSearchInputSchema,
        execute: async (args) => {
          const traceId = nextToolTraceId("web_search");
          const startedAt = nowIso();

          input.trace?.({
            kind: "tool-call",
            id: traceId,
            parentId: input.traceParentId ?? "research-thread",
            scope: "research",
            title: "Web search",
            toolName: "web_search",
            status: "running",
            startedAt,
            input: args,
          });
          await yieldStreamFlush();

          try {
            const output = await exaSearch(args);

            input.trace?.({
              kind: "tool-call",
              id: traceId,
              parentId: input.traceParentId ?? "research-thread",
              scope: "research",
              title: "Web search",
              toolName: "web_search",
              status: "completed",
              startedAt,
              completedAt: nowIso(),
              input: args,
              output: trimWebSearchForTrace(output),
            });
            await yieldStreamFlush();

            return output;
          } catch (error) {
            input.trace?.({
              kind: "tool-call",
              id: traceId,
              parentId: input.traceParentId ?? "research-thread",
              scope: "research",
              title: "Web search",
              toolName: "web_search",
              status: "error",
              startedAt,
              completedAt: nowIso(),
              input: args,
              error: getTraceErrorMessage(error),
            });
            await yieldStreamFlush();

            throw error;
          }
        },
      }),
      crm_lookup: tool({
        description: "Look up mocked CRM context for the account and lead.",
        inputSchema: crmLookupInputSchema,
        execute: async (args) => {
          const traceId = nextToolTraceId("crm_lookup");
          const startedAt = nowIso();

          input.trace?.({
            kind: "tool-call",
            id: traceId,
            parentId: input.traceParentId ?? "research-thread",
            scope: "research",
            title: "CRM lookup",
            toolName: "crm_lookup",
            status: "running",
            startedAt,
            input: args,
          });
          await yieldStreamFlush();

          try {
            const output = lookupMockCrm(args);

            input.trace?.({
              kind: "tool-call",
              id: traceId,
              parentId: input.traceParentId ?? "research-thread",
              scope: "research",
              title: "CRM lookup",
              toolName: "crm_lookup",
              status: "completed",
              startedAt,
              completedAt: nowIso(),
              input: args,
              output,
            });
            await yieldStreamFlush();

            return output;
          } catch (error) {
            input.trace?.({
              kind: "tool-call",
              id: traceId,
              parentId: input.traceParentId ?? "research-thread",
              scope: "research",
              title: "CRM lookup",
              toolName: "crm_lookup",
              status: "error",
              startedAt,
              completedAt: nowIso(),
              input: args,
              error: getTraceErrorMessage(error),
            });
            await yieldStreamFlush();

            throw error;
          }
        },
      }),
      product_signals: tool({
        description: "Return mocked first-party product or event signals based on the lead source and play.",
        inputSchema: productSignalsInputSchema,
        execute: async (args) => {
          const traceId = nextToolTraceId("product_signals");
          const startedAt = nowIso();

          input.trace?.({
            kind: "tool-call",
            id: traceId,
            parentId: input.traceParentId ?? "research-thread",
            scope: "research",
            title: "Product signals",
            toolName: "product_signals",
            status: "running",
            startedAt,
            input: args,
          });
          await yieldStreamFlush();

          try {
            const output = getMockProductSignals(args);

            input.trace?.({
              kind: "tool-call",
              id: traceId,
              parentId: input.traceParentId ?? "research-thread",
              scope: "research",
              title: "Product signals",
              toolName: "product_signals",
              status: "completed",
              startedAt,
              completedAt: nowIso(),
              input: args,
              output,
            });
            await yieldStreamFlush();

            return output;
          } catch (error) {
            input.trace?.({
              kind: "tool-call",
              id: traceId,
              parentId: input.traceParentId ?? "research-thread",
              scope: "research",
              title: "Product signals",
              toolName: "product_signals",
              status: "error",
              startedAt,
              completedAt: nowIso(),
              input: args,
              error: getTraceErrorMessage(error),
            });
            await yieldStreamFlush();

            throw error;
          }
        },
      }),
    },
    output: Output.object({
      schema: subAgentReportSchema,
    }),
    stopWhen: stepCountIs(12),
  });

  const result = await researcher.generate({
    prompt: buildResearchPrompt({
      leadInput: input.leadInput,
      topic: input.topic,
      researchGoal: input.researchGoal,
      queryHints: input.queryHints ?? [],
      includeDomains: input.includeDomains ?? [],
    }),
    abortSignal: input.abortSignal,
  });

  return {
    report: result.output as SubAgentReport,
    steps: result.steps,
  };
}
