import { Decimal } from "@prisma/client/runtime/library";

type Numeric = number | Decimal | string | null | undefined;

function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return Number(value.toString()) || 0;
}

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdNoCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** $125,000.00 */
export function formatUSD(value: Numeric): string {
  return usdFull.format(toNumber(value));
}

/** $125,000 (no cents) */
export function formatUSDWhole(value: Numeric): string {
  return usdNoCents.format(toNumber(value));
}

/** $125K / $1.2M compact form, sign-aware */
export function formatUSDCompact(value: Numeric): string {
  const n = toNumber(value);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** 12.5% */
export function formatPercent(value: Numeric, fractionDigits = 1): string {
  return `${toNumber(value).toFixed(fractionDigits)}%`;
}

/** 140.5 hrs */
export function formatHours(value: Numeric, fractionDigits = 1): string {
  return `${toNumber(value).toFixed(fractionDigits)} hrs`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

export function num(value: Numeric): number {
  return toNumber(value);
}

/** Signed percentage change, e.g. "+12.4%" / "-3.1%" */
export function formatChange(current: Numeric, previous: Numeric): { label: string; direction: "up" | "down" | "flat" } {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (p === 0) {
    if (c === 0) return { label: "0.0%", direction: "flat" };
    return { label: "New", direction: "up" };
  }
  const pct = ((c - p) / Math.abs(p)) * 100;
  const direction = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const sign = pct > 0 ? "+" : "";
  return { label: `${sign}${pct.toFixed(1)}%`, direction };
}
