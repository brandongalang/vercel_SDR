"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type ActiveView = "review" | "analytics" | "dspy" | "debugger";

interface ViewContextValue {
  activeView: ActiveView;
  setActiveView: Dispatch<SetStateAction<ActiveView>>;
  railControls: ReactNode;
  setRailControls: Dispatch<SetStateAction<ReactNode>>;
}

export const ViewContext = createContext<ViewContextValue | null>(null);

export function useViewContext() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useViewContext must be used within ViewContext.Provider");
  return ctx;
}
