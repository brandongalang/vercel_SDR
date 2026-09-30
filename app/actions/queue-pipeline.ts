"use server";

import { start } from "workflow/api";
import { outboundPipelineWorkflow } from "@/workflows/outbound-pipeline/workflow";
import type { LeadInput } from "@/lib/types";
import { requireActionSession } from "@/lib/server/action-auth";
import { leadInputSchema } from "@/lib/pipeline/schemas";

export async function queueLeadForPipeline(
  leadInput: LeadInput,
): Promise<{ runId: string }> {
  await requireActionSession();
  const parsed = leadInputSchema.parse(leadInput);
  const run = await start(outboundPipelineWorkflow, [parsed]);
  return { runId: run.runId };
}
