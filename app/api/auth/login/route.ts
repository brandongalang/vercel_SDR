import { createLoginLimiter, createSession, isWorkspaceConfigured, isSameOrigin, passwordMatches, PRIVATE_HEADERS, sessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowAttempt = createLoginLimiter();

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, new URL(request.url).origin)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403, headers: PRIVATE_HEADERS });
  }
  if (!isWorkspaceConfigured()) return Response.json({ error: "Workspace setup is pending" }, { status: 503, headers: PRIVATE_HEADERS });
  if (!allowAttempt(request.headers)) return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": "900" } });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  try {
    // Limit the payload without ever logging or returning it.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Invalid request");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); throw new Error("Invalid request"); }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const password = typeof body === "object" && body !== null && "password" in body ? body.password : undefined;
    if (typeof password !== "string" || !passwordMatches(password)) {
      return Response.json({ error: "Incorrect password" }, { status: 401, headers: PRIVATE_HEADERS });
    }
    return Response.json({ ok: true }, { headers: { ...PRIVATE_HEADERS, "Set-Cookie": sessionCookie(createSession()) } });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
}
