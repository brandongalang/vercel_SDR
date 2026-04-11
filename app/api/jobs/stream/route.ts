import {
  createAgentUIStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";
import { createPipelineAgent } from "@/lib/pipeline/pipeline-agent";
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

  const stream = createUIMessageStream<PipelineAgentUIMessage>({
    execute: async ({ writer }) => {
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

      const agent = createPipelineAgent(parsed.data, {
        abortSignal: request.signal,
        trace,
      });

      const agentStream = await createAgentUIStream({
        agent,
        uiMessages: messages,
        abortSignal: request.signal,
      });

      writer.merge(agentStream as unknown as Parameters<typeof writer.merge>[0]);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
