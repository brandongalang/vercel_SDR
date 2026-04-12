"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function fmtPct(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

export function shortVersion(v: string): string {
  // "2026-04-11.draft-generator.v3" → "v3 (Apr 11)"
  const parts = v.split(".");
  const tag = parts[parts.length - 1];
  const date = new Date(parts[0]);
  if (Number.isNaN(date.getTime())) return v;
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${tag} (${month} ${date.getDate()})`;
}

export function DeltaBadge({ value, invert = false }: { value?: number; invert?: boolean }) {
  if (value == null) return null;
  const positive = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
      )}
    >
      {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(value)}pp
    </span>
  );
}
