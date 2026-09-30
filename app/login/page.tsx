import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/PasswordForm";
import { isWorkspaceConfigured, SESSION_COOKIE, verifySession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isWorkspaceConfigured();
  if (configured && verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/");
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Vercel SDR</p>
        <h1 className="mt-3 text-2xl font-semibold">{configured ? "Open the prototype" : "Prototype setup pending"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{configured ? "Enter the shared password to access the workspace." : "The owner needs to finish secure server configuration before this workspace can open."}</p>
        {configured && <PasswordForm />}
      </div>
    </main>
  );
}
