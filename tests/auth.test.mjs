import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context);
  },
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = resolve(specifier.slice(2));
      const path = [`${base}.ts`, `${base}.tsx`, base].find(existsSync);
      if (!path) throw new Error(`Missing test import: ${specifier}`);
      return nextResolve(pathToFileURL(path).href, path.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context);
    }
    if (specifier.startsWith(".") && context.parentURL && existsSync(new URL(`${specifier}.ts`, context.parentURL))) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

// Isolated test-process values only; no real credentials or provider requests.
process.env.APP_PASSWORD = "synthetic-password-for-test";
process.env.APP_SESSION_SECRET = "synthetic-session-secret-for-tests-only";
process.env.NEXT_PUBLIC_INSTANT_APP_ID = "00000000-0000-4000-8000-000000000000";
process.env.INSTANT_ADMIN_TOKEN = "synthetic-test-key";
process.env.OPENROUTER_API_KEY = "synthetic-test-key";
process.env.TAVILY_API_KEY = "synthetic-test-key";

const session = await import("../lib/server/session.ts");
const origin = "https://prototype.example";
const request = (path, options = {}, token = session.createSession()) => new Request(`${origin}${path}`, {
  ...options,
  headers: { cookie: `${session.SESSION_COOKIE}=${token}`, origin, "content-type": "application/json", ...options.headers },
});

test("sessions are signed, expire, reject tampering and rotate with either credential", () => {
  const token = session.createSession(1000000);
  assert.equal(session.verifySession(token, 1000000), true);
  assert.equal(session.verifySession(token, 999000), false);
  assert.equal(session.verifySession(token, 1000000 + session.SESSION_SECONDS * 1000), false);
  assert.equal(session.verifySession(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), 1000000), false);
  assert.equal(session.verifySession(`${token}.extra`, 1000000), false);
  const previousPassword = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = "rotated-synthetic-password";
  assert.equal(session.verifySession(token, 1000000), false);
  process.env.APP_PASSWORD = previousPassword;
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = "rotated-synthetic-session-secret-test-only";
  assert.equal(session.verifySession(token, 1000000), false);
  process.env.APP_SESSION_SECRET = previousSecret;
  assert.equal(session.passwordMatches(previousPassword), true);
  assert.equal(session.passwordMatches("incorrect"), false);
  assert.match(session.sessionCookie(token), /^__Host-sdr_session=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) assert.ok(session.sessionCookie(token).includes(flag));
});

test("missing configuration, unsigned requests and cross-origin writes fail closed", async () => {
  const missing = process.env.INSTANT_ADMIN_TOKEN;
  delete process.env.INSTANT_ADMIN_TOKEN;
  assert.equal(session.isWorkspaceConfigured(), false);
  assert.equal(session.authorizeRequest(request("/api/jobs")).status, 503);
  process.env.INSTANT_ADMIN_TOKEN = missing;
  assert.equal(session.authorizeRequest(new Request(`${origin}/api/jobs`)).status, 401);
  assert.equal(session.authorizeRequest(request("/api/jobs", { method: "PATCH", headers: { origin: "https://attacker.example" } })).status, 403);
  assert.equal(session.authorizeRequest(request("/api/jobs", { method: "PATCH", headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal(session.authorizeRequest(request("/api/jobs", { method: "PATCH" })), null);
  const duplicate = new Headers({ cookie: `${session.SESSION_COOKIE}=a; ${session.SESSION_COOKIE}=b` });
  assert.equal(session.getSessionCookie(duplicate), undefined);
});

test("login never reflects passwords; session cookie, CSRF, logout and rate limit work", async () => {
  const { POST: login } = await import("../app/api/auth/login/route.ts");
  const { POST: logout } = await import("../app/api/auth/logout/route.ts");
  const crossSite = await login(request("/api/auth/login", { method: "POST", headers: { origin: "https://attacker.example" }, body: JSON.stringify({ password: process.env.APP_PASSWORD }) }));
  assert.equal(crossSite.status, 403);
  const bad = await login(request("/api/auth/login", { method: "POST", body: JSON.stringify({ password: "wrong" }) }));
  assert.equal(bad.status, 401);
  assert.equal((await bad.text()).includes("wrong"), false);
  const good = await login(request("/api/auth/login", { method: "POST", body: JSON.stringify({ password: process.env.APP_PASSWORD }) }));
  assert.equal(good.status, 200);
  assert.equal(await good.text(), '{"ok":true}');
  assert.match(good.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Strict/);
  const logOut = await logout(request("/api/auth/logout", { method: "POST" }));
  assert.match(logOut.headers.get("set-cookie"), /Max-Age=0/);
  const limiter = session.createLoginLimiter();
  for (let attempt = 0; attempt < 5; attempt++) assert.equal(limiter(new Headers(), 0), true);
  assert.equal(limiter(new Headers(), 0), false);
  assert.equal(limiter(new Headers(), 15 * 60 * 1000), true);
});

test("all existing HTTP operations reject unauthenticated requests before any service call", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No network allowed in auth test"); };
  try {
    const routes = [
      ["run", "POST"], ["stream", "POST"], ["regenerate", "POST"],
      ["workflow", "POST"], ["workflow/status", "GET"],
    ];
    for (const [name, method] of routes) {
      const route = await import(`../app/api/jobs/${name}/route.ts`);
      const response = await route[method](new Request(`${origin}/api/jobs/${name}`, { method }));
      assert.equal(response.status, 401, name);
    }
    const reset = await import("../app/api/reset-demo/route.ts");
    assert.equal((await reset.POST(new Request(`${origin}/api/reset-demo`, { method: "POST" }))).status, 401);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("protected job routes use only the server seam, validate commands and never send email", async () => {
  const { createJobsHandlers } = await import("../lib/server/jobs.ts");
  const jobId = "00000000-0000-4000-8000-000000000001";
  const records = [{ id: jobId, status: "pending_review", createdAt: 1, leadName: "Synthetic Person", company: "Synthetic Company" }];
  const updates = [];
  let reads = 0;
  const fake = () => ({
    query: async () => { reads++; return { jobs: records }; },
    tx: { jobs: { [jobId]: { update: update => update } } },
    transact: async update => { updates.push(update); },
  });
  const routes = createJobsHandlers(fake);
  assert.equal((await routes.GET(new Request(`${origin}/api/jobs`))).status, 401);
  assert.equal(reads, 0);
  const response = await routes.GET(request("/api/jobs"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).jobs[0].lead.name, "Synthetic Person");
  const write = body => routes.PATCH(request("/api/jobs", { method: "PATCH", body: JSON.stringify(body) }));
  assert.equal((await write({ action: "draft", jobId, subject: "Synthetic subject", body: "Synthetic draft" })).status, 200);
  assert.equal(updates[0].draftBody, "Synthetic draft");
  assert.equal((await write({ action: "approve", jobId, subject: "Synthetic subject", body: "Synthetic draft", edited: false })).status, 200);
  assert.equal(updates[1].status, "sent_stub");
  assert.equal((await write({ action: "delete", jobId })).status, 400);
  assert.equal((await write({ action: "draft", jobId, subject: "x", body: "x", status: "sent_stub" })).status, 400);
  assert.equal(updates.length, 2);
  records[0].status = "reviewed";
  assert.equal((await write({ action: "archive", jobId })).status, 409);
  assert.equal(updates.length, 2);
});
