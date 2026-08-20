import type { ReactNode } from "react";

import { money } from "@/lib/format";

type Tone = "neutral" | "income" | "expense" | "pending" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "bg-card text-card-foreground",
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  pending: "bg-pending-soft text-pending",
  primary: "bg-primary-soft text-primary",
};

export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
  icon,
  large,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  hint?: string | undefined;
  icon?: ReactNode;
  large?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-border p-3 ${toneClass[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={`num mt-1 font-bold ${large ? "text-3xl" : "text-xl"}`}>
        {typeof value === "number" ? money(value) : value}
      </p>
      {hint ? <p className="mt-0.5 text-xs opacity-75">{hint}</p> : null}
    </div>
  );
}
