export type DateInputRange = {
  start: string;
  end: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function diffTimestampsMs(startedAt: string, completedAt: string): number {
  const start = parseTimestamp(startedAt);
  const end = parseTimestamp(completedAt);

  if (start == null || end == null || end < start) {
    return 0;
  }

  return end - start;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDateInputRange(range?: DateInputRange): { start: Date; end: Date } | null {
  if (!range) {
    return null;
  }

  const start = parseDateInputValue(range.start);
  const end = parseDateInputValue(range.end);

  if (!start || !end || start.getTime() > end.getTime()) {
    return null;
  }

  return { start, end };
}

export function getInclusiveDateInputBounds(
  range?: DateInputRange,
): { start: number; end: number } | null {
  const parsedRange = getDateInputRange(range);
  if (!parsedRange) {
    return null;
  }

  const { start, end } = parsedRange;

  return {
    start: start.getTime(),
    end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime(),
  };
}
