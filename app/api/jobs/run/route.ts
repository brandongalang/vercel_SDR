import { z } from "zod";
import { leadInputSchema } from "@/lib/pipeline/schemas";
import {
  PipelineExecutionError,
  runOutboundJobPipeline,
  startPipelineAuditPhase,
  type PipelineRunAudit,
} from "@/lib/pipeline/run-job";
import { persistPipelineRun } from "@/lib/pipeline/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let audit: PipelineRunAudit | null = null;

  try {
    const body = await request.json();
    const parsed = leadInputSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid lead input",
          issues: z.treeifyError(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await runOutboundJobPipeline({
      leadInput: parsed.data,
      abortSignal: request.signal,
    });
    audit = result.audit;
    startPipelineAuditPhase(audit, "persist");

    const persisted = await persistPipelineRun({
      job: result.job,
      audit,
    });

    return Response.json({
      job: persisted.job,
      traces: result.traces,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline failure";
    const pipelineError = error instanceof PipelineExecutionError ? error : null;
    const failedAudit = pipelineError?.audit ?? audit;
    let auditPersistenceError: string | null = null;

    if (failedAudit && failedAudit.currentPhase !== "persist") {
      try {
        await persistPipelineRun({
          audit: failedAudit,
        });
      } catch (persistError) {
        auditPersistenceError =
          persistError instanceof Error ? persistError.message : "Unknown audit persistence failure";
      }
    }

    return Response.json(
      {
        error: auditPersistenceError
          ? `${message}. Failed to persist audit: ${auditPersistenceError}`
          : message,
      },
      { status: 500 },
    );
  }
}
