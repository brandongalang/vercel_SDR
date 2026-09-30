import { authorizeRequest } from "@/lib/server/session";
import { z } from "zod";
import { runDraftGenerator } from "@/lib/pipeline/draft-generator";
import { regenerateDraftRequestSchema } from "@/lib/pipeline/schemas";
import type { AnglePlan, LeadInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = authorizeRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const parsed = regenerateDraftRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid regenerate request",
          issues: z.treeifyError(parsed.error),
        },
        { status: 400 },
      );
    }

    const { adjustments, job, note } = parsed.data;

    const leadInput: LeadInput = {
      leadName: job.lead.name,
      leadTitle: job.lead.title,
      company: job.company,
      play: job.play,
    };

    const anglePlan: AnglePlan = {
      angleType: job.angleType,
      angle: job.angle,
      whyNow: job.whyNow,
      confidence: {
        tier: job.confidence.tier,
        summary: job.confidence.summary,
        reasons: job.confidence.reasons ?? [job.confidence.summary],
      },
      usedSignalIds: job.signals
        .filter((signal) => signal.usedInAngle)
        .map((signal) => signal.id),
    };

    const draft = await runDraftGenerator({
      leadInput,
      anglePlan,
      regeneration: {
        adjustments,
        currentDraft: job.draft,
        note,
      },
      signals: job.signals,
    });

    return Response.json({ draft });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to regenerate draft",
      },
      { status: 500 },
    );
  }
}
