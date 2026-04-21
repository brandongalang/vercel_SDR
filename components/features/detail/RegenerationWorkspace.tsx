"use client";

import { useState } from "react";
import type { OutboundJob } from "@/lib/types";
import {
  REGENERATION_PRESETS,
  summarizeRegenerationRequest,
  type RegenerationPreset,
} from "@/lib/regeneration-presets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_PRESETS = 3;

function renderBodyWithHighlight(body: string, span?: string) {
  if (!span) return <span className="whitespace-pre-wrap leading-relaxed">{body}</span>;
  const idx = body.indexOf(span);
  if (idx === -1) return <span className="whitespace-pre-wrap leading-relaxed">{body}</span>;
  const before = body.slice(0, idx);
  const after = body.slice(idx + span.length);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {before}
      <mark className="bg-cyan-100/60 text-zinc-900 dark:bg-cyan-900/40 dark:border-cyan-600/60 dark:text-cyan-100 rounded-[3px] px-0.5 not-italic border-b border-cyan-400/80">
        {span}
      </mark>
      {after}
    </span>
  );
}

export function RegenerationWorkspace({
  job,
  onDraftUpdate,
  onRegenerateNote,
}: {
  job: OutboundJob;
  onDraftUpdate: (jobId: string, draft: OutboundJob["draft"]) => void;
  onRegenerateNote: (jobId: string, note: string | undefined) => void;
}) {
  const [presets, setPresets] = useState<RegenerationPreset[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OutboundJob["draft"] | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);

  const requestFingerprint = `${[...presets].sort().join(",")}|${note.trim()}`;
  const previewMatchesRequest =
    previewFingerprint != null && previewFingerprint === requestFingerprint;

  const handleToggle = (preset: RegenerationPreset) => {
    setError(null);
    setPresets((current) => {
      if (current.includes(preset)) return current.filter((v) => v !== preset);
      if (current.length >= MAX_PRESETS) return current;
      return [...current, preset];
    });
  };

  const fetchDraft = async (): Promise<OutboundJob["draft"]> => {
    const trimmedNote = note.trim();
    const response = await fetch("/api/jobs/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        job: {
          lead: job.lead,
          company: job.company,
          play: job.play,
          whyNow: job.whyNow,
          angleType: job.angleType,
          angle: job.angle,
          confidence: {
            tier: job.confidence.tier,
            summary: job.confidence.summary,
            reasons: job.confidence.reasons,
          },
          signals: job.signals,
          draft: job.draft,
        },
        adjustments: presets,
        note: trimmedNote || undefined,
      }),
    });

    const payload = (await response.json()) as
      | { error?: string; draft?: OutboundJob["draft"] }
      | null;

    if (!response.ok || !payload?.draft) {
      throw new Error(payload?.error ?? "Failed to regenerate draft");
    }
    return payload.draft;
  };

  const handlePreview = async () => {
    if (presets.length === 0) {
      setError("Pick at least one adjustment.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const draft = await fetchDraft();
      setPreview(draft);
      setPreviewFingerprint(requestFingerprint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate draft");
      setPreview(null);
      setPreviewFingerprint(null);
    } finally {
      setBusy(false);
    }
  };

  const handleUse = () => {
    if (!preview || !previewMatchesRequest) {
      setError(
        !preview
          ? "Generate a preview first."
          : "Adjustments or note changed — generate a new preview.",
      );
      return;
    }

    const trimmedNote = note.trim();
    onDraftUpdate(job.id, preview);
    onRegenerateNote(
      job.id,
      summarizeRegenerationRequest(presets, trimmedNote || undefined) || undefined,
    );
    reset();
  };

  const reset = () => {
    setPresets([]);
    setNote("");
    setError(null);
    setPreview(null);
    setPreviewFingerprint(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card/70 px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            Try another version
          </h3>
          <p className="mt-1 max-w-[60ch] text-[12px] leading-relaxed text-muted-foreground">
            Tweak the current draft. The angle and evidence stay the same.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="mb-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Adjustments
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Choose up to {MAX_PRESETS}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {REGENERATION_PRESETS.map((preset) => {
                  const isSelected = presets.includes(preset.id);
                  const disableSelect = !isSelected && presets.length >= MAX_PRESETS;

                  return (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant={isSelected ? "secondary" : "outline"}
                      className={cn(
                        isSelected &&
                          "border-foreground/15 bg-foreground text-background shadow-sm hover:bg-foreground/92 dark:border-foreground/20 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
                      )}
                      disabled={disableSelect || busy}
                      onClick={() => handleToggle(preset.id)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="regen-note"
                className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
              >
                Note (optional)
              </label>
              <textarea
                id="regen-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Strong idea, but make it less familiar"
                className="mt-2 min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            {error && <p className="text-[12px] text-destructive">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                className="shadow-sm hover:shadow-md"
                disabled={busy || presets.length === 0}
                onClick={handlePreview}
              >
                {busy ? "Generating…" : preview ? "Regenerate preview" : "Generate preview"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={reset}
              >
                {preview ? "Keep current draft" : "Cancel"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                Preview
              </p>
              {preview && !previewMatchesRequest && (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300">
                  Preview is outdated
                </span>
              )}
            </div>

            {preview ? (
              <div className="mt-4 space-y-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Subject
                  </span>
                  <p className="mt-1 text-[15px] font-semibold text-foreground">
                    {preview.subject}
                  </p>
                </div>
                <div className="max-h-[min(320px,40vh)] overflow-y-auto rounded-lg border border-border bg-card">
                  <div className="p-4 text-[15px] leading-relaxed text-foreground">
                    {renderBodyWithHighlight(preview.body, preview.highlightedSpan)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={busy || !previewMatchesRequest}
                    onClick={handleUse}
                  >
                    Use this draft
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/40 px-6 text-center">
                <p className="max-w-[32ch] text-[12px] leading-relaxed text-muted-foreground">
                  Pick a few adjustments, then generate a preview here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
