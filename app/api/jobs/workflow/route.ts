import { start } from "workflow/api";
import { leadInputSchema } from "@/lib/pipeline/schemas";
import { outboundPipelineWorkflow } from "@/workflows/outbound-pipeline/workflow";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.WORKFLOW_API_KEY;
  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = leadInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid lead input", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const run = await start(outboundPipelineWorkflow, [parsed.data]);

  return Response.json({
    message: "Pipeline workflow started",
    runId: run.runId,
  });
}
