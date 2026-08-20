import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { StatCard } from "@/components/app/StatCard";
import { TxnRow } from "@/components/app/TxnRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MONEY_IN, MONEY_OUT, type Transaction } from "@/lib/business/constants";
import { totals } from "@/lib/business/metrics";
import {
  useBusiness,
  useCustomers,
  useDeleteTransaction,
  useTransactions,
  useVendors,
} from "@/lib/data/hooks";
import { shortDate } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "All entries — Vyapaar Saathi" },
      { name: "description", content: "Every sale, expense, purchase and payment in one ledger." },
      { property: "og:title", content: "All entries — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Every sale, expense, purchase and payment in one ledger.",
      },
    ],
  }),
  component: TransactionsPage,
});

type Filter = "all" | "in" | "out";

function groupByDay(txns: Transaction[]) {
  const groups: { day: string; items: Transaction[] }[] = [];
  for (const txn of txns) {
    const day = shortDate(txn.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(txn);
    else groups.push({ day, items: [txn] });
  }
  return groups;
}

function TransactionsPage() {
  const t = useT();
  const { data: business } = useBusiness();
  const { data: txns = [] } = useTransactions(business?.id, { days: 120 });
  const { data: customers = [] } = useCustomers(business?.id);
  const { data: vendors = [] } = useVendors(business?.id);
  const remove = useDeleteTransaction();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const nameFor = (txn: Transaction) =>
    customers.find((c) => c.id === txn.customer_id)?.name ??
    vendors.find((v) => v.id === txn.vendor_id)?.name ??
    txn.party_name ??
    undefined;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return txns.filter((txn) => {
      if (filter === "in" && !MONEY_IN.includes(txn.type)) return false;
      if (filter === "out" && !MONEY_OUT.includes(txn.type)) return false;
      if (!needle) return true;
      return [nameFor(txn), txn.notes, txn.category, String(txn.amount)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns, filter, query, customers, vendors]);

  const sums = totals(filtered);
  const groups = groupByDay(filtered);

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t("txn.filterAll") },
    { value: "in", label: t("txn.moneyIn") },
    { value: "out", label: t("txn.moneyOut") },
  ];

  return (
    <AppShell title={t("txn.history")}>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("common.search")}
        className="h-12 text-base"
      />

      <div className="mt-3 flex gap-2">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-semibold ${
              filter === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatCard label={t("home.sales")} value={sums.sales} tone="income" />
        <StatCard
          label={t("home.expenses")}
          value={sums.expenses + sums.purchases}
          tone="expense"
        />
        <StatCard label={t("home.profit")} value={sums.profit} tone="primary" />
      </div>

      {groups.length ? (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <section key={group.day}>
              <h2 className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {group.day}
              </h2>
              <div className="rounded-2xl border border-border bg-card px-3">
                {group.items.map((txn) => (
                  <TxnRow
                    key={txn.id}
                    txn={txn}
                    partyName={nameFor(txn)}
                    onClick={() => setSelected(selected?.id === txn.id ? null : txn)}
                  />
                ))}
              </div>
              {selected && group.items.some((item) => item.id === selected.id) ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-2 w-full text-expense"
                  onClick={() => {
                    remove.mutate(selected.id, {
                      onSuccess: () => {
                        toast.success(t("txn.deleted"));
                        setSelected(null);
                      },
                      onError: () => toast.error(t("common.error")),
                    });
                  }}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden />
                  {t("common.delete")}
                </Button>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ReceiptText className="size-8" />} title={t("common.none")} />
      )}
    </AppShell>
  );
}
