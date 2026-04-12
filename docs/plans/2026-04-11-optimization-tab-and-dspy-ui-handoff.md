# Optimization Tab & DSPy UI — Handoff for Scopingn
n
**Status:** Implementation ready and scoped.\n
**Last updated:** 2026-04-11\n
**Audience:** GTM Engineering Interviewers / Engineers scoping DSPy optimization workflow.n
n
---n
# DSPy Optimization Strategy & Implementation Plan

This document details the strategy and architecture for making the "DSPy Optimization" tab a grounded, data-backed feature for GTM engineering interviews.

The core objective is to move from "here are fake delta badges" to "here is real synthetic data running through an actual optimization loop, scored by real performance metrics."

---

## 1. The Core DSPy Architecture (TypeScript via Ax)

We are using **[Ax](https://github.com/ax-llm/ax)**, the TypeScript implementation of DSPy. This is a critical distinction because Ax compiles prompts entirely in TypeScript.

### 1.1 The Training Data (What is a Labeled Example?)

Our training dataset is derived from the pipeline's historical output. Each labeled example must contain:

1. **Inputs:** The data fed to the draft generator (`leadName`, `title`, `company`, `signals`, `angleType`)
2. **Output:** The artifact produced (`subject`, `body`)
3. **Labels:** The real-world feedback from our users and leads.
   - **`cleanAccept` (Boolean):** Did the SDR send it without edits? (Dense, immediate signal)
   - **`edited` (Boolean):** Did the SDR edit it before sending? (Dense, immediate signal)
   - **`positiveReply` (Boolean/Null):** Did the lead reply favorably? (Sparse, lagging signal)

### 1.2 The Two Optimizers & The Mismatch Problem

Optimization is a closed loop: **generate → evaluate (score) → keep the best**.
The metric must score a `prediction` (a newly generated email) against an `example` (the original inputs/labels).

The problem: You cannot score a *newly generated* email using `cleanAccept` or `positiveReply` because you haven't sent it to an SDR or lead yet. Those are behavioral outcomes, not reference outputs.

This dictates which optimizer we use and how we use it:

#### Path A: `AxBootstrapFewShot` (The Right Choice for Our Data)
- **What it does:** Selects the best historical examples to serve as few-shot demonstrations in the prompt.
- **Why it fits:** It ranks our *existing* labeled history. Our composite reward (clean accept + reply) maps perfectly.
- **The Metric:** A straightforward function evaluating the existing labels.

#### Path B: `AxMiPRO` (Instruction Rewriting)
- **What it does:** Tests entirely new instruction prompts by generating new emails.
- **Why it's tricky:** Because it generates *new* emails, we can't use our labels. We must proxy SDR/lead approval.
- **The Metric:** Requires an **LLM-as-Judge**.
- **Python Dependency:** MiPRO requires a Python `ax-optimizer` server running Optuna.

---

## 2. The Optimization Logic in Code

### 2.1 The Composite Reward Metric (For BootstrapFewShot)

This metric scores our historical, labeled examples. The highest-scoring examples are selected as few-shot demos.

```typescript
const metric = ({ prediction, example }) => {
  let score = 0;
  
  // Biggest positive: Lead actually booked a meeting/engaged
  if (example.labels.positiveReply) {
    score += 0.70;  
  }
  
  // Primary dense signal: SDR trusted it enough to send untouched
  if (example.labels.cleanAccept) {
    score += 0.40;  
  }
  
  // Partial credit: SDR used it, but had to tweak it
  if (example.labels.edited) {
    score += 0.15;  
  }
  
  return Math.min(score, 1.0);
};
```

### 2.2 The LLM Judge Metric (For MiPRO Instruction Rewriting)

If we were to run MiPRO to re-write the instruction itself, we must evaluate newly generated text. We use a smaller model as a judge to approximate what an SDR/Lead desires.

```typescript
const metric = async ({ prediction, example }) => {
  const judge = ax(`emailSubject, emailBody -> 
    quality:class "high, medium, low" 
    "Does the email have a specific hook tied to a signal, clear why-now, and a low-friction CTA?"`);
    
  const result = await judge.forward(llm, prediction);
  
  return result.quality === "high" ? 1 : result.quality === "medium" ? 0.5 : 0;
};
```

---

## 3. The Demo Narrative & Delivery

The interview demo should flow as a 3-act structure.

### Act 1: The Baseline (The v1 / v2 Setup)
- **What to show:** The new "DSPy" tab (rightmost tab).
- **The UI:** A version performance table computed live via `computeDspyVersionMetrics()`.
- **The Data:** A pre-loaded synthetic corpus of ~90 jobs.
  - **v1 Baseline:** 30 jobs stamped `v1`. Realistic baseline metrics (45% clean accept, ~1% positive reply rate against sent volume).
  - **v2 Few-Shot Optimized:** 30 jobs stamped `v2`. Improved metrics (65% clean accept, ~3% positive reply rate against sent volume).
  - **v3 Live:** 30 jobs stamped `v3`. Excellent automation metrics (85% clean accept, ~6% positive reply rate against sent volume).
- **The Artifacts:** The UI displays the *actual text diff* between the v1 instruction (0 shots) and the v2 instruction (4 shots).

### Act 2: The "How it works" Offline Script
- **What to show:** Expose the `scripts/ax-compile.ts` file.
- **The Narrative:** "We export the labeled jobs via JSONL. We run this script using `AxBootstrapFewShot` and our composite reward metric (show the metric code). It identifies the gold-standard examples and builds a new frozen artifact."

### Act 3: The Live Compile (v3)
- **What to show:** Run `scripts/ax-compile.ts` on the expanded dataset (the v1 + v2 jobs combined, picking the best winners).
- **The Fallback:** If the live compile fails (API error), we have a pre-committed `data/ax-optimized-v3.json` artifact to fall back on.

---

## 4. Phase 1: Engineering Setup (To-Do List)

*(Documenting the required scaffolding; execution deferred per user request)*

1. **Synthetic Data Corpus (`data/synthetic-jobs-*.json`)**
   - Create 30 sent jobs for `v1` (baseline metrics: 55% edited, 45% clean accept, ~1% positive reply).
   - Create 30 sent jobs for `v2` (improved metrics: 35% edited, 65% clean accept, ~3% positive reply).
   - Create 30 sent jobs for `v3` (best metrics: 15% edited, 85% clean accept, ~6% positive reply).
   - Ensure all jobs have `cleanAccept`, `edited`, and `positiveReply` populated.

2. **Prompt Snapshot Artifacts (`data/prompt-snapshots.json`)**
   - Create a JSON artifact storing the `instruction` text and `fewShotCount` for v1, v2, and v3.
   - This drives the UI diff view.

3. **Data Wiring**
   - Import the 90 synthetic jobs into `lib/mock-data.ts`.
   - Ensure `lib/metrics.ts` properly processes the `promptVersions` property on these synthetic jobs to generate live table metrics.

4. **The Ax Script (`scripts/ax-compile.ts`)**
   - Install `@ax-llm/ax`.
   - Write a standalone TypeScript script that uses `AxBootstrapFewShot`.
   - Implement the composite reward metric based on the synthetic JSON data.
   - Output an optimized JSON artifact containing the demos and instruction.

5. **UI Refactor**
   - Move the "DSPy" tab to the rightmost end of `SDRWorkspace.tsx`.
   - Build `components/DspyPage.tsx` using the live metrics and prompt snapshot diffs.
