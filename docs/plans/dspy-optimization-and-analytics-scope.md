# DSPy optimization & Analysis — scoping notes

**Status:** Scoping / design discussion (not implemented).  
**Last updated:** 2026-04-11  
**Purpose:** Preserve full context from product/engineering discussions so future sessions can continue scoping without re-deriving decisions.

---

## 1. Background and goals

### 1.1 Product context

- Outbound SDR pipeline produces personalized drafts; reps **approve**, **edit and approve**, or **archive**. Sends can later get **reply / outcome** signals (prototype: `JobOutcome` on jobs).
- Long-term intent (see [PRD §8 — DSPy](../prd-outbound-personalization.md)): treat LM-heavy stages as **modular DSPy programs** with **per-stage metrics** and **global outcome metrics** when data exists. Multi-stage credit assignment is hard; prefer **stage metrics** + sparse global labels.

### 1.2 What “minimum DSPy pipeline” means here

An **offline** loop, not in-request DSPy:

| Piece | Description |
|-------|-------------|
| **Dataset builder** | Export jobs with `feedback`, `outcome`, `angleType`, and pipeline artifacts to JSONL `{ inputs, trace, labels }`. |
| **One module (v0)** | Start with **draft generation** (largest lever, clearest proxy). Alternatives: angle planner only for faster iteration. |
| **Compiler** | Run a DSPy optimizer offline; write **frozen** prompt + demos to versioned artifacts; production loads by version. |
| **Integration** | App uses compiled artifact id / version string at inference time. |

Research orchestrator is a **later** phase (noisy credit assignment, expensive).

### 1.3 Business metrics to align with (queue analytics)

These are already computed in app code for the selected date range:

- **Clean accept rate** — draft shipped unchanged after approval.  
- **Edit rate** — rep edited before approve.  
- **Reply rate** — among sends with outcome tracked.  
- **Positive rate** — “good” outcomes (meetings / strong intent), not merely any reply.

**Implementation reference:** `computeQueueMetrics` in [`lib/metrics.ts`](../../lib/metrics.ts), surfaced on [`components/features/AnalyticsPage.tsx`](../../components/features/AnalyticsPage.tsx) under **Review quality**.

**Types:** `OutboundJob.feedback`, `OutboundJob.outcome` (`replied`, `positive`) in [`lib/types.ts`](../../lib/types.ts).

---

## 2. Metric design for DSPy (must match business intent)

### 2.1 Composite score concept

Optimize on a **scalar** that combines:

- High weight: **clean accept** (and optionally **edited accept** as partial credit).  
- Smaller weight: **positive reply** signal when volume allows (lag-aware in production).  
- **Do not** reward “any reply” alone if negatives (unsubscribe, objection) would pollute the objective.

Example shape (illustrative, not final):

\[
\text{score} = w_1 \cdot \mathbb{1}_{\text{clean}} + w_2 \cdot \mathbb{1}_{\text{edited}} + w_3 \cdot \mathbb{1}_{\text{replied} \land \text{positive}} - \text{(optional small penalty for labeled negative)}
\]

with \(w_1 > w_2\), \(w_3\) tuned once outcomes are dense enough.

### 2.2 Explicit constraint: do **not** optimize for negative replies

- **Negative replies** (“stop messaging me”, unsubscribe, hard objection) must **not** increase the metric.  
- Guardrail is **metric definition**, not choice of DSPy optimizer: every optimizer maximizes whatever `metric` returns.  
- **Reply bonus** should use **`replied && positive`** (CRM disposition) or a validated **interest / meeting** label—not raw reply count.

### 2.3 Positive vs negative reply labeling

| Source | Role |
|--------|------|
| **CRM / rep disposition** | Preferred source of truth when available. |
| **LLM classification** | Useful for **backfill**, **rows missing disposition**, or **offline dataset cleaning**—not the sole high-stakes label until validated. Treat confidence as weight optional. |

Existing type hook: `JobOutcome.positive?: boolean` in [`lib/types.ts`](../../lib/types.ts).

---

## 3. DSPy optimizer choice (official landscape, ~2026)

**Note:** DSPy docs rename former “teleprompters” to **optimizers**. Reference: [DSPy Optimizers](https://dspy.ai/learn/optimization/optimizers/).

### 3.1 Relevant optimizers

| Optimizer | Role | When to consider |
|-----------|------|------------------|
| **BootstrapFewShot** | Builds demos; metric filters traces | **~10** examples (small N). |
| **BootstrapFewShotWithRandomSearch** | Above + random search over candidates | **~50+** examples. |
| **MIPROv2** | Joint **instructions + few-shot**; Bayesian search | **Richer** runs; docs suggest larger train sets for heavy configs; has **light** modes. |
| **GEPA** | Reflects on trajectories; can use **textual feedback** | Strong when **editor notes**, presets, failure reasons are logged. |
| **SIMBA** | Hard examples, introspective fixes | After baseline metric and stable pipeline. |
| **BootstrapFinetune** | Weight updates | Later; not minimum pipeline. |
| **BetterTogether** | Meta: prompt ↔ finetune sequences | After prompt optimization plateaus. |

### 3.2 Proposed phasing

1. **Phase 1:** `BootstrapFewShot` or `BootstrapFewShotWithRandomSearch` + **strict metric** (no credit for negative replies).  
2. **Phase 2:** `MIPROv2` (`auto="light"` first for cost control) with same metric.  
3. **Phase 3:** `GEPA` when **structured textual feedback** is consistently available.

---

## 4. Analysis UI: DSPy-oriented section (scoped, not built)

### 4.1 Intent

Add an **Analysis** section that shows **the same core metrics** (clean accept, edit, reply, positive) **across time windows** aligned with **optimization cadence** (e.g. compile every **X weeks**), so teams can relate “compile on date D” to “metrics in the window after D.”

### 4.2 Current Analytics behavior (for implementers)

- **Review quality:** Live metrics from `computeQueueMetrics(jobs, dateRange)` with **From / To** date pickers — [`AnalyticsPage.tsx`](../../components/features/AnalyticsPage.tsx).  
- **Operational benchmarks:** Mock snapshots keyed by **nearest** 7d / 30d / 90d span — [`lib/analytics-mock.ts`](../../lib/analytics-mock.ts).

### 4.3 Two analytics modes

| Mode | Question | Data |
|------|----------|------|
| **A — Time epochs only** | How did metrics move each period? | Jobs + timestamps (existing). |
| **B — Version-attributed** | Did **this** compiled program beat the **previous**? | Persist **`dspyPromptVersion`** (or `compileRunId`) on job / pipeline run at creation time. |

**v0:** Ship **A** (epoch table). Add **B** when version is persisted from offline compile.

### 4.4 Epoch alignment with “every X weeks”

- Define **non-overlapping epochs** `[t₀,t₁), [t₁,t₂), …` (document timezone, e.g. UTC).  
- Config: `DSPY_EPOCH_DAYS` or cron equivalent for compile schedule.  
- UI: **Last K epochs** table (or per-compile dropdown) — **separate** from ad-hoc From/To so users don’t fight two primary ranges.

### 4.5 Outcome lag (follow-up)

Replies lag sends. Optional rule: **label delay** (e.g. attribute outcomes to sends in epoch E only after E + N days). Can be v1.1 if v0 matches current naive filtering.

### 4.6 Persistence sketch for full story

- **`dspy_runs`:** `id`, `compiled_at`, `prompt_version`, `optimizer`, optional `train_window`, `git_sha`.  
- **Jobs:** `dspyPromptVersion` when persisting from frozen artifact.  
- **Events:** `log_events` already has snapshot fields for implicit metrics — [`lib/db/schema.ts`](../../lib/db/schema.ts).

---

## 5. Open decisions (for future scoping)

1. **Single scalar vs Pareto:** Clean accept and positive reply can trade off; whether to reject prompt versions that improve one while harming the other.  
2. **Minimum N** before running compile (per `angleType` or globally).  
3. **Holdout strategy** (time-based vs account-based) to reduce leakage.  
4. **Exact epoch length** and **compile day-of-week** for ops alignment.  
5. **Outcome attribution window** for reply metrics (lag rule).

---

## 6. Related documents

- [Outbound personalization PRD — §8 DSPy](../prd-outbound-personalization.md)  
- [Live agent streaming / analytics handoff](./2026-04-11-live-agent-streaming-analytics-handoff.md) (queue metrics, `computeQueueMetrics`)

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Initial capture: pipeline scope, metrics, optimizers, Analysis epochs, version attribution, links to code. |
