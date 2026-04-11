import { Output, stepCountIs, ToolLoopAgent } from "ai";
import { vertexModels } from "@/lib/ai/vertex";
import type { LeadInput, SubAgentReport } from "@/lib/types";
import { PROMPT_VERSIONS } from "@/lib/pipeline/prompts";
import { runResearcherInputSchema, subAgentReportSchema } from "@/lib/pipeline/schemas";
import { createCrmLookupTool } from "@/lib/pipeline/tools/crm-lookup";
import { createProductSignalsTool } from "@/lib/pipeline/tools/product-signals";
import { createWebSearchTool } from "@/lib/pipeline/tools/web-search";

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

export async function runResearchThread(input: {
  leadInput: LeadInput;
  topic: string;
  researchGoal: string;
  queryHints?: string[];
  includeDomains?: string[];
  abortSignal?: AbortSignal;
}) {
  runResearcherInputSchema.parse({
    topic: input.topic,
    researchGoal: input.researchGoal,
    queryHints: input.queryHints ?? [],
    includeDomains: input.includeDomains ?? [],
  });

  const researcher = new ToolLoopAgent({
    model: vertexModels.researcher,
    instructions: `You are a focused research subagent.

Only investigate the single topic you were assigned.
Use the available tools to gather evidence.
Do not write marketing copy.
Do not mix facts from separate sources into one finding.
End with a concise, high-signal summary that can be handed back to a parent orchestrator.`,
    tools: {
      web_search: createWebSearchTool(),
      crm_lookup: createCrmLookupTool(),
      product_signals: createProductSignalsTool(),
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
