import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Mic,
  Receipt,
  ShoppingBag,
  HandCoins,
  ArrowUpRight,
  Sparkles,
  PackageX,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, SectionTitle } from "@/components/app/EmptyState";
import { useEntry } from "@/components/app/EntryProvider";
import { StatCard } from "@/components/app/StatCard";
import { TxnRow } from "@/components/app/TxnRow";
import { Button } from "@/components/ui/button";
import { buildInsight } from "@/lib/business/insights";
import {
  inRange,
  payables,
  receivables,
  todayTotals,
  yesterdayTotals,
} from "@/lib/business/metrics";
import {
  useBusiness,
  useCustomers,
  useProducts,
  useTransactions,
  useVendors,
} from "@/lib/data/hooks";
import { daysAgo, money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Home — Vyapaar Saathi" },
      {
        name: "description",
        content: "Today's sales, expenses, profit and pending udhaar at a glance.",
      },
      { property: "og:title", content: "Home — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Today's sales, expenses, profit and pending udhaar at a glance.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const t = useT();
  const navigate = useNavigate();
  const { openManual, openVoice } = useEntry();
  const { data: business, isLoading } = useBusiness();
  const { data: txns = [] } = useTransactions(business?.id, { days: 60 });
  const { data: customers = [] } = useCustomers(business?.id);
  const { data: vendors = [] } = useVendors(business?.id);
  const { data: products = [] } = useProducts(business?.id);

  useEffect(() => {
    if (!isLoading && !business) void navigate({ to: "/onboarding" });
  }, [isLoading, business, navigate]);

  const today = todayTotals(txns);
  const yesterday = yesterdayTotals(txns);
  const toReceive = receivables(txns);
  const toPay = payables(txns);
  const last7 = inRange(txns, daysAgo(6));
  const prev7 = inRange(txns, daysAgo(13), daysAgo(6));
  const insight = buildInsight({ today, yesterday, last7, prev7, toReceive }, t);

  const nameFor = (txn: (typeof txns)[number]) =>
    customers.find((c) => c.id === txn.customer_id)?.name ??
    vendors.find((v) => v.id === txn.vendor_id)?.name ??
    txn.party_name ??
    undefined;

  const lowStock = products.filter(
    (p) => Number(p.low_stock_threshold) > 0 && Number(p.stock) <= Number(p.low_stock_threshold),
  );

  const actions = [
    { type: "sale" as const, label: t("txn.sale"), icon: ShoppingBag },
    { type: "expense" as const, label: t("txn.expense"), icon: Receipt },
    { type: "payment_in" as const, label: t("txn.payment_in"), icon: HandCoins },
    { type: "payment_out" as const, label: t("txn.payment_out"), icon: ArrowUpRight },
  ];

  return (
    <AppShell title={`${t("home.greeting")}!`} subtitle={business?.name ?? t("common.loading")}>
      <button
        type="button"
        onClick={openVoice}
        className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-primary-foreground shadow-md"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/15">
          <Mic className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-tight">{t("home.recordByVoice")}</span>
          <span className="block truncate text-sm opacity-85">{t("app.tagline")}</span>
        </span>
        <ArrowRight className="size-5 shrink-0" aria-hidden />
      </button>

      <SectionTitle>{t("home.todaySummary")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("home.sales")} value={today.sales} tone="income" />
        <StatCard
          label={t("home.expenses")}
          value={today.expenses + today.purchases}
          tone="expense"
        />
        <StatCard label={t("home.profit")} value={today.profit} tone="primary" large />
        <StatCard label={t("home.received")} value={today.received} tone="neutral" />
      </div>

      {insight ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-accent-soft p-3 text-accent-foreground">
          <Sparkles className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm font-semibold">{insight}</p>
        </div>
      ) : null}

      <SectionTitle>{t("home.quickActions")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => openManual(type)}
            className="tap flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-left font-semibold"
          >
            <Icon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <SectionTitle>{t("home.snapshot")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("home.toReceive")} value={toReceive} tone="pending" />
        <StatCard label={t("home.toPay")} value={toPay} tone="expense" />
      </div>

      {lowStock.length ? (
        <div className="mt-3 rounded-2xl border border-border bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <PackageX className="size-4 text-pending" aria-hidden />
            {t("home.lowStock")}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {lowStock.slice(0, 4).map((product) => (
              <li key={product.id} className="flex justify-between gap-2">
                <span className="truncate">{product.name}</span>
                <span className="num shrink-0">
                  {Number(product.stock)} {product.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SectionTitle
        action={
          <Link to="/transactions" className="text-sm font-semibold text-primary">
            {t("common.viewAll")}
          </Link>
        }
      >
        {t("home.recent")}
      </SectionTitle>

      {txns.length ? (
        <div className="rounded-2xl border border-border bg-card px-3">
          {txns.slice(0, 6).map((txn) => (
            <TxnRow key={txn.id} txn={txn} partyName={nameFor(txn)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Mic className="size-8" />}
          title={t("common.none")}
          hint={t("voice.example1")}
        />
      )}

      <Button asChild variant="secondary" size="lg" className="mt-6 w-full">
        <Link to="/assistant">
          <Sparkles className="mr-2 size-5" aria-hidden />
          {t("home.askAnything")}
        </Link>
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {money(toReceive)} {t("home.toReceive")} · {money(toPay)} {t("home.toPay")}
      </p>
    </AppShell>
  );
}
