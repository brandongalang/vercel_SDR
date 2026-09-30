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

Set `NEXT_PUBLIC_INSTANT_APP_ID`, `INSTANT_ADMIN_TOKEN`, `OPENROUTER_API_KEY`,
`TAVILY_API_KEY`, `APP_PASSWORD`, and `APP_SESSION_SECRET` through local environment
variables or the existing Vercel project's environment settings. The owner must enter
secret values directly in the secure settings UI. Use an independent random session
secret of at least 32 bytes. No credentials belong in source control or chat.

## Free Runtime Providers

- All five model roles use OpenRouter `qwen/qwen3.8-27b:free`, with zero-price provider
  limits and structured output validation. No secondary model is configured.
- Web search uses Tavily basic search on its free Researcher plan. Every request checks
  account usage and requires pay-as-you-go to be disabled. Missing configuration,
  unknown billing state, or exhausted quota stops search. Exa and Vertex search are absent.
- The public prototype requires its shared password. Sessions are signed, expire after
  eight hours, and use HttpOnly/Secure/SameSite=Strict cookies. Changing either password
  or session secret invalidates sessions. Every API and server action checks access;
  mutations also check origin. Missing configuration closes the workspace before any
  database or model request. Keep Vercel Authentication on preview deployments.
- `instant.perms.ts` denies direct client access only to `jobs` and `pipelineRuns`.
  Apply these rules before opening the workspace. Existing direct clients of those
  namespaces will need the server route; other namespace permissions are unchanged.
- Login allows five attempts per 15 minutes per process. This is appropriate defense
  for this small shared prototype; serverless scaling can reset or multiply counters.
  No paid WAF, new sign-in provider, or new rate-limit service is configured.

## Runtime vs Demo Data

- Runtime pipeline writes to InstantDB through `lib/pipeline/persistence.ts`.
- Review UI polls authenticated `/api/jobs`; job edits use its validated server-only
  mutation route. The browser no longer connects directly to InstantDB.
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
- `npm test`: synthetic pipeline, free-only routing/search, signed sessions, access
  boundaries, and server-mediated job operations (Node 24+; no live service calls)
