import { useCallback, useState } from "react";
import type { OutboundJob } from "@/lib/types";

type BaselineDraft = OutboundJob["draft"];

export function useJobActions(jobs: OutboundJob[]) {
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, BaselineDraft>>({});
  const [regenerateNotes, setRegenerateNotes] = useState<Record<string, string | undefined>>({});
  const [actionError, setActionError] = useState<string>();
  const save = useCallback(async (command: Record<string, unknown>) => {
    setActionError(undefined);
    try {
      const response = await fetch("/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      if (response.status === 401) { window.location.replace("/login"); return; }
      if (!response.ok) throw new Error("Unable to save job action");
      window.dispatchEvent(new Event("sdr-jobs-changed"));
    } catch { setActionError("Unable to save job action. Please try again."); }
  }, []);

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
      void save({ action: "approve", jobId, ...payload });
      setRegenerateNotes((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    },
    [save],
  );

  const handleArchive = useCallback((jobId: string, payload?: { skipReason?: string }) => {
    void save({ action: "archive", jobId, skipReason: payload?.skipReason });
  }, [save]);

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

      void save({ action: "draft", jobId, subject: draft.subject, body: draft.body, highlightedSpan: resolvedHighlight });
    },
    [jobs, baselineDrafts, save],
  );

  const handleResetDraft = useCallback(
    (jobId: string) => {
      const baseline = baselineDrafts[jobId];
      if (!baseline) return;

      void save({ action: "draft", jobId, ...baseline });

      setRegenerateNotes((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    },
    [baselineDrafts, save],
  );

  const handleRegenerateNote = useCallback((jobId: string, note: string | undefined) => {
    setRegenerateNotes((prev) => ({ ...prev, [jobId]: note }));
  }, []);

  const resetAll = useCallback(() => {
    setRegenerateNotes({});
    setBaselineDrafts({});
    setActionError(undefined);
  }, []);

  return {
    actionError,
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
