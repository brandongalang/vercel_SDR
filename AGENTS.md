<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Guidance

This repo is an interview prototype and a thin Next.js shell around an outbound-personalization pipeline. Optimize for clarity, speakability, and fast feature iteration over framework purity.

## Live Coding Session Guidance

When helping in a live AI coding or pair-coding session:

- Start by grounding the user in the repo shape before proposing changes.
- Proactively surface the likely files to touch for the requested feature instead of only speaking abstractly.
- Explain architecture and tradeoffs in a compact, interview-friendly way: what owns the UI, what owns the pipeline, what owns persistence, and whether a change is demo-only or part of the real runtime path.
- Prefer the smallest change that is easy to explain out loud.
- Avoid broad refactors unless they materially reduce risk for the feature being built right now.
- If a request has more than one plausible implementation path, briefly name the options, recommend one, and explain why.
- Make it easy for the user to narrate ownership: "this file is the screen", "this file is the state/orchestration seam", "this file is the pipeline stage", "this file is the persistence seam".

## Canonical Repo Map

Use these files as the default orientation points when explaining the codebase:

- `app/page.tsx`: app entrypoint; renders the main workspace.
- `components/features/SDRWorkspace.tsx`: top-level product shell for the review, analytics, DSPy, and live-agent surfaces.
- `components/features/QueueList.tsx`: review queue and history list UI.
- `components/features/DetailPanel.tsx` and `components/features/detail/*`: draft review, angle/context display, and regenerate flow.
- `components/features/LiveAgentDemo.tsx`: live streamed demo surface for the pipeline.
- `lib/types.ts`: canonical nouns and data model.
- `lib/jobs/instant-job-codec.ts`: mapping between InstantDB records and the app's domain model.
- `lib/pipeline/run-job.ts`: clearest sequential view of the full pipeline.
- `lib/pipeline/execution-core.ts`: stage ownership and shared pipeline state.
- `lib/pipeline/pipeline-agent.ts`: streamed tool-based pipeline path for the live demo.
- `lib/pipeline/persistence.ts`: persistence seam for jobs and pipeline runs.
- `app/api/jobs/stream/route.ts`: live streaming API path.
- `app/api/jobs/run/route.ts`: direct sequential run path.
- `app/actions/queue-pipeline.ts` and `workflows/outbound-pipeline/*`: durable workflow path.

## How To Frame Feature Additions

When discussing or implementing a new feature, first classify it into one or more of these buckets:

- UI surface change
- State/orchestration change
- Domain model change
- Pipeline stage change
- Persistence/schema change
- Demo-only / fixture-only change

Then name the most likely files in each bucket before editing.

## Preferred Explanation Style

For interview-oriented conversations:

- Lead with the user-facing goal and where it lives in the code.
- Then explain the data flow from UI -> route/action -> pipeline logic -> persistence.
- Call out tradeoffs explicitly when relevant, especially if there is a choice between the streamed demo path and the durable workflow path.
- Default to one canonical implementation story rather than describing every possible path in the repo.

## Preferred Change Strategy

- For most live feature work, treat `SDRWorkspace -> feature component -> hook/state -> API route -> lib/pipeline -> persistence` as the canonical path.
- De-emphasize the workflow path unless the feature is explicitly about durable background execution.
- Keep demo fixtures and production-ish runtime changes conceptually separate and say which side you are touching.
- If the app is using local fixture artifacts for a surface, say that plainly instead of implying it is fully live-backed.
