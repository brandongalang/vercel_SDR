import SDRWorkspace from "@/components/features/SDRWorkspace";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isWorkspaceConfigured, SESSION_COOKIE, verifySession } from "@/lib/server/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isWorkspaceConfigured() || !verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  return <AppShell><SDRWorkspace /></AppShell>;
}
