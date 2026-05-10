import { useCallback, useState } from "react";
import type { OutboundJob } from "@/lib/types";
import { db } from "@/lib/instant-db";

type BaselineDraft = OutboundJob["draft"];

export function useJobActions(jobs: OutboundJob[]) {
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, BaselineDraft>>({});
  const [regenerateNotes, setRegenerateNotes] = useState<Record<string, string | undefined>>({});

  const getBaselineDraft = useCallback(
    (jobId: string): BaselineDraft | undefined => baselineDrafts[jobId],
    [baselineDrafts],
  );

  const getRegenerateNote = useCallback(
    (jobId: string): string | undefined => regenerateNotes[jobId],
    [regenerateNotes],
  );

  const handleApprove = useCallback(
    (
      jobId: string,
      payload: {
        subject: string;
        body: string;
        edited: boolean;
        editorNote?: string;
        draftRationale?: string;
      },
    ) => {
      const now = Date.now();
      db.transact(
        db.tx.jobs[jobId].update({
          status: "sent_stub",
          draftSubject: payload.subject,
          draftBody: payload.body,
          highlightedSpan: null,
          feedback: {
            edited: payload.edited,
            editorNote: payload.editorNote ?? null,
            draftRationale: payload.draftRationale ?? null,
          },
          approvedAt: now,
          sentAt: now,
          updatedAt: now,
          outcome: { replied: false, positive: false },
        }),
      );
      setRegenerateNotes((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    },
    [],
  );

  const handleArchive = useCallback((jobId: string, payload?: { skipReason?: string }) => {
    const now = Date.now();
    db.transact(
      db.tx.jobs[jobId].update({
        status: "reviewed",
        feedback: payload?.skipReason
          ? {
              edited: false,
              skipReason: payload.skipReason,
            }
          : null,
        archivedAt: now,
        updatedAt: now,
      }),
    );
  }, []);

  const handleDraftUpdate = useCallback(
    (jobId: string, draft: OutboundJob["draft"]) => {
      const current = jobs.find((job) => job.id === jobId);

      let baseline = baselineDrafts[jobId];
      if (current && !baseline) {
        baseline = {
          subject: current.draft.subject,
          body: current.draft.body,
          highlightedSpan: current.draft.highlightedSpan,
        };
        setBaselineDrafts((prev) => ({ ...prev, [jobId]: baseline! }));
      }

      const resolvedHighlight =
        baseline && draft.body === baseline.body && draft.highlightedSpan === undefined
          ? baseline.highlightedSpan
          : draft.highlightedSpan;

      db.transact(
        db.tx.jobs[jobId].update({
          draftSubject: draft.subject,
          draftBody: draft.body,
          highlightedSpan: resolvedHighlight ?? null,
          updatedAt: Date.now(),
        }),
      );
    },
    [jobs, baselineDrafts],
  );

  const handleResetDraft = useCallback(
    (jobId: string) => {
      const baseline = baselineDrafts[jobId];
      if (!baseline) return;

      db.transact(
        db.tx.jobs[jobId].update({
          draftSubject: baseline.subject,
          draftBody: baseline.body,
          highlightedSpan: baseline.highlightedSpan ?? null,
          updatedAt: Date.now(),
        }),
      );

      setRegenerateNotes((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    },
    [baselineDrafts],
  );

  const handleRegenerateNote = useCallback((jobId: string, note: string | undefined) => {
    setRegenerateNotes((prev) => ({ ...prev, [jobId]: note }));
  }, []);

  const resetAll = useCallback(() => {
    setRegenerateNotes({});
    setBaselineDrafts({});
  }, []);

  return {
    handleApprove,
    handleArchive,
    handleDraftUpdate,
    handleResetDraft,
    handleRegenerateNote,
    getBaselineDraft,
    getRegenerateNote,
    resetAll,
  };
}
