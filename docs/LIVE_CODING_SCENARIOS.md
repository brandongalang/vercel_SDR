# Live Coding Scenarios — Feature Request Prep

> **Context:** These are the 6 most likely feature requests an SDR manager or GTM engineer would ask you to talk through (or build) during a live session. For each one:
> - Why they'd ask it (what it tests)
> - How to talk through the architecture
> - The exact files you'd touch, in order
> - What to show on screen if you're live coding

---

## Scenario 1: "Filter the queue by angle type"

**Why they'd ask:** The SDR manager wants to focus on a specific outreach motion (e.g., only see `event_signal` leads after a conference). Tests whether you understand the UI data flow.

### How to talk through it

> "The queue already has the data — every job has an `angleType` field. The QueueList component receives the full `jobs` array and filters it by status. I'd add an angle-type filter alongside the existing Queue/History toggle and the Sent Today/Skipped sub-filters. The UI config already exists in `angle-config.ts` — each angle type has a label, dot color, and description."

### Files to touch

| Step | File | Change |
|------|------|--------|
| 1 | `components/features/SDRWorkspace.tsx` | Add `angleFilter` state: `useState<AngleType | "all">("all")`. Pass it to QueueList. Apply it in `visibleSelectionIds` memo alongside the existing `queueView`/`historyFilter` logic. |
| 2 | `components/features/QueueList.tsx` | Add `angleFilter` + `onAngleFilterChange` to `QueueListProps`. Render a row of filter chips (like the existing history filter chips on line 490-509) using `Object.entries(ANGLE_CONFIG)` — each chip shows the angle's colored dot + label. Filter the `needsReview` and `autoEligible` arrays. |

### What to show on screen

Open `QueueList.tsx`, point to lines 490-509 where the history filter chips are rendered:

```tsx
{(["all", "sent_today", "skipped"] as const).map(([value, label, count]) => (
  <Button key={value} ... onClick={() => onHistoryFilterChange(value)}>
    {label} <span>{count}</span>
  </Button>
))}
```

> "I'd follow this exact pattern — a row of filter buttons, each one keyed to an angle type from `ANGLE_CONFIG`. The angle config already has labels and dot colors, so the chips practically build themselves."

### Key detail to mention

> "The filter is purely client-side. All jobs are already loaded via `db.useQuery({ jobs: {} })` — we're just narrowing the visible set. No API call needed."

---

## Scenario 2: "Add a new angle type — say `funding_round`"

**Why they'd ask:** Tests whether you understand the data contract stack — how a change propagates through all 5 layers.

### How to talk through it

> "This is a great example of why the data contract stack is layered the way it is. The angle type is defined once in `vocab.ts` as a const tuple. The TypeScript type, Zod schema, and angle config all derive from it. So adding a new angle type is mostly mechanical — add it to the vocab, add display config, and update the prompts to know about it."

### Files to touch

| Step | File | Change |
|------|------|--------|
| 1 | `lib/pipeline/vocab.ts` | Add `"funding_round"` to `ANGLE_TYPE_VALUES` array |
| 2 | `lib/angle-config.ts` | Add `funding_round: { label: "Funding Round", dot: "bg-green-500", ... }` — the UI picks this up automatically everywhere (queue list, detail panel, analytics) |
| 3 | `lib/pipeline/angle-planner-prompt.ts` | Update the angle type selection instructions to describe when `funding_round` should be chosen (e.g., "when recent fundraising signals suggest a growth investment that maps to platform tooling needs") |
| That's it | — | `types.ts` derives `AngleType` from `ANGLE_TYPE_VALUES`, so it updates automatically. `schemas.ts` uses `z.enum(ANGLE_TYPE_VALUES)`, so validation updates automatically. The codec's `isStringEnumValue(ANGLE_TYPE_VALUES, ...)` check passes automatically. |

### What to show on screen

Open `vocab.ts` and `angle-config.ts` side by side. Add the value to the array, add the config object. Then show how `types.ts` line 34 derives the type:

```typescript
export type AngleType = (typeof ANGLE_TYPE_VALUES)[number];
```

> "One source of truth, everything downstream follows. I don't need to update the Zod schema, the codec, or the DB schema — they all derive from vocab."

---

## Scenario 3: "Add a 'Snooze' action — skip it today, bring it back tomorrow"

**Why they'd ask:** The SDR manager's #1 workflow request. Tests whether you understand the status lifecycle, the governance model, and the DB mutations.

### How to talk through it

> "Today we have three statuses: `pending_review`, `reviewed` (skipped), and `sent_stub` (approved). A snooze is a fourth status — it leaves the active pipeline but comes back. I'd add `snoozed` to the status enum, store a `snoozeUntil` timestamp, and add logic to surface snoozed leads when their time expires."

### Files to touch

| Step | File | Change |
|------|------|--------|
| 1 | `lib/pipeline/vocab.ts` | Add `"snoozed"` to `JOB_STATUS_VALUES` |
| 2 | `lib/types.ts` | Add `snoozeUntil?: string` to `JobTimestamps` |
| 3 | `lib/jobs/instant-job-codec.ts` | Add `snoozeUntil` to `InstantJobRecord`, handle it in both `toInstantJobRecord` and `fromInstantJobRecord` |
| 4 | `instant.schema.ts` | Add `snoozeUntil: i.any()` to the jobs entity |
| 5 | `components/features/SDRWorkspace.tsx` | Add a `handleSnooze` handler next to `handleArchive`. Write `db.transact(db.tx.jobs[jobId].update({ status: "snoozed", snoozeUntil: tomorrow, updatedAt: now }))`. In the queue filter logic, treat snoozed jobs whose `snoozeUntil` has passed as `pending_review` again. |
| 6 | `components/features/DetailPanel.tsx` | Add a Snooze button in the action bar next to Approve and Skip. Maybe with a clock icon from Lucide. |
| 7 | `components/features/QueueList.tsx` | Add a "Snoozed" count in the queue header. Optionally add a sub-filter to see snoozed leads. |

### What to show on screen

Open `SDRWorkspace.tsx`, point to `handleArchive` (line 249):

```typescript
const handleArchive = (jobId: string) => {
  const now = getTimestamp();
  db.transact(
    db.tx.jobs[jobId].update({
      status: "reviewed",
      archivedAt: now,
      updatedAt: now,
    })
  );
};
```

> "Snooze follows the same pattern — a `db.transact` that sets `status: 'snoozed'` and `snoozeUntil`. Then in the queue filter, I check if `Date.now() > snoozeUntil` to resurface them. The queue already has a midnight timer (`useStartOfTodayMs` in QueueList) that recomputes every minute — snoozed leads would naturally appear when their time comes."

### Key insight

> "The real design question isn't the code — it's the UX. Do you snooze for a fixed duration (24h) or let the rep pick? Do snoozed leads come back to the top of the queue or their original position? Those are product decisions that affect SDR workflow more than any technical choice."

---

## Scenario 4: "Add a priority score so high-value leads surface first"

**Why they'd ask:** Tests the full 5-layer data contract stack, plus whether you'd derive it from existing data (signals, company size, confidence) or add a new pipeline stage.

### How to talk through it

> "There are two approaches. First: derive priority from what we already have — confidence tier, company size, signal strength, lead source. That's a pure client-side sort, no pipeline change. Second: add a scoring model as a pipeline stage that produces a numeric priority. I'd start with the first approach and graduate to the second when we have enough data to train a scoring model."

### The quick version (derived, no pipeline change)

| Step | File | Change |
|------|------|--------|
| 1 | `lib/types.ts` | (Optional) Add `priorityScore?: number` to `OutboundJob` |
| 2 | `components/features/SDRWorkspace.tsx` or new `lib/priority.ts` | Add a `computePriority(job: OutboundJob): number` function. Score based on: confidence tier (high=3, medium=2, low=1), company size (enterprise=3, mid_market=2, smb/startup=1), signal count and strength. |
| 3 | `components/features/QueueList.tsx` | Sort `needsReview` and `autoEligible` arrays by priority score instead of creation order |

### The full version (pipeline stage)

| Step | File | Change |
|------|------|--------|
| 1 | `lib/pipeline/vocab.ts` | Add `"scoring"` to `PIPELINE_PHASE_VALUES` |
| 2 | `lib/pipeline/schemas.ts` | Add `priorityScoreSchema = z.object({ score: z.number(), reasons: z.array(z.string()) })` |
| 3 | `lib/pipeline/execution-core.ts` | Add `runScoringStage()` between draft and job building |
| 4 | `lib/pipeline/job-builder.ts` | Include priority score in `buildGeneratedJob` |
| 5 | `lib/jobs/instant-job-codec.ts` | Add `priorityScore` to codec |
| 6 | `instant.schema.ts` | Add `priorityScore: i.any()` |
| 7 | `workflows/outbound-pipeline/steps.ts` | Add `scoringStep` with `"use step"` |
| 8 | `lib/pipeline/pipeline-agent.ts` | Add `score_priority` tool to the ToolLoopAgent |

### What to say

> "I'd ship the derived version first — it's a 30-minute change, no pipeline cost, and it immediately improves the SDR's workflow. The full pipeline version is the right long-term answer when you have enough feedback data to train the scoring model on actual accept/reply rates."

---

## Scenario 5: "Add a real data source — like LinkedIn or an intent data provider"

**Why they'd ask:** The GTM engineer wants to see if you understand the tool abstraction in the pipeline. Tests whether the research agent architecture is genuinely modular.

### How to talk through it

> "The research sub-agents already have a tool abstraction. Each tool has an input schema, an execute function, and a trace format. Adding a new data source means adding a new tool — the sub-agent decides at runtime whether to call it based on the research goal."

### Files to touch

| Step | File | Change |
|------|------|--------|
| 1 | `lib/pipeline/tools/linkedin-lookup.ts` | New file. Implement the API call. Return structured data matching a defined output type. |
| 2 | `lib/pipeline/schemas.ts` | Add `linkedinLookupInputSchema` (e.g., `{ leadName, company, profileUrl? }`) |
| 3 | `lib/pipeline/spawn-researcher.ts` | Add `linkedin_lookup` to the sub-agent's `tools` object, following the same `executeTracedResearchTool` pattern as the existing web_search/crm_lookup/product_signals tools |
| 4 | `lib/pipeline/live-trace.ts` | Add `"linkedin_lookup"` to `PipelineTraceToolName` union. Add input/output types to `PipelineTraceToolInputMap` and `PipelineTraceToolOutputMap`. |

### What to show on screen

Open `spawn-researcher.ts` and point to the existing tools (lines 201-245). Show how each tool follows the same pattern:

```typescript
web_search: tool({
  description: "...",
  inputSchema: webSearchInputSchema,
  execute: async (args) =>
    executeTracedResearchTool({
      trace: input.trace,
      parentId: traceParentId,
      traceId: nextToolTraceId("web_search"),
      title: "Web search",
      toolName: "web_search",
      input: args,
      execute: () => searchWeb(args),
      formatOutput: trimWebSearchForTrace,
    }),
}),
```

> "A new data source follows this exact pattern. Define the schema, implement the API call, wrap it in `executeTracedResearchTool` for tracing, and the sub-agent decides when to use it based on its research goal. The live agent view picks it up automatically because the trace system is generic over tool names."

### Key insight

> "The sub-agent decides *whether* to call the tool — I don't hardcode which tools run for which lead. If the research goal is 'find this person's recent public activity', the agent might call LinkedIn. If the goal is 'find recent product launches at this company', it might skip LinkedIn and do web searches instead. That's the benefit of the agent tool-loop pattern over a static DAG."

---

## Scenario 6: "The SDR manager wants to see which signals actually drive replies"

**Why they'd ask:** Product thinking question disguised as a feature request. The SDR manager wants to know: "Of all the signals the agent uses, which ones correlate with positive replies?" Tests whether your analytics architecture can answer this.

### How to talk through it

> "We already have the raw data for this. Every job stores `signals[]` with `usedInAngle: true/false`, the `angleType`, and the `outcome.replied` / `outcome.positive` fields. The question is: which signal categories, when used as the primary angle hook, produce the highest reply rate?"

### Files to touch

| Step | File | Change |
|------|------|--------|
| 1 | `lib/metrics.ts` | Add a `computeSignalEffectiveness(jobs)` function. Group sent jobs by the signal category of their top `usedInAngle` signal. For each category, compute: volume, reply count, reply rate, positive rate. Return sorted by reply rate. |
| 2 | `components/features/AnalyticsPage.tsx` | Add a "Signal effectiveness" section below the playbook tables. Render as a simple table: Signal Category | Volume | Reply Rate | Positive Rate. |

### What to show on screen

Open `metrics.ts` and point to `computeQueueMetrics` (line 141) — show the pattern:

> "The metrics engine already groups by angle type and computes reply rates per angle. I'd follow the same pattern but group by the primary signal's category instead. The data's all there — `job.signals.filter(s => s.usedInAngle)[0].category` gives me the primary signal category, and `job.outcome.replied` gives me the outcome."

### The architecture insight

> "This is where the data contract pays off. Because `ScoredSignal` has `category`, `strength`, `usedInAngle`, and `scope` — and every signal stays attached to the job forever — I can slice this data any way I want: which categories drive replies, whether person-scoped signals outperform company-scoped ones, whether strong signals actually produce better outcomes than moderate ones. All of that is retroactive analysis on data we're already collecting."

---

## Quick Reference: What Each Scenario Tests

| Scenario | What it tests | Who cares most |
|----------|--------------|----------------|
| 1. Queue filter by angle | UI data flow, client-side filtering | SDR Manager |
| 2. New angle type | Data contract stack (5 layers), prompt design | GTM Engineer |
| 3. Snooze action | Status lifecycle, DB mutations, UX thinking | SDR Manager |
| 4. Priority score | Derived vs. pipeline, incremental complexity | Both |
| 5. New data source | Tool abstraction, agent modularity | GTM Engineer |
| 6. Signal effectiveness | Analytics architecture, product thinking | SDR Manager |

## How to Handle Any Unknown Feature Request

If they ask for something not on this list, use this framework:

1. **"Where does this data live today?"** — Check if the fields already exist on `OutboundJob` or need to be added
2. **"Is this a UI change, a pipeline change, or both?"** — UI-only is fast (client-side filter/sort). Pipeline changes touch more layers but follow established patterns.
3. **"Start with the vocab"** — If it's a new enum value, add it to `vocab.ts`. Everything else follows.
4. **"Follow an existing pattern"** — Point to a similar feature that already exists (the history filter for UI, the web_search tool for data sources, the regeneration presets for user controls)
5. **"Ship the simple version first"** — Derived/client-side before pipeline/LLM. "I'd start here, then graduate to [X] when we have the data to justify it."
