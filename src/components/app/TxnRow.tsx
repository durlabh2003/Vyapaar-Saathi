import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Receipt,
  ShoppingBag,
  Truck,
  Mic,
} from "lucide-react";

import { MONEY_IN, TXN_LABEL, type Transaction, type TxnType } from "@/lib/business/constants";
import { money, shortDate } from "@/lib/format";
import { useT } from "@/lib/i18n";

const icons: Record<TxnType, typeof Receipt> = {
  sale: ShoppingBag,
  purchase: Truck,
  expense: Receipt,
  payment_in: ArrowDownLeft,
  payment_out: ArrowUpRight,
  adjustment: HandCoins,
};

export function TxnRow({
  txn,
  partyName,
  onClick,
}: {
  txn: Transaction;
  partyName?: string | undefined;
  onClick?: () => void;
}) {
  const t = useT();
  const Icon = icons[txn.type];
  const isIn = MONEY_IN.includes(txn.type);
  const due = Number(txn.amount) - Number(txn.amount_paid);
  const unpaid = (txn.type === "sale" || txn.type === "purchase") && due > 0.5;

  const secondary = [
    partyName ?? txn.party_name,
    txn.category ? t(`cat.${txn.category}` as never) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-b-0"
    >
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          isIn ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
        }`}
      >
        <Icon className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {t(TXN_LABEL[txn.type])}
          {txn.source === "voice" ? (
            <Mic className="size-3 text-muted-foreground" aria-label="Recorded by voice" />
          ) : null}
        </span>
        {secondary ? (
          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </span>

      <span className="shrink-0 text-right">
        <span className={`num block font-bold ${isIn ? "text-income" : "text-expense"}`}>
          {isIn ? "+" : "−"}
          {money(txn.amount)}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {shortDate(txn.occurred_at)}
          {unpaid ? ` • ${t("txn.credit")} ${money(due)}` : ""}
        </span>
      </span>
    </Wrapper>
  );
}
