import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { SectionTitle } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_TYPES } from "@/lib/business/constants";
import { useBusiness, useUpdateBusiness } from "@/lib/data/hooks";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Business details — Vyapaar Saathi" },
      {
        name: "description",
        content: "Update your shop name, business type and whether you track stock.",
      },
      { property: "og:title", content: "Business details — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Update your shop name, business type and whether you track stock.",
      },
    ],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const t = useT();
  const { data: business } = useBusiness();
  const updateBusiness = useUpdateBusiness();

  const [name, setName] = useState("");
  const [type, setType] = useState("other");
  const [inventory, setInventory] = useState(true);

  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setType(business.business_type);
    setInventory(business.inventory_enabled);
  }, [business]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business || !name.trim()) return;
    try {
      await updateBusiness.mutateAsync({
        id: business.id,
        name: name.trim(),
        business_type: type,
        inventory_enabled: inventory,
      });
      toast.success(t("common.saved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <AppShell title={t("more.business")} back="/more">
      <form className="space-y-5" onSubmit={save}>
        <div>
          <Label htmlFor="b-name">{t("onboarding.businessName")}</Label>
          <Input
            id="b-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 h-12 text-base"
          />
        </div>

        <div>
          <SectionTitle>{t("onboarding.businessType")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={type === option.value}
                onClick={() => setType(option.value)}
                className={`min-h-11 rounded-full border px-3 font-semibold ${
                  type === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <span className="font-semibold">{t("products.title")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={inventory}
            aria-label={t("products.title")}
            onClick={() => setInventory((value) => !value)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              inventory ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-card transition-all ${
                inventory ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!name.trim() || updateBusiness.isPending}
        >
          {t("common.save")}
        </Button>
      </form>
    </AppShell>
  );
}
