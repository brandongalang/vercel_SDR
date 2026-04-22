# Handoff: Live Agent (streaming + AI Elements), required free-text demo input, and analytics split

**Created:** 2026-04-11  
**Audience:** Implementing agent (Cursor / Codex / human)  
**Repo:** `Vercel_SDR` (Next.js 16, App Router, `ai` ^6, InstantDB)

This document is the **single implementation spec** for work agreed in product discussion. It assumes familiarity with the existing outbound pipeline under `lib/pipeline/` and the current **Live Agent** tab (`components/features/LiveAgentDemo.tsx`) that POSTs to `app/api/jobs/run/route.ts`.

---

## 1. Objectives

### 1.1 Product goals

1. **Mental model (clear to users and demos)**  
   - **Async server pipeline:** research → signals → angle → draft → governance → persisted job.  
   - **Test / demo UI:** triggers the same capabilities as production would, but optimized for **live demo** (streaming visibility, tool/sub-agent transparency).  
   - **In-app queue:** InstantDB-backed **Lead review** is the operational surface; new runs must **land in the queue** after success.

2. **Demo input: required free text**  
   - Add a **required** free-text field (working name: `freeformContext`) on demo submission.  
   - Purpose: show that **any** pasted lead blob (CRM notes, bullets, unstructured enrichment) can feed the agent—not only structured fields.  
   - Structured fields (`leadName`, `company`, `play`, etc.) may remain for defaults and display; **validation must fail** if `freeformContext` is empty for the **demo path** (see §5 for how to scope “demo” vs future API-only callers).

3. **Analytics**  
   - **Baseline vs lift:** Treat **comparison to static template baseline** as **fully synthetic** (fixed mock numbers). **Do not** derive baseline or “lift” from queue data.  
   - **Queue-derived metrics:** Continue to (or extend) **actual calculations from `OutboundJob[]`** for SDR workflow stats (clean accept, edit before approve, archives, by-angle breakdown, etc.) so the page demonstrates **how real analytics would look** once outcomes exist.  
   - Label clearly what is **synthetic benchmark** vs **computed from current queue**.

4. **Live Agent UI: Vercel AI Elements + streaming**  
   - Replace or augment the current **blocking** “run → JSON result” experience with a **streaming** UX using **Vercel AI Elements** where appropriate.  
   - Show **tool execution** and **sub-agent / phase** detail in **expandable** UI (see §7).  
   - **No** general-purpose “plugin” architecture—only composed React and AI Elements primitives.

### 1.2 Non-goals

- Real email send, Outreach/Salesforce writeback.  
- Production-grade PII handling (beyond reasonable length limits and obvious trimming).  
- Full DSPy or separate classifier services.  
- A pluggable third-party panel system (“plugins”).  
- Calculating **baseline template performance** from stored jobs (explicitly out of scope).

---

## 2. Current state (baseline for the implementing agent)

### 2.1 Entry points

| Area | Location | Behavior today |
|------|----------|----------------|
| Home | `app/page.tsx` | Renders `SDRWorkspace` with `MOCK_ANALYTICS_MAP`. |
| Lead review | `components/features/SDRWorkspace.tsx` | InstantDB `jobs` query; `QueueList` + `DetailPanel`. |
| Analytics | `components/features/AnalyticsPage.tsx` | Mix of **mock** snapshot (`analytics` prop) + **`computeQueueMetrics(jobs)`** for “Review quality”. |
| Live Agent | `components/features/LiveAgentDemo.tsx` | Form → `POST /api/jobs/run` → displays result; copy says job is written to InstantDB. |
| Pipeline | `lib/pipeline/run-job.ts` | `runOutboundJobPipeline`: research → signals → angle → draft → governance. |
| API | `app/api/jobs/run/route.ts` | Validates `leadInputSchema`, runs pipeline, writes job via `@instantdb/admin`. |

### 2.2 Types and schema

- **`LeadInput`:** `lib/types.ts` — `leadName`, `leadTitle`, `company`, `companyDomain?`, `play`.  
- **Zod:** `lib/pipeline/schemas.ts` — `leadInputSchema` mirrors `LeadInput`.  
- **Research:** `lib/pipeline/research-agent.ts` — `buildOrchestratorPrompt(leadInput)` lists structured fields only; **no free-text block yet**.

### 2.3 Analytics data

- **Mock operational / baseline story:** `lib/analytics-mock.ts` → `MOCK_ANALYTICS_MAP` keyed by `7d` | `30d` | `90d`.  
- **Queue metrics:** `lib/metrics.ts` — `computeQueueMetrics(jobs)` uses `feedback`, `status`, `outcome`, `angleType`.

### 2.4 Dependencies note

- `package.json` includes `ai` ^6 and `@ai-sdk/google-vertex`.  
- **AI Elements** and **`@ai-sdk/react`** (if required for `useChat` per your AI SDK version) may need to be **added** per [AI Elements install docs](https://github.com/vercel/ai-elements). **Verify** against the installed `ai` major version for correct imports (`useChat` from `ai` vs `@ai-sdk/react`—check AI SDK 6 migration notes in-repo or Context7 `/vercel/ai`).

---

## 3. Architecture after implementation

```text
┌─────────────────────────────────────────────────────────────────┐
│  SDRWorkspace (tabs: Lead review | Analytics | Live Agent)      │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         │ InstantDB subscribe                 │ useChat + streaming
         ▼                                    ▼
┌─────────────────────┐              ┌────────────────────────────┐
│  Queue + Detail     │              │  Live Agent panel           │
│  (existing jobs)    │              │  AI Elements: Conversation, │
│                     │              │  Tool, ChainOfThought, etc. │
└─────────────────────┘              └──────────────┬─────────────┘
                                                    │
                    POST /api/pipeline/stream (NEW)  │  (or extend run)
                                                    ▼
                    ┌───────────────────────────────────────────┐
                    │  streamText / createUIMessageStream       │
                    │  + tools OR staged writer events           │
                    │  → toUIMessageStreamResponse()             │
                    └───────────────────────┬───────────────────┘
                                            │ onFinish
                                            ▼
                    ┌───────────────────────────────────────────┐
                    │  Same business logic as today:             │
                    │  runOutboundJobPipeline OR extracted steps   │
                    │  → toInstantJobRecord → admin.transact      │
                    └───────────────────────────────────────────┘
```

**Persistence rule:** The **authoritative job record** remains InstantDB (same shape as today). The streaming route is for **UX + transparency**; final job write should match what `run-job` produces so Lead review does not need a second code path.

---

## 4. Phase A — Required free-text field and pipeline wiring

### 4.1 Schema and types

1. Add **`freeformContext: string`** to:
   - `LeadInput` in `lib/types.ts`  
   - `leadInputSchema` in `lib/pipeline/schemas.ts` with:
     - **`.min(1)`** or **`.min(N)`** (e.g. 20 characters) after trim—product wanted **required**; choose `min(1)` after trim for “non-empty” or a higher bar to force substantive paste. **Recommendation:** `z.string().trim().min(1, "…")` at minimum.

2. **Optional (API compatibility):** If non-demo clients must POST without `freeformContext`, use:
   - **Separate schema** `demoLeadInputSchema` for demo-only routes, **or**
   - **`.optional()`** on the shared schema **only** if product confirms—**current spec says required for demo**; simplest is **required on `leadInputSchema`** and update any seed/API callers.

3. Update **`scripts/seed.ts`** and any test fixtures that construct `LeadInput` to include `freeformContext`.

### 4.2 Research layer

1. In **`buildOrchestratorPrompt`** (`lib/pipeline/research-agent.ts`), inject a dedicated section, e.g.:

   ```text
   Unstructured lead context (from CRM / rep notes — treat as primary evidence for enrichment):
   """
   ${leadInput.freeformContext}
   """
   ```

2. If sub-researchers receive a narrower prompt builder (`runResearchThread` / `spawn-researcher.ts`), pass a **short excerpt or the same block** where it improves retrieval—avoid duplicating conflicting instructions.

3. **Length cap:** Add `max(8000)` or similar on Zod + truncate in prompt if needed to avoid runaway tokens.

### 4.3 Live Agent form (`LiveAgentDemo.tsx`)

1. Add a **large `<Textarea>`** labeled clearly (e.g. “Paste lead notes (required)”).  
2. Bind to `form.freeformContext`.  
3. Disable **Run** until non-empty (in addition to Zod on server).  
4. Keep structured fields as today for **play/company**—they still inform governance and research budget.

### 4.4 API route `app/api/jobs/run/route.ts`

1. No change to **success behavior** beyond accepting new field once schema updates.  
2. Return **400** with Zod issues if `freeformContext` missing.

---

## 5. Phase B — Analytics: synthetic baseline vs computed actuals

### 5.1 Rules (strict)

| Metric / block | Source | Notes |
|----------------|--------|--------|
| Static baseline rate, “lift vs baseline”, send volumes that imply industry scale | **`lib/analytics-mock.ts`** (or a small `baselineConfig` object) | **Fixed**; **not** computed from jobs. |
| Clean accept %, edit rate, archive behavior, by-angle table, reply/outcome **when data exists** | **`computeQueueMetrics`** + helpers | Derived from **`jobs`** filtered by time window (see §5.2). |
| Copy in UI | Must say **“Illustrative baseline”** / **“Demo benchmark”** where synthetic. |

### 5.2 Time window

- `AnalyticsPage` already has `timeRange` state (`7d` | `30d` | `90d`).  
- Implement **`filterJobsByTimeRange(jobs, range)`** using `timestamps.created` (ISO) vs “now” (or end of demo day).  
- Pass **filtered** `jobs` into `computeQueueMetrics` for the “live” section.  
- **Mock snapshot** for top cards: either **unchanged** (still keyed by range for copy variety) or **same numbers** across ranges—product preference; document choice in PR.

### 5.3 Optional: richer “example” outcomes

- To avoid empty reply rates, **`scripts/seed.ts`** can set **`sent_stub`** + **`outcome`** on a subset with **deterministic** rules so demos repeat.  
- Not required for Phase B if the table showing “—” is acceptable until seed work is done.

### 5.4 Files to touch

- `lib/metrics.ts` — ensure time-filtered jobs; add `filterJobsByTimeRange` in `lib/metrics.ts` or `lib/analytics-utils.ts`.  
- `components/features/AnalyticsPage.tsx` — wire filtered jobs; add labels for synthetic vs computed.  
- `app/page.tsx` / `SDRWorkspace.tsx` — pass filtered data or compute inside page.

---

## 6. Phase C — Install Vercel AI Elements

### 6.1 Install

- Follow the official **AI Elements** setup (CLI or copy components into `components/ai-elements/`).  
- Align **Tailwind / shadcn** with existing project (this repo already uses shadcn-style UI under `components/ui/`).

### 6.2 Components most relevant to this product

Use Context7 library ID **`/vercel/ai-elements`** for up-to-date APIs.

| Component | Use in SDR Live Agent |
|-----------|------------------------|
| **`Conversation`**, **`Message`**, **`MessageContent`**, **`MessageResponse`** | Main streaming transcript. |
| **`Tool`**, **`ToolHeader`**, **`ToolContent`**, **`ToolInput`**, **`ToolOutput`** | Each **tool call** or wrapped **sub-agent step** with expandable I/O. Use `defaultOpen` while `state` is streaming. |
| **`ChainOfThought`**, **`ChainOfThoughtStep`**, etc. | **Fixed pipeline phases**: Ingest → Research → Signals → Angle → Draft — show **pending / active / complete** without faking tool data. |
| **`Queue` (AI Elements)** | Optional **sidebar** list of stages or parallel items with **collapsible sections**—**not** the same as business “lead queue”; rename in UI to “Pipeline” or “Run steps” to avoid confusion with `QueueList`. |
| **`Reasoning`**, **`ReasoningTrigger`**, **`ReasoningContent`** | Only if the model streams **reasoning** parts and `sendReasoning: true` on the server. |
| **`PromptInput`** (optional) | Could replace ad-hoc inputs for **chat-style** demo; still keep **required freeform** + structured fields either in the same form or as initial “system” message. |
| **`Sources`** | If research exposes URLs in the UI message stream. |

### 6.3 Deprecated / unused cleanup

- `components/InsightsSheet.tsx` is currently **unreferenced**—remove or wire after analytics work to avoid drift.

---

## 7. Phase D — Streaming API and mapping to UI

### 7.1 Two implementation strategies (pick one; hybrid allowed)

**Strategy 1 — Native tool streaming (preferred for fidelity)**  

- Implement `POST /api/pipeline/stream` (name flexible) that uses **`streamText`** with **`tools`** whose `execute` functions call into existing modules:
  - e.g. tool `run_research` → `runResearchAgent` (or smaller units).  
- Return **`result.toUIMessageStreamResponse()`** (AI SDK 6 pattern).  
- Sub-agents appear as **separate tool calls** if the **orchestrator** is a `streamText` + tools loop, **or** as one tool that streams sub-progress via **`createUIMessageStream`** merged into the same response (harder).

**Strategy 2 — Staged UI stream (pragmatic)**  

- Use **`createUIMessageStream`** + **`createUIMessageStreamResponse`** to **`writer.write`** custom data parts as each **phase** completes (research done → emit chunk; signals done → emit chunk).  
- Optionally **`writer.merge`** a nested `streamText(...).toUIMessageStream()` for narrative summary only.  
- Map phases to **`ChainOfThought`** steps and/or **`Tool`**-shaped custom components (if you emit structured `data-*` parts, add a small renderer in the message loop).

**Recommendation:** Start with **Strategy 2** if refactoring the orchestrator into a single `streamText` tools loop is large; iterate toward Strategy 1 for “real” tool streaming.

### 7.2 Frontend: `useChat` + parts loop

- Use **`useChat`** from the correct package for `ai` v6 (verify imports).  
- **`DefaultChatTransport`** pointing at the new stream route.  
- Render `messages` with a **`switch` on `part.type`**:
  - `text` → `MessageResponse`  
  - `reasoning` → `Reasoning` (if enabled)  
  - `tool-*` or tool-invocation types → **`Tool`** + Elements  
  - Custom `data-*` → internal components for **ChainOfThought** updates  

Reference: Context7 **`/vercel/ai-elements`** examples map **`tool-invocation`** and **`tool-<name>`** patterns—match what your AI SDK version emits.

### 7.3 Sub-agent visualization

- **Minimum:** One **ChainOfThought** row with 5 steps; update `status` as server emits events.  
- **Richer:** Each **Flash thread** or tool call rendered as **`Tool`** with title `Sub-researcher: {topic}`.  
- **Content:** Show **summary + key findings** from `SubAgentReport` in `ToolOutput` (truncate for UI).

### 7.4 Duration and limits

- Set **`export const maxDuration`** on the route (Vercel) high enough for research (e.g. 60–300s depending on plan).  
- Handle **abort** (`AbortSignal`) if `useChat` supports stop—pass through to pipeline if possible.

---

## 8. Phase E — Persistence after stream completes

### 8.1 Behavior

- When the **pipeline completes successfully**, the server must still **write the job** to InstantDB exactly as today (`toInstantJobRecord`, `admin.transact`).  
- Return the **`job.id`** in a **final data part** or JSON tail so the client can **`setSelectedJobId`** / switch tab to **Lead review** (optional UX improvement).

### 8.2 Failure

- On failure: stream an **error** part; **do not** write partial jobs unless product explicitly wants draft rows (default: **no**).

### 8.3 Relationship to `POST /api/jobs/run`

- **Options:**  
  - **(a)** Keep both: non-streaming for scripts; streaming for UI.  
  - **(b)** Have `/api/jobs/run` call shared `runOutboundJobPipeline` only; streaming route calls the same function after emitting progress (progress requires Strategy 2 or refactored internals).  
- **DRY:** Extract **`persistJob(job)`** helper used by both routes.

---

## 9. Phase F — UX polish and environment

### 9.1 `INSTANT_ADMIN_TOKEN`

- If missing, `/api/jobs/run` throws—surface a **friendly** message in Live Agent (catch 500 body).  
- Document in `.env.example` (if policy allows).

### 9.2 Lead review refresh

- InstantDB subscription should update automatically; optionally **navigate to Lead review** and select the new job id from the stream response.

---

## 10. Testing and verification checklist

- [ ] `npm run lint`  
- [ ] `npm run build`  
- [ ] Demo: empty `freeformContext` → **validation error** (client + server).  
- [ ] Demo: valid payload → job appears in **Lead review** with expected fields.  
- [ ] Streaming route: **tool** and/or **phase** UI updates; expandable detail works.  
- [ ] Analytics: baseline block **unchanged** by triage actions; queue metrics **change** when approving/archiving jobs (with feedback).  
- [ ] No accidental computation of “baseline” from `jobs`.

---

## 11. File change list (expected)

| Action | Path |
|--------|------|
| Edit | `lib/types.ts` — `freeformContext` on `LeadInput` |
| Edit | `lib/pipeline/schemas.ts` — Zod |
| Edit | `lib/pipeline/research-agent.ts` — prompt |
| Edit | `lib/pipeline/spawn-researcher.ts` (optional) — context propagation |
| Edit | `components/features/LiveAgentDemo.tsx` — textarea, streaming UI |
| New | `app/api/pipeline/stream/route.ts` (or agreed path) |
| Edit | `components/features/SDRWorkspace.tsx` — pass props if needed; tab switch helper |
| New | `components/ai-elements/*` (if CLI adds here) |
| Edit | `lib/metrics.ts` or new `lib/analytics-utils.ts` — time filter |
| Edit | `components/features/AnalyticsPage.tsx` — labels + filtered metrics |
| Edit | `scripts/seed.ts` — `freeformContext` + optional outcomes |
| Delete or use | `components/InsightsSheet.tsx` |

---

## 12. Open decisions (implementer should confirm with stakeholder if unclear)

1. **Minimum length** for `freeformContext` (1 char vs e.g. 50 chars).  
2. **Whether** `/api/jobs/run` stays for scripts or is folded into streaming-only.  
3. **Strategy 1 vs 2** for streaming (§7.1).  
4. **AI Elements `Queue`** vs **only `ChainOfThought` + `Tool`** for MVP visuals.  
5. **Time-range behavior** for mock top cards (independent per range vs single static block).

---

## 13. Reference commands for docs

- Context7 MCP library IDs: **`/vercel/ai-elements`**, **`/vercel/ai`**.  
- NPM package **`@context7/cli`** was not found on the public registry at handoff time; use **MCP `query-docs`** or the published AI Elements / AI SDK sites.

---

**End of handoff document.**
