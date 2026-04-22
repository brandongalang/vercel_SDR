<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Guidance

This repo is an interview prototype: a thin Next.js shell around an outbound-personalization pipeline. Optimize for clarity, speakability, and fast feature iteration over framework purity.

## Interview Mode

When helping in a live coding session:

- Start with the user-facing goal, not the implementation.
- Quickly ground the user in the repo shape before proposing changes.
- Name the likely files to touch before editing.
- Prefer the smallest change that is easy to explain out loud.
- Default to one canonical implementation story instead of describing every possible path.
- Make it easy for the user to say: "this is the screen", "this is the state seam", "this is the pipeline owner", "this is the persistence seam".

## Fast Repo Map

Open these first:

- `app/page.tsx`: entrypoint; renders `SDRWorkspace`.
- `components/features/SDRWorkspace.tsx`: top-level screen coordinator for review, analytics, GEPA, and live-agent views.
- `components/features/QueueList.tsx`: review queue/history rail.
- `components/features/DetailPanel.tsx`: draft review, edit, regenerate, approve, skip.
- `components/features/LiveAgentDemo.tsx`: streamed live pipeline demo.
- `lib/types.ts`: canonical nouns and shared model.
- `lib/jobs/instant-job-codec.ts`: InstantDB record <-> `OutboundJob` mapper.
- `lib/pipeline/run-job.ts`: clearest sequential pipeline story.
- `lib/pipeline/execution-core.ts`: stage ownership and shared pipeline state.
- `lib/pipeline/pipeline-agent.ts`: streamed tool-based pipeline path.
- `lib/pipeline/persistence.ts`: jobs + pipeline runs persistence seam.
- `app/api/jobs/stream/route.ts`: live streaming route.
- `app/api/jobs/run/route.ts`: direct sequential route.
- `app/actions/queue-pipeline.ts` and `workflows/outbound-pipeline/*`: durable workflow path.

## Canonical Story

For most live feature work, tell the story in this order:

1. User-facing goal
2. Screen / surface
3. State or orchestration seam
4. Route or action
5. Pipeline logic
6. Persistence

Default implementation path:

`SDRWorkspace -> feature component -> hook/state -> API route -> lib/pipeline -> persistence`

De-emphasize the workflow path unless the feature is explicitly about durable background execution.

## Feature Placement

Classify a feature into one or more of these buckets before editing:

- UI surface change
- State/orchestration change
- Domain model change
- Pipeline stage change
- Persistence/schema change
- Demo-only / fixture-only change

Then name the most likely files in each bucket.

## Response Style

For interview-facing output:

- Lead with what the feature does for the SDR.
- Then explain where it lives in the code.
- Call out tradeoffs briefly and explicitly.
- Prefer a few concrete file references over a broad file dump.
- Say plainly when something is demo-only, fixture-backed, or not yet wired into the real runtime path.

## Avoid

- Do not lead with broad validation-gate ideas; that muddles the DSPy story and creates a second optimization target.
- Do not equate "better interview answer" with "show more data"; prefer understandability over surface area.
- Do not reach for broad refactors unless they materially reduce risk for the feature being built right now.
