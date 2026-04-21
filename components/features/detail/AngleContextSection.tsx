"use client";

import { useState } from "react";
import type { OutboundJob } from "@/lib/types";
import { ANGLE_CONFIG } from "@/lib/angle-config";
import { ContextLabel } from "./ContextLabel";
import { AlertTriangle, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

function formatLeadSource(source: OutboundJob["play"]["leadSource"]) {
  return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AngleContextSection({ job }: { job: OutboundJob }) {
  const [showResearch, setShowResearch] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);

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

  return (
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
  );
}
