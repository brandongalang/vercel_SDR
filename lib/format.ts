import { formatDistanceToNow } from "date-fns";

export function formatRelativeUpdated(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "—";
  return formatDistanceToNow(timestamp, { addSuffix: true });
}
