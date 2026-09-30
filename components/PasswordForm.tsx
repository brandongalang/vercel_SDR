"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-6 space-y-4" onSubmit={async event => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        const result = await response.json();
        if (response.ok) window.location.assign("/");
        else setError(result.error ?? "Unable to sign in");
      } catch { setError("Unable to sign in. Try again."); }
      finally { setPassword(""); setBusy(false); }
    }}>
      <label className="block text-sm font-medium" htmlFor="app-password">Password</label>
      <input id="app-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Opening…" : "Open workspace"}</Button>
    </form>
  );
}
