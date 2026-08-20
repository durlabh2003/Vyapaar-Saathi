import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, SectionTitle } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import {
  useBusiness,
  useCompleteReminder,
  useCustomers,
  useReminders,
  useVendors,
} from "@/lib/data/hooks";
import { money, shortDate } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Payment reminders — Vyapaar Saathi" },
      {
        name: "description",
        content: "See every udhaar follow-up you set, with the amount and the day it is due.",
      },
      { property: "og:title", content: "Payment reminders — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "See every udhaar follow-up you set, with the amount and the day it is due.",
      },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  const t = useT();
  const { data: business } = useBusiness();
  const { data: reminders = [] } = useReminders(business?.id);
  const { data: customers = [] } = useCustomers(business?.id);
  const { data: vendors = [] } = useVendors(business?.id);
  const complete = useCompleteReminder();

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const party of [...customers, ...vendors]) map.set(party.id, party.name);
    return map;
  }, [customers, vendors]);

  const now = Date.now();
  const due = reminders.filter((r) => new Date(r.due_at).getTime() <= now);
  const upcoming = reminders.filter((r) => new Date(r.due_at).getTime() > now);

  const markDone = async (id: string) => {
    try {
      await complete.mutateAsync(id);
      toast.success(t("common.saved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const renderList = (rows: typeof reminders) => (
    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((reminder) => (
        <li key={reminder.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {nameOf.get(reminder.customer_id ?? reminder.vendor_id ?? "") ??
                (reminder.note || t("reminder.title"))}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {shortDate(reminder.due_at)}
              {reminder.amount ? ` · ${money(Number(reminder.amount))}` : ""}
              {reminder.note ? ` · ${reminder.note}` : ""}
            </span>
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("common.confirm")}
            onClick={() => void markDone(reminder.id)}
          >
            <Check className="size-4" aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );

  return (
    <AppShell title={t("reminder.title")} back="/more">
      {reminders.length ? (
        <>
          {due.length ? (
            <>
              <SectionTitle>{t("reminder.due")}</SectionTitle>
              {renderList(due)}
            </>
          ) : null}
          {upcoming.length ? (
            <>
              <SectionTitle>{t("reminder.upcoming")}</SectionTitle>
              {renderList(upcoming)}
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<BellRing className="size-8" />}
          title={t("common.none")}
          hint={t("people.remind")}
        />
      )}
    </AppShell>
  );
}
