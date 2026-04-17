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
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCompanySize(size?: string): string {
  const labels: Record<string, string> = {
    smb: "SMB",
    mid_market: "Mid-market",
    enterprise: "Enterprise",
    startup: "Startup",
  };
  return size ? (labels[size] ?? size.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) : "Unknown";
}


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

const MAX_REGENERATION_PRESETS = 3;

function formatLeadSource(source: OutboundJob["play"]["leadSource"]) {
  return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ContextLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/65 transition-colors hover:text-muted-foreground">
              <Info size={12} aria-hidden />
            </span>
          }
        />
        <TooltipContent side="top" className="max-w-[220px] text-left leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
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
          detail: "Switch to History to audit sent or skipped leads without bringing them back into the active queue.",
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
  const [showAllSignals, setShowAllSignals] = useState(false);
  useEffect(() => {
    setShowResearch(false);
    setShowAllSignals(false);
  }, [job?.id]);
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
  const sortSignalsByRank = (a: (typeof job.signals)[number], b: (typeof job.signals)[number]) => {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  };
  const sortedUsedSignals = [...usedSignals].sort(sortSignalsByRank);
  const contextSignals = [...job.signals.filter((s) => !s.usedInAngle)].sort(sortSignalsByRank);
  const visibleSignals = showAllSignals ? sortedUsedSignals : sortedUsedSignals.slice(0, 3);
  const hiddenSignalCount = Math.max(sortedUsedSignals.length - visibleSignals.length, 0);
  const shouldShowThreadSummaries = run.reports.length === 0 && run.threadSummaries.length > 0;
  const showReviewState = draftHasEdits || (isEditing && !draftHasEdits);

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

    const payload = (await response.json()) as
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
          label: "Review suggested",
          Icon: ShieldAlert,
          className: "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200",
          iconClassName: "text-amber-700 dark:text-amber-400",
        }
      : {
          label: "Auto-send candidates",
          Icon: ShieldCheck,
          className: "border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200",
          iconClassName: "text-sky-600 dark:text-sky-400",
        };
  const GovIcon = gov.Icon;

  const tierStyleMap: Record<string, string> = {
    high: "text-emerald-800 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
    medium: "text-blue-800 border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  };
  const tierStyles = tierStyleMap[job.confidence.tier] ?? "text-muted-foreground border-border bg-muted";
  const signalLabel = job.confidence.tier === "high" ? "Strong Relevance" : job.confidence.tier === "medium" ? "Moderate Relevance" : "Weak Relevance";
  const reviewMetadata = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Routing</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                  gov.className
                )}
              >
                <GovIcon size={12} className={gov.iconClassName} aria-hidden />
                {gov.label}
              </button>
            }
          />
          <TooltipContent side="bottom" className="max-w-xs text-left">
            {job.governance === "review_required"
              ? "Human review required before sending. Enterprise accounts or low-signal leads always require a review pass."
              : "Eligible for automated sending based on signal strength and account size. Still benefits from a quick review."}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Signal</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                  tierStyles
                )}
              >
                {signalLabel}
                <Info size={11} className="opacity-60" aria-hidden />
              </button>
            }
          />
          <TooltipContent side="bottom" className="max-w-sm text-left leading-snug">
            <p className="mb-1.5 font-medium text-background">{job.confidence.summary}</p>
            {job.confidence.reasons && job.confidence.reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-[11px] opacity-95">
                {job.confidence.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Account</span>
        <span className="inline-flex items-center rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
          {formatCompanySize(job.companySize)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Source</span>
        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {formatLeadSource(job.play.leadSource)}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background min-h-0 overflow-hidden">
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
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {job.status === "reviewed"
                  ? "Skipped lead"
                  : job.status === "pending_review"
                    ? "Draft under review"
                    : "Sent lead"}
              </p>
              <h2 className="text-lg font-semibold text-foreground tracking-tight truncate">{job.lead.name}</h2>
              <p className="text-[13px] text-muted-foreground mt-1">
                <span className="text-foreground/80">{job.company}</span>
                <span className="text-muted-foreground/30 mx-2">·</span>
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
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 lg:max-w-[34rem]">
                  {reviewMetadata}
                </div>
              )}
              {isDone && (
                <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium",
                    job.status === "sent_stub"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                >
                  {job.status === "reviewed" && <><SkipForward size={12} aria-hidden /> Skipped</>}
                  {job.status === "sent_stub" && <><Send size={12} aria-hidden /> Sent</>}
                </span>
                {job.status === "sent_stub" && hasStructuredFeedback && (
                  <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
                    {feedbackCaptured ? "Edits logged" : "Feedback noted"}
                  </span>
                )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 bg-muted/40">
          <div className="mx-auto w-full max-w-[1380px] space-y-8 px-4 py-6 pb-4 sm:px-6">
            {job.status === "reviewed" && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-start gap-3">
                <SkipForward size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium text-foreground">Skipped — not approved for send</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">Skipped in active triage. Angle and evidence stay visible for audit.</p>
                </div>
              </div>
            )}
            {job.status === "sent_stub" && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-950 flex items-start gap-3 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-200">
                <Send size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
                <div>
                  <p className="font-medium">Sent — first touch logged</p>
                  <p className="text-xs mt-0.5 text-teal-900/90 dark:text-teal-300">
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
                                  className={cn(
                                    isSelected &&
                                      "border-foreground/15 bg-foreground text-background shadow-sm hover:bg-foreground/92 dark:border-foreground/20 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
                                  )}
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
                            variant="default"
                            className="shadow-sm hover:shadow-md"
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
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300">
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
                <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200/80 rounded-md px-2 py-1.5 w-fit dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800/80">
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
                      "flex max-h-[min(640px,70vh)] min-h-[200px] flex-col overflow-hidden rounded-xl border transition-shadow focus-within:ring-2 focus-within:ring-ring/50 md:max-h-[min(640px,64vh)] md:min-h-[340px]",
                      isEditing
                        ? "border-teal-300 ring-1 ring-teal-200/70 bg-card"
                        : "border-border bg-card hover:border-border/80",
                      !isDone && !isEditing && "cursor-text hover:bg-muted/10"
                    )}
                  >
                    {isEditing ? (
                      <textarea
                        ref={bodyRef}
                        className="min-h-[200px] w-full flex-1 resize-none bg-transparent p-5 text-[15px] leading-relaxed text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:min-h-[320px]"
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
                    <p className="text-[12px] text-muted-foreground bg-muted/60 rounded-md px-3 py-2">
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
                    Review the selected angle first, then the broader backdrop if you need to validate or tune the recommendation.
                  </p>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono font-semibold", atConfig.color)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                  {atConfig.label}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card/80 overflow-hidden flex flex-col">
                <div className="p-4 space-y-5">
                  <div className="space-y-3 border-b border-border/50 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Selected angle
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold",
                          atConfig.color
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                        {atConfig.label}
                      </span>
                    </div>
                    <p className="max-w-[58ch] text-[14px] font-semibold leading-6 tracking-tight text-foreground">
                      {job.angle}
                    </p>
                    {run.uncertainty && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-800/70 dark:bg-amber-950/30">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                        <p className="text-[12px] leading-5 text-amber-900 dark:text-amber-200">
                          {run.uncertainty}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[12px] font-semibold tracking-tight text-foreground">
                        Signals used in the draft
                      </h3>
                      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                        {usedSignals.length} signal{usedSignals.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {sortedUsedSignals.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-card/60">
                        {visibleSignals.map((sig, index) => (
                          <div
                            key={sig.id}
                            className={cn("px-4 py-3", index > 0 && "border-t border-border/70")}
                          >
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                  <p className="text-[13px] font-semibold leading-5 text-foreground">
                                    {sig.label}
                                  </p>
                                  <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                                    {sig.strength} · {sig.source.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <p className="mt-1 max-w-[62ch] text-[12px] leading-5 text-muted-foreground">
                                  {sig.value}
                                </p>
                              </div>
                              {sig.evidenceUrl && (
                                <a
                                  href={sig.evidenceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                  aria-label={`Open evidence for ${sig.label}`}
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-card/60 px-3 py-3">
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                          No supporting signals were retained for this draft.
                        </p>
                      </div>
                    )}
                    {hiddenSignalCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSignals(true)}
                        className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Show {hiddenSignalCount} more signal{hiddenSignalCount !== 1 ? "s" : ""}
                      </button>
                    )}
                  </div>

                  {job.whyNow && (
                    <div>
                      <ContextLabel
                        label="Trigger"
                        tooltip="The immediate reason this lead looks timely right now, such as a launch, hiring pattern, or public signal."
                      />
                      <p className="text-[14px] leading-relaxed text-foreground">{job.whyNow}</p>
                    </div>
                  )}

                  {job.outreach?.personInsight && (
                    <div>
                      <ContextLabel
                        label="Person Context"
                        tooltip="Research about this specific contact that can sharpen the message, such as role priorities, recent posts, or team remit."
                      />
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
                      <ContextLabel
                        label="Account Context"
                        tooltip="Company-level research that frames the opportunity, like expansion, product changes, infrastructure moves, or hiring momentum."
                      />
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

                  {contextSignals.length > 0 && (
                    <div className="space-y-2">
                      <ContextLabel
                        label="Additional Context Signals"
                        tooltip="Useful research signals that were found but not selected as the primary reasons for this draft."
                      />
                      <div className="overflow-hidden rounded-lg border border-border/80 bg-muted/15">
                        {contextSignals.map((sig, index) => (
                          <div
                            key={sig.id}
                            className={cn("flex items-start gap-3 px-3 py-3", index > 0 && "border-t border-border/70")}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <p className="text-[13px] font-semibold leading-5 text-foreground">
                                  {sig.label}
                                </p>
                                <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                                  {sig.strength} · {sig.source.replace(/_/g, " ")}
                                </span>
                              </div>
                              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                                {sig.value}
                              </p>
                            </div>
                            {sig.evidenceUrl && (
                              <a
                                href={sig.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                aria-label={`Open evidence for ${sig.label}`}
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!job.whyNow && !job.outreach?.personInsight && !job.outreach?.companyInsight && contextSignals.length === 0 && (
                    <div>
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        No additional context was attached beyond the selected angle and supporting signals.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3 border-t border-border/50 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowResearch((v) => !v)}
                      aria-expanded={showResearch}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight size={13} className={cn("transition-transform duration-150", showResearch && "rotate-90")} />
                      Research packet
                    </button>
                    {showResearch && (
                      <div className="mt-3 space-y-3">
                        <div className="px-1">
                          <p className="max-w-[65ch] text-[12px] leading-5 text-muted-foreground">
                            The orchestrator delegated topic-specific research threads, summarized the coverage, then handed a narrowed packet into signal extraction and drafting.
                          </p>
                        </div>

                        {shouldShowThreadSummaries && (
                          <div className="rounded-lg border border-border bg-card px-3 py-3">
                            <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Thread summaries</p>
                            <ul className="mt-2 space-y-2">
                              {run.threadSummaries.map((summary, index) => (
                                <li key={`${summary}-${index}`} className="text-[12px] leading-relaxed text-foreground/80">
                                  {summary}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          {run.reports.map((report) => (
                            <div key={report.topic} className="rounded-lg border border-border bg-card px-3 py-3">
                              <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{report.topic}</p>
                              <p className="mt-2 text-[12px] font-medium text-foreground">{report.summary}</p>
                              {report.findings.length > 0 && (
                                <ul className="mt-2 space-y-2">
                                  {report.findings.slice(0, 2).map((finding, index) => (
                                    <li key={`${report.topic}-${index}`} className="text-[11px] leading-relaxed text-muted-foreground">
                                      <span className="font-medium text-foreground/80">{finding.text}</span>
                                      {finding.date ? ` · ${finding.date}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {report.gaps.length > 0 && (
                                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                                  Gaps: {report.gaps.join("; ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="rounded-lg border border-border bg-card px-3 py-3">
                          <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Lead source</p>
                          <p className="mt-2 text-[12px] font-medium text-foreground">{formatLeadSource(job.play.leadSource)}</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                            This lead already existed upstream. The agent enriched it, narrowed to one angle, and generated a first-touch draft.
                          </p>
                        </div>

                        {job.discardedSignals && job.discardedSignals.length > 0 && (
                          <div className="rounded-lg border border-border bg-card px-3 py-3">
                            <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Not leading with</p>
                            <ul className="mt-2 space-y-2">
                              {job.discardedSignals.map((ds, i) => (
                                <li key={i} className="text-[12px] text-foreground/80">
                                  <span className="font-medium text-foreground">{ds.label}</span>
                                  <p className="mt-1 leading-relaxed text-muted-foreground">{ds.reason}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {!isDone && (
          <div className="shrink-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-2.5 [will-change:backdrop-filter]">
            <div
              className={cn(
                "mx-auto flex w-full max-w-[1380px] items-center gap-3",
                showReviewState ? "justify-between" : "justify-end"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {draftHasEdits && (
                  <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-1 shrink-0 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800">
                    Draft edited
                  </span>
                )}
                {isEditing && !draftHasEdits && (
                  <span className="text-[11px] text-muted-foreground font-mono">Editing…</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
                  )}
                  onClick={handleApprove}
                >
                  <CheckCircle size={13} />
                  {draftHasEdits ? "Approve with edits" : "Approve draft"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  onClick={() => onArchive(job.id)}
                >
                  <SkipForward size={13} />
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>

    </>
  );
}
