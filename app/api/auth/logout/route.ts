import { isSameOrigin, PRIVATE_HEADERS, sessionCookie } from "@/lib/server/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, new URL(request.url).origin)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403, headers: PRIVATE_HEADERS });
  }
  return Response.json({ ok: true }, { headers: { ...PRIVATE_HEADERS, "Set-Cookie": sessionCookie("", 0) } });
}
