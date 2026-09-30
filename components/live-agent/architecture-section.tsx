"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ExternalLink, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queueLeadForPipeline } from "@/app/actions/queue-pipeline";
import type { LeadInput } from "@/lib/types";

type PathNode = {
  label: string;
  sublabel: string;
  badge: string;
  badgeClass: string;
  detail?: string;
};

const DEMO_NODES: PathNode[] = [
  {
    label: "useChat + DefaultChatTransport",
    sublabel: "Client-side React hook streaming messages",
    badge: "Vercel AI SDK",
    badgeClass: "bg-teal-50 text-teal-700 border border-teal-200",
  },
  {
    label: "POST /api/jobs/stream",
    sublabel: "Route handler — returns agent stream",
    badge: "Vercel Function",
    badgeClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  },
  {
    label: "ToolLoopAgent",
    sublabel: "LLM-driven tool-call loop over pipeline stages",
    badge: "Vercel AI SDK",
    badgeClass: "bg-teal-50 text-teal-700 border border-teal-200",
  },
  {
    label: "OpenRouter · Qwen Free",
    sublabel: "Inference for research, signals, angle, and draft",
    badge: "Google Cloud",
    badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  {
    label: "Live stream → AI Elements",
    sublabel: "Per-token trace visible below",
    badge: "UI Components",
    badgeClass: "bg-teal-50 text-teal-700 border border-teal-200",
  },
];

const PROD_NODES: PathNode[] = [
  {
    label: "Server Action or Vercel Cron",
    sublabel: "Type-safe RPC from UI, or 7am daily schedule",
    badge: "Next.js · Vercel Cron",
    badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  {
    label: "start() → Workflow Orchestrator",
    sublabel: "Fire-and-forget durable enqueue, returns runId",
    badge: "Vercel Workflows",
    badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  {
    label: "5 Independent Steps",
    sublabel: "Research · Signals · Angle · Draft · Persist",
    badge: "Vercel Functions",
    badgeClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
    detail: "Auto-retry ×3 · Resume after crash · No shared timeout",
  },
  {
    label: "Native observability",
    sublabel: "Step traces, retries, and I/O in the Vercel dashboard",
    badge: "Vercel Dashboard",
    badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
  },
];

function FlowNode({
  node,
  isLast,
  color,
}: {
  node: PathNode;
  isLast: boolean;
  color: "teal" | "violet";
}) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-tight text-zinc-900">
              {node.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              {node.sublabel}
            </p>
            {node.detail && (
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                {node.detail}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${node.badgeClass}`}
          >
            {node.badge}
          </span>
        </div>
      </div>
      {!isLast && (
        <div className="flex flex-col items-center py-0.5">
          <div
            className={`w-px h-2.5 ${color === "teal" ? "bg-teal-300" : "bg-violet-300"}`}
          />
          <ChevronDown
            className={`h-3 w-3 ${color === "teal" ? "text-teal-500" : "text-violet-500"}`}
          />
        </div>
      )}
    </div>
  );
}

export function ArchitectureSection({ form }: { form: LeadInput }) {
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleQueue() {
    setQueueError(null);
    setWorkflowRunId(null);
    startTransition(async () => {
      try {
        const result = await queueLeadForPipeline(form);
        setWorkflowRunId(result.runId);
      } catch (err) {
        setQueueError(err instanceof Error ? err.message : "Failed to queue workflow");
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 pb-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Platform Architecture · Vercel
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-zinc-900">
              Built on the Vercel Platform
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              Two execution paths. One shared business logic layer.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {["AI SDK", "Workflows", "Functions", "Cron", "Next.js"].map((p) => (
              <span
                key={p}
                className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-500 border border-zinc-200"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-y lg:divide-x lg:divide-y-0 divide-zinc-100">
        <div className="p-5 bg-teal-50/10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-teal-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-600">
                Demo Path
              </p>
            </div>
            <span className="text-[10px] text-zinc-500">Real-time streaming</span>
          </div>
          <div className="flex flex-col">
            {DEMO_NODES.map((node, i) => (
              <FlowNode
                key={node.label}
                node={node}
                isLast={i === DEMO_NODES.length - 1}
                color="teal"
              />
            ))}
          </div>
        </div>

        <div className="p-5 bg-violet-50/10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-600">
                Production Path
              </p>
            </div>
            <span className="text-[10px] text-zinc-500">Durable at scale</span>
          </div>
          <div className="flex flex-col">
            {PROD_NODES.map((node, i) => (
              <FlowNode
                key={node.label}
                node={node}
                isLast={i === PROD_NODES.length - 1}
                color="violet"
              />
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-violet-200 bg-white text-violet-700 hover:bg-violet-50 hover:text-violet-800 shadow-sm"
              onClick={handleQueue}
              disabled={isPending || !form.freeformContext?.trim()}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {isPending ? "Queuing workflow…" : "Queue in Production"}
            </Button>

            {queueError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
                {queueError}
              </p>
            )}

            {workflowRunId && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-800">
                      ✓ Workflow started
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-emerald-700/70 truncate">
                      {workflowRunId}
                    </p>
                  </div>
                  <a
                    href="https://vercel.com/brandon-galangs-projects/vercel-sdr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-emerald-700 shadow-sm border border-emerald-100 hover:bg-emerald-100/50"
                  >
                    Dashboard
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Shared Business Logic
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {[
            { text: "execution-core.ts", cls: "text-zinc-800 font-semibold font-mono" },
            { text: "→", cls: "text-zinc-300" },
            { text: "Research", cls: "text-zinc-500 font-mono text-[11px]" },
            { text: "→", cls: "text-zinc-300" },
            { text: "Signals", cls: "text-zinc-500 font-mono text-[11px]" },
            { text: "→", cls: "text-zinc-300" },
            { text: "Angle", cls: "text-zinc-500 font-mono text-[11px]" },
            { text: "→", cls: "text-zinc-300" },
            { text: "Draft", cls: "text-zinc-500 font-mono text-[11px]" },
            { text: "→", cls: "text-zinc-300" },
            { text: "InstantDB", cls: "text-orange-600 font-semibold text-[11px]" },
            { text: "→", cls: "text-zinc-300" },
            { text: "Lead Review", cls: "text-orange-600 font-semibold text-[11px]" },
          ].map((item, i) => (
            <span key={i} className={`text-[12px] ${item.cls}`}>
              {item.text}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          Same LLM calls, same prompts, same data model — regardless of which
          path triggers the pipeline.
        </p>
      </div>
    </section>
  );
}
