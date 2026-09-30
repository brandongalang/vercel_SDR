"use client";
import { useEffect, useState } from "react";
import type { OutboundJob } from "@/lib/types";

export function useJobs() {
  const [jobs, setJobs] = useState<OutboundJob[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string }>();
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (inFlight || disposed) return;
      inFlight = true;
      try {
        const response = await fetch("/api/jobs", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.replace("/login"); return; }
        if (!response.ok) throw new Error("Unable to load workspace");
        const result = await response.json();
        if (!disposed) { setJobs(result.jobs); setError(undefined); }
      } catch {
        if (!disposed) setError({ message: "Unable to load workspace. Try again shortly." });
      } finally { inFlight = false; if (!disposed) setLoading(false); }
    };
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    const onChange = () => { void refresh(); };
    window.addEventListener("sdr-jobs-changed", onChange);
    return () => { disposed = true; controller.abort(); window.clearInterval(interval); window.removeEventListener("sdr-jobs-changed", onChange); };
  }, []);
  return { jobs, isLoading, error };
}
