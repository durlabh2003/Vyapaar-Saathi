import type { SupabaseClient } from "@supabase/supabase-js";

import type { Transaction } from "@/lib/business/constants";
import {
  averageSale,
  dailySeries,
  expenseByCategory,
  inRange,
  partyBalances,
  payables,
  receivables,
  topParties,
  totals,
} from "@/lib/business/metrics";
import { daysAgo, money, startOfDay } from "@/lib/format";
import { AIUnavailableError, chat } from "./gateway.server";

export type Snapshot = ReturnType<typeof buildSnapshot>;

type Named = { id: string; name: string };

/** All figures here are computed from stored rows — never from the model. */
export function buildSnapshot(txns: Transaction[], customers: Named[], vendors: Named[]) {
  const nameOf = (list: Named[], id: string) => list.find((p) => p.id === id)?.name ?? "Unknown";

  const today = totals(inRange(txns, startOfDay()));
  const yesterday = totals(inRange(txns, daysAgo(1), startOfDay()));
  const last7 = totals(inRange(txns, daysAgo(6)));
  const prev7 = totals(inRange(txns, daysAgo(13), daysAgo(6)));
  const last30 = totals(inRange(txns, daysAgo(29)));
  const prev30 = totals(inRange(txns, daysAgo(59), daysAgo(29)));

  const customerDue = [...partyBalances(txns, "customer_id").entries()]
    .filter(([, row]) => row.due > 0.5)
    .map(([id, row]) => ({ name: nameOf(customers, id), due: row.due, last: row.last }))
    .sort((a, b) => b.due - a.due)
    .slice(0, 10);

  const vendorDue = [...partyBalances(txns, "vendor_id").entries()]
    .filter(([, row]) => row.due > 0.5)
    .map(([id, row]) => ({ name: nameOf(vendors, id), due: row.due, last: row.last }))
    .sort((a, b) => b.due - a.due)
    .slice(0, 10);

  const daily = dailySeries(txns, 30);
  const bestDay = [...daily].sort((a, b) => b.sales - a.sales)[0] ?? null;

  return {
    today,
    yesterday,
    last7Days: last7,
    previous7Days: prev7,
    last30Days: last30,
    previous30Days: prev30,
    totalToReceive: receivables(txns),
    totalToPay: payables(txns),
    averageSale: averageSale(inRange(txns, daysAgo(29))),
    expenseCategoriesLast30Days: expenseByCategory(inRange(txns, daysAgo(29))).slice(0, 8),
    topCustomersLast30Days: topParties(inRange(txns, daysAgo(29)), "customer_id").map((row) => ({
      name: nameOf(customers, row.id),
      amount: row.amount,
    })),
    topVendorsLast30Days: topParties(inRange(txns, daysAgo(29)), "vendor_id").map((row) => ({
      name: nameOf(vendors, row.id),
      amount: row.amount,
    })),
    customersWhoOweMoney: customerDue,
    vendorsToPay: vendorDue,
    bestSalesDayLast30Days: bestDay,
    dailyLast30Days: daily,
  };
}

export async function loadSnapshot(supabase: SupabaseClient, businessId: string) {
  const since = daysAgo(120).toISOString();
  const [txnRes, custRes, vendRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id,business_id,type,amount,amount_paid,payment_method,category,customer_id,vendor_id,party_name,notes,occurred_at,source,ai_confidence,created_at",
      )
      .eq("business_id", businessId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabase.from("customers").select("id,name").eq("business_id", businessId).limit(1000),
    supabase.from("vendors").select("id,name").eq("business_id", businessId).limit(1000),
  ]);

  if (txnRes.error) throw txnRes.error;

  return buildSnapshot(
    (txnRes.data ?? []) as unknown as Transaction[],
    (custRes.data ?? []) as Named[],
    (vendRes.data ?? []) as Named[],
  );
}

const SYSTEM = `You are the business assistant inside a shopkeeper's app in India.

You are given a JSON snapshot of FACTS computed from the shop's own records, and a question.

Hard rules:
- Use ONLY the numbers present in the snapshot. Never estimate, extrapolate or invent a figure.
- If the snapshot does not contain the answer, say plainly that there is not enough recorded data yet.
- Format money in Indian rupees like ₹1,85,000.
- Answer in the SAME language style as the question (Hindi, English or Hinglish).
- Be short: a one-line answer, then up to 3 supporting lines. No headings, no markdown tables, no emoji.`;

function deterministicAnswer(snapshot: Snapshot) {
  return [
    `${money(snapshot.last30Days.profit)} profit in the last 30 days.`,
    `Sales: ${money(snapshot.last30Days.sales)}`,
    `Expenses: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)}`,
    `To receive: ${money(snapshot.totalToReceive)} · To pay: ${money(snapshot.totalToPay)}`,
  ].join("\n");
}

export async function answerQuestion(question: string, snapshot: Snapshot) {
  try {
    const text = await chat([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `SNAPSHOT:\n${JSON.stringify(snapshot)}\n\nQUESTION: ${question}`,
      },
    ]);
    return { answer: text.trim(), grounded: true };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) console.error(error);
    return { answer: deterministicAnswer(snapshot), grounded: true, degraded: true };
  }
}
