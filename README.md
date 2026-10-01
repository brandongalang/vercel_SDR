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

- All five model roles start with OpenRouter `stealth/space-bunny-alpha`. The selected
  free fallback order is `inclusionai/ling-3.0-flash-sante:free`,
  `nvidia/nemotron-3-ultra-550b-a55b:free`, then
  `thinkingmachines/inkling:free`. Every attempt pins its model and zero-price
  provider limits; provider routing, plugins, and paid model overrides are disabled.
  Recoverable connection/provider failures (404/408/429/500/502/503/504) and invalid
  structured output advance to the next eligible model. Authentication, billing,
  invalid requests, content filtering, and cancellation stop immediately. An
  exhausted chain is not retried by the SDK.
- Live leads can fall back to free Ling through a provider that does not train on
  prompts (`data_collection: deny`). Space Bunny uses the same no-training routing.
  Space Bunny is a free preview scheduled to retire October 5, 2026; Ling remains
  the live-eligible backup after that endpoint becomes unavailable. Each model step
  has a 60-second deadline, including its response body. When Space Bunny times out or returns a recoverable provider
  error, all roles share a five-minute cooldown before trying it again.
  **Nemotron and Inkling fallback for live leads is blocked.** Both forbid personal
  or confidential data, and Inkling additionally requires an agentic harness.
  Current live prompts include lead names, CRM notes, and external search results;
  even a synthetic lead can acquire personal data through search. Those paths use
  Space Bunny and Ling and fail closed when restricted fallback would be needed.
  No request flag or environment variable bypasses this boundary. A trusted server-side synthetic
  fixture harness can use `createPipelineModel({ fallbackDataPolicy:
  "synthetic-nonpersonal", agenticHarness: true })` only when **all** prompt content,
  tool inputs/outputs, notes, and prior messages are nonpersonal/nonconfidential.
  The existing tests exercise this chain with synthetic fixtures and mocked tools.
- Space Bunny and the fallback endpoints receive a JSON schema prompt followed by
  mandatory local schema validation. Space Bunny also uses native JSON-object mode
  and low reasoning effort to keep the prototype responsive.
  A complete JSON Markdown fence is removed before validation; surrounding prose,
  invalid JSON, and schema mismatches remain errors.
  Streaming buffers one model step before publishing text or tool calls, allowing
  fallback without executing failed tool calls or replaying completed agent steps.
  This trades token-by-token display for validated step delivery.
  Official model/terms references: [Space Bunny](https://openrouter.ai/stealth/space-bunny-alpha),
  [Ling](https://openrouter.ai/inclusionai/ling-3.0-flash-sante:free),
  [Nemotron](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free),
  [Inkling](https://openrouter.ai/thinkingmachines/inkling:free),
  [capability catalog](https://openrouter.ai/api/v1/models).
- Web search uses Tavily basic search on its free Researcher plan. A shared quota check
  verifies account usage, zero paid usage, and a capped API key within the remaining
  free account allowance. It caches that approval for ten minutes to respect Tavily's
  usage-endpoint rate limit, reserving one credit before each basic search. The API
  key's hard cap still applies across processes. The pay-as-you-go limit can be `0`
  or `null` (the response observed with pay-as-you-go disabled); positive or missing limits are rejected.
  Keep pay-as-you-go disabled in the account dashboard. Missing configuration,
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
