import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { useEntry } from "@/components/app/EntryProvider";
import { StatCard } from "@/components/app/StatCard";
import { TxnRow } from "@/components/app/TxnRow";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { partyBalances } from "@/lib/business/metrics";
import {
  useBusiness,
  useCreateReminder,
  useCustomers,
  useDeleteParty,
  useTransactions,
  useUpdateParty,
  useVendors,
} from "@/lib/data/hooks";
import { dayKey, money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/party/$kind/$id")({
  head: () => ({
    meta: [
      { title: "Ledger — Vyapaar Saathi" },
      { name: "description", content: "Full ledger of entries and balance for this person." },
      { property: "og:title", content: "Ledger — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Full ledger of entries and balance for this person.",
      },
    ],
  }),
  component: PartyLedgerPage,
});

function PartyLedgerPage() {
  const t = useT();
  const { kind, id } = useParams({ from: "/_authenticated/party/$kind/$id" });
  const isCustomer = kind !== "vendors";
  const { data: business } = useBusiness();
  const { data: txns = [] } = useTransactions(business?.id, { days: 365 });
  const { data: customers = [] } = useCustomers(business?.id);
  const { data: vendors = [] } = useVendors(business?.id);
  const createReminder = useCreateReminder();
  const partyKind = isCustomer ? "customers" : "vendors";
  const updateParty = useUpdateParty(partyKind);
  const deleteParty = useDeleteParty(partyKind);
  const navigate = useNavigate();
  const { openManual } = useEntry();

  const [reminding, setReminding] = useState(false);
  const [due, setDue] = useState(dayKey(new Date()));
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  const party = (isCustomer ? customers : vendors).find((item) => item.id === id);
  const key = isCustomer ? "customer_id" : "vendor_id";
  const rows = txns.filter((txn) => txn[key] === id);
  const balance = partyBalances(rows, key).get(id);

  const saveReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business) return;
    try {
      await createReminder.mutateAsync({
        business_id: business.id,
        customer_id: isCustomer ? id : null,
        vendor_id: isCustomer ? null : id,
        amount: balance?.due ?? null,
        due_at: new Date(`${due}T09:00:00`).toISOString(),
        note: note.trim() || null,
      });
      toast.success(t("reminder.saved"));
      setReminding(false);
      setNote("");
    } catch {
      toast.error(t("common.error"));
    }
  };

  useEffect(() => {
    if (party) setForm({ name: party.name, phone: party.phone ?? "", notes: party.notes ?? "" });
  }, [party]);

  const saveParty = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    try {
      await updateParty.mutateAsync({
        id,
        name,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast.success(t("common.saved"));
      setEditing(false);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const removeParty = async () => {
    try {
      await deleteParty.mutateAsync(id);
      toast.success(t("people.deleted"));
      void navigate({ to: "/customers" });
    } catch {
      toast.error(t("common.error"));
    }
  };

  const dueAmount = Math.max(balance?.due ?? 0, 0);
  // Indian numbers are usually stored as 10 digits; wa.me needs the country code.
  const digits = (party?.phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  const whatsappHref =
    party && waNumber.length >= 10
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
          `Namaste ${party.name} ji, ${business?.name ?? "humari dukaan"} se aapka ${money(dueAmount)} ${isCustomer ? "ka hisaab baaki hai. Kripya bhugtan karein. Dhanyawad!" : "dena hai."}`,
        )}`
      : null;

  return (
    <AppShell
      title={party?.name ?? t("people.ledger")}
      subtitle={party?.phone ?? undefined}
      back="/customers"
    >
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={isCustomer ? t("people.toReceive") : t("people.toPay")}
          value={dueAmount}
          tone={isCustomer ? "pending" : "expense"}
          large
        />
        <StatCard
          label={isCustomer ? t("people.received") : t("people.paid")}
          value={balance?.settled ?? 0}
          tone="income"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          onClick={() =>
            openManual(isCustomer ? "payment_in" : "payment_out", {
              partyName: party?.name ?? null,
              amount: dueAmount || null,
            })
          }
        >
          {isCustomer ? t("txn.payment_in") : t("txn.payment_out")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setReminding(true)}>
          <BellRing className="mr-1 size-5" aria-hidden />
          {t("people.remind")}
        </Button>
      </div>

      <div className="mt-2 flex gap-2">
        {whatsappHref ? (
          <Button asChild size="lg" variant="outline" className="flex-1">
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1 size-5" aria-hidden />
              {t("people.whatsapp")}
            </a>
          </Button>
        ) : null}
        <Button
          size="lg"
          variant="outline"
          aria-label={t("people.editParty")}
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-5" aria-hidden />
        </Button>
      </div>

      <h2 className="mt-6 px-1 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("people.ledger")}
      </h2>
      {rows.length ? (
        <div className="rounded-2xl border border-border bg-card px-3">
          {rows.map((txn) => (
            <TxnRow key={txn.id} txn={txn} partyName={party?.name} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("common.none")} />
      )}

      <Drawer open={reminding} onOpenChange={setReminding}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("reminder.title")}</DrawerTitle>
          </DrawerHeader>
          <form className="space-y-4 px-4 pb-8" onSubmit={saveReminder}>
            <div>
              <Label htmlFor="r-due">{t("reminder.due")}</Label>
              <Input
                id="r-due"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="r-note">
                {t("reminder.note")} ({t("common.optional")})
              </Label>
              <Input
                id="r-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              {t("common.save")}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      <Drawer open={editing} onOpenChange={setEditing}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("people.editParty")}</DrawerTitle>
          </DrawerHeader>
          <form className="space-y-4 px-4 pb-8" onSubmit={saveParty}>
            <div>
              <Label htmlFor="p-name">{t("common.name")}</Label>
              <Input
                id="p-name"
                value={form.name}
                maxLength={80}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="p-phone">
                {t("common.phone")} ({t("common.optional")})
              </Label>
              <Input
                id="p-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                maxLength={20}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="p-notes">
                {t("common.notes")} ({t("common.optional")})
              </Label>
              <Input
                id="p-notes"
                value={form.notes}
                maxLength={200}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!form.name.trim()}>
              {t("common.save")}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="w-full text-destructive"
              onClick={() => void removeParty()}
            >
              <Trash2 className="mr-1 size-5" aria-hidden />
              {t("people.deleteParty")}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
