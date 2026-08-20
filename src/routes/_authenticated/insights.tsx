import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { SectionTitle } from "@/components/app/EmptyState";
import { StatCard } from "@/components/app/StatCard";
import { EXPENSE_CATEGORIES } from "@/lib/business/constants";
import {
  averageSale,
  dailySeries,
  expenseByCategory,
  inRange,
  payables,
  receivables,
  topParties,
  totals,
} from "@/lib/business/metrics";
import { useBusiness, useCustomers, useTransactions } from "@/lib/data/hooks";
import { compactMoney, daysAgo, money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Vyapaar Saathi" },
      {
        name: "description",
        content: "Sales trends, expense split and top customers for your shop.",
      },
      { property: "og:title", content: "Insights — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Sales trends, expense split and top customers for your shop.",
      },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const t = useT();
  const { data: business } = useBusiness();
  const { data: txns = [] } = useTransactions(business?.id, { days: 120 });
  const { data: customers = [] } = useCustomers(business?.id);

  const [range, setRange] = useState<7 | 30>(7);
  const scoped = inRange(txns, daysAgo(range - 1));
  const sums = totals(scoped);
  const series = dailySeries(scoped, range);
  const peak = Math.max(...series.map((day) => day.sales), 1);
  const categories = expenseByCategory(scoped);
  const maxCategory = Math.max(...categories.map((row) => row.amount), 1);
  const top = topParties(scoped, "customer_id");

  const labelFor = (value: string) =>
    EXPENSE_CATEGORIES.find((category) => category.value === value)?.label ??
    ("cat.misc" as TranslationKey);

  return (
    <AppShell title={t("insights.title")}>
      <div className="flex gap-2">
        {([7, 30] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={`min-h-11 flex-1 rounded-full border px-3 font-semibold ${
              range === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {value === 7 ? t("insights.week") : t("insights.month")}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard label={t("insights.revenue")} value={sums.sales} tone="income" />
        <StatCard
          label={t("home.expenses")}
          value={sums.expenses + sums.purchases}
          tone="expense"
        />
        <StatCard label={t("home.profit")} value={sums.profit} tone="primary" large />
        <StatCard label={t("insights.avgOrder")} value={averageSale(scoped)} tone="neutral" />
      </div>

      <SectionTitle>{t("insights.salesTrend")}</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex h-40 items-end gap-1.5">
          {series.map((day) => (
            <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${Math.max((day.sales / peak) * 100, 2)}%` }}
                role="img"
                aria-label={`${day.day}: ${money(day.sales)}`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{series[0]?.day.slice(5)}</span>
          <span className="num">{compactMoney(peak)}</span>
          <span>{series[series.length - 1]?.day.slice(5)}</span>
        </p>
      </div>

      <SectionTitle>{t("insights.expenseSplit")}</SectionTitle>
      {categories.length ? (
        <ul className="space-y-2 rounded-2xl border border-border bg-card p-4">
          {categories.map((row) => (
            <li key={row.category}>
              <div className="flex justify-between gap-2 text-sm font-semibold">
                <span className="truncate">{t(labelFor(row.category))}</span>
                <span className="num shrink-0">{money(row.amount)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-expense"
                  style={{ width: `${(row.amount / maxCategory) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("common.none")}
        </p>
      )}

      <SectionTitle>{t("insights.topCustomers")}</SectionTitle>
      {top.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {top.map((row) => (
            <li key={row.id} className="flex justify-between gap-2 px-4 py-3 font-semibold">
              <span className="truncate">
                {customers.find((customer) => customer.id === row.id)?.name ?? "—"}
              </span>
              <span className="num shrink-0">{money(row.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("common.none")}
        </p>
      )}

      <SectionTitle>{t("home.snapshot")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("insights.receivables")} value={receivables(txns)} tone="pending" />
        <StatCard label={t("insights.payables")} value={payables(txns)} tone="expense" />
      </div>
    </AppShell>
  );
}
