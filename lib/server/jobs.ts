import "server-only";
import { z } from "zod";
import { fromInstantJobRecord } from "@/lib/jobs/instant-job-codec";
import { getAdminDb } from "@/lib/server/database";
import { authorizeRequest, PRIVATE_HEADERS } from "@/lib/server/session";

const text = z.string().max(20000);
const draft = { subject: z.string().max(1000), body: text, highlightedSpan: text.optional() };
const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), jobId: z.uuid(), subject: draft.subject, body: text, edited: z.boolean(), editorNote: text.optional(), draftRationale: text.optional() }).strict(),
  z.object({ action: z.literal("archive"), jobId: z.uuid(), skipReason: text.optional() }).strict(),
  z.object({ action: z.literal("draft"), jobId: z.uuid(), ...draft }).strict(),
]);

export function createJobsHandlers(database: typeof getAdminDb = getAdminDb) {
  return {
    async GET(request: Request) {
      const denied = authorizeRequest(request);
      if (denied) return denied;
      try {
        const data = await database().query({ jobs: {} });
        const jobs = [...data.jobs].sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)).map(fromInstantJobRecord);
        return Response.json({ jobs }, { headers: PRIVATE_HEADERS });
      } catch {
        return Response.json({ error: "Unable to load workspace" }, { status: 503, headers: PRIVATE_HEADERS });
      }
    },
    async PATCH(request: Request) {
      const denied = authorizeRequest(request);
      if (denied) return denied;
      try {
        const parsed = commandSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid job action" }, { status: 400, headers: PRIVATE_HEADERS });
        const command = parsed.data;
        const db = database();
        const existing = await db.query({ jobs: { $: { where: { id: command.jobId } } } });
        const job = existing.jobs[0];
        if (!job) return Response.json({ error: "Job not found" }, { status: 404, headers: PRIVATE_HEADERS });
        if (job.status !== "pending_review") return Response.json({ error: "Job is no longer pending review" }, { status: 409, headers: PRIVATE_HEADERS });
        const now = Date.now();
        const update = command.action === "approve" ? {
          status: "sent_stub", draftSubject: command.subject, draftBody: command.body, highlightedSpan: null,
          feedback: { edited: command.edited, editorNote: command.editorNote ?? null, draftRationale: command.draftRationale ?? null },
          approvedAt: now, sentAt: now, updatedAt: now, outcome: { replied: false, positive: false },
        } : command.action === "archive" ? {
          status: "reviewed", feedback: command.skipReason ? { edited: false, skipReason: command.skipReason } : null, archivedAt: now, updatedAt: now,
        } : {
          draftSubject: command.subject, draftBody: command.body, highlightedSpan: command.highlightedSpan ?? null, updatedAt: now,
        };
        await db.transact(db.tx.jobs[command.jobId].update(update));
        return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
      } catch {
        return Response.json({ error: "Unable to save job action" }, { status: 503, headers: PRIVATE_HEADERS });
      }
    },
  };
}
