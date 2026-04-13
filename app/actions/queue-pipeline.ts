"use server";

import { start } from "workflow/api";
import { outboundPipelineWorkflow } from "@/workflows/outbound-pipeline/workflow";
import type { LeadInput } from "@/lib/types";

export async function queueLeadForPipeline(
  leadInput: LeadInput,
): Promise<{ runId: string }> {
  const run = await start(outboundPipelineWorkflow, [leadInput]);
  return { runId: run.runId };
}
