/**
 * Deterministic financial calculations.
 *
 * Every number shown in the app or spoken by the assistant comes from here —
 * the language model never invents figures.
 */
import { dayKey, daysAgo, startOfDay } from "@/lib/format";
import type { Transaction } from "./constants";

export type Totals = {
  sales: number;
  expenses: number;
  purchases: number;
  received: number;
  paid: number;
  profit: number;
  count: number;
};

const num = (v: unknown) => Number(v ?? 0);

export function totals(txns: Transaction[]): Totals {
  let sales = 0;
  let expenses = 0;
  let purchases = 0;
  let received = 0;
  let paid = 0;

  for (const t of txns) {
    const amount = num(t.amount);
    if (t.type === "sale") {
      sales += amount;
      received += num(t.amount_paid);
    } else if (t.type === "expense") {
      expenses += amount;
      paid += num(t.amount_paid);
    } else if (t.type === "purchase") {
      purchases += amount;
      paid += num(t.amount_paid);
    } else if (t.type === "payment_in") {
      received += amount;
    } else if (t.type === "payment_out") {
      paid += amount;
    }
  }

  return {
    sales,
    expenses,
    purchases,
    received,
    paid,
    profit: sales - expenses - purchases,
    count: txns.length,
  };
}

export function inRange(txns: Transaction[], from: Date, to?: Date) {
  const start = from.getTime();
  const end = to ? to.getTime() : Infinity;
  return txns.filter((t) => {
    const at = new Date(t.occurred_at).getTime();
    return at >= start && at < end;
  });
}

export function todayTotals(txns: Transaction[]) {
  return totals(inRange(txns, startOfDay()));
}

export function yesterdayTotals(txns: Transaction[]) {
  return totals(inRange(txns, daysAgo(1), startOfDay()));
}

/** Outstanding balance per party. Positive = they still owe the business. */
export function partyBalances(txns: Transaction[], key: "customer_id" | "vendor_id") {
  const map = new Map<string, { due: number; total: number; settled: number; last: string }>();
  for (const t of txns) {
    const id = t[key];
    if (!id) continue;
    const row = map.get(id) ?? { due: 0, total: 0, settled: 0, last: t.occurred_at };
    if (key === "customer_id") {
      if (t.type === "sale") {
        row.total += num(t.amount);
        row.settled += num(t.amount_paid);
        row.due += num(t.amount) - num(t.amount_paid);
      } else if (t.type === "payment_in") {
        row.settled += num(t.amount);
        row.due -= num(t.amount);
      }
    } else {
      if (t.type === "purchase") {
        row.total += num(t.amount);
        row.settled += num(t.amount_paid);
        row.due += num(t.amount) - num(t.amount_paid);
      } else if (t.type === "payment_out") {
        row.settled += num(t.amount);
        row.due -= num(t.amount);
      }
    }
    if (new Date(t.occurred_at) > new Date(row.last)) row.last = t.occurred_at;
    map.set(id, row);
  }
  return map;
}

export function receivables(txns: Transaction[]) {
  let sum = 0;
  for (const row of partyBalances(txns, "customer_id").values()) sum += Math.max(row.due, 0);
  return sum;
}

export function payables(txns: Transaction[]) {
  let sum = 0;
  for (const row of partyBalances(txns, "vendor_id").values()) sum += Math.max(row.due, 0);
  return sum;
}

export function dailySeries(txns: Transaction[], days: number) {
  const buckets: { day: string; sales: number; expenses: number; profit: number }[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const key = dayKey(d);
    index.set(key, buckets.length);
    buckets.push({ day: key, sales: 0, expenses: 0, profit: 0 });
  }
  for (const t of txns) {
    const slot = index.get(dayKey(t.occurred_at));
    if (slot === undefined) continue;
    const bucket = buckets[slot]!;
    if (t.type === "sale") bucket.sales += num(t.amount);
    if (t.type === "expense" || t.type === "purchase") bucket.expenses += num(t.amount);
    bucket.profit = bucket.sales - bucket.expenses;
  }
  return buckets;
}

export function expenseByCategory(txns: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "expense") continue;
    const key = t.category ?? "misc";
    map.set(key, (map.get(key) ?? 0) + num(t.amount));
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function topParties(
  txns: Transaction[],
  key: "customer_id" | "vendor_id",
  limit = 5,
): { id: string; amount: number }[] {
  const map = new Map<string, number>();
  const relevant = key === "customer_id" ? "sale" : "purchase";
  for (const t of txns) {
    const id = t[key];
    if (!id || t.type !== relevant) continue;
    map.set(id, (map.get(id) ?? 0) + num(t.amount));
  }
  return [...map.entries()]
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function averageSale(txns: Transaction[]) {
  const sales = txns.filter((t) => t.type === "sale");
  if (!sales.length) return 0;
  return sales.reduce((sum, t) => sum + num(t.amount), 0) / sales.length;
}
