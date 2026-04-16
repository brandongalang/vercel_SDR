"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useViewContext } from "@/lib/view-context";

export function RailNav() {
  const { resolvedTheme, setTheme } = useTheme();
  const { railControls } = useViewContext();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex w-full flex-col items-center justify-end gap-2">
      {railControls}
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="flex items-center justify-center rounded-md border border-border bg-background/80 p-2 text-muted-foreground transition-colors hover:text-foreground"
        title={mounted ? (resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
        aria-label={mounted ? (resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      >
        {!mounted || resolvedTheme !== "dark" ? <Moon size={20} aria-hidden /> : <Sun size={20} aria-hidden />}
      </button>
    </div>
  );
}
