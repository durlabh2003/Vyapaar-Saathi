const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export function money(value: number | null | undefined, precise = false) {
  const n = Number(value ?? 0);
  return precise ? inrPrecise.format(n) : inr.format(Math.round(n));
}

export function compactMoney(value: number | null | undefined) {
  const n = Math.abs(Number(value ?? 0));
  const sign = Number(value ?? 0) < 0 ? "-" : "";
  if (n >= 10000000) return `${sign}₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${sign}₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${sign}₹${(n / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(n)}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function dayKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shortDate(date: string | Date, locale = "en-IN") {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function shortDateTime(date: string | Date, locale = "en-IN") {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(n: number) {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}
