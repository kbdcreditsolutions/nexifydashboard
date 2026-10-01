export type PeriodKey = "current_month" | "previous_month" | "ytd" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function currentMonthRange(ref = new Date()): DateRange {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start: startOfDay(start), end: endOfDay(end), label: "This Month" };
}

export function previousMonthRange(ref = new Date()): DateRange {
  const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
  return { start: startOfDay(start), end: endOfDay(end), label: "Previous Month" };
}

export function ytdRange(ref = new Date()): DateRange {
  const start = new Date(ref.getFullYear(), 0, 1);
  return { start: startOfDay(start), end: endOfDay(ref), label: "Year to Date" };
}

export function previousPeriodOfSameLength(range: DateRange): DateRange {
  const lengthMs = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - lengthMs);
  return { start: startOfDay(start), end: endOfDay(end), label: "Previous Period" };
}

/**
 * Calendar-aware comparison range for a given period selection. Using a
 * naive "N days immediately prior" window misaligns month boundaries and
 * drops day-1 recurring costs (payroll, rent) from the comparison period,
 * producing false spikes — so month/YTD periods compare to the matching
 * calendar month/year instead.
 */
export function comparisonRangeFor(period: PeriodKey, range: DateRange, ref = new Date()): DateRange {
  switch (period) {
    case "current_month":
      return previousMonthRange(ref);
    case "previous_month":
      return previousMonthRange(new Date(ref.getFullYear(), ref.getMonth() - 1, 1));
    case "ytd": {
      const start = new Date(range.start.getFullYear() - 1, 0, 1);
      const end = new Date(range.end.getFullYear() - 1, range.end.getMonth(), range.end.getDate());
      return { start: startOfDay(start), end: endOfDay(end), label: "Same Period Last Year" };
    }
    case "custom":
    default:
      return previousPeriodOfSameLength(range);
  }
}

export function resolvePeriod(period: PeriodKey, customStart?: string, customEnd?: string, ref = new Date()): DateRange {
  switch (period) {
    case "current_month":
      return currentMonthRange(ref);
    case "previous_month":
      return previousMonthRange(ref);
    case "ytd":
      return ytdRange(ref);
    case "custom":
      if (customStart && customEnd) {
        return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)), label: "Custom Range" };
      }
      return currentMonthRange(ref);
  }
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
}

/** Last N calendar months including the current one, oldest first. */
export function lastNMonths(n: number, ref = new Date()): { start: Date; end: Date; key: string; label: string }[] {
  const out: { start: Date; end: Date; key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0);
    out.push({ start: startOfDay(start), end: endOfDay(end), key: monthKey(start), label: monthLabel(start) });
  }
  return out;
}
