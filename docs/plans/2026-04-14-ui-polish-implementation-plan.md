# UI Polish Implementation Plan

**Status:** Ready for implementation  
**Created:** 2026-04-14  
**Source:** UI-polish skill audit against PRD and Vercel v0 standards  
**Scope:** Visual/aesthetic changes only — no logic, data model, or API changes  

---

## Pre-requisites

- Read the PRD at `docs/prd-outbound-personalization.md` (especially §4.1–4.2 UX spec)
- Read `app/globals.css` to understand the token system
- The app uses: Next.js 16, Tailwind v4, shadcn/ui, Geist fonts, Lucide icons

---

## Task 1 — Queue Rail Tinting (High Priority)

**Goal:** Create visual hierarchy between the queue panel (scan) and the detail panel (read) by giving the queue a receding tinted background.

**File:** `components/QueueList.tsx`

**Changes:**
1. On the root `<div>` (line ~322), change `bg-card` to `bg-zinc-50/60`.
2. On the queue header `<div>` (line ~323), change `bg-card` to `bg-zinc-50/80`.
3. Keep the section headers (`SectionHeader` component) as-is — they already have their own tinted backgrounds.

**Verify:** Queue panel should feel like a "receding rail" next to the white detail panel. The contrast should be subtle — not a dark sidebar, just a hint of depth.

---

## Task 2 — Queue Badge Simplification (High Priority)

**Goal:** Reduce badge count per pending queue row from 3 inline pills to a simpler hierarchy: 1 prominent confidence chip + dot indicator + text.

**File:** `components/QueueList.tsx`

**Changes in `QueueRow` (pending branch, lines ~79–124):**

1. Keep Zone 1 (confidence chip) as-is — it's the primary scannable element.
2. In Zone 2 (identity + context, lines ~97–121):
   - Keep `job.lead.name` and `job.company` as-is.
   - Replace the angle type `<span>` badge with a smaller dot indicator:
     ```
     <span className={cn("h-2 w-2 rounded-full shrink-0", atConfig.dot)} />
     <span className="text-[11px] text-zinc-500 truncate">{atConfig.label}</span>
     ```
   - Keep the play badge but make it lighter — remove the `border` and `font-semibold`, use just `text-[10px] font-mono text-zinc-400` with the play icon.
3. The done row (lines ~128–165) can keep its current simpler treatment.

**Verify:** Pending rows should scan as: [colored chip] Name / Company · dot AngleLabel · PlayIcon PlayLabel. Less visual noise, faster triage.

---

## Task 3 — Personalized Clause Highlight: Amber → Cyan (High Priority)

**Goal:** The `<mark>` element highlighting the personalized clause in the draft body should use cyan (a product accent) instead of amber (governance/warning accent).

**File:** `components/DetailPanel.tsx`

**Changes in `renderBodyWithHighlight` function (line ~48):**
1. Change the `<mark>` className from:
   ```
   bg-amber-100 text-zinc-900 rounded-[3px] px-0.5 not-italic border-b border-amber-300/80
   ```
   to:
   ```
   bg-cyan-100/60 text-zinc-900 rounded-[3px] px-0.5 not-italic border-b border-cyan-400/80
   ```

**Also update in the regeneration preview** (same file, line ~878 area) — the `renderBodyWithHighlight` call already uses this function, so the single change covers both locations.

**Verify:** The highlighted span in the draft should read as "this is the personalized part" (cool cyan accent) not "this needs attention" (warm amber). The `--geist-cyan` token (`#79ffe1`) is already defined in `globals.css` and unused elsewhere.

---

## Task 4 — Detail Panel Header Badge Consolidation (Medium Priority)

**Goal:** Reduce "badge salad" in the detail panel header by using inline icon+text instead of bordered pill badges for governance and confidence.

**File:** `components/DetailPanel.tsx`

**Changes in the header metadata area (lines ~370–409):**
1. Replace the governance pill badge with a lighter inline treatment:
   - Remove the bordered `rounded-md border px-2 py-1` wrapper.
   - Use: `<GovIcon size={13} className="text-amber-700" /> <span className="text-[11px] text-zinc-600">{gov.label}</span>` as a simple `flex items-center gap-1` group.
2. Keep the confidence badge as a tooltip trigger but lighten it:
   - Remove the `border` and `bg-*` fill classes.
   - Use: `text-[11px] font-mono text-zinc-500` with just the `Info` icon as the tooltip affordance.
3. Keep the `Source: {leadSource}` text as-is — it's already light.
4. Wrap all three in a single `flex items-center gap-3` row with `·` separators between them instead of stacking as separate pills.

**Verify:** Header should read as a single-line metadata strip on desktop: `🛡 Review required · Confidence: high ⓘ · Source: event_registration`. On mobile it can wrap but should not create a block of pills.

---

## Task 5 — Analytics Metric Card Emphasis (Medium Priority)

**Goal:** Make the primary outcome metric ("Positive reply rate") visually dominant and increase trend badge prominence across all cards.

**File:** `components/AnalyticsPage.tsx`

**Changes in `MetricCard` component (lines ~18–58):**
1. Increase the trend badge size slightly: change `text-[11px]` to `text-[12px]` and add `font-semibold`.
2. Add a `highlight` boolean prop to `MetricCard`.
3. When `highlight` is true, add a subtle ring: `ring-1 ring-emerald-200/60` to the card's outer div (in addition to existing border).

**Changes in the metric grid (lines ~174–201):**
1. Add `highlight` prop to the "Impact: Positive reply" MetricCard only (the 3rd card).

**Verify:** The positive reply card should subtly stand out from its siblings without being garish. The trend arrows should be slightly more legible.

---

## Task 6 — Analytics Table Row Angle Accents (Medium Priority)

**Goal:** Add left-border color accents to the "By angle type" table rows matching each angle's dot color, creating visual continuity with the queue and detail panel.

**File:** `components/AnalyticsPage.tsx`

**Changes in the `byAngle` table body (lines ~257–290):**
1. On each `<TableRow>`, add a `className` with a left border:
   ```
   className={cn("border-l-[3px]", `border-l-${ANGLE_CONFIG[row.angleType].dot.replace('bg-', '')}`)}
   ```
   Note: Since Tailwind needs static class names, map the dot colors explicitly:
   - `bg-teal-500` → `border-l-teal-500`
   - `bg-slate-500` → `border-l-slate-500`
   - `bg-amber-500` → `border-l-amber-500`
   - `bg-teal-400` → `border-l-teal-400`
   - `bg-slate-400` → `border-l-slate-400`
   - `bg-zinc-400` → `border-l-zinc-400`
   
   The cleanest approach: add a `borderColor` field to `ANGLE_CONFIG` in `lib/angle-config.ts` (e.g. `borderColor: 'border-l-teal-500'`), then apply it on the row.

**Files also touched:** `lib/angle-config.ts` — add `borderColor` string to each angle config entry.

**Verify:** Each row in the "By angle type" table should have a colored left strip matching the dot indicator in the first cell. Visual echo of the signal cards in `DetailPanel`.

---

## Task 7 — DSPy Run Button Violet Accent (Medium Priority)

**Goal:** Make the "Run Optimization" button match the violet accent used throughout the DSPy page instead of default primary black.

**File:** `components/DspyPage.tsx`

**Changes (lines ~614–636):**
1. On the `<Button>` for "Run Optimization", change the idle state styling:
   - Add `className="min-w-[190px] bg-violet-600 text-white hover:bg-violet-700"` for the idle state.
   - The `disabled` (running) and `complete` states can keep default or use softer violet variants.

**Verify:** The button should feel like it belongs to the DSPy page's violet color family, not the global black primary.

---

## Task 8 — Live Agent Form Breathing (Low Priority)

**Goal:** Add visual separation to the freeform notes field and improve the advanced inputs toggle affordance.

**File:** `components/LiveAgentDemo.tsx`

**Changes:**
1. On the freeform notes `<Textarea>` (line ~468–476):
   - Add a slightly elevated treatment when focused: `focus:ring-2 focus:ring-teal-200/60 focus:border-teal-300`.
2. On the "Advanced settings" toggle button (wherever `showAdvancedInputs` is toggled):
   - Add a `ChevronRight` icon that rotates on open (same pattern as `showResearch` in DetailPanel).
   - Use `text-[12px] font-medium text-zinc-500 hover:text-zinc-800` instead of a bare text toggle.

**Verify:** The notes field should feel like the primary input. The advanced toggle should be clearly interactive.

---

## Task 9 — Rail Interactivity (Low Priority)

**Goal:** Connect the left rail icons to the tab switcher so clicking them navigates views.

**File:** `app/layout.tsx` + `components/SDRWorkspace.tsx`

**Approach:** This requires lifting the `activeView` state or using a URL-based approach. Two options:

**Option A (simpler):** Convert the `<span>` nav icons in `layout.tsx` to actual `<button>` elements that dispatch a custom event or use a shared context. `SDRWorkspace` listens and sets `activeView`.

**Option B (recommended):** Since this is a single-page app with no routing, pass a callback down or use a lightweight context:
1. Create a small `ViewContext` in a new file `lib/view-context.tsx`.
2. Provide it in `layout.tsx`, consume it in both the rail nav and `SDRWorkspace`.
3. Map: `Home` → no-op (disabled), `Inbox` → `"review"`, `BarChart` → `"analytics"`, `Settings` → no-op (disabled).
4. Highlight the active icon: `text-foreground` for active, `text-muted-foreground opacity-40` for disabled.

**Verify:** Clicking Inbox or BarChart in the rail should switch views. Home and Settings remain disabled/dimmed.

---

## Task 10 — Regeneration Preview Treatment (Low Priority)

**Goal:** Make the regeneration preview in the Sheet more visually distinct from the sheet background.

**File:** `components/DetailPanel.tsx`

**Changes in the regen preview area (line ~861):**
1. Change the preview container from `bg-muted/30` to `bg-card` with a left border accent:
   ```
   rounded-xl border border-border bg-card border-l-[3px] border-l-teal-400 p-4 space-y-3
   ```
2. Add a small "NEW DRAFT" label above the preview subject in `text-[10px] font-mono text-teal-600`.

**Verify:** The preview should clearly read as "this is what the regenerated version looks like" with a visual anchor distinct from the surrounding sheet content.

---

## Task 11 — Signal Strength Badge Legibility (Low Priority)

**Goal:** Improve the tiny `9px` strength badges on signal cards with a clearer 3-level visual system.

**File:** `components/DetailPanel.tsx`

**Changes in the signal card strength badge (lines ~659–667):**
1. Increase font size from `text-[9px]` to `text-[10px]`.
2. Use a 3-level fill system instead of just border variants:
   - `strong`: `bg-emerald-500 text-white border-emerald-500` (filled)
   - `moderate`: `bg-emerald-50 text-emerald-700 border-emerald-200` (outlined emerald)  
   - `weak`: `bg-zinc-100 text-zinc-500 border-zinc-200` (outlined zinc)

**Verify:** The three strength levels should be instantly distinguishable at a glance without needing to read the text.

---

## Implementation Order

Execute in this order to minimize conflicts and enable incremental verification:

1. **Task 3** (highlight color) — single-line change, zero risk
2. **Task 1** (queue tinting) — 2 class changes, zero risk
3. **Task 2** (queue badges) — contained to QueueRow
4. **Task 4** (header badges) — contained to DetailPanel header
5. **Task 5** (metric cards) — contained to AnalyticsPage
6. **Task 6** (table accents) — touches AnalyticsPage + angle-config
7. **Task 7** (DSPy button) — single class change
8. **Tasks 8–11** — low priority, independent of each other

**Testing:** After each task, run `npm run build` to verify no type errors. Visual verification via `npm run dev` on desktop and a narrow viewport (≤768px) for mobile.
