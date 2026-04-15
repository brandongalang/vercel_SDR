import { Output, stepCountIs, tool, ToolLoopAgent } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import {
  getTraceErrorMessage,
  nowIso,
  type PipelineTraceEmitter,
  type PipelineTraceToolName,
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
import { searchWeb } from "@/lib/pipeline/tools/web-search";
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

Exact-match guardrails:
- The lead must match ${leadInput.leadName} at ${leadInput.company}${leadInput.companyDomain ? ` (${leadInput.companyDomain})` : ""}.
- Use a source only if it clearly refers to this lead or this exact company.
- Reject same-name companies, near-match brands, or unrelated domains even if the search result looks semantically relevant.

Source quality preferences:
- Prefer official company pages, lead-authored posts/newsletters/profiles, named event pages, public code/product artifacts, and credible reporting.
- Use directory or enrichment pages only to confirm title/background when better sources are unavailable. Do not build the whole angle on them.

Return a structured report for this topic only.
Use up to 5 tool calls.
Prefer recent, specific, source-backed findings. Two to four strong findings are better than five weak ones.
Every finding must keep the fact, source URL, optional date, optional quote, and confidence together.
Do not mix facts from separate sources into one finding.
Do not infer frontend, deployment, migration, or governance pain unless the source itself points there.
If evidence is weak, return a smaller, humbler report instead of inventing stronger evidence.
Make the summary compact and concrete because it will be shown to a parent orchestrator.
`;
}

function trimWebSearchForTrace(output: Awaited<ReturnType<typeof searchWeb>>) {
  return {
    query: output.query,
    provider: output.provider,
    warnings: output.warnings,
    results: output.results.slice(0, 3).map((result) => ({
      title: result.title,
      url: result.url,
      publishedDate: result.publishedDate,
      summary: result.summary,
      highlights: result.highlights.slice(0, 2),
    })),
  };
}

async function executeTracedResearchTool<TInput, TOutput>(config: {
  trace?: PipelineTraceEmitter;
  parentId: string;
  traceId: string;
  title: string;
  toolName: PipelineTraceToolName;
  input: TInput;
  execute: () => Promise<TOutput>;
  formatOutput?: (output: TOutput) => unknown;
}): Promise<TOutput> {
  const startedAt = nowIso();

  config.trace?.({
    kind: "tool-call",
    id: config.traceId,
    parentId: config.parentId,
    scope: "research",
    title: config.title,
    toolName: config.toolName,
    status: "running",
    startedAt,
    input: config.input,
  });
  await yieldStreamFlush();

  try {
    const output = await config.execute();

    config.trace?.({
      kind: "tool-call",
      id: config.traceId,
      parentId: config.parentId,
      scope: "research",
      title: config.title,
      toolName: config.toolName,
      status: "completed",
      startedAt,
      completedAt: nowIso(),
      input: config.input,
      output: config.formatOutput ? config.formatOutput(output) : output,
    });
    await yieldStreamFlush();

    return output;
  } catch (error) {
    config.trace?.({
      kind: "tool-call",
      id: config.traceId,
      parentId: config.parentId,
      scope: "research",
      title: config.title,
      toolName: config.toolName,
      status: "error",
      startedAt,
      completedAt: nowIso(),
      input: config.input,
      error: getTraceErrorMessage(error),
    });
    await yieldStreamFlush();

    throw error;
  }
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
  const traceParentId = input.traceParentId ?? "research-thread";
  const nextToolTraceId = (toolName: "web_search" | "crm_lookup" | "product_signals") =>
    `${traceParentId}:${toolName}:${++toolCallCount}`;

  const researcher = new ToolLoopAgent({
    model: vertexModels.researcher,
    instructions: `You are a focused research subagent.

Only investigate the single topic you were assigned.
Use the available tools to gather evidence.
Disambiguate same-name companies before using a source.
Treat the task as evidence gathering, not storytelling.
Do not write marketing copy.
Do not mix facts from separate sources into one finding.
End with a concise, high-signal summary that can be handed back to a parent orchestrator.`,
    tools: {
      web_search: tool({
        description: "Search the public web for recent company, person, hiring, social, and product signals.",
        inputSchema: webSearchInputSchema,
        execute: async (args) =>
          executeTracedResearchTool({
            trace: input.trace,
            parentId: traceParentId,
            traceId: nextToolTraceId("web_search"),
            title: "Web search",
            toolName: "web_search",
            input: args,
            execute: () => searchWeb(args),
            formatOutput: trimWebSearchForTrace,
          }),
      }),
      crm_lookup: tool({
        description: "Look up mocked CRM context for the account and lead.",
        inputSchema: crmLookupInputSchema,
        execute: async (args) =>
          executeTracedResearchTool({
            trace: input.trace,
            parentId: traceParentId,
            traceId: nextToolTraceId("crm_lookup"),
            title: "CRM lookup",
            toolName: "crm_lookup",
            input: args,
            execute: async () => lookupMockCrm(args),
          }),
      }),
      product_signals: tool({
        description: "Return mocked first-party product or event signals based on the lead source and play.",
        inputSchema: productSignalsInputSchema,
        execute: async (args) =>
          executeTracedResearchTool({
            trace: input.trace,
            parentId: traceParentId,
            traceId: nextToolTraceId("product_signals"),
            title: "Product signals",
            toolName: "product_signals",
            input: args,
            execute: async () => getMockProductSignals(args),
          }),
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
