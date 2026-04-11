# Optimization tab & DSPy UI — handoff for scoping

**Status:** Discussion captured; implementation not scoped in this document.  
**Last updated:** 2026-04-11  
**Audience:** Another model or engineer scoping UI, data, and DSPy integration work.

**Related docs:**

- [DSPy optimization & Analysis — scoping notes](./dspy-optimization-and-analytics-scope.md) — metrics, offline loop, UI notes, phasing.
- [Outbound personalization PRD — §8 DSPy](../prd-outbound-personalization.md) — modular stages, per-stage metrics, deferred teleprompting.

---

## 1. Summary of the product direction

### 1.1 What we discussed

1. **Remove** the embedded **DSPy** block from the **Analysis** page (currently a section at the bottom with heading “DSPy optimization” and `DspyOptimizationPanel`).
2. **Add** a **top-level tab** in the same control surface as Analysis / Live Agent / etc., so DSPy-related content is not buried inside Analysis.
3. **Name the tab** something like **“Optimization”** rather than “DSPy” — conveys *outcome* (improving the pipeline) to mixed audiences; technical users still get mechanism detail inside the page.
4. **Clarify purpose:** the page explains **offline prompt compilation**, **version attribution**, and **evidence** that a new frozen prompt artifact performed vs the previous one — not live in-request learning.
5. **Ground the UI in the real pipeline:** work **backwards** from how a DSPy-style optimization would actually run given **data we have or could have** (clean accept, edits, replies, positive replies) to decide **what to show** and what to defer.

### 1.2 Recommended UX spine (high level)

- **“Release train” narrative:** timeline of **compile runs**; selecting a run shows **what changed** (version before → after) and **deltas** on agreed metrics.
- **Plus a compact pipeline strip** at the top: stages as columns with **current version** and **key metrics** where available — progressive disclosure into prompt text / diffs.
- **Do not** rely on two competing primary date ranges; prefer **compile-aligned windows** or **“since version X”** for attribution (see existing scoping doc §4.3–4.4).

---

## 2. Current implementation (facts in repo)

### 2.1 Analysis page today

- File: `components/AnalyticsPage.tsx`
- Near the bottom, a `<section>` titled **“DSPy optimization”** with copy about `promptVersions` and renders **`DspyOptimizationPanel`** with `compileRuns` and `jobs`.

### 2.2 DSPy panel component

- File: `components/DspyOptimizationPanel.tsx`
- Includes:
  - **Compile run cards** (`DspyCompileRun`): optimizer name, dates, train window, jobs used, `promptVersionBefore` → `promptVersionAfter`, delta badges (clean accept, edit rate, positive reply, reply rate). Some UI marked **“Illustrative”** (mock).
  - **Version comparison table** (`DspyVersionRow`): per draft prompt version, job counts, clean accept, edit, reply, positive rates (from `computeDspyVersionMetrics`).

### 2.3 Types

- File: `lib/types.ts`
- **`OutboundJob.promptVersions`:** `Record<string, string>` — stamped at pipeline run time; enables version-attributed analytics. Implementation today keys **draft** work off **`promptVersions.draftGenerator`** in metrics.
- **`DspyVersionRow`:** metrics per `(draftPromptVersion, angleType | global)`.
- **`DspyCompileRun`:** one offline compile: `compiledAt`, `optimizer`, `promptVersionBefore/After`, `trainWindowDays`, `jobsUsed`, `deltas`.

### 2.4 Metrics

- File: `lib/metrics.ts`
- **`computeDspyVersionMetrics(jobs, angleFilter?)`:** filters jobs with `promptVersions.draftGenerator`, groups by version (and optional angle), computes clean accept rate, edit rate, reply rate, positive rate from `feedback` and `outcome`.

### 2.5 Offline dataset export (DSPy training input)

- File: `scripts/export-dspy-dataset.ts`
- Exports **JSONL** rows with:
  - `promptVersions`, `angleType`, inputs (`leadInput`, `signals`), draft (`draftSubject`, `draftBody`).
  - **Labels:** `cleanAccept`, `edited`, `editorNote`, `replied`, `positive` (outcomes **nullable** until tracked).
- **Qualifying rows:** jobs with **`feedback`** (approve path known). Minimum job count configurable (`--min-jobs`, default 5).

### 2.6 Broader product intent (PRD / plans)

- LM-heavy stages are **modular programs** with **per-stage metrics** and **global** outcomes; **multi-stage credit assignment is hard** — prefer **stage proxies** + sparse global labels.
- **Offline** compile loop: dataset → optimizer → **frozen** artifact → production loads by **version string** — not in-request DSPy.

---

## 3. User, job-to-be-done, and page purpose

### 3.1 Primary user

Owner of pipeline quality: PM, revops, or engineering — needs to connect **prompt changes** to **funnel/review outcomes** without becoming a DSPy expert.

### 3.2 Job-to-be-done

- Understand **what was optimized** (which module, what train data).
- See **whether the new compiled version beat the prior** on **agreed metrics**, with **honest sample sizes**.
- Optionally drill into **prompt/instruction content** and **few-shot** metadata when artifacts exist.

### 3.3 Optimization page vs Analysis page

| Surface | Question it answers |
|--------|----------------------|
| **Analysis** | “How is the queue performing?” — time-sliced operational metrics (date pickers, review quality, benchmarks). |
| **Optimization** | “What did we ship offline, on what data, and did the new **frozen prompt version** perform better than the last?” — **change control + evidence**. |

**Anti-confusion:** Optimization must not feel like a duplicate Analytics dashboard; it should foreground **version attribution** and the **offline compile** story.

---

## 4. Naming and first-line clarity

- **Tab label:** **Optimization** (preferred over “DSPy” for the default chrome).
- **Subtitle / hero (conceptual):** Make **offline + versioned** unmistakable, e.g. *Offline prompt compiles and version-attributed results* (exact copy TBD).
- **Inside the page:** DSPy can appear as the **implementation** of compilation; optimizer names can be **secondary** (details panel or compile card), not the hero.

---

## 5. UX strategy (condensed from discussion)

### 5.1 Success and failure signals

- **Success:** User trusts **what changed**, **on how many examples**, and **whether metrics moved** without believing the system “learns live” in production.
- **Failure:** Jargon-first UI, two conflicting date ranges, or **“better”** without **n** or without lag caveats on reply metrics.

### 5.2 Trade-off posture (recommended)

- **Clarity of attribution** over **flexible ad-hoc date filtering** on this tab (aligns with `dspy-optimization-and-analytics-scope.md` §4.3: separate compile windows from Analysis From/To where needed).
- **Progressive disclosure:** pipeline overview → stage or compile detail → prompt/diff.
- **Phased honesty:** show **one primary module** (draft generator) in v1 if other stages lack `promptVersions` or traces — avoid empty multi-stage theater.

### 5.3 Mental model anchors

- **Jakob’s Law:** Frame as **releases / versions / compiles**, familiar from software delivery.
- **Peak–end:** End on **“this version vs previous on metrics we care about”** (+ sample size), not on optimizer taxonomy alone.
- **Progressive disclosure:** Horizontal **pipeline stepper** or strip: default = metrics strip; expand = prompt / demos / diff.

### 5.4 Journey (abstract)

1. Land → **current production version**, **last compile**, **data readiness** (counts with feedback vs with outcome).
2. Orient → **compile history** or **version table** with core metrics.
3. Drill → **stage** (or draft module) → instruction preview, demo count, link to compile run.
4. Compare → **vN vs vN−1** when artifacts exist; footnotes for **outcome lag**.

### 5.5 Anti-goals

- Imply **in-request** or continuous learning in production.
- Claim **causation** across versions without acknowledging mix shifts / sparse outcomes.
- Show **full multi-stage** optimization UI before **per-stage versions and metrics** exist in data.

---

## 6. UI approaches considered

| Approach | Idea | Pros | Cons |
|----------|------|------|------|
| **A — Release train (recommended)** | Timeline of compile runs; run selection shows version transitions and deltas | Matches offline compile story | Must handle “only draft module updated” clearly |
| **B — Pipeline board** | Columns per stage: version + metrics; history secondary | Great for “prompts per stage” | Weaker “when did it land” without extra UI |
| **C — Experiment table** | Version × Stage × Metrics grid | Power users | Cold; weaker explainability |

**Recommendation:** **A** as spine + **compact pipeline strip** (borrow strength from B) for at-a-glance stages.

---

## 7. How a DSPy-style optimization pipeline maps to this codebase

This is the **logical** pipeline another model can align to implementation and copy.

### 7.1 Data available per job (relevant fields)

- **Review signal (dense when rep decides):** `feedback.edited`, `feedback.editorNote` — drives clean accept vs edit.
- **Outcome (sparse until CRM/sync):** `outcome.replied`, `outcome.positive` — nullable in export labels.
- **Attribution:** `promptVersions` map, with **`draftGenerator`** used today for bucketing.

### 7.2 Training export

- Script: `scripts/export-dspy-dataset.ts`
- Rows require **`feedback`** for training eligibility.
- Labels exported: `cleanAccept`, `edited`, `editorNote`, `replied`, `positive`.

### 7.3 Metric philosophy (must match business intent)

- **Primary:** clean accept (high weight); edited approve as partial credit if product agrees.
- **Secondary / gated:** positive (and “good” reply), not raw reply count alone — see scoping doc §2.2–2.3.
- **Sparse outcomes:** composite or review-heavy metric until outcome volume supports reply terms.

### 7.4 Offline steps (conceptual)

1. **Export** JSONL for a **train window** (optional angle filter).
2. **Define** a DSPy `Module` / signature for **draft generation** (inputs → subject/body) matching logged shapes.
3. **Run optimizer offline** (e.g. BootstrapFewShot, MIPROv2 per phased plan in scoping doc §3).
4. **Write frozen artifact** with new **version id** (`promptVersionAfter`).
5. **Deploy** so new runs stamp `promptVersions` (at minimum `draftGenerator`).
6. **Evaluate** by grouping jobs with **`computeDspyVersionMetrics`** (and persist **`DspyCompileRun`** records for the UI timeline).

### 7.5 Evaluation caveats (must surface in UI eventually)

- **Outcome lag:** replies arrive after send; attribution windows may need rules (scoping doc §4.5).
- **Credit assignment:** stage metrics are **proxies**; global outcomes are **sparse** — avoid over-claiming.

---

## 8. What to show on the Optimization page (backwards from pipeline)

Layered content another model can turn into tickets:

| Layer | Content |
|-------|---------|
| **Hero / positioning** | One sentence: offline compile → frozen version → jobs stamped → measured. Optional **minimal diagram**: Dataset → Compile → vN → tagged jobs → metrics. |
| **Data readiness** | Counts: jobs with **feedback** (trainable); jobs with **outcome** (for reply/positive views). Prevents false confidence. |
| **Last compile** (when `DspyCompileRun` exists) | Train window, jobs used, optimizer (secondary), **before → after** version, delta summary on agreed metrics. |
| **Version attribution table** (largely exists) | Per `draftPromptVersion`: job counts, clean accept %, edit %, reply %, positive % — see `DspyVersionRow` / `computeDspyVersionMetrics`. |
| **Pipeline / stages** | v1: single **Draft** row if only `draftGenerator` is versioned; expand when more keys exist. |
| **Drill: prompt** | Read-only instruction + demo count + diff vs previous (modal/split) when artifacts are available. |
| **Caveats** | Outcome lag; small **n**; correlation ≠ causation when mix shifts. |

---

## 9. Engineering scoping hints (non-exhaustive)

- **Navigation:** Add **Optimization** tab alongside existing primary tabs; **remove** DSPy section from `AnalyticsPage.tsx` (or replace with a short link to Optimization if desired — product choice).
- **Routes:** Decide if Optimization is a new route (`/optimization` or similar) or query-param tab; follow existing app patterns.
- **Data:** Mock `compileRuns` vs persisted `dspy_runs` — scoping doc §4.6 sketches persistence; align UI to what exists.
- **Empty states:** Missing `promptVersions` on older jobs — export script already warns; UI should mirror.
- **Accessibility / security:** Long prompts in collapsible/modal; avoid leaking PII in shared screenshots.

---

## 10. Open questions for the scoping model

1. Exact **tab order** and **route** naming in the app shell.
2. **Subtitle / marketing copy** for “Optimization” — final strings and whether to say “DSPy” in hero or only in “Learn more.”
3. **v1 scope:** single module (draft) only vs placeholder rows for future stages.
4. Whether Analysis should show a **single link** (“Prompt versions & compiles →”) after removal.
5. **Persistence:** when `DspyCompileRun` moves from mock to DB, required fields and admin-only vs all users.
6. **Lag policy** for attributing outcomes to sends (v1 naive vs labeled delay).

---

## 11. Non-goals for initial scope (unless explicitly expanded)

- In-request DSPy or runtime prompt mutation per request.
- Full multi-stage joint optimization UI without per-stage version data.
- Replacing Analysis date pickers with a single global truth — Analysis remains operational; Optimization remains compile/version-centric.

---

## 12. File index for implementers

| Topic | Location |
|-------|----------|
| Analysis + embedded DSPy section | `components/AnalyticsPage.tsx` |
| DSPy panel UI | `components/DspyOptimizationPanel.tsx` |
| Version metrics | `lib/metrics.ts` — `computeDspyVersionMetrics` |
| Job / DSPy types | `lib/types.ts` — `OutboundJob`, `DspyVersionRow`, `DspyCompileRun` |
| Training export | `scripts/export-dspy-dataset.ts` |
| Mock compile history / analytics | `lib/analytics-mock.ts` (per grep history; verify when wiring) |
| Metric & UI scoping notes | `docs/plans/dspy-optimization-and-analytics-scope.md` |

---

*End of handoff document.*
