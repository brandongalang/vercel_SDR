"use client";

import { useState, type ReactNode } from "react";
import { Triangle } from "lucide-react";
import { ViewContext, type ActiveView } from "@/lib/view-context";
import { RailNav } from "@/components/RailNav";

export function AppShell({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ActiveView>("review");

  return (
    <ViewContext.Provider value={{ activeView, setActiveView }}>
      {/* Rail: left on md+; bottom tab bar on small screens (keeps main width usable) */}
      <aside
        className="fixed bottom-0 left-0 right-0 z-50 flex h-[3.5rem] items-center justify-around border-t border-border bg-muted/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-muted/80 md:static md:h-auto md:w-16 md:shrink-0 md:flex-col md:justify-start md:gap-8 md:border-r md:border-t-0 md:bg-muted/60 md:py-4 md:pb-4 md:backdrop-blur-none"
        aria-label="App"
      >
        <div className="hidden md:flex w-8 h-8 bg-foreground text-background items-center justify-center rounded-md shrink-0 shadow-sm" aria-hidden>
          <Triangle size={16} fill="currentColor" />
        </div>
        <RailNav />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </ViewContext.Provider>
  );
}
