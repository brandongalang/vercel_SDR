"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import optimizedArtifactData from "@/data/ax-optimized-v3.json";
import { getSyntheticPromptSnapshots } from "@/lib/synthetic-data";
import type { DspyCompileRun } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIMIZATION_TARGET_VERSION = "2026-04-11.draft-generator.v3";

const TEAM_VIEW = {
  label: "Illustrative 30-day team outcomes",
  drafts: 2400,
  live: {
    accepted: 1440,
    edited: 960,
    positiveReplies: 216,
  },
  candidate: {
    accepted: 1680,
    edited: 720,
    positiveReplies: 252,
  },
} as const;

interface OptimizationArtifact {
  instruction: string;
  compiledAt: string;
  optimizer: string;
  demos: Array<{ id: string }>;
  promptVersionBefore: string;
  promptVersionAfter: string;
  objective: {
    label: string;
    weights: {
      cleanAccept: number;
      workableReply: number;
    };
  };
}

interface CheckpointCard {
  id: string;
  label: string;
  dateLabel: string;
  eyebrow: string;
  shift: string;
  evidence: string;
  tone?: "baseline" | "live" | "candidate" | "future";
}

const OPTIMIZATION_ARTIFACT = optimizedArtifactData as OptimizationArtifact;

const SIGNAL_SUMMARY = [
  {
    id: "accepted",
    label: "Accepted as-is",
    live: TEAM_VIEW.live.accepted,
    candidate: TEAM_VIEW.candidate.accepted,
    toneClassName: "text-teal-700 dark:text-teal-300",
  },
  {
    id: "edited",
    label: "Edited into final draft",
    live: TEAM_VIEW.live.edited,
    candidate: TEAM_VIEW.candidate.edited,
    toneClassName: "text-amber-700 dark:text-amber-300",
  },
  {
    id: "positive",
    label: "Positive replies",
    live: TEAM_VIEW.live.positiveReplies,
    candidate: TEAM_VIEW.candidate.positiveReplies,
    toneClassName: "text-rose-700 dark:text-rose-300",
  },
] as const;

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function buildMermaidChart(): string {
  return [
    "flowchart LR",
    '    subgraph top[" "]',
    "      direction LR",
    '      A["Live<br/>checkpoint"] ~~~ B["Rep<br/>review"] ~~~ F["Positive lead<br/>response"]',
    "    end",
    '    subgraph bottom[" "]',
    "      direction LR",
    '      C["Full<br/>accept"] ~~~ D["Edited final<br/>draft"] ~~~ E["Compile<br/>dataset"]',
    "    end",
    '    A --> B',
    '    B -->|accept as-is| C',
    '    B -->|edit before send| D',
    '    C --> E',
    '    D --> E',
    '    C -. can earn .-> F',
    '    D -. can earn .-> F',
    '    F -->|extra weight| E',
    '    E -. next cycle .-> A',
    "    style top fill:transparent,stroke:transparent",
    "    style bottom fill:transparent,stroke:transparent",
    "    classDef observed fill:#f5f5f4,stroke:#d6d3d1,stroke-width:1.2,color:#292524,rx:6",
    "    classDef sdr fill:#fef7e6,stroke:#facc15,stroke-width:1.2,color:#854d0e,rx:6",
    "    classDef accepted fill:#effcf6,stroke:#34d399,stroke-width:1.45,color:#166534,rx:6",
    "    classDef edited fill:#fff7ed,stroke:#fb923c,stroke-width:1.45,color:#9a3412,rx:6",
    "    classDef reply fill:#fff1f2,stroke:#fb7185,stroke-width:1.45,color:#9f1239,rx:6",
    "    classDef compile fill:#f4f4f5,stroke:#a1a1aa,stroke-width:1.35,color:#27272a,rx:6",
    "    class A observed",
    "    class B sdr",
    "    class C accepted",
    "    class D edited",
    "    class E compile",
    "    class F reply",
  ].join("\n");
}

function buildCheckpointCards(input: {
  v1DateLabel: string;
  v2DateLabel: string;
  v3DateLabel: string;
}): CheckpointCard[] {
  return [
    {
      id: "v1",
      label: "v1",
      dateLabel: input.v1DateLabel,
      eyebrow: "Baseline",
      shift: "Generic professional outreach with a meeting CTA.",
      evidence: "Reps often rewrote the opener because the policy did not anchor strongly on the signal.",
      tone: "baseline",
    },
    {
      id: "v2",
      label: "v2",
      dateLabel: input.v2DateLabel,
      eyebrow: "Live",
      shift: "Lead with one strong signal and end with a lower-friction ask.",
      evidence: "This reflected what the team was already trusting: concrete openings and cleaner asks.",
      tone: "live",
    },
    {
      id: "v3",
      label: "v3",
      dateLabel: input.v3DateLabel,
      eyebrow: "Candidate",
      shift: "Adjust framing by account size and replace generic meeting asks with follow-up assets.",
      evidence: "This is the next frozen checkpoint produced by the compile, not a prompt being edited live.",
      tone: "candidate",
    },
    {
      id: "future",
      label: "Future",
      dateLabel: "Next compile",
      eyebrow: "Next",
      shift: "The cycle repeats as new accepted drafts, edited finals, and positive replies accumulate.",
      evidence: "Each future checkpoint absorbs more team behavior and more market response without manual retuning.",
      tone: "future",
    },
  ];
}

function CheckpointCardView({ card }: { card: CheckpointCard }) {
  const toneClassName =
    card.tone === "candidate"
      ? "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/25"
      : card.tone === "live"
        ? "border-teal-200 bg-teal-50/70 dark:border-teal-900 dark:bg-teal-950/20"
        : card.tone === "future"
          ? "border-dashed border-border/80 bg-muted/15"
      : "border-border bg-card/80";

  return (
    <div className={cn("min-w-0 flex-1 rounded-[24px] border px-4 py-4", toneClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">
            {card.eyebrow}
          </p>
          <h3 className="mt-2 text-[16px] font-semibold tracking-tight text-foreground">
            {card.label}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{card.dateLabel}</p>
        </div>
      </div>
      <p className="mt-4 text-[14px] font-medium leading-relaxed text-foreground">{card.shift}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{card.evidence}</p>
    </div>
  );
}

export default function DspyPage(props: { compileRuns: DspyCompileRun[] }) {
  const sortedRuns = useMemo(
    () =>
      [...props.compileRuns].sort(
        (a, b) => new Date(b.compiledAt).getTime() - new Date(a.compiledAt).getTime(),
      ),
    [props.compileRuns],
  );
  const candidateRun = useMemo(
    () =>
      sortedRuns.find((run) => run.promptVersionAfter === OPTIMIZATION_TARGET_VERSION) ?? null,
    [sortedRuns],
  );
  const promptSnapshots = useMemo(() => getSyntheticPromptSnapshots(), []);
  const v1Snapshot = useMemo(
    () => promptSnapshots.find((snapshot) => snapshot.label === "v1") ?? null,
    [promptSnapshots],
  );
  const v2Snapshot = useMemo(
    () => promptSnapshots.find((snapshot) => snapshot.label === "v2") ?? null,
    [promptSnapshots],
  );

  const mermaidChart = useMemo(() => buildMermaidChart(), []);
  const checkpointCards = useMemo(
    () =>
      buildCheckpointCards({
        v1DateLabel: v1Snapshot ? formatDateLabel(v1Snapshot.releaseDate) : "Jan 20, 2026",
        v2DateLabel: v2Snapshot ? formatDateLabel(v2Snapshot.releaseDate) : "Feb 17, 2026",
        v3DateLabel: formatDateLabel(OPTIMIZATION_ARTIFACT.compiledAt),
      }),
    [v1Snapshot, v2Snapshot],
  );

  const acceptedDelta = TEAM_VIEW.candidate.accepted - TEAM_VIEW.live.accepted;
  const editedDelta = TEAM_VIEW.live.edited - TEAM_VIEW.candidate.edited;
  const positiveDelta = TEAM_VIEW.candidate.positiveReplies - TEAM_VIEW.live.positiveReplies;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
      <div className="mx-auto w-full max-w-[1220px] space-y-6 px-4 py-6 pb-20 sm:px-6">
        <section className="rounded-[32px] border border-border bg-card shadow-sm">
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <div className="max-w-4xl">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                MIPRO feedback loop
              </p>
              <h2 className="mt-3 max-w-3xl font-heading text-[28px] font-semibold tracking-tight text-foreground sm:text-[34px]">
                Every send sharpens the checkpoint.
              </h2>
              <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                Reps accept or rewrite the draft, positive replies add market signal, and the next
                frozen checkpoint is rebuilt offline from final sent drafts.
              </p>
            </div>

            <div className="mt-5 rounded-[28px] border border-border/70 bg-muted/20 px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-[52ch]">
                  <p className="text-[13px] font-medium text-foreground">Illustrative team outcomes</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Team-scale production behavior before the smaller finalized-draft compile slice.
                  </p>
                </div>
                <p className="text-[24px] font-semibold tracking-tight text-foreground">
                  {formatCount(TEAM_VIEW.drafts)} drafts
                </p>
              </div>

              <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-3">
                {SIGNAL_SUMMARY.map((signal) => (
                  <div
                    key={signal.id}
                    className="min-w-0 sm:border-l sm:border-border/60 sm:pl-4 first:sm:border-l-0 first:sm:pl-0"
                  >
                    <p className="text-[12px] text-muted-foreground">{signal.label}</p>
                    <p className="mt-1.5 text-[24px] font-semibold tracking-tight text-foreground">
                      {formatCount(signal.live)}
                      <span className="mx-2 text-muted-foreground/40">→</span>
                      <span className={signal.toneClassName}>{formatCount(signal.candidate)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div>
                <h3 className="text-[19px] font-semibold tracking-tight text-foreground">
                  How the loop works
                </h3>
                <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-muted-foreground">
                  Accepts show where the model already matched rep judgment. Edits show what the
                  draft needed to become. Replies show what the market rewarded.
                </p>
              </div>

              <MermaidDiagram
                chart={mermaidChart}
                className="mt-4"
              />
            </div>

            <div className="mt-6 rounded-[28px] border border-border/70 bg-muted/20 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-[60ch]">
                  <h3 className="text-[16px] font-semibold tracking-tight text-foreground">
                    What actually enters the compile
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                    The optimizer does not train on the full illustrative team volume above. It
                    learns from a recent finalized-draft window, where edited drafts are replaced
                    by what the rep actually sent and positive replies carry extra weight.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 lg:max-w-[620px]">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Compile window</p>
                    <p className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
                      {candidateRun
                        ? `${formatCount(candidateRun.jobsUsed)} finalized drafts`
                        : "Recent finalized drafts"}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {candidateRun
                        ? `${candidateRun.trainWindowDays}-day lookback`
                        : "Recent finalized-draft slice"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Target output</p>
                    <p className="mt-1 text-[18px] font-semibold tracking-tight text-foreground">
                      Final sent draft
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      The system learns from what was actually sent, not the original draft alone.
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">What MIPRO changes</p>
                    <p className="mt-1 text-[18px] font-semibold tracking-tight text-foreground">
                      Instructions + examples
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      The checkpoint policy evolves as a whole, not just the few-shot count.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-4 max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">
                Scoring favors positive replies, with rep trust as the early quality signal. This
                candidate was compiled on {formatDateLabel(OPTIMIZATION_ARTIFACT.compiledAt)} with{" "}
                {OPTIMIZATION_ARTIFACT.optimizer}.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-border bg-card px-6 py-6 shadow-sm sm:px-8 sm:py-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-heading text-[22px] font-semibold tracking-tight text-foreground">
                How the checkpoint policy evolved
              </h2>
              <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-muted-foreground">
                This is the presentation version of the story: what each checkpoint emphasized and
                why the system moved in that direction.
              </p>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground lg:text-right">
              The faint final card keeps the page focused on an ongoing loop, not one isolated
              upgrade.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-stretch">
            {checkpointCards.map((card, index) => (
              <div key={card.id} className="flex min-w-0 flex-1 items-stretch gap-3">
                <CheckpointCardView card={card} />
                {index < checkpointCards.length - 1 ? (
                  <div className="hidden items-center justify-center text-muted-foreground/35 xl:flex">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-border/70 bg-muted/20 px-4 py-4">
            <p className="text-[12px] font-medium text-muted-foreground">
              Why the candidate is stronger
            </p>
            <p className="mt-3 max-w-[72ch] text-[14px] leading-relaxed text-foreground/90">
              Across {formatCount(TEAM_VIEW.drafts)} illustrative drafts, the candidate checkpoint
              moves{" "}
              <span className="font-semibold text-teal-700 dark:text-teal-300">
                +{formatCount(acceptedDelta)} more accepts
              </span>
              ,{" "}
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {formatCount(editedDelta)} fewer edits
              </span>
              , and{" "}
              <span className="font-semibold text-rose-700 dark:text-rose-300">
                +{formatCount(positiveDelta)} additional positive replies
              </span>
              . In plain terms: reps rewrote less, the market responded more, and the next checkpoint
              absorbed those patterns into a stronger policy.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
