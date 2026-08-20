import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  TXN_LABEL,
  type TxnType,
} from "@/lib/business/constants";
import {
  useBusiness,
  useCreateTransaction,
  useCustomers,
  useVendors,
  resolveParty,
} from "@/lib/data/hooks";
import { useT } from "@/lib/i18n";

export type ManualDraft = {
  type: TxnType;
  amount?: number | null;
  partyName?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  source?: "voice" | "manual";
  confidence?: number | null;
};

function Chips({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              value === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ManualEntrySheet({
  draft,
  onClose,
}: {
  draft: ManualDraft | null;
  onClose: () => void;
}) {
  const t = useT();
  const { data: business } = useBusiness();
  const { data: customers = [] } = useCustomers(business?.id);
  const { data: vendors = [] } = useVendors(business?.id);
  const createTransaction = useCreateTransaction();

  const [type, setType] = useState<TxnType>("sale");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [method, setMethod] = useState<string | null>("cash");
  const [category, setCategory] = useState<string | null>("misc");
  const [notes, setNotes] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setType(draft.type);
    setAmount(draft.amount ? String(draft.amount) : "");
    setPartyName(draft.partyName ?? "");
    setMethod(draft.paymentMethod ?? (draft.type === "sale" ? "cash" : "cash"));
    setCategory(draft.category ?? "misc");
    setNotes(draft.notes ?? "");
    setPaidNow("");
  }, [draft]);

  const usesParty =
    type === "sale" || type === "purchase" || type === "payment_in" || type === "payment_out";
  const partyIsCustomer = type === "sale" || type === "payment_in";
  const suggestions = partyIsCustomer ? customers : vendors;

  const amountNumber = Number(amount.replace(/[^\d.]/g, "")) || 0;
  const onCredit = (type === "sale" || type === "purchase") && method === "credit";
  const paidAmount = useMemo(() => {
    if (type === "payment_in" || type === "payment_out") return amountNumber;
    if (!onCredit) return amountNumber;
    return Number(paidNow.replace(/[^\d.]/g, "")) || 0;
  }, [amountNumber, onCredit, paidNow, type]);

  const save = async () => {
    if (!business || amountNumber <= 0) return;
    setSaving(true);
    try {
      let customerId: string | null = null;
      let vendorId: string | null = null;
      if (usesParty && partyName.trim()) {
        const party = await resolveParty(
          partyIsCustomer ? "customers" : "vendors",
          business.id,
          partyName,
        );
        if (partyIsCustomer) customerId = party?.id ?? null;
        else vendorId = party?.id ?? null;
      }

      const result = await createTransaction.mutateAsync({
        business_id: business.id,
        type,
        amount: amountNumber,
        amount_paid: paidAmount,
        payment_method: type === "expense" ? (method ?? "cash") : method,
        category: type === "expense" ? (category ?? "misc") : null,
        customer_id: customerId,
        vendor_id: vendorId,
        party_name: partyName.trim() || null,
        notes: notes.trim() || null,
        source: draft?.source ?? "manual",
        ai_confidence: draft?.confidence ?? null,
      });

      toast.success(result.queued ? t("common.offline") : t("common.saved"));
      onClose();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{t(TXN_LABEL[type])}</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-8">
          <div>
            <Label
              htmlFor="amount"
              className="mb-1.5 block text-sm font-semibold text-muted-foreground"
            >
              {t("common.amount")}
            </Label>
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-4">
              <span className="text-2xl font-bold text-muted-foreground">₹</span>
              <Input
                id="amount"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className="num h-16 border-0 bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {usesParty ? (
            <div>
              <Label
                htmlFor="party"
                className="mb-1.5 block text-sm font-semibold text-muted-foreground"
              >
                {partyIsCustomer ? t("txn.customer") : t("txn.vendor")}
              </Label>
              <Input
                id="party"
                list="party-suggestions"
                value={partyName}
                onChange={(event) => setPartyName(event.target.value)}
                placeholder={t("common.name")}
                className="h-12 text-base"
              />
              <datalist id="party-suggestions">
                {suggestions.map((party) => (
                  <option key={party.id} value={party.name} />
                ))}
              </datalist>

              {type === "sale" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPartyName("Cash / Anonymous")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      partyName === "Cash / Anonymous"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:bg-card"
                    }`}
                  >
                    👤 Cash / Anonymous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartyName("Other Sale")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      partyName === "Other Sale"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:bg-card"
                    }`}
                  >
                    🏷️ Other Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartyName("Walk-in Customer")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      partyName === "Walk-in Customer"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:bg-card"
                    }`}
                  >
                    🛍️ Walk-in
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <Chips
            label={t("txn.method")}
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS.filter(
              (option) => option.value !== "credit" || type === "sale" || type === "purchase",
            ).map((option) => ({ value: option.value, label: t(option.label) }))}
          />

          {onCredit ? (
            <div>
              <Label
                htmlFor="paid"
                className="mb-1.5 block text-sm font-semibold text-muted-foreground"
              >
                {t("txn.amountPaidNow")}
              </Label>
              <Input
                id="paid"
                inputMode="decimal"
                value={paidNow}
                onChange={(event) => setPaidNow(event.target.value)}
                placeholder="0"
                className="num h-12 text-base"
              />
            </div>
          ) : null}

          {type === "expense" ? (
            <Chips
              label={t("txn.category")}
              value={category}
              onChange={setCategory}
              options={EXPENSE_CATEGORIES.map((option) => ({
                value: option.value,
                label: t(option.label),
              }))}
            />
          ) : null}

          <div>
            <Label
              htmlFor="notes"
              className="mb-1.5 block text-sm font-semibold text-muted-foreground"
            >
              {t("common.notes")}
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="h-12 text-base"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={amountNumber <= 0 || saving}
              onClick={save}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
