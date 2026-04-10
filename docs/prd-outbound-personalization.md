# PRD: SDR Outbound Messaging — Personalization Prototype

**Status:** Draft (interview / take-home scope)  
**Last updated:** 2026-04-10  
**Owner:** Brandon Galang  

**For future agents resuming this work:** This document is the **single source of truth** for problem framing, MVP scope, architecture, funnel, confidence, DSPy intent, and stakeholder expectations. Read **§1 Summary**, **§5** (funnel + detailed appendix cross-ref), **§6 MVP**, **§7 Backend**, **§8 DSPy**, and **Appendix A–C** before implementing. The repository may be empty or partial—confirm `README` and app entry when present.

---

## 1. Summary

Build a **prototype** that raises the **quality floor** of **first-touch outbound** emails by combining **intent signals** (internal + external) into **one credible angle**, with **explicit governance** (who must review before send) and a **review queue** that earns **trust** through structured signals, confidence, and human-in-the-loop actions.

**Integration stance:** No dependency on real Outreach/SendGrid for v0. Mock CRM and signals; real **Exa** (or mocks) acceptable per environment.

**Stack alignment (interview context):** Next.js, Vercel Workflows optional for durable steps; research via **Exa** where applicable.

---

## 2. Problem framing

### 2.1 Business problem

- Many SDRs run outbound in **Outreach** (sequences); **first touch** is often manual and **inconsistent** (time and quality vary widely).
- Leadership wants **everyone** to get a solid draft **fast** (“B+ floor”), without emails that read like **AI surveillance** (dumping every fact found about the prospect).

### 2.2 Product insight (harder than generation)

The bottleneck is **trust**: reps stake **reputation** on what sends. The system must make **judgment visible**:

- Why this hook (one angle), what was **not** used, how **confident** we are, and whether **auto** vs **human review** applies.

### 2.3 Prioritized goals

1. **Quality floor** — consistent, strong first-touch drafts.  
2. **Governance** — explicit rules for auto-eligible vs review-required (e.g. marketing-sourced sensitivity).  
3. **Trust** — ranked/categorized signals, chosen angle, confidence; avoid dossier mode.  
4. **Future-ready analytics** — structured fields + implicit events so week-over-week success can be measured later (charts optional in v0).

### 2.4 Non-goals (v0)

- Real email delivery or Outreach/Salesforce writeback.  
- Full inbound routing / SLA (contact-sales queue).  
- Multi-contact account orchestration in the UI (see §6.2 — **deferred**).  
- Full DSPy optimization in code (see §8 — **designed in**, not required to ship).  
- Separate per-signal classifier service (see §7.2).

---

## 3. User & core loop

**Primary user:** SDR or operator **reviewing** outbound drafts.

**Core loop:** Scan **queue** → open **drawer** → verify signals & angle → **approve** or **edit** → next row.  
**Principle:** Speed = staying in context → **table + drawer** (not full-page review).

---

## 4. UX specification

### 4.1 Main view: review queue (table)

| Column | Purpose |
|--------|---------|
| Lead | Name (+ title optional) |
| Company | Organization |
| Play | Short label (e.g. `Event — SF 2026`, `PLG signup`) |
| Primary angle | One line — hook the draft uses |
| Confidence | Tier + short summary |
| Governance | `Review required` / `Auto-eligible` |
| Status | `pending_review` / `approved` / `rejected` (stub) / `sent_stub` |
| Updated | Optional relative time |

**Interaction:** Row click opens **drawer**; optional `?jobId=` for refresh/share.

### 4.2 Drawer: review detail

**Sections (top → bottom):**

1. Header — lead, company, play, governance, confidence.  
2. **Chosen angle** — single sentence (policy: one external + one internal story, not a list of everything).  
3. **Ranked signals** — list with: category, label/value, source (`internal` \| `external` \| `derived`), rank; mark which powered the angle (`usedInAngle`).  
4. **Discarded / deprioritized** (collapsed) — what we did **not** lead with (trust + “not creepy”).  
5. **Draft** — subject + body; optional highlight of **personalized clause** vs **template shell**.  
6. **Actions** — Approve, Save edits, optional Regenerate (with note), Reject / flag.

**Trust UX:** Ranking + categorization over walls of text.

---

## 5. Architecture: funnel (conceptual)

End-to-end flow for one **outbound job**:

```text
[Optional] Disqualify / route (rules) — thin in v0
    → Retrieve wide (Exa + internal mocks)
    → Extract + label signals (one logical step; see §7.2)
    → [Future] Contextualize ensemble (themes across signals)
    → [Future] Sufficiency gate
    → Plan: angle + confidence (MVP: single call; see §7.3)
    → Draft
    → [Optional] Verify (policy / grounding) — capped loop in future
    → Human queue (priority by confidence × policy)
    → [Future] Rewrite / re-plan with implicit feedback
```

**Outbound vs inbound:** This is **outbound** (team initiates). Warm signals (event, PLG) are still **outbound** motion.

**Entity model (full vision):** **Account (company)** + **contacts[]** + ranked fit; **event** may point at one person while another contact is a better first touch. **MVP:** one contact per row; document multi-contact as phase 2.

### 5.1 Detailed funnel (design reference)

Use this as the **canonical stage list** when implementing or extending the pipeline. It matches stakeholder expectations (“mirror what SDRs do”) and prior brainstorming.

| Step | Name | What happens |
|------|------|----------------|
| 1 | **Pool** | Rows exist per **play** (event, PLG, etc.). Not every lead merits equal research budget later; queue may show `pending` / not yet researched. |
| 2 | **Widen — research / retrieve** | Pull **candidate** material: Exa hits, internal signals, `LeadContext`. Output is intentionally **messy**: `RawHit[]`, raw internal facts. No obligation to use everything. |
| 3 | **Narrow — extract + label + score** | Turn candidates into **atomic typed signals**; label (play-fit, internal/external, risk); dedupe. **MVP:** labels emitted **with** extraction (no separate classifier product). Output: **ScoredSignal**-shaped objects. |
| 4 | **Plan — angle** | From scored signals → **AnglePlan**: one-sentence story + **which signal IDs** are in-bounds + **discarded** list with short reasons. Funnel wall: many signals → **one** hook shape (e.g. one external + one internal). |
| 5 | **Generate** | Draft **only** from AnglePlan + policy (voice, length, CTA)—**not** from the full research blob. |
| 6 | **Verify (automated)** | Cheap checks: hook budget, forbidden patterns, grounding (“claim X cites signal Y”), governance. Outcome: `ok` \| `flag` (human or rewrite)—**policy**, not “is it beautiful?” |
| 7 | **Human queue** | UI: confidence, signals, angle, draft; approve, edit, or kick off rewrite. |
| 8 | **Rewrite loop (optional)** | Input: original draft + plan + feedback (verify, human presets, free text). Output: new draft. **Same plan** unless human indicates **bad angle** → then **re-plan** or re-research, not only rewrite. |

**Visual:**

```text
Leads → Retrieve (wide) → Extract/label/score (narrow) → AnglePlan (narrow) → Draft → Auto-verify → Human → [Rewrite → Draft …] → Done
```

### 5.2 Where confidence lives

Treat confidence as **“can we stake reputation on this *plan*?”**, not “how pretty is the paragraph.”

| When | Meaning |
|------|--------|
| After signal scoring | Evidence strength: freshness, specificity, grounding, on-play. |
| After angle plan | **Primary** queue confidence: coherent, evidence-backed angle + hook budget. **Surface this in the UI.** |
| After generate | Usually **low incremental** value if draft is plan-constrained; optional **draft-risk** from verify (tone, length, CTA). |

**Rules:**

- **Low plan confidence** → may still **draft** for human speed; badge **Low**, default **`review_required`**, softer template; **never auto-send** without policy.  
- **High plan confidence** → can still fail verify or human edit; that is **operational**, not necessarily “confidence was wrong.”  
- **Routing:** “Agent shouldn’t push low-confidence sends” = **governance rule**, not a property of the generator alone.

**Interview one-liner:** *Confidence scores the evidence and the angle plan; generation is a constrained composer; verify and rewrite close the loop without reopening the whole firehose.*

### 5.3 Rewrite & re-prompt behavior

- **API shape:** `Rewrite(draft, plan, feedback_spec)` where `feedback_spec` is **preset id** and/or **free string**.  
- **Presets (examples):** `shorter`, `less_hype`, `softer_cta`, `more_technical`, `wrong_hook` — map to structured feedback the rewrite module understands.  
- **Edge case — wrong fact:** If the bad content was **`usedInAngle`**, prefer **re-run angle (or classify)** rather than prose-only rewrite. If wording-only, rewrite suffices. Encode via **`wrong_hook`** → re-plan path.

### 5.4 Sequence / Outreach context (stakeholder)

- Today: **Outreach** = sequences; **first email** often manual / templated + edits; **subsequent steps** more automated; variables possible.  
- **When the prospect replies, the sequence stops** — SDR works the thread manually; AE/SDR handoff as per their process.  
- **Exercise:** Deep **Outreach integration not required**; focus on **message framework + feedback**. Production may use SendGrid directly, etc.

---

## 6. MVP scope (80/20)

### 6.1 In scope

- Queue **table** + **drawer** as specified.  
- Backend pipeline: **mock or real research** → **signals with labels in one pass** → **single angle + confidence** (one call) → **draft** → optional **verify** (rules or one small LM pass).  
- **Mock jobs** (5–8) spanning high/low confidence, governance variants.  
- **Logging:** original draft, final text, `approved`, `edited` boolean.

### 6.2 Deferred (document as “next”)

- **Account + multiple contacts** + contact ranking.  
- **Candidate angles + ranker** (separate proposer/ranker modules).  
- **Joint contextualization** (“hackathon crowd” vs one tweet) as a dedicated layer.  
- **Hard disqualify** + research budget by segment.  
- **DSPy** training loops in production (see §8).  
- **Durable workflows** (retries, long research) — optional narrative.  
- Rich **analytics** UI — events/schema only in v0.

### 6.3 MVP simplifications (explicit)

| Topic | MVP choice |
|-------|------------|
| Per-signal classification | **No separate step** — labels emitted with signal extraction (§7.2). |
| Angle selection | **Single** LLM call → `angle + confidence + used_signal_ids` (§7.3). |
| Company vs person | **One contact** per row; enrich narrative for phase 2. |
| Auto review loop | **0–1** verify pass; no “until happy” unbounded loop. |

---

## 7. Backend stages & contracts

### 7.1 Suggested stages (v0)

| Stage | Responsibility |
|-------|----------------|
| S0 | Ingest / normalize lead + play + mock CRM context |
| S1 | Retrieve (Exa + internal; mockable) |
| S2 | **Signal extraction + labels** — structured output; **no separate classifier service** |
| S3 | **Angle + confidence** — single call (see §7.3) |
| S4 | Draft generation |
| S5 | Optional verify (policy / grounding) |

### 7.2 Signals + labels in one pass

The **research / extraction** agent outputs **structured signals** each with labels (e.g. kind, scope, strength, evidence pointer, source). That is **one logical step** in the product.

- If context is too large or quality is weak, implementation may use **two LLM calls** (e.g. compress → structure) **without** adding a separate “classifier” product module.

### 7.3 Single angle + confidence call (MVP)

**One** generation produces:

- `angle` (one sentence)  
- `confidence` (score/tier + short reasons)  
- `used_signal_ids[]`  
- optional `discarded_signals[]` (short reasons)

**Future:** **Proposer** (2–4 candidates) + **ranker** (different metrics, DSPy-friendly); optional **conditional** second pass when confidence is low.

**Confidence:** Primarily **evidence + plan** (signal strength + angle coherence), not prose polish. **Routing:** low confidence → review-required / no auto-send; generation may still produce a draft for speed.

---

## 8. DSPy & optimization (design, not all v0 code)

### 8.1 Intent

Treat each **LM-heavy stage** as a **modular program** (explicit inputs/outputs), ready for **DSPy**-style optimization with **per-stage metrics** and **global** outcome metrics when data exists.

### 8.2 Multi-stage optimization

- **Per-stage:** Each module can have its own `metric(example, prediction)` (e.g. grounding for extraction, **no-edit approve** for draft given fixed angle).  
- **Staged curriculum:** Optimize early stages with **proxies**; later stages with **acceptance** metrics.  
- **End-to-end:** Possible but **credit assignment** is hard — prefer **stage metrics** + sparse global labels.

### 8.3 Implicit supervision (no manual signal scoring)

Do **not** rely on users to score each signal. **Natural usage** provides labels:

| Signal | Use |
|--------|-----|
| Approve without edit | Strong positive for plan + draft |
| Approve after edit | Positive plan; draft needs work |
| Reject / abandon | Negative for job or angle |
| Regenerate / preset | Structured failure modes |
| Reply / meeting (when available) | Slow, gold outcome signal |

Log events for future optimization: `job_created`, `review_opened`, `approved`, `edited`, `rejected`, `regenerate_requested` with snapshots of `confidence_tier`, `play`, signal categories.

### 8.4 V0 vs implementation

**V0:** Implement **pipeline + types + logging**; document **DSPy** mapping in this PRD. **Shipping** DSPy optimizers is **optional** for the demo; interview narrative: *stages are modular signatures ready for per-stage metrics and implicit feedback.*

---

## 9. Data model (reference)

**OutboundJob** (illustrative):

- `id`, `lead`, `company`, `play`  
- `status`, `governance`  
- `confidence` — `{ score?, tier, summary, reasons? }`  
- `angle` (string)  
- `signals[]` — `{ id, category, label, value, source, rank, usedInAngle, evidenceUrl? }`  
- `discardedSignals[]` (optional)  
- `draft` — `{ subject, body, highlightedSpan? }`  
- `draftOriginal?`, `timestamps`, `feedback?` (`edited`, `editorNote?`)

---

## 10. Success criteria (prototype)

- SDR can **triage** from the table using confidence + angle + governance.  
- In the drawer, **why this email exists** is clear in **~30 seconds** (signals + angle + discarded).  
- Approve / save edits updates queue state.  
- Structure supports **future** analytics and DSPy without schema redesign.

---

## 11. Appendix: interview “what’s next”

1. Account + **multiple contacts** + ranking for best first touch.  
2. **Candidate angles + ranker** + separate DSPy metrics.  
3. **Contextualization layer** across all signals (ensemble meaning).  
4. **Disqualify** + research budget by segment.  
5. **Implicit feedback** loops + optional outcome-weighted training.  
6. **Vercel Workflows** for durable research and retries.

---

## Appendix A — Stakeholder interview distillate (Apr 10, 2026)

**Source:** Meeting “SDR outbound messaging personalization strategy” (participant: Brandon Galang + GTM/sales guide + engineering). **Purpose:** Ground the prototype in what interviewers said they care about.

### A.1 Outcomes they want

- **Standardize quality:** Everyone gets roughly **B+** first-touch quality **fast**—not spending 10–15 minutes to move B− → B+ (they don’t believe reply rate justifies that time).  
- **Intent signals:** Combine **external** (e.g. tech on site) + **internal** (e.g. signups, product activity) into **one perspective**—**not** “throw everything we found at you” (reads creepy / non-human).  
- **Measurability:** Today content is so **unstandard** they **can’t tell** what moved the needle—structure + feedback helps later.  
- **Custom first touch (and beyond):** Ideally **custom first**, **custom second**, **forks**—not identical blast copy after step 1.

### A.2 Current reality

- **Outreach** for sequences; **manual / hybrid first email**; later steps more automated.  
- **Reply stops the sequence** — then human conversation.  
- **~20 SDRs**, inconsistent use of ChatGPT/ad-hoc AI; some don’t use it; quality varies.  
- **Salesforce** as source of truth; **Outreach tolerated**; **Outreach API** called out as painful—**SendGrid** sits behind sending; could integrate SendGrid directly later. **For the exercise:** **don’t require Outreach**—focus on **how the message is decided + feedback**.  
- **Lead targeting** “generally solved” — prototype can assume leads are already chosen.

### A.3 Signals (examples they gave)

Event **registration/attendance**, **product signups** (e.g. Vercel), **web page views**, social—**surface-level** is OK. **Mock data explicitly encouraged**; not testing factual accuracy.

### A.4 Engineering / product constraints they emphasized

- **Resilience / fallback (v2 mindset):** If the agent or model path fails, **don’t block SDRs**—fallback to **static sequence** or known-good path (like inbound lead agent pattern). **Not necessarily MVP**, but **foundation** for trust ops.  
- **Governance:** Some leads **E2E automated** (low stakes); some **human must review** (e.g. **marketing** not bought into full send automation). **Dynamic or manual** rules.  
- **Dashboard:** They’re building **dashboard-style** orchestration for **inbound** agent; **this outbound work should feel like “where SDRs work”**—**how does an SDR use this tool?**  
- **Research:** **Exa** used internally; **mock inputs + one real research step** acceptable.  
- **Stack nudge:** **Next.js**, **Vercel Workflows** for agent/deep research steps—**evaluate fit** for the job.  
- **Feedback & analytics:** Edits (“they changed X”), version-one dislike, and **prompt/analytics** over time (“prompts phrased this way do better”).  
- **Pair coding / next round:** They want to see **what you built**, **how you’d tweak it**, then **live add a feature** to test **mental model of architecture**—**OK to use AI to build** if you can **explain** architecture (files, diagram, data model). **Don’t YOLO ship** without understanding.

---

## Appendix B — Brainstorming notes (merged)

**Purpose:** Preserve design discussions so future agents don’t re-derive from scratch.

- **Outbound vs inbound:** Event/PLG signals can feel “warm,” but motion is still **outbound** (team initiates thread). No need to model **full inbound routing** in v0.  
- **Company-first (future):** Lead may be **account-centric** with **multiple contacts**; event attendee may not be best first contact—**ranking** deferred post-MVP.  
- **Signal meaning is contextual:** “Many people at hackathon” vs “one person mentioned Vercel once” — ensemble interpretation is a **future contextualization layer**; MVP may use a **single angle + confidence** call.  
- **DSPy:** Multi-stage programs with **per-stage metrics**; **implicit** labels from usage (approve, edit, outcomes)—see §8.  
- **Table + drawer** chosen for **speed** (full page = higher navigation cost for high-throughput review).

---

## Appendix C — Resume checklist (for agents)

- [ ] Read **§1 Summary** and **§6 MVP** (what ships vs not).  
- [ ] Read **§5.1–5.4** (funnel, confidence, rewrite, Outreach context).  
- [ ] Read **Appendix A** (stakeholder must-haves).  
- [ ] Confirm **data model** in §9 matches implemented types.  
- [ ] Confirm logging/events in §8.3 for future analytics.  
- [ ] If adding DSPy later: preserve **modular stage boundaries** in §7–8.  
- [ ] Update **§12 Revision history** when changing scope.

---

## 12. Revision history

| Date | Change |
|------|--------|
| 2026-04-10 | Initial PRD from problem framing, architecture, MVP, DSPy discussion |
| 2026-04-10 | Added resume note for agents; §5.1–5.4 detailed funnel, confidence, rewrite, sequence context; Appendix A (interview distillate), B (brainstorm merge), C (resume checklist) |
