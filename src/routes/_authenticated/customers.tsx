import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { partyBalances, payables, receivables } from "@/lib/business/metrics";
import {
  useBusiness,
  useCreateParty,
  useCustomers,
  useTransactions,
  useVendors,
} from "@/lib/data/hooks";
import { money, shortDate } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers & vendors — Vyapaar Saathi" },
      { name: "description", content: "Track who owes you money and whom you owe, name by name." },
      { property: "og:title", content: "Customers & vendors — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Track who owes you money and whom you owe, name by name.",
      },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const t = useT();
  const { data: business } = useBusiness();
  const { data: txns = [] } = useTransactions(business?.id, { days: 365 });
  const { data: customers = [] } = useCustomers(business?.id);
  const { data: vendors = [] } = useVendors(business?.id);

  const [tab, setTab] = useState<"customers" | "vendors">("customers");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const createParty = useCreateParty(tab);

  const balances = useMemo(
    () => partyBalances(txns, tab === "customers" ? "customer_id" : "vendor_id"),
    [txns, tab],
  );

  const list = (tab === "customers" ? customers : vendors)
    .filter((party) => party.name.toLowerCase().includes(query.trim().toLowerCase()))
    .map((party) => ({ party, balance: balances.get(party.id) }))
    .sort((a, b) => (b.balance?.due ?? 0) - (a.balance?.due ?? 0));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business || !name.trim()) return;
    try {
      await createParty.mutateAsync({
        business_id: business.id,
        name: name.trim(),
        phone: phone.trim() || null,
      });
      toast.success(t("common.saved"));
      setName("");
      setPhone("");
      setAdding(false);
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <AppShell title={t("nav.customers")}>
      <div className="flex gap-2">
        {(["customers", "vendors"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`min-h-11 flex-1 rounded-full border px-3 font-semibold ${
              tab === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {value === "customers" ? t("people.customers") : t("people.vendors")}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard label={t("home.toReceive")} value={receivables(txns)} tone="pending" />
        <StatCard label={t("home.toPay")} value={payables(txns)} tone="expense" />
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("common.search")}
          className="h-12 text-base"
        />
        <Button size="lg" onClick={() => setAdding(true)} aria-label={t("common.add")}>
          <Plus className="size-5" aria-hidden />
        </Button>
      </div>

      {list.length ? (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {list.map(({ party, balance }) => (
            <li key={party.id}>
              <Link
                to="/party/$kind/$id"
                params={{ kind: tab, id: party.id }}
                className="tap flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{party.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {balance?.last
                      ? `${t("people.lastEntry")}: ${shortDate(balance.last)}`
                      : (party.phone ?? t("people.settled"))}
                  </span>
                </span>
                <span
                  className={`num shrink-0 font-bold ${
                    (balance?.due ?? 0) > 0.5
                      ? tab === "customers"
                        ? "text-pending"
                        : "text-expense"
                      : "text-muted-foreground"
                  }`}
                >
                  {(balance?.due ?? 0) > 0.5 ? money(balance!.due) : t("people.settled")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Users className="size-8" />} title={t("common.none")} />
      )}

      <p className="mt-4 text-xs text-muted-foreground">{t("people.contactsNote")}</p>

      <Drawer open={adding} onOpenChange={setAdding}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {tab === "customers" ? t("people.addCustomer") : t("people.addVendor")}
            </DrawerTitle>
          </DrawerHeader>
          <form className="space-y-4 px-4 pb-8" onSubmit={save}>
            <div>
              <Label htmlFor="p-name">{t("common.name")}</Label>
              <Input
                id="p-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="p-phone">
                {t("common.phone")} ({t("common.optional")})
              </Label>
              <Input
                id="p-phone"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </div>
            {"contacts" in navigator &&
            "select" in (navigator as unknown as { contacts: unknown }) ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={async () => {
                  try {
                    const contacts = await (
                      navigator as unknown as {
                        contacts: {
                          select: (
                            props: string[],
                            opts?: { multiple?: boolean },
                          ) => Promise<{ name?: string[]; tel?: string[] }[]>;
                        };
                      }
                    ).contacts.select(["name", "tel"], { multiple: false });
                    if (contacts?.[0]) {
                      if (contacts[0].name?.[0]) setName(contacts[0].name[0]);
                      if (contacts[0].tel?.[0]) setPhone(contacts[0].tel[0]);
                    }
                  } catch {
                    // User canceled contact picker
                  }
                }}
              >
                {t("people.importContacts")}
              </Button>
            ) : null}
            <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
              {t("common.save")}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
