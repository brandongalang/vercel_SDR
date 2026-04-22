# Vercel SDR Prototype

Interview-oriented outbound personalization prototype. The app is a thin Next.js shell around a staged pipeline that generates personalized drafts and persists review jobs in InstantDB.

## Start Here

- Repo map for live coding: `INTERVIEW_MAP.md`
- Agent/session guidance: `AGENTS.md`
- App entrypoint: `app/page.tsx` -> `components/features/SDRWorkspace.tsx`

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Runtime vs Demo Data

- Runtime pipeline writes to InstantDB through `lib/pipeline/persistence.ts`.
- Review UI reads live jobs via `db.useQuery` in `components/features/SDRWorkspace.tsx`.
- Some interview/demo surfaces intentionally use local fixture artifacts:
  - `lib/analytics-mock.ts`
  - `lib/synthetic-data.ts`
  - `lib/pipeline/prompt-artifacts.ts`
  - `app/api/reset-demo/route.ts`

## Main Paths

- Streamed live pipeline: `app/api/jobs/stream/route.ts`
- Direct sequential run: `app/api/jobs/run/route.ts`
- Durable workflow run: `app/actions/queue-pipeline.ts` + `workflows/outbound-pipeline/*`

## Scripts

- `npm run dev`: local development
- `npm run build`: production build check
- `npm run start`: run built app
- `npm run lint`: linting
