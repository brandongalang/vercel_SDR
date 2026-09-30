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

Set `NEXT_PUBLIC_INSTANT_APP_ID`, `INSTANT_ADMIN_TOKEN`, `OPENROUTER_API_KEY`, and
`TAVILY_API_KEY` through local environment variables or the existing Vercel project's
environment settings. Secret values belong in the provider's secure settings UI.

## Free Runtime Providers

- All five model roles use OpenRouter `qwen/qwen3.8-27b:free`, with zero-price provider
  limits and structured output validation. No secondary model is configured.
- Web search uses Tavily basic search on its free Researcher plan. Every request checks
  account usage and requires pay-as-you-go to be disabled. Missing configuration,
  unknown billing state, or exhausted quota stops search. Exa and Vertex search are absent.
- Keep the existing Vercel login protection enabled. The prototype has no application
  sign-in, and InstantDB permission rules must be inspected before publishing its data.

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
- `npm test`: mocked provider, structured output, and free-search checks (Node 24+)
