import { formatDistanceToNow } from "date-fns";

export function formatRelativeUpdated(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}
