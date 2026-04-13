"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to `window.matchMedia(query)`. Server snapshot defaults to `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
