# SDR feedback capture for GEPA optimization

**Status:** Scoped, not implemented
**Last updated:** 2026-04-21

## Goal

Capture enough structured rep feedback from the review surface that we can:

- distinguish clean accepts from edits, skips, and regenerate attempts
- preserve the rep's textual reasoning instead of flattening it to one note field
- export finalized examples and negative examples into an offline GEPA-friendly dataset

This scope is intentionally anchored to the current review flow, not an idealized redesign.

## Current state in the app

### What we already capture

- Approve writes `feedback: { edited, editorNote }` onto the job when the rep sends the draft.
- `edited` is inferred from whether the current draft differs from the baseline draft.
- Regenerate supports preset-based adjustments plus an optional freeform note.
- The dataset export already emits `cleanAccept`, `edited`, `editorNote`, and reply labels.

### Current gaps

1. Skip has no reason capture at all.
2. Regenerate feedback is only preserved as a summarized local note before approval.
3. We do not retain the original draft alongside the rep-finalized draft in exported rows.
4. We do not log the sequence of rep actions, so GEPA cannot distinguish:
   - immediate skip
   - regenerate then skip
   - multiple regenerations before approve
   - direct manual rewrite with no regenerate
5. The current dataset is approval-only; skipped drafts are effectively invisible to optimization.

## Evidence in code

- Approval stores only `edited` plus `editorNote` in [lib/hooks/use-job-actions.ts](/Users/brandongalang/Documents/Vercel_SDR/lib/hooks/use-job-actions.ts:21).
- Skip only marks the job reviewed and timestamps it in [lib/hooks/use-job-actions.ts](/Users/brandongalang/Documents/Vercel_SDR/lib/hooks/use-job-actions.ts:46).
- Regenerate note/preset state currently lives in component state and only becomes a summarized note on `Use this draft` in [components/features/detail/RegenerationWorkspace.tsx](/Users/brandongalang/Documents/Vercel_SDR/components/features/detail/RegenerationWorkspace.tsx:41) and [components/features/detail/RegenerationWorkspace.tsx](/Users/brandongalang/Documents/Vercel_SDR/components/features/detail/RegenerationWorkspace.tsx:129).
- The exported DSPy dataset currently only includes one final draft plus a thin label set in [scripts/export-dspy-dataset.ts](/Users/brandongalang/Documents/Vercel_SDR/scripts/export-dspy-dataset.ts:102).

## Proposed feedback model

Add two complementary layers:

### 1. Job-level summary labels

Keep a normalized summary on the job for analytics and simple filtering:

```ts
feedback?: {
  decision: "approved_clean" | "approved_edited" | "skipped";
  editorNote?: string;
  skipReason?: string;
  skipCategory?: "bad_signal" | "bad_angle" | "bad_draft" | "wrong_person" | "not_sendable" | "other";
  positiveReply?: boolean | null;
  regenerateCount?: number;
  editedFromOriginal?: boolean;
}
```

Why:

- `decision` removes the need to infer terminal label shape downstream.
- `skipCategory` gives us a low-cardinality training signal for negative examples.
- `regenerateCount` is a useful friction feature for both analytics and sampling.
- `editedFromOriginal` preserves the current business metric without re-diffing later.

### 2. Review event history

Store the richer supervision as append-only review events on the job:

```ts
reviewEvents: Array<
  | {
      type: "regenerate_requested";
      at: string;
      presets: string[];
      note?: string;
      sourceDraft: { subject: string; body: string };
    }
  | {
      type: "regenerate_applied";
      at: string;
      presets: string[];
      note?: string;
      sourceDraft: { subject: string; body: string };
      resultDraft: { subject: string; body: string };
    }
  | {
      type: "draft_edited";
      at: string;
      source: "manual" | "regenerate";
      before: { subject: string; body: string };
      after: { subject: string; body: string };
    }
  | {
      type: "decision";
      at: string;
      decision: "approved_clean" | "approved_edited" | "skipped";
      note?: string;
      skipCategory?: string;
    }
>;
```

Why:

- GEPA benefits from textual criticism tied to concrete failures, not just final binary labels.
- We need the original draft, final draft, and rep rationale together if we want to build teacher-style reflection prompts.
- This gives us a clean path to future judge prompts like: "Given original draft, rep edits, and skip reason, what policy should change?"

## UX scope

### Approve clean

No additional friction.

- Keep one-click approve when the draft is unchanged.
- Optionally allow an inline "why this worked" note later, but do not make it required.

### Approve with edits

When the draft differs from baseline:

- require either:
  - a short freeform note, or
  - a structured reason chip plus optional note

Suggested structured edit reasons:

- `tone`
- `specificity`
- `cta`
- `accuracy`
- `length`
- `personalization`

This keeps the UI fast while still producing useful textual supervision.

### Skip

Intercept skip with a lightweight sheet:

- one required category chip
- one optional freeform explanation
- one optional "save example for training" toggle that defaults on for now in internal use

Suggested skip categories:

- Bad signal
- Wrong angle
- Wrong person
- Unsalvageable draft
- Not worth sending
- Other

This is the most important missing piece in the current system.

### Regenerate

Preserve more than the summarized note:

- log the selected presets verbatim
- log the freeform note verbatim
- log the source draft and resulting draft when the rep applies the regeneration

If the rep previews but never applies, we can ignore that in v1 unless we want exploration analytics.

## Minimum implementation plan

### Phase 1: Capture high-value labels

1. Extend `OutboundJob.feedback` to include `decision`, `skipCategory`, `skipReason`, `regenerateCount`, and `editedFromOriginal`.
2. Add skip-reason capture to the review UI.
3. Preserve regenerate presets + note on approval instead of only the summarized text.
4. Export skipped jobs as negative examples in `scripts/export-dspy-dataset.ts`.

This is the smallest useful step.

### Phase 2: Preserve rich supervision

1. Add `reviewEvents` to the stored job shape.
2. Append events for regenerate applied, manual edits, approve, and skip.
3. Export:
   - original model draft
   - final rep draft if approved
   - review event sequence
   - textual notes

This is the step that makes GEPA reflection materially stronger.

### Phase 3: Use feedback in optimization

Create two offline dataset views:

- `approved_examples`
  - positive examples with original draft, final draft, and edit rationale
- `rejected_examples`
  - skipped drafts with skip category and explanation

Likely GEPA usage:

- original draft + signals + review note -> teacher critique
- teacher critique + accepted final draft -> policy revision candidate
- skipped draft + skip rationale -> negative constraint / anti-pattern examples

## Export shape recommendation

Expand the current dataset row from a single finalized label row to a richer supervision row:

```ts
{
  id,
  promptVersions,
  angleType,
  leadInput,
  signals,
  originalDraft: { subject, body },
  finalDraft: { subject, body } | null,
  feedback: {
    decision,
    editedFromOriginal,
    regenerateCount,
    editReasons?: string[],
    editorNote?: string | null,
    skipCategory?: string | null,
    skipReason?: string | null,
  },
  reviewEvents: [...],
  outcome: {
    replied: boolean | null,
    positiveReply: boolean | null,
  }
}
```

Important:

- `originalDraft` should be the model-produced draft before rep changes.
- `finalDraft` should be null for skipped jobs.
- `reviewEvents` should remain ordered so offline transforms can derive multiple training views.

## How this maps to GEPA specifically

GEPA is a better fit once we have human language explaining failure modes.

Without richer feedback, we mostly have:

- clean accept
- edited
- one thin note

With the proposed capture, we can build reflection prompts like:

- "The rep skipped this because the signal was weak and the person was wrong. What policy change would prevent similar drafts?"
- "The rep rewrote the CTA and removed generic language. What instruction update would cause the model to produce that version directly?"
- "Across these 20 skipped jobs tagged `wrong_angle`, what recurring planning mistake shows up?"

That is much closer to the supervision GEPA can use well than a binary clean/edited label alone.

## Recommended sequencing

If we want the fastest path to signal:

1. implement skip reason capture
2. persist raw regenerate presets + note
3. preserve original draft alongside final draft
4. expand the export script
5. only then invest in GEPA teacher prompts

If we skip those steps, we risk building a GEPA loop on top of labels that are too thin to improve drafts in a targeted way.
