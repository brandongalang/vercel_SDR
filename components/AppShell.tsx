"use client";

import { useState, type ReactNode } from "react";
import { Triangle } from "lucide-react";
import { ViewContext, type ActiveView } from "@/lib/view-context";
import { RailNav } from "@/components/RailNav";

export function AppShell({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ActiveView>("review");

  return (
    <ViewContext.Provider value={{ activeView, setActiveView }}>
      <aside
        className="hidden md:flex md:w-16 md:shrink-0 md:flex-col md:items-center md:justify-between md:border-r md:border-border md:bg-muted/40 md:px-3 md:py-4"
        aria-label="Workspace utilities"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background shadow-sm" aria-hidden>
          <Triangle size={16} fill="currentColor" />
        </div>
        <RailNav />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {children}
      </main>
    </ViewContext.Provider>
  );
}
