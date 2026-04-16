"use client";

import { useEffect, useRef, useState } from "react";
import { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import {
  REGENERATION_PRESETS,
  summarizeRegenerationRequest,
  type RegenerationPreset,
} from "@/lib/regeneration-presets";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  Info,
  Loader2,
  PencilLine,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

function renderBodyWithHighlight(body: string, span?: string) {
  if (!span) return <span className="whitespace-pre-wrap leading-relaxed">{body}</span>;
  const idx = body.indexOf(span);
  if (idx === -1) return <span className="whitespace-pre-wrap leading-relaxed">{body}</span>;
  const before = body.slice(0, idx);
  const after = body.slice(idx + span.length);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {before}
      <mark className="bg-cyan-100/60 text-zinc-900 rounded-[3px] px-0.5 not-italic border-b border-cyan-400/80">
        {span}
      </mark>
      {after}
    </span>
  );
}

const MAX_REGENERATION_PRESETS = 3;

function formatLeadSource(source: OutboundJob["play"]["leadSource"]) {
  return source.replace(/_/g, " ");
}

function DetailPanelEmptyState({
  state,
  errorMessage,
  isLoadingSlow,
  onBackToQueue,
}: {
  state: "loading" | "error" | "empty" | "complete" | "idle" | "ready";
  errorMessage?: string;
  isLoadingSlow?: boolean;
  onBackToQueue?: () => void;
}) {
  function getEmptyStateConfig() {
    switch (state) {
      case "loading":
        return {
          Icon: Loader2,
          iconClassName: "animate-spin text-muted-foreground",
          title: "Loading lead review queue",
          description: "Connecting to InstantDB and pulling the latest drafted leads into review.",
          detail: isLoadingSlow
            ? "This is taking longer than usual. You can still switch to Analytics, DSPy, or Live Agent while the queue connects."
            : undefined,
        };
      case "error":
        return {
          Icon: AlertTriangle,
          iconClassName: "text-destructive",
          title: "Couldn't load the review queue",
          description: errorMessage ?? "The review queue is unavailable right now.",
          detail: "You can still use the other demo surfaces while this connection issue is unresolved.",
        };
      case "empty":
        return {
          Icon: Inbox,
          iconClassName: "text-muted-foreground",
          title: "No leads in review yet",
          description: "Run the live pipeline to create a lead, or reseed demo data if this environment supports it.",
          detail: undefined,
        };
      case "complete":
        return {
          Icon: CheckCircle,
          iconClassName: "text-emerald-600",
          title: "All caught up",
          description: "There are no AI-generated drafts waiting for review.",
          detail: "Select any approved or skipped lead from the list to audit the final decision and evidence.",
        };
      default:
        return {
          Icon: Inbox,
          iconClassName: "text-muted-foreground",
          title: "Select a lead",
          description: "Choose a lead in the queue to review the draft and supporting evidence.",
          detail: undefined,
        };
    }
  }
  const config = getEmptyStateConfig();
  const Icon = config.Icon;

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/15 px-6 min-h-0">
      <div className="max-w-[360px] space-y-3 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
          <Icon className={cn("h-5 w-5", config.iconClassName)} aria-hidden />
        </div>
        <div className="space-y-1.5">
          <p className="text-[14px] font-medium text-foreground">{config.title}</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {config.description}
          </p>
          {config.detail && (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {config.detail}
            </p>
          )}
          {onBackToQueue && (
            <div className="pt-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onBackToQueue}>
                <ChevronLeft size={16} aria-hidden />
                Back to queue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DetailPanel({
  job,
  onApprove,
  onArchive,
  onDraftUpdate,
  onResetDraft,
  onRegenerateNote,
  draftHasEdits,
  regenerateNote,
  onBackToQueue,
  state,
  errorMessage,
  isLoadingSlow,
}: {
  job: OutboundJob | null;
  onApprove: (jobId: string, payload: { subject: string; body: string; edited: boolean; editorNote?: string }) => void;
  onArchive: (jobId: string) => void;
  onDraftUpdate: (jobId: string, draft: OutboundJob["draft"]) => void;
  onResetDraft: (jobId: string) => void;
  onRegenerateNote: (jobId: string, note: string | undefined) => void;
  draftHasEdits: boolean;
  regenerateNote?: string;
  /** When set (mobile master–detail), shows a back control to return to the queue list. */
  onBackToQueue?: () => void;
  state: "loading" | "error" | "empty" | "complete" | "idle" | "ready";
  errorMessage?: string;
  isLoadingSlow?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPresets, setRegenPresets] = useState<RegenerationPreset[]>([]);
  const [regenNote, setRegenNote] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenPreview, setRegenPreview] = useState<OutboundJob["draft"] | null>(null);
  const [regenPreviewFingerprint, setRegenPreviewFingerprint] = useState<string | null>(null);
  const [showResearch, setShowResearch] = useState(false);
  const [showEvidence, setShowEvidence] = useState(job?.confidence.tier !== "high");
  useEffect(() => {
    setShowEvidence(job?.confidence.tier !== "high");
  }, [job?.id, job?.confidence.tier]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  if (!job) {
    return (
      <DetailPanelEmptyState
        state={state}
        errorMessage={errorMessage}
        isLoadingSlow={isLoadingSlow}
        onBackToQueue={onBackToQueue}
      />
    );
  }

  const isDone = job.status !== "pending_review";
  const atConfig = ANGLE_CONFIG[job.angleType] ?? ANGLE_CONFIG.generic;
  const run = job.researchRun;
  const usedSignals = job.signals.filter((s) => s.usedInAngle);

  const feedbackCaptured = job.feedback?.edited === true;
  const hasStructuredFeedback = feedbackCaptured || Boolean(job.feedback?.editorNote);

  const handleApprove = () => {
    onApprove(job.id, {
      subject: job.draft.subject,
      body: job.draft.body,
      edited: draftHasEdits,
      editorNote: regenerateNote,
    });
    setIsEditing(false);
  };

  const handleResetDraft = () => {
    onResetDraft(job.id);
    setIsEditing(false);
  };

  const resetRegenerationWorkspace = () => {
    setRegenOpen(false);
    setRegenError(null);
    setRegenPresets([]);
    setRegenNote("");
    setRegenPreview(null);
    setRegenPreviewFingerprint(null);
  };

  const handleRegenerateToggle = (preset: RegenerationPreset) => {
    setRegenError(null);
    setRegenPresets((current) => {
      if (current.includes(preset)) {
        return current.filter((value) => value !== preset);
      }

      if (current.length >= MAX_REGENERATION_PRESETS) {
        return current;
      }

      return [...current, preset];
    });
  };

  const regenRequestFingerprint = `${[...regenPresets].sort().join(",")}|${regenNote.trim()}`;
  const previewMatchesRequest =
    regenPreviewFingerprint != null && regenPreviewFingerprint === regenRequestFingerprint;

  const fetchRegeneratedDraft = async (): Promise<OutboundJob["draft"]> => {
    const note = regenNote.trim();
    const response = await fetch("/api/jobs/regenerate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
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
        adjustments: regenPresets,
        note: note || undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; draft?: OutboundJob["draft"] }
      | null;

    if (!response.ok || !payload?.draft) {
      throw new Error(payload?.error ?? "Failed to regenerate draft");
    }
    return payload.draft;
  };

  const handleRegeneratePreview = async () => {
    if (regenPresets.length === 0) {
      setRegenError("Pick at least one adjustment.");
      return;
    }

    setRegenBusy(true);
    setRegenError(null);

    try {
      const draft = await fetchRegeneratedDraft();
      setRegenPreview(draft);
      setRegenPreviewFingerprint(regenRequestFingerprint);
    } catch (error) {
      setRegenError(error instanceof Error ? error.message : "Failed to regenerate draft");
      setRegenPreview(null);
      setRegenPreviewFingerprint(null);
    } finally {
      setRegenBusy(false);
    }
  };

  const handleUseRegeneratedDraft = () => {
    if (!regenPreview || !previewMatchesRequest) {
      setRegenError(
        !regenPreview
          ? "Generate a preview first."
          : "Adjustments or note changed — generate a new preview.",
      );
      return;
    }

    const note = regenNote.trim();
    onDraftUpdate(job.id, regenPreview);
    onRegenerateNote(
      job.id,
      summarizeRegenerationRequest(regenPresets, note || undefined) || undefined,
    );
    resetRegenerationWorkspace();
  };

  const gov =
    job.governance === "review_required"
      ? {
          label: "Review required",
          Icon: ShieldAlert,
          className: "border-amber-200 bg-amber-50 text-amber-900",
          iconClassName: "text-amber-700",
        }
      : {
          label: "Auto-eligible",
          Icon: ShieldCheck,
          className: "border-slate-200 bg-slate-100 text-slate-800",
          iconClassName: "text-slate-500",
        };
  const GovIcon = gov.Icon;

  const tierStyleMap: Record<string, string> = {
    high: "text-emerald-800 border-emerald-200 bg-emerald-50",
    medium: "text-blue-800 border-blue-200 bg-blue-50",
  };
  const tierStyles = tierStyleMap[job.confidence.tier] ?? "text-zinc-600 border-zinc-200 bg-zinc-100";
  const signalLabel = job.confidence.tier === "high" ? "Strong relevance" : job.confidence.tier === "medium" ? "Moderate relevance" : "Weak relevance";
  const reviewMetadata = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500/70">Routing</span>
        <span className="inline-flex items-center gap-1">
          <GovIcon size={13} className={job.governance === "review_required" ? "text-amber-700" : "text-slate-500"} aria-hidden />
          <span className="text-[11px] text-zinc-600">{gov.label}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500/70">Signal</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-mono font-medium transition-opacity hover:opacity-80",
                  tierStyles
                )}
              >
                {signalLabel}
                <Info size={11} className="opacity-60" aria-hidden />
              </button>
            }
          />
          <TooltipContent side="bottom" className="max-w-sm text-left leading-snug">
            <p className="font-medium text-background mb-1.5">{job.confidence.summary}</p>
            {job.confidence.reasons && job.confidence.reasons.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-[11px] opacity-95">
                {job.confidence.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500/70">Source</span>
        <span className="text-[11px] font-mono text-zinc-500">
          {formatLeadSource(job.play.leadSource)}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background min-h-0 overflow-hidden">
        {/* Header — recommendation context + primary decision */}
        <div className="z-20 shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
          {onBackToQueue && (
            <div className="mb-3 flex md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
                onClick={onBackToQueue}
              >
                <ChevronLeft size={18} aria-hidden />
                Queue
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {job.status === "reviewed" ? "Skipped lead" : job.status === "pending_review" ? "Draft under review" : "Reviewed lead"}
              </p>
              <h1 className="text-lg font-semibold text-zinc-900 tracking-tight truncate">{job.lead.name}</h1>
              <p className="text-[13px] text-zinc-500 mt-1">
                <span className="text-zinc-800">{job.company}</span>
                <span className="text-zinc-300 mx-2">·</span>
                {job.lead.title}
              </p>

              {isDone && (
                <div className="mt-4 border-t border-border/60 pt-3">
                  {reviewMetadata}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              {!isDone && (
                <div className="rounded-lg border border-border/70 bg-card px-3 py-2 lg:max-w-[30rem]">
                  {reviewMetadata}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5">
              {isDone ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium",
                      job.status === "approved" || job.status === "sent_stub"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-zinc-100 border-zinc-200 text-zinc-600"
                    )}
                  >
                    {job.status === "approved" && <><CheckCircle size={12} aria-hidden /> Approved</>}
                    {job.status === "reviewed" && <><SkipForward size={12} aria-hidden /> Skipped</>}
                    {job.status === "sent_stub" && <><Send size={12} aria-hidden /> Sent</>}
                  </span>
                  {job.status === "approved" && hasStructuredFeedback && (
                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                      {feedbackCaptured ? "Edits logged" : "Feedback noted"}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onArchive(job.id)}>
                          <SkipForward size={13} />
                          Skip
                        </Button>
                      }
                    />
                    <TooltipContent side="right" className="max-w-xs text-left">
                      Skip — mark not approved for send. Moves this lead to the Skipped queue (no first touch in this pass).
                    </TooltipContent>
                  </Tooltip>
                  <Button type="button" size="sm" onClick={handleApprove} className="gap-1.5">
                    <CheckCircle size={13} />
                    {draftHasEdits ? "Approve draft with edits" : "Approve draft"}
                  </Button>
                </>
              )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-50/80">
          <div className="mx-auto w-full max-w-[1380px] space-y-8 px-4 py-6 pb-4 sm:px-6">
            {job.status === "approved" && (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3 flex items-start gap-3 text-sm",
                  hasStructuredFeedback ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
                )}
              >
                <CheckCircle size={16} className={cn("mt-0.5 shrink-0", hasStructuredFeedback ? "text-amber-700" : "text-emerald-600")} />
                <div>
                  <p className={cn("font-medium", hasStructuredFeedback ? "text-amber-900" : "text-emerald-900")}>
                    {hasStructuredFeedback ? "Draft approved — feedback captured for tuning." : "Draft approved — ready for send workflow."}
                  </p>
                  <p className="text-zinc-600 text-xs mt-0.5">
                    {feedbackCaptured
                      ? "Edits are logged for future prompt tuning on this play."
                      : job.feedback?.editorNote
                        ? "Regenerate note and draft snapshot are retained for analytics (stub)."
                        : "The draft is approved here; sending remains a downstream step in production."}
                  </p>
                </div>
              </div>
            )}
            {job.status === "reviewed" && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 flex items-start gap-3">
                <SkipForward size={16} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden />
                <div>
                  <p className="font-medium text-zinc-900">Skipped — not approved for send</p>
                  <p className="text-xs mt-0.5 text-zinc-600">Skipped in active triage. Angle and evidence stay visible for audit.</p>
                </div>
              </div>
            )}
            {job.status === "sent_stub" && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-950 flex items-start gap-3">
                <Send size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
                <div>
                  <p className="font-medium">Sent (stub) — first touch logged</p>
                  <p className="text-xs mt-0.5 text-teal-900/90">
                    {job.outcome == null
                      ? "Connect email or CRM sync to populate reply and meeting outcomes for Insights."
                      : [
                          job.outcome.replied === true ? "Reply received" : "No reply yet",
                          job.outcome.positive === true ? "Positive outcome logged" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {/* Draft */}
            <section className="space-y-4">
              <div className="min-w-0 space-y-1 px-0.5">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  At a glance
                </p>
                <p className="max-w-[72ch] text-[13px] leading-relaxed text-foreground/90">
                  {job.whyNow ?? job.angle}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <h2 className="text-[14px] font-semibold text-foreground tracking-tight">
                      Generated draft
                    </h2>
                    {!isDone && !isEditing && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                        <PencilLine size={12} aria-hidden />
                        Click draft to edit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold",
                        atConfig.color
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                      {atConfig.label}
                    </span>
                    {job.outreach?.personAngleStrength && job.outreach.personAngleStrength !== "none" && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                        ★ Personal hook
                      </span>
                    )}
                  </div>
                </div>
                {!isDone && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant={regenOpen ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRegenError(null);
                        setRegenOpen((open) => !open);
                      }}
                    >
                      <RotateCcw size={13} />
                      {regenOpen ? "Close regenerate" : "Try another version"}
                    </Button>
                  </div>
                )}
              </div>

              {!isDone && regenOpen && (
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
                              Choose up to {MAX_REGENERATION_PRESETS}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {REGENERATION_PRESETS.map((preset) => {
                              const isSelected = regenPresets.includes(preset.id);
                              const disableSelect =
                                !isSelected && regenPresets.length >= MAX_REGENERATION_PRESETS;

                              return (
                                <Button
                                  key={preset.id}
                                  type="button"
                                  size="sm"
                                  variant={isSelected ? "secondary" : "outline"}
                                  disabled={disableSelect || regenBusy}
                                  onClick={() => handleRegenerateToggle(preset.id)}
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
                            value={regenNote}
                            onChange={(e) => setRegenNote(e.target.value)}
                            placeholder="e.g. Strong idea, but make it less familiar"
                            className="mt-2 min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                          />
                        </div>

                        {regenError && (
                          <p className="text-[12px] text-destructive">{regenError}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={regenBusy || regenPresets.length === 0}
                            onClick={handleRegeneratePreview}
                          >
                            {regenBusy ? "Generating…" : regenPreview ? "Regenerate preview" : "Generate preview"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={regenBusy}
                            onClick={() => resetRegenerationWorkspace()}
                          >
                            {regenPreview ? "Keep current draft" : "Cancel"}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-dashed border-border bg-background/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                            Preview
                          </p>
                          {regenPreview && !previewMatchesRequest && (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                              Preview is outdated
                            </span>
                          )}
                        </div>

                        {regenPreview ? (
                          <div className="mt-4 space-y-4">
                            <div>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                Subject
                              </span>
                              <p className="mt-1 text-[15px] font-semibold text-foreground">
                                {regenPreview.subject}
                              </p>
                            </div>
                            <div className="max-h-[min(320px,40vh)] overflow-y-auto rounded-lg border border-border bg-card">
                              <div className="p-4 text-[15px] leading-relaxed text-foreground">
                                {renderBodyWithHighlight(regenPreview.body, regenPreview.highlightedSpan)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                disabled={regenBusy || !previewMatchesRequest}
                                onClick={handleUseRegeneratedDraft}
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
              )}

              {draftHasEdits && !isDone && (
                <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200/80 rounded-md px-2 py-1.5 w-fit">
                  Draft edited — approving keeps these changes.
                </p>
              )}

              <div
                className={cn(
                  "rounded-xl border bg-card shadow-sm overflow-hidden transition-colors",
                  isEditing ? "border-teal-300" : "border-border hover:border-border/80"
                )}
              >
                <div className="space-y-3 p-4">
                  {isEditing ? (
                    <input
                      className="w-full text-[15px] font-medium bg-secondary/40 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
                      value={job.draft.subject}
                      onChange={(e) =>
                        onDraftUpdate(job.id, { ...job.draft, subject: e.target.value })
                      }
                      aria-label="Email subject"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={isDone}
                      onClick={() => {
                        if (!isDone) {
                          setIsEditing(true);
                          setTimeout(() => bodyRef.current?.focus(), 50);
                        }
                      }}
                      className={cn(
                        "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 -mx-2 -my-1.5 text-left transition-colors",
                        !isDone && "cursor-text hover:bg-muted/40"
                      )}
                      aria-label={isDone ? "Email subject" : "Click to edit email subject"}
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 shrink-0">Subject</span>
                      <span className="text-[15px] font-semibold text-foreground">{job.draft.subject}</span>
                    </button>
                  )}

                  <div
                    className={cn(
                      "flex max-h-[min(640px,70vh)] min-h-[200px] flex-col overflow-hidden rounded-xl border transition-shadow md:max-h-[min(640px,64vh)] md:min-h-[340px]",
                      isEditing
                        ? "border-teal-300 ring-1 ring-teal-200/70 bg-card"
                        : "border-border bg-card hover:border-border/80"
                    )}
                  >
                    {isEditing ? (
                      <textarea
                        ref={bodyRef}
                        className="min-h-[200px] w-full flex-1 resize-none bg-transparent p-5 text-[15px] leading-relaxed text-foreground focus:outline-none md:min-h-[320px]"
                        value={job.draft.body}
                        onChange={(e) =>
                          onDraftUpdate(job.id, { ...job.draft, body: e.target.value, highlightedSpan: undefined })
                        }
                        aria-label="Email body"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={isDone}
                        onClick={() => {
                          if (!isDone) {
                            setIsEditing(true);
                            setTimeout(() => bodyRef.current?.focus(), 50);
                          }
                        }}
                        className={cn(
                          "w-full flex-1 overflow-y-auto p-5 text-left text-[15px] leading-relaxed text-foreground transition-colors",
                          !isDone && "cursor-text hover:bg-muted/30"
                        )}
                        aria-label={isDone ? "Email body" : "Click to edit email body"}
                      >
                        {renderBodyWithHighlight(job.draft.body, job.draft.highlightedSpan)}
                      </button>
                    )}
                  </div>

                  {draftHasEdits && !isDone && (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground -ml-1 h-8" onClick={handleResetDraft}>
                      <RotateCcw size={13} />
                      Reset to original draft
                    </Button>
                  )}
                  {regenerateNote && !isDone && (
                    <p className="text-[12px] text-muted-foreground border-l-2 border-border pl-3 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">Regenerate note</span>
                      <span className="block mt-0.5 text-foreground/90">{regenerateNote}</span>
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Angle & context — demoted below the draft for deeper inspection */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-foreground tracking-tight">
                    Angle &amp; context
                  </h2>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Review the reasoning after the draft if you need to validate or tune the recommendation.
                  </p>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono font-semibold", atConfig.color)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                  {atConfig.label}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 space-y-5">
                  {job.whyNow && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">Trigger</p>
                      <p className="text-[14px] leading-relaxed text-foreground">{job.whyNow}</p>
                    </div>
                  )}

                  {job.outreach?.personInsight && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">Person Context</p>
                      <p className="text-[14px] leading-relaxed text-foreground">{job.outreach.personInsight}</p>
                      {job.outreach.personRefs && job.outreach.personRefs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.outreach.personRefs.map((r, i) => (
                            <a href={r.url} key={i} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                              [{i + 1}] {r.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {job.outreach?.companyInsight && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">Account Context</p>
                      <p className="text-[14px] leading-relaxed text-foreground">{job.outreach.companyInsight}</p>
                      {job.outreach.companyRefs && job.outreach.companyRefs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.outreach.companyRefs.map((r, i) => (
                            <a href={r.url} key={i} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                              [{i + 1}] {r.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(!job.outreach?.personInsight && !job.outreach?.companyInsight) && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">Selected Angle</p>
                      <p className="text-[14px] leading-relaxed text-foreground">{job.angle}</p>
                    </div>
                  )}
                </div>

                {(usedSignals.length > 0 || run.uncertainty) && (
                  <div className="space-y-2 border-t border-border/50 bg-muted/30 px-4 py-3">
                    {usedSignals.length > 0 && (() => {
                      const strong = usedSignals.filter((s) => s.strength === "strong");
                      const moderate = usedSignals.filter((s) => s.strength === "moderate");
                      const weak = usedSignals.filter((s) => s.strength === "weak");
                      return (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {usedSignals.length} research signal{usedSignals.length !== 1 ? "s" : ""}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {strong.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span className="inline-flex cursor-default items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                                      {strong.length} strong
                                    </span>
                                  }
                                />
                                <TooltipContent side="bottom" className="max-w-[200px] text-left">
                                  {strong.map((s) => s.label).join(", ")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {moderate.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span className="inline-flex cursor-default items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" aria-hidden />
                                      {moderate.length} moderate
                                    </span>
                                  }
                                />
                                <TooltipContent side="bottom" className="max-w-[200px] text-left">
                                  {moderate.map((s) => s.label).join(", ")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {weak.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span className="inline-flex cursor-default items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                                      {weak.length} weak
                                    </span>
                                  }
                                />
                                <TooltipContent side="bottom" className="max-w-[200px] text-left">
                                  {weak.map((s) => s.label).join(", ")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {run.uncertainty && (
                      <div className="mt-1 flex items-start gap-1.5 border-t border-amber-100/50 pt-1 text-amber-700 dark:border-amber-800/50 dark:text-amber-400">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                        <p className="text-[12px] font-medium leading-snug">{run.uncertainty}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <button
                type="button"
                onClick={() => setShowEvidence((v) => !v)}
                aria-expanded={showEvidence}
                className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground tracking-tight hover:text-foreground/70 transition-colors"
              >
                <ChevronRight size={16} className={cn("transition-transform duration-150 text-muted-foreground/60", showEvidence && "rotate-90")} />
                {usedSignals.length} signals · agent strategy · research
              </button>

              {showEvidence && (
                <div className="space-y-6 pt-2 pl-6">
                  {/* Signals grid */}
                  <div>
                    <h3 className="text-[13px] font-semibold text-zinc-900 tracking-tight mb-3">Signals</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {usedSignals.map((sig) => (
                        <div
                          key={sig.id}
                          className={cn(
                            "rounded-lg border border-zinc-200 bg-white px-3 py-3 border-l-[3px]",
                            sig.source === "internal" ? "border-l-emerald-500" : sig.source === "external" ? "border-l-teal-500" : "border-l-zinc-300"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[13px] font-medium text-zinc-900">{sig.label}</span>
                                <span className="text-[10px] font-mono uppercase text-zinc-500">{sig.source}</span>
                                <span
                                  className={cn(
                                    "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border",
                                    sig.strength === "strong"
                                      ? "bg-emerald-500 text-white border-emerald-500"
                                      : sig.strength === "moderate"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-zinc-100 text-zinc-500 border-zinc-200"
                                  )}
                                >
                                  {sig.strength}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-600">{sig.value}</p>
                            </div>
                            {sig.evidenceUrl && (
                              <a
                                href={sig.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-teal-700 hover:text-teal-900 shrink-0 mt-0.5"
                                aria-label={`Open evidence for ${sig.label}`}
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agent Strategy */}
                  <div>
                    <h3 className="text-[13px] font-semibold text-zinc-900 tracking-tight mb-3">Agent Strategy</h3>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono font-semibold", atConfig.color)}>
                            <span className={cn("h-2 w-2 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                            {atConfig.label}
                          </span>
                          <span className="text-[10px] font-mono uppercase text-zinc-400">Angle</span>
                        </div>
                        <p className="text-[12px] leading-relaxed text-zinc-700 font-medium">{job.angle}</p>
                      </div>
                      <div className="border-t border-zinc-200 pt-3">
                        <p className="text-[10px] font-mono uppercase text-zinc-400 mb-1">Why Now</p>
                        <p className="text-[12px] leading-relaxed text-zinc-700">{job.whyNow}</p>
                      </div>
                    </div>
                  </div>

                  {/* Research details — collapsible toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowResearch((v) => !v)}
                      className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                      <ChevronRight size={12} className={cn("transition-transform duration-150", showResearch && "rotate-90")} />
                      Research details
                    </button>
                    {showResearch && (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-3">
                          <p className="text-[12px] font-medium text-zinc-900">Research packet</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                            The orchestrator delegated topic-specific research threads, summarized the coverage, then handed a narrowed packet into signal extraction and drafting.
                          </p>
                        </div>

                        {run.threadSummaries.length > 0 && (
                          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                            <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Thread summaries</p>
                            <ul className="mt-2 space-y-2">
                              {run.threadSummaries.map((summary, index) => (
                                <li key={`${summary}-${index}`} className="text-[12px] leading-relaxed text-zinc-700">
                                  {summary}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          {run.reports.map((report) => (
                            <div key={report.topic} className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                              <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">{report.topic}</p>
                              <p className="mt-2 text-[12px] font-medium text-zinc-900">{report.summary}</p>
                              {report.findings.length > 0 && (
                                <ul className="mt-2 space-y-2">
                                  {report.findings.slice(0, 2).map((finding, index) => (
                                    <li key={`${report.topic}-${index}`} className="text-[11px] leading-relaxed text-zinc-600">
                                      <span className="font-medium text-zinc-800">{finding.text}</span>
                                      {finding.date ? ` · ${finding.date}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {report.gaps.length > 0 && (
                                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                                  Gaps: {report.gaps.join("; ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                          <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Lead source</p>
                          <p className="mt-2 text-[12px] font-medium text-zinc-900">{formatLeadSource(job.play.leadSource)}</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                            This lead already existed upstream. The agent enriched it, narrowed to one angle, and generated a first-touch draft.
                          </p>
                        </div>

                        {job.discardedSignals && job.discardedSignals.length > 0 && (
                          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                            <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Not leading with</p>
                            <ul className="mt-2 space-y-2">
                              {job.discardedSignals.map((ds, i) => (
                                <li key={i} className="text-[12px] text-zinc-700">
                                  <span className="font-medium text-zinc-900">{ds.label}</span>
                                  <p className="mt-1 leading-relaxed text-zinc-600">{ds.reason}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {run.uncertainty && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3">
                            <p className="text-[10px] font-mono uppercase tracking-wide text-amber-800">Uncertainty note</p>
                            <p className="mt-2 text-[12px] leading-relaxed text-amber-950/85">{run.uncertainty}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {!isDone && (
          <div className="shrink-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {draftHasEdits && (
                <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-1 shrink-0">
                  Draft edited
                </span>
              )}
              {isEditing && !draftHasEdits && (
                <span className="text-[11px] text-zinc-500 font-mono">Editing…</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-zinc-600"
                onClick={() => onArchive(job.id)}
              >
                <SkipForward size={13} />
                Skip
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={handleApprove}
              >
                <CheckCircle size={13} />
                {draftHasEdits ? "Approve with edits" : "Approve draft"}
              </Button>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
