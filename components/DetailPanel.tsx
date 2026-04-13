"use client";

import { useRef, useState } from "react";
import { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import {
  REGENERATION_PRESETS,
  summarizeRegenerationRequest,
  type RegenerationPreset,
} from "@/lib/regeneration-presets";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, PencilLine, RotateCcw, CheckCircle, ShieldAlert, ShieldCheck, Info, Send, ChevronRight, SkipForward } from "lucide-react";
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
      <mark className="bg-amber-100 text-zinc-900 rounded-[3px] px-0.5 not-italic border-b border-amber-300/80">
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

export default function DetailPanel({
  job,
  onApprove,
  onArchive,
  onDraftUpdate,
  onResetDraft,
  onRegenerateNote,
  draftHasEdits,
  regenerateNote,
}: {
  job: OutboundJob | null;
  onApprove: (jobId: string, payload: { subject: string; body: string; edited: boolean; editorNote?: string }) => void;
  onArchive: (jobId: string) => void;
  onDraftUpdate: (jobId: string, draft: OutboundJob["draft"]) => void;
  onResetDraft: (jobId: string) => void;
  onRegenerateNote: (jobId: string, note: string | undefined) => void;
  draftHasEdits: boolean;
  regenerateNote?: string;
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/15 min-h-0">
        <div className="text-muted-foreground text-sm max-w-[240px] text-center leading-relaxed">
          <div className="w-10 h-10 rounded-full border border-dashed border-muted-foreground/25 mx-auto mb-3" />
          Select a lead in the queue to review the draft and evidence.
        </div>
      </div>
    );
  }

  const isDone = job.status !== "pending_review";
  const atConfig = ANGLE_CONFIG[job.angleType] ?? ANGLE_CONFIG.generic;
  const run = job.researchRun;
  const usedSignals = job.signals.filter((s) => s.usedInAngle);
  const primarySignals = usedSignals.slice(0, 2);
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
    setRegenOpen(false);
    setRegenPresets([]);
    setRegenNote("");
    setRegenPreview(null);
    setRegenPreviewFingerprint(null);
  };

  const gov =
    job.governance === "review_required"
      ? { label: "Review required", Icon: ShieldAlert, className: "border-amber-200 bg-amber-50 text-amber-900" }
      : { label: "Auto-eligible", Icon: ShieldCheck, className: "border-slate-200 bg-slate-100 text-slate-800" };
  const GovIcon = gov.Icon;

  const tierStyles =
    job.confidence.tier === "high"
      ? "text-emerald-800 border-emerald-200 bg-emerald-50"
      : job.confidence.tier === "medium"
        ? "text-amber-900 border-amber-200 bg-amber-50"
        : "text-zinc-600 border-zinc-200 bg-zinc-100";

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background min-h-0 overflow-hidden">
        {/* Header — recommendation context + primary decision */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 z-20 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-mono font-semibold uppercase tracking-wide",
                    gov.className
                  )}
                >
                  <GovIcon size={12} aria-hidden />
                  {gov.label}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-mono font-semibold uppercase tracking-wide",
                          tierStyles
                        )}
                      >
                        Confidence: {job.confidence.tier}
                        <Info size={12} className="opacity-70" aria-hidden />
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
                <span className="text-[11px] font-mono text-zinc-500">
                  Source: {formatLeadSource(job.play.leadSource)}
                </span>
              </div>
            </div>

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

        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-50/80">
          <div className="mx-auto w-full max-w-[1380px] space-y-8 px-4 py-6 pb-24 sm:px-6">
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

            {/* Decision context — angle, signals, and timing surfaced before the draft */}
            <section>
              <h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight mb-3">Why this lead</h2>
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3 space-y-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-mono font-semibold",
                      atConfig.color
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                    {atConfig.label}
                  </span>
                  <p className="text-[14px] font-medium text-zinc-900 leading-snug">{job.angle}</p>
                  {primarySignals.length > 0 && (
                    <p className="text-[12px] text-zinc-400">
                      Based on:{" "}
                      <span className="text-zinc-500">
                        {primarySignals.map((s) => s.label).join(" · ")}
                      </span>
                    </p>
                  )}
                </div>
                <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-400 mb-1">Why now</p>
                    <p className="text-[12px] leading-relaxed text-zinc-700">{job.whyNow}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-400 mb-1">Research summary</p>
                    <p className="text-[12px] leading-relaxed text-zinc-600 line-clamp-3">{run.orchestratorSummary}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
                  Generated draft
                </h2>
                {!isDone && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
                      <RotateCcw size={13} />
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      variant={isEditing ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsEditing((v) => !v);
                        if (!isEditing) setTimeout(() => bodyRef.current?.focus(), 50);
                      }}
                    >
                      <PencilLine size={13} />
                      {isEditing ? "Done editing" : "Edit draft"}
                    </Button>
                  </div>
                )}
              </div>

              {draftHasEdits && !isDone && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-md px-2 py-1.5 w-fit">
                  Unsaved edits — approving this draft keeps these changes.
                </p>
              )}

              <div className="rounded-xl border border-zinc-200 bg-card shadow-sm overflow-hidden">
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
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 shrink-0">Subject</span>
                      <span className="text-[15px] font-semibold text-foreground">{job.draft.subject}</span>
                    </div>
                  )}

                  <div
                    className={cn(
                      "rounded-xl border transition-shadow min-h-[340px] max-h-[min(640px,64vh)] overflow-hidden flex flex-col",
                      isEditing ? "border-teal-300 ring-1 ring-teal-200/70 bg-card" : "border-border bg-card"
                    )}
                  >
                    {isEditing ? (
                      <textarea
                        ref={bodyRef}
                        className="w-full flex-1 min-h-[320px] text-[15px] leading-relaxed bg-transparent resize-none focus:outline-none p-5 text-foreground"
                        value={job.draft.body}
                        onChange={(e) =>
                          onDraftUpdate(job.id, { ...job.draft, body: e.target.value, highlightedSpan: undefined })
                        }
                        aria-label="Email body"
                      />
                    ) : (
                      <div className="w-full flex-1 text-[15px] leading-relaxed text-foreground p-5 overflow-y-auto">
                        {renderBodyWithHighlight(job.draft.body, job.draft.highlightedSpan)}
                      </div>
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

            <section className="space-y-4">
              <h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
                Supporting evidence
              </h2>

              {/* Signals grid — always visible */}
              <div>
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
                                "text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border",
                                sig.strength === "strong"
                                  ? "text-emerald-900 border-emerald-200 bg-emerald-50"
                                  : "text-zinc-600 bg-white border-zinc-200"
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

              {/* Why this angle strategy — describes the angle type rationale */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono font-semibold", atConfig.color)}>
                    <span className={cn("h-2 w-2 rounded-full shrink-0", atConfig.dot)} aria-hidden />
                    {atConfig.label}
                  </span>
                  <p className="text-[10px] font-mono uppercase text-zinc-500">Angle strategy</p>
                </div>
                <p className="text-[12px] leading-relaxed text-zinc-700">{atConfig.description}</p>
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
            </section>
          </div>
        </div>
      </div>

      <Sheet
        open={regenOpen}
        onOpenChange={(open) => {
          setRegenOpen(open);
          if (!open) {
            setRegenError(null);
            setRegenPresets([]);
            setRegenNote("");
            setRegenPreview(null);
            setRegenPreviewFingerprint(null);
          }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-xl border-t max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Regenerate draft</SheetTitle>
            <SheetDescription>
              Choose adjustments and an optional note, generate a preview here, then apply it to the
              lead when you are ready. The angle plan and signals stay the same.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
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
                    disabled={disableSelect}
                    onClick={() => handleRegenerateToggle(preset.id)}
                  >
                    {preset.label}
                  </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Useful for things like making the draft shorter, more direct, less creepy, or more
                executive without re-running research or changing the angle.
              </p>
            </div>
            <div>
              <label htmlFor="regen-note" className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Note (optional)
              </label>
              <textarea
                id="regen-note"
                value={regenNote}
                onChange={(e) => setRegenNote(e.target.value)}
                placeholder="e.g. Wrong hook — needs re-plan"
                className="mt-2 w-full min-h-[72px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            {regenPreview && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Preview
                  </p>
                  {!previewMatchesRequest && (
                    <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-md px-2 py-0.5">
                      Settings changed — generate preview again
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Subject</span>
                  <p className="mt-1 text-[15px] font-semibold text-foreground">{regenPreview.subject}</p>
                </div>
                <div className="rounded-lg border border-border bg-background max-h-[min(360px,45vh)] overflow-y-auto">
                  <div className="p-4 text-[15px] leading-relaxed text-foreground">
                    {renderBodyWithHighlight(regenPreview.body, regenPreview.highlightedSpan)}
                  </div>
                </div>
              </div>
            )}
            {regenError && (
              <p className="text-[12px] text-destructive">{regenError}</p>
            )}
          </div>
          <SheetFooter className="flex-row flex-wrap justify-end gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRegenOpen(false)}>
              Cancel
            </Button>
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
              disabled={regenBusy || !regenPreview || !previewMatchesRequest}
              onClick={handleUseRegeneratedDraft}
            >
              Use this draft
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
