"use client";

import { Home, Inbox, BarChart, Settings } from "lucide-react";
import { useViewContext, type ActiveView } from "@/lib/view-context";
import { cn } from "@/lib/utils";

const RAIL_ITEMS: {
  id: ActiveView | null;
  icon: typeof Home;
  title: string;
}[] = [
  { id: null, icon: Home, title: "Not in prototype" },
  { id: "review", icon: Inbox, title: "Review queue" },
  { id: "analytics", icon: BarChart, title: "Analytics" },
  { id: null, icon: Settings, title: "Not in prototype" },
];

export function RailNav() {
  const { activeView, setActiveView } = useViewContext();

  return (
    <nav
      className="flex w-full flex-row items-center justify-around gap-0 text-muted-foreground md:w-full md:flex-col md:justify-start md:gap-6"
      aria-label="Primary"
    >
      {RAIL_ITEMS.map((item, i) => {
        const Icon = item.icon;
        const isDisabled = item.id === null;
        const isActive = item.id !== null && activeView === item.id;

        if (isDisabled) {
          return (
            <span
              key={i}
              className={cn(
                "opacity-40 max-md:px-3 max-md:py-1",
                i === RAIL_ITEMS.length - 1 && "md:mt-auto",
              )}
              title={item.title}
            >
              <Icon size={20} aria-hidden />
            </span>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => setActiveView(item.id!)}
            className={cn(
              "max-md:px-3 max-md:py-1 transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground opacity-40 hover:opacity-80",
            )}
            title={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
