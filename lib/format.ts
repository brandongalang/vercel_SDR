import { formatDistanceToNow } from "date-fns";

export function formatRelativeUpdated(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function truncateAngle(text: string, maxLen = 120): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
