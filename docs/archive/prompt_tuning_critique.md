# Prompt Tuning Page — Critique & Command Plan
Target: `components/features/DspyPage.tsx` (rendered as the "Prompt Tuning" tab in `components/features/SDRWorkspace.tsx`)
Critique method: `/critique` (impeccable skill family), combined LLM design review + deterministic CLI detector (`npx impeccable --json --fast`).
Design context source: `.impeccable.md` — refined, high-signal product aesthetic; composure over ornament; inspiration-not-imitation of Vercel; trust must be visible.
## User-Provided Context (from critique clarification)
- **Project purpose**: Interviewing at Vercel for a GTM engineering role. Being Vercel-inspired/aligned is a feature, not a bug — but the work should have its own slant so it feels original, not derivative.
- **Aesthetic pivot scope**: Meaningful pivot — drop gradients and glows, pair a display typeface, but keep the sky/teal/amber palette.
- **Off-limits**: Nothing. Rework freely.
- **Scope**: (skipped — defaulting to full plan; step order is chosen so you can stop after any step and still ship a better page.)
## Design Health Score (Nielsen's 10 Heuristics)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Idle state gives no cue that the ring is interactive. |
| 2 | Match System / Real World | 3 | "MIPRO," "compile," "checkpoint" only land if the viewer already knows DSPy. |
| 3 | User Control and Freedom | 3 | No way to skip, pause, or jump to a stage mid-reveal. |
| 4 | Consistency and Standards | 3 | 8 different radii (`32, 28, 24, 22, 2xl, lg, md, full`) — scale feels arbitrary. |
| 5 | Error Prevention | 3 | `runError` path handled; double-click guarded. |
| 6 | Recognition Rather Than Recall | 2 | v1/v2/v3 labels require memory; hover state on the ring isn't persistent. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcut to replay; 5.5s scripted reveal is the only speed. |
| 8 | Aesthetic and Minimalist Design | 2 | Radial glows, nested cards, mono eyebrows on 15+ labels, icon chips on every heading. |
| 9 | Error Recovery | 3 | Reveal failures surface copy; demo-scoped. |
| 10 | Help and Documentation | 3 | Stage detail + center status + talk track are genuinely helpful. |
| **Total** | | **27/40** | **Good, not yet refined.** |
## Anti-Patterns Verdict
**"Would I believe AI made this?" Partially, yes.** The surface is polished, but the loudest elements are the most recognizable 2024–25 AI/Next.js-template tells stacked together:
- **Radial-gradient hero wash** (DspyPage.tsx:624) — teal + amber + slate haze behind the headline.
- **Gradient CTA** (DspyPage.tsx:652) — `linear-gradient(135deg,#0f172a,#155e75)` on the primary button, cyan-ish dark-mode gradient. One of the top three AI tells.
- **Radial glow inside the ring** (DspyPage.tsx:697) and **gradient divider line** (DspyPage.tsx:794). Decorative, not purposeful.
- **Icon-chip-over-every-heading**: each of the 6 stage nodes carries a rounded-full icon container + number badge + title + subtitle.
- **Hero metric layout**: the signal proof cards are literal "big number → arrow → big number + supporting stats + bar" — the banned template.
- **Card-in-card-in-card nesting**: section (`rounded-[32px]`) → narrative loop card (`rounded-[28px]`) → 6 stage cards (`rounded-[22px]`) + center card (`rounded-[28px]`) → mini "current reveal step" card (`rounded-2xl`). Five levels.
- **Single-family typography**: Geist Sans + Geist Mono for everything. No display contrast, scale of ~9 sizes with weak ratios.
### Deterministic scan results
`npx impeccable --json --fast components/features/DspyPage.tsx` — 4 findings, all `pure-black-white`:
- DspyPage.tsx:414 — `bg-black/5` (bar track)
- DspyPage.tsx:425 — `bg-black/5` (bar track)
- DspyPage.tsx:489 — `bg-black/[0.02]` (quote surface)
- DspyPage.tsx:814 — `bg-black/[0.02]` (inner reveal-step card)
The detector did not flag the gradient CTA or radial washes because they are inline `bg-[...]` arbitrary Tailwind values that slip past static pattern matching. LLM review caught them.
## Overall Impression
A competent Vercel-adjacent dashboard doing a smart narrative job. But it relies on every AI/Next-template default at once — radial glows, gradient CTA, icon chips, mono eyebrows, nested cards, hero-metric comparison — and the design context explicitly asked for the opposite: "inspiration, not imitation," "precision beats decoration," "inspectable and earned, not magical." The single biggest opportunity is to *remove* decoration, not add it, and then earn originality through typography and hierarchy.
## What's Working
- **Story architecture is strong.** Three acts — narrative loop → supporting proof → checkpoint evolution — map cleanly to the pitch. The state machine (`idle → running → complete`) is honest and narratable.
- **Semantic color discipline.** Teal/amber/rose for accepted/edited/positive is consistent across both modes and the tones stay muted in dark mode. Color carries meaning, not decoration.
- **Evidence-forward microcopy.** "Illustrative 30-day team view," "Reveal to compare the candidate," the dashed v3 track before reveal — these make uncertainty visible, which is exactly what the design principles demand.
## Priority Issues
### [P0] The hero leans on every common AI-dashboard tell at once
- **What**: Two radial gradient washes (DspyPage.tsx:624), gradient CTA (DspyPage.tsx:652), gradient divider (DspyPage.tsx:794), icon-chip-over-every-heading pattern on the 6 stage cards.
- **Why it matters**: The design context says "should not mirror [Vercel] one-to-one" and "inspectable and earned, not magical." Radial glows + gradient CTA + icon chips is the most recognizable "AI made a Next.js dashboard" visual signature. A Vercel interviewer will clock it immediately and that undermines the thesis.
- **Fix**: Kill both `radial-gradient` washes on the hero. Replace the gradient CTA with a single solid foreground color (or subtle border + muted fill for an editorial feel). Drop the gradient-line divider. On stage cards, remove the rounded-full icon container or collapse icon + number into a single small mark in the corner.
- **Suggested command**: `/quieter`
### [P0] Nested cards flatten the hierarchy
- **What**: Outer section wraps an inner narrative card, which wraps 6 stage cards around a center card, which wraps a mini reveal-step card. Plus a supporting-proof aside that wraps another card which wraps signal cards. Every surface has the same shadow + border + rounded visual weight.
- **Why it matters**: "DO NOT nest cards inside cards" — visual noise, nothing stands out. The principle "Speed should preserve context … fast scan-to-decision" requires a clear primary focus. Right now everything is a peer.
- **Fix**: Keep the outer section as the only carded surface. The "Narrative loop" panel becomes open space with a heading and a diagram — no border, no inner shadow. Stage nodes drop their card chrome and become labeled dots on the ring (or linear-flow steps). The supporting-proof aside loses its outer card; the three signal cards sit directly on the section surface.
- **Suggested command**: `/distill`
### [P1] Typography is single-family and the scale has ~9 sizes
- **What**: Only Geist Sans (body + headings) and Geist Mono (eyebrows). Heading sizes include 28/24/22/18/16/15/13/12/11/10 px — small ratios between steps, no distinct display face.
- **Why it matters**: "DO NOT use only one font family for the entire page. Pair a distinctive display font with a refined body font." "Aim for at least a 1.25 ratio between steps." The context calls for "refined, high-signal product aesthetic" — that means intentional pairing, not one sans stretched across ten sizes.
- **Fix**: Pair a distinctive editorial/technical display face for section headlines — not in the reflex-reject list and not Geist (e.g., a restrained technical serif like Söhne Breit or Signifier; or a condensed grotesk; or a technical mono-adjacent display like Berkeley Mono for just the h2s). Keep Geist Sans for UI body. Collapse the scale to 5 sizes (e.g., ~30, 22, 16, 13, 11) at ≥1.25 ratio.
- **Suggested command**: `/typeset`
### [P1] The mono-uppercase eyebrow has become the page's dominant texture
- **What**: `text-[10px] font-mono font-semibold uppercase tracking-[0.14em]` appears on 15+ labels — section eyebrows, metric tile captions, stage index numbers, card eyebrows, sub-card headers.
- **Why it matters**: At this frequency it's not an accent — it's the visual grain of the page. "DO NOT use monospace typography as lazy shorthand for 'technical/developer' vibes" and "Reserve all-caps for short labels." The eyebrow is acting as the default label style.
- **Fix**: Restrict the mono-uppercase eyebrow to 2–3 uses maximum (section-level only). Replace the rest with sentence-case small sans labels or drop the label entirely when the header already carries the intent. Metric tiles ("Optimizer," "Training view," "Objective," "Example draft set") do not need eyebrows at all — label and value can sit together.
- **Suggested command**: `/distill`
### [P2] Six peer nodes on the ring, no focal point
- **What**: The circular diagram places 6 equal-weight stage cards around an equally-weighted center card. No default anchor; the eye bounces.
- **Why it matters**: Principle: "Speed should preserve context. Optimize for fast scan-to-decision." With 6 peer nodes + 1 central peer + no pre-selected state, a first-time viewer doesn't know where to start.
- **Fix**: Three options — (A) linearize to a horizontal "now → next" timeline where the 6 stages read left-to-right and the "candidate" is the payoff at the right edge; (B) keep the ring but visually dominate the "Live checkpoint" node on idle (larger, stronger color) and mute the other 5 until interacted; (C) keep the ring but make the center card (not a parallel node) the anchor, stripping surrounding card chrome.
- **Suggested command**: `/layout`
### [P2] Alpha-scaled pure black is used as a neutral tint
- **What**: `bg-black/5`, `bg-black/[0.02]` for bar-track fills and quote backgrounds (DspyPage.tsx:414, 425, 489, 814). Dark mode mirrors with `bg-white/10`, `bg-white/[0.03]`.
- **Why it matters**: "DO NOT use pure black or pure white. Always tint." Alpha-scaled neutrals read colder than the oklch tokens and break perceptual cohesion with the rest of the palette.
- **Fix**: Swap to `bg-foreground/5` (inherits the tinted oklch foreground) or a defined token like `bg-muted/40`. Pick one consistent neutral tint pattern and apply across all 4 instances.
- **Suggested command**: `/colorize`
## Persona Red Flags
**Alex (Vercel GTM engineer reviewer, skeptical)**: Opens the prototype knowing the domain. Clocks the radial-gradient hero and the cyan/slate gradient CTA as Next-template defaults within 2 seconds. Expects the page that was described in the context — *inspectable and earned* — and sees ornamentation. Notices there's no keyboard shortcut to re-trigger the reveal, no way to inspect the actual prompt text surfaced on this page (the v1/v2 snapshots are imported but never shown), and the "Example draft set" tile shows a count but no way to open an example. Reads as "polished but shallow."
**Morgan (first-time SDR/ops viewer, mid-demo)**: Lands on the page during a presentation. Hero headline is clear — good. Then has to parse "DSPy narrative · MIPRO feedback loop" (mono eyebrow, three unfamiliar terms), then a circle with 6 cards. Reads the headline + caption, tries the button, watches the reveal — but doesn't internalize what changed because the diff between "v2 live" and "v3 candidate" is only shown numerically and in small excerpt quotes. Needs a clearer "this is what got better, and by how much" in plain language.
**Priya (skeptical SDR who'll use the agent)**: Wants to trust the system. Honest "Illustrative 30-day team view" badge is good. But the shift from 1,440 → 1,680 accepts happens with no methodology link. "Where did those numbers come from? What assumptions?" The principle "Trust must be visible … what evidence it relied on" is half-delivered — uncertainty is visible (dashed v3 bars, "hidden until reveal"), but evidence provenance isn't.
## Minor Observations
- `formatRate` output uses ASCII `->` (DspyPage.tsx:404) — swap for Unicode `→` to match the ArrowRight icon used elsewhere.
- The bottom pill "Human judgment informs the loop. Metrics decide what ships." looks clickable (same shape as the active badge). Make it a caption, not a pill.
- `text-muted-foreground/60` (60% of already-muted) on eyebrows may fall below 4.5:1 contrast on the muted/card backgrounds. Run it through a contrast check.
- Section radii `rounded-[32px]` and inner `rounded-[28px]` are nearly indistinguishable — pick one or widen the gap.
- Disabled state on the CTA drops the gradient — the button visually shrinks. Use a single solid color for both states and let the spinner carry the state change.
- `v1Snapshot` and `v2Snapshot` are loaded from `getSyntheticPromptSnapshots` but only the dates are used. Expose the full prompt text on hover/click — it directly serves the "inspectable evidence" principle.
## Questions to Consider
- What if the ring became a horizontal left-to-right flow? The metaphor ("it's a loop") is already carried by the copy — the visual could earn more by *showing the delta* rather than circling.
- Does the **Reveal next checkpoint** button need to be hero-weight? For an interview demo, should the narrative be the hero and the reveal be a tertiary control?
- What happens if you delete both radial gradients, the gradient CTA, and half the mono eyebrows — does the page feel less designed, or *more* composed?
- Would a single editorial display typeface on the two h2s change the page's character from "polished dashboard" to "considered explainer"?
- Could the three signal-proof cards compress into one stacked-bar comparison (accepted/edited/positive as segments of a 2,400-draft total) so the delta reads as a single story rather than three parallel comparisons?
## Step-by-Step Command Plan
Sequenced so each step sets up the next: quiet the noise first (so what's left can be judged honestly), flatten nesting (so hierarchy can carry weight), then earn the originality through typography and layout. You can stop after any step and still ship a better page.
### Step 1 — `/quieter`
**Goal**: Remove the AI-template decoration while keeping the sky/teal/amber palette.
- Remove the two radial gradient washes on the hero (DspyPage.tsx:624).
- Replace the gradient CTA (DspyPage.tsx:652) with a single solid foreground color (or subtle border + muted fill for an editorial feel). Kill the dark-mode gradient too.
- Drop the gradient divider line (DspyPage.tsx:794) and the small radial glow inside the ring (DspyPage.tsx:697).
- On the 6 stage cards, collapse the rounded-full icon container + number chip into a single smaller mark so every stage doesn't lead with a templated icon block.
- Keep the teal/amber/rose/sky semantic colors intact — they're doing real work.
### Step 2 — `/distill`
**Goal**: Flatten the card-in-card nesting and reduce mono-eyebrow noise so hierarchy can carry weight.
- Outer section stays carded. The "Narrative loop" inner card (DspyPage.tsx:680) loses its border + shadow + rounded chrome and becomes open space with a heading.
- The supporting-proof aside (DspyPage.tsx:854) loses its outer card — signal cards sit directly on the section surface.
- The center card (DspyPage.tsx:793) should be a single composed unit, not two nested cards. Remove the inner "Current reveal step" mini card; inline that state into the main center surface.
- Cut the mono-uppercase eyebrow pattern from ~15 uses down to 2–3 (section-level only). Metric tiles ("Optimizer," "Training view," "Objective," "Example draft set") get label+value without an eyebrow.
### Step 3 — `/typeset`
**Goal**: The originality lever. Earn a point-of-view through typographic pairing.
- Pair a distinctive display face for section h2s with Geist Sans for body. Avoid the reflex-reject list (Fraunces, Inter, DM Sans, Instrument Serif, etc.) and avoid a second Geist variant. Candidates: a restrained technical serif (Söhne Breit, Signifier), a condensed grotesk, or a technical mono-adjacent display (Berkeley Mono) for just the two h2s.
- Collapse the type scale from ~9 sizes to 5 (e.g., 30, 22, 16, 13, 11) with ≥1.25 ratio between steps.
- Rebalance heading weight so the narrative, not the CTA, is the hero of the page.
### Step 4 — `/layout`
**Goal**: With the noise gone, decide whether the ring earns its place; give first-time viewers a clearer "this is what changed."
- Test three directions:
  - (A) Linearize to a horizontal "now → next" timeline where the 6 stages read left-to-right and the "candidate" is the payoff at the right edge.
  - (B) Keep the ring but visually dominate the "Live checkpoint" node on idle (larger, stronger color) and mute the other 5 until interacted.
  - (C) Keep the ring but make the center card (not a parallel node) the anchor, stripping surrounding card chrome.
- After the reveal, surface a plain-language "v2 vs v3: here's what changed and by how much" so Morgan (first-time demo viewer) can internalize the delta without math.
### Step 5 — `/colorize`
**Goal**: Fix the alpha-scaled pure-black neutrals so the palette stays perceptually cohesive.
- Swap the 4 `bg-black/...` instances (DspyPage.tsx:414, 425, 489, 814) to a tinted neutral: `bg-foreground/5` (inherits the tinted oklch foreground) or a defined token like `bg-muted/40`. Mirror the dark-mode variants.
- Audit the `text-muted-foreground/60` uses on eyebrows for WCAG 4.5:1 contrast on card surfaces; bump to `/80` where needed.
### Step 6 — `/polish`
**Goal**: Final pass. Unify scales and close the loose ends.
- Unify the radii scale: drop from ~8 values (`32, 28, 24, 22, 2xl, lg, md, full`) to 3–4 consistent values.
- Fix the ASCII `->` → Unicode `→` in `formatRate` (DspyPage.tsx:404).
- Demote the bottom slogan pill ("Human judgment informs the loop. Metrics decide what ships.") to a caption — it isn't clickable and shouldn't look like it is.
- Resolve the disabled-CTA state shift: single solid color for both states, let the spinner carry the state change.
- Expose the real v1/v2 prompt text on the checkpoint cards (`v1Snapshot` / `v2Snapshot` are already loaded and unused) so "inspectable evidence" is delivered, not implied.
## Verification
After each step, re-run `/critique` — the score should move up, especially on Aesthetic and Minimalist Design (currently 2) and Consistency (currently 3). Target totals:
- After Step 1 (`/quieter`): +2 on heuristic 8.
- After Step 2 (`/distill`): +1 on heuristics 6 and 8.
- After Step 3 (`/typeset`): +1 on heuristic 8, improves overall aesthetic coherence.
- After Step 4 (`/layout`): +1 on heuristics 6 and 7.
- After Step 5 (`/colorize`): consistency of palette.
- After Step 6 (`/polish`): +1 on heuristic 4.
Expected landing score: low-to-mid 30s / 40.
