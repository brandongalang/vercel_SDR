import { formatDistanceToNow } from "date-fns";
import type { OutboundJob } from "@/lib/types";

export function formatRelativeUpdated(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "—";
  return formatDistanceToNow(timestamp, { addSuffix: true });
}

export function formatLeadSource(source: OutboundJob["play"]["leadSource"]): string {
  return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
