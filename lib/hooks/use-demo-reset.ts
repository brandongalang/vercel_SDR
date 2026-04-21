import { useCallback, useState } from "react";

export function useDemoReset(resetCallback: () => void) {
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [workspaceResetVersion, setWorkspaceResetVersion] = useState(0);

  const handleResetDemo = useCallback(async () => {
    if (isResettingDemo) return;

    setIsResettingDemo(true);
    setResetError(null);

    try {
      const headers: HeadersInit = {};
      const publicToken = process.env.NEXT_PUBLIC_DEMO_RESET_TOKEN?.trim();
      if (publicToken) {
        headers["x-demo-reset-token"] = publicToken;
      }

      const response = await fetch("/api/reset-demo", {
        method: "POST",
        headers,
      });
      const payload = (await response.json()) as { error?: string } | null;

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Demo reset is off in this environment. Set ENABLE_DEMO_RESET=true on the server (e.g. .env.local or Vercel).",
          );
        }
        if (response.status === 401) {
          throw new Error(
            "Demo reset is not authorized. Set DEMO_RESET_TOKEN and the same value in NEXT_PUBLIC_DEMO_RESET_TOKEN so the browser can send x-demo-reset-token.",
          );
        }
        throw new Error(payload?.error ?? "Failed to reset demo");
      }

      resetCallback();
      setWorkspaceResetVersion((value) => value + 1);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Failed to reset demo");
    } finally {
      setIsResettingDemo(false);
    }
  }, [isResettingDemo, resetCallback]);

  return { handleResetDemo, isResettingDemo, resetError, workspaceResetVersion };
}
