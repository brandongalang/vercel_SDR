import {
  createAgentUIStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";
import { createPipelineAgent } from "@/lib/pipeline/pipeline-agent";
import { persistPipelineRun } from "@/lib/pipeline/persistence";
import { demoLeadInputSchema } from "@/lib/pipeline/schemas";
import type { PipelineAgentUIMessage } from "@/lib/pipeline/pipeline-agent";
import type { PipelineTraceNode, PipelineTraceNodeUpdate } from "@/lib/pipeline/live-trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function extractLeadInput(body: unknown) {
  if (typeof body === "object" && body !== null && "leadInput" in body) {
    return body.leadInput;
  }
  return body;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = demoLeadInputSchema.safeParse(extractLeadInput(body));

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid lead input", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  let persistedFailureAudit = false;
  let pipeline = createPipelineAgent(parsed.data, {
    abortSignal: request.signal,
  });

  const persistFailedAudit = async (error: unknown) => {
    if (persistedFailureAudit) {
      return;
    }

    const currentAudit = pipeline.getAuditSnapshot();
    if (currentAudit.status === "completed" || currentAudit.currentPhase === "persist") {
      return;
    }

    persistedFailureAudit = true;
    const message = error instanceof Error ? error.message : "Unknown pipeline failure";
    const failedAudit = pipeline.markFailed(message);

    try {
      await persistPipelineRun({ audit: failedAudit });
    } catch (persistError) {
      console.error("Failed to persist stream audit:", persistError);
    }
  };

  const stream = createUIMessageStream<PipelineAgentUIMessage>({
    onError: (error) => {
      void persistFailedAudit(error);
      return error instanceof Error ? error.message : "Unknown stream error";
    },
    execute: async ({ writer }) => {
      try {
        const nodeOrder = new Map<string, number>();
        let nextOrder = 0;

        const trace = (node: PipelineTraceNodeUpdate) => {
          const order = nodeOrder.get(node.id) ?? nextOrder++;
          nodeOrder.set(node.id, order);

          writer.write({
            type: "data-trace-node",
            id: node.id,
            data: {
              ...node,
              order,
            } as PipelineTraceNode,
          });
        };

        pipeline = createPipelineAgent(parsed.data, {
          abortSignal: request.signal,
          trace,
        });

        const agentStream = await createAgentUIStream({
          agent: pipeline.agent,
          uiMessages: messages,
          abortSignal: request.signal,
        });

        writer.merge(agentStream as unknown as Parameters<typeof writer.merge>[0]);
      } catch (error) {
        await persistFailedAudit(error);
        throw error;
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
