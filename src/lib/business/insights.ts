import type { Totals } from "./metrics";
import type { Transaction } from "./constants";
import { totals } from "./metrics";
import { money, percentChange } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";

type Input = {
  today: Totals;
  yesterday: Totals;
  last7: Transaction[];
  prev7: Transaction[];
  toReceive: number;
};

/**
 * Insights are template sentences filled with figures from the ledger.
 * If there is no evidence for a statement, nothing is shown.
 */
export function buildInsight(input: Input, t: (key: TranslationKey) => string): string | null {
  const { today, yesterday, last7, prev7, toReceive } = input;

  const dayChange = percentChange(today.sales, yesterday.sales);
  if (today.sales > 0 && dayChange !== null && Math.abs(dayChange) >= 5) {
    const direction = dayChange > 0 ? "+" : "−";
    return `${t("home.sales")} ${direction}${Math.abs(Math.round(dayChange))}% ${t("common.today")} · ${money(today.sales)}`;
  }

  const week = totals(last7);
  const previousWeek = totals(prev7);
  const weekChange = percentChange(week.sales, previousWeek.sales);
  if (weekChange !== null && Math.abs(weekChange) >= 5) {
    const direction = weekChange > 0 ? "+" : "−";
    return `${t("insights.week")}: ${t("home.sales")} ${direction}${Math.abs(Math.round(weekChange))}% · ${money(week.sales)}`;
  }

  const expenseChange = percentChange(
    week.expenses + week.purchases,
    previousWeek.expenses + previousWeek.purchases,
  );
  if (expenseChange !== null && expenseChange >= 10) {
    return `${t("home.expenses")} +${Math.round(expenseChange)}% · ${money(week.expenses + week.purchases)}`;
  }

  if (toReceive > 0) {
    return `${money(toReceive)} — ${t("home.toReceive")}`;
  }

  if (week.sales > 0) {
    return `${t("insights.week")}: ${money(week.sales)} ${t("home.sales")}, ${money(week.profit)} ${t("home.profit")}`;
  }

  return null;
}
