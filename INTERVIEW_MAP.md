# Interview Map: Vercel_SDR

This repo is a thin Next.js shell around an outbound-personalization pipeline. For live coding, treat it as a product app with one main UI shell and one core pipeline seam.

## 1) Fast Orientation

- Entrypoint: `app/page.tsx` -> `components/features/SDRWorkspace.tsx`
- Product surfaces:
  - `components/features/QueueList.tsx`
  - `components/features/DetailPanel.tsx`
  - `components/features/LiveAgentDemo.tsx`
  - `components/features/AnalyticsPage.tsx`
  - `components/features/DspyPage.tsx`
- Domain model: `lib/types.ts`
- InstantDB record mapping: `lib/jobs/instant-job-codec.ts`

## 2) Runtime Path (Canonical)

Use this path when explaining "real behavior":

1. UI sends input through route/action.
2. Pipeline stages run in `lib/pipeline/execution-core.ts`.
3. Sequential orchestration in `lib/pipeline/run-job.ts` or streamed tool orchestration in `lib/pipeline/pipeline-agent.ts`.
4. Writes persist through `lib/pipeline/persistence.ts`.
5. Review UI reads from InstantDB via `lib/instant-db.ts` + `db.useQuery`.

Key routes:

- `app/api/jobs/stream/route.ts` (live streamed pipeline demo)
- `app/api/jobs/run/route.ts` (direct sequential run)
- `app/actions/queue-pipeline.ts` + `workflows/outbound-pipeline/*` (durable workflow path)

## 3) Demo / Fixture Path (Intentional)

These files are fixture-backed and interview-oriented:

- `lib/analytics-mock.ts`
- `lib/synthetic-data.ts`
- `lib/pipeline/prompt-artifacts.ts`
- `app/api/reset-demo/route.ts`
- `lib/db/seeds/*`

Keep this boundary explicit in live sessions: runtime persistence is InstantDB-backed; some analytics/DSPy/demo panels intentionally read local fixtures.

## 4) Where To Add A Feature Quickly

Use this as the default implementation story in live coding:

`SDRWorkspace -> feature component -> hook/state -> API route -> lib/pipeline -> persistence`

Start from one of these seams depending on feature type:

- UI behavior: `components/features/*` (+ `components/features/detail/*`)
- Shared state or orchestration: `lib/hooks/*`
- Validation/type changes: `lib/types.ts` and `lib/pipeline/schemas.ts`
- Pipeline behavior: `lib/pipeline/execution-core.ts` + stage file
- Persistence behavior: `lib/pipeline/persistence.ts` + codec/schema

## 5) Tradeoff Language (Interview Friendly)

- Streamed demo path (`/api/jobs/stream`) is best for visibility and step-by-step explanation.
- Workflow path (`workflows/outbound-pipeline/*`) is best for durability/retries/background execution.
- Use the streamed path for most live feature additions unless the feature is explicitly about scheduled or durable runs.
