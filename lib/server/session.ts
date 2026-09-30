import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "__Host-sdr_session";
export const SESSION_SECONDS = 8 * 60 * 60;
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function configuration() {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.APP_SESSION_SECRET;
  return password && secret && Buffer.byteLength(secret) >= 32 ? { password, secret } : null;
}

export function isGateConfigured() {
  return configuration() !== null;
}

export function isWorkspaceConfigured() {
  return isGateConfigured() && ["NEXT_PUBLIC_INSTANT_APP_ID", "INSTANT_ADMIN_TOKEN", "OPENROUTER_API_KEY", "TAVILY_API_KEY"]
    .every(name => Boolean(process.env[name]?.trim()));
}

export function passwordMatches(provided: string) {
  const config = configuration();
  if (!config) return false;
  // Fixed-length digests keep comparison constant-time even for different lengths.
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(config.password).digest(),
  );
}

function signature(payload: string, secret: string, password: string) {
  // Changing either server secret invalidates every outstanding session.
  const key = createHmac("sha256", secret).update("sdr-session-v1\0").update(password).digest();
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSession(now = Date.now()) {
  const config = configuration();
  if (!config) throw new Error("Access is not configured");
  const issued = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, iat: issued, exp: issued + SESSION_SECONDS, nonce: randomBytes(24).toString("base64url") })).toString("base64url");
  return `${payload}.${signature(payload, config.secret, config.password)}`;
}

export function verifySession(token: string | undefined, now = Date.now()) {
  const config = configuration();
  if (!config || !token || token.length > 1024) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  const expected = signature(parts[0], config.secret, config.password);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))) return false;
  try {
    const claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const current = Math.floor(now / 1000);
    return claims.v === 1 && Number.isInteger(claims.iat) && Number.isInteger(claims.exp)
      && claims.iat <= current && claims.exp > current && claims.exp - claims.iat === SESSION_SECONDS
      && typeof claims.nonce === "string" && /^[A-Za-z0-9_-]{32}$/.test(claims.nonce);
  } catch { return false; }
}

export function getSessionCookie(headers: Headers) {
  const matches = (headers.get("cookie") ?? "").split(";").map(value => value.trim())
    .filter(value => value.startsWith(`${SESSION_COOKIE}=`));
  // Reject duplicate cookies instead of depending on ambiguous ordering.
  return matches.length === 1 ? matches[0].slice(SESSION_COOKIE.length + 1) : undefined;
}

export function sessionCookie(token: string, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function isSameOrigin(headers: Headers, origin: string) {
  if (headers.get("sec-fetch-site") === "cross-site") return false;
  try { return new URL(headers.get("origin") ?? "").origin === origin; }
  catch { return false; }
}

export function authorizeRequest(request: Request) {
  if (!isWorkspaceConfigured()) return Response.json({ error: "Workspace setup is pending" }, { status: 503, headers: PRIVATE_HEADERS });
  if (!verifySession(getSessionCookie(request.headers))) return Response.json({ error: "Password required" }, { status: 401, headers: PRIVATE_HEADERS });
  if (!["GET", "HEAD"].includes(request.method) && !isSameOrigin(request.headers, new URL(request.url).origin)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403, headers: PRIVATE_HEADERS });
  }
  return null;
}

// Per-process protection for this prototype. On Vercel the platform overwrites
// x-forwarded-for; across scaled instances this is defense-in-depth, not a WAF.
export function createLoginLimiter() {
  const attempts = new Map<string, { count: number; until: number }>();
  return (headers: Headers, now = Date.now()) => {
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const client = process.env.VERCEL === "1" ? headers.get("x-forwarded-for") ?? "unknown" : "local";
    const key = createHash("sha256").update(client).digest("hex");
    const previous = attempts.get(key);
    // Bound memory and fail closed instead of dropping active counters.
    if (!previous && attempts.size >= 10000) return false;
    const entry = previous ?? { count: 0, until: now + 15 * 60 * 1000 };
    entry.count += 1;
    attempts.set(key, entry);
    return entry.count <= 5;
  };
}
