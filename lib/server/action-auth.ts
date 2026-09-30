import "server-only";
import { cookies, headers } from "next/headers";
import { isWorkspaceConfigured, isSameOrigin, SESSION_COOKIE, verifySession } from "@/lib/server/session";

export async function requireActionSession() {
  if (!isWorkspaceConfigured() || !verifySession((await cookies()).get(SESSION_COOKIE)?.value)) {
    throw new Error("Password required");
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = process.env.VERCEL === "1" ? "https" : "http";
  if (!host || !isSameOrigin(new Headers(requestHeaders), `${protocol}://${host}`)) {
    throw new Error("Invalid request origin");
  }
}
