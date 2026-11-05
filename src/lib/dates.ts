import { APP } from "./config";

export type Period = "day" | "week" | "month" | "year" | "all";

// Dates are handled as local "YYYY-MM-DD" strings to avoid UTC off-by-one bugs.
export const toISO = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
export const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => toISO(new Date());

export function addPeriod(anchor: Date, period: Period, n: number): Date {
  const d = new Date(anchor);
  if (period === "day") d.setDate(d.getDate() + n);
  else if (period === "week") d.setDate(d.getDate() + 7 * n);
  else if (period === "month") { d.setDate(1); d.setMonth(d.getMonth() + n); }
  else if (period === "year") { d.setDate(1); d.setFullYear(d.getFullYear() + n); }
  return d;
}

/** Inclusive [from, to] ISO bounds for the period containing `anchor`. */
export function periodRange(anchor: Date, period: Period): { from: string; to: string } {
  if (period === "all") return { from: "0000-01-01", to: "9999-12-31" };
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (period === "day") return { from: toISO(a), to: toISO(a) };
  if (period === "week") {
    const diff = (a.getDay() - APP.WEEK_STARTS_ON + 7) % 7;
    const start = new Date(a); start.setDate(a.getDate() - diff);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: toISO(start), to: toISO(end) };
  }
  if (period === "month") {
    return { from: toISO(new Date(a.getFullYear(), a.getMonth(), 1)), to: toISO(new Date(a.getFullYear(), a.getMonth() + 1, 0)) };
  }
  return { from: toISO(new Date(a.getFullYear(), 0, 1)), to: toISO(new Date(a.getFullYear(), 11, 31)) };
}

export function periodLabel(anchor: Date, period: Period): string {
  const fmt = (o: Intl.DateTimeFormatOptions, d = anchor) => d.toLocaleDateString(APP.LOCALE, o);
  switch (period) {
    case "day": return fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
    case "week": {
      const { from, to } = periodRange(anchor, "week");
      return `${fmt({ day: "numeric", month: "short" }, fromISO(from))} – ${fmt({ day: "numeric", month: "short" }, fromISO(to))}`;
    }
    case "month": return fmt({ month: "long", year: "numeric" });
    case "year": return String(anchor.getFullYear());
    default: return "All time";
  }
}

export const prettyDate = (iso: string) =>
  fromISO(iso).toLocaleDateString(APP.LOCALE, { day: "numeric", month: "short", year: "numeric" });

export const inRange = (iso: string, r: { from: string; to: string }) => iso >= r.from && iso <= r.to;
