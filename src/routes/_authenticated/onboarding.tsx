import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUSINESS_TYPES } from "@/lib/business/constants";
import { useBusiness } from "@/lib/data/hooks";
import { useI18n, useT, LOCALES } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business — Vyapaar Saathi" },
      { name: "description", content: "Name your shop and start recording entries by voice." },
    ],
  }),
  component: OnboardingPage,
});

type ProvisionedBusiness = { id: string; name: string; business_type: string };

function OnboardingPage() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: rawBusiness, isLoading } = useBusiness();
  const business = rawBusiness as ProvisionedBusiness | null | undefined;

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [type, setType] = useState("kirana");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (business && business.name !== "My Business") void navigate({ to: "/" });
    if (business && !name) setName(business.name === "My Business" ? "" : business.name);
  }, [business, navigate, name]);

  useEffect(() => {
    if (user && !ownerName) setOwnerName(user.user_metadata?.full_name ?? "");
  }, [user, ownerName]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const businessId = business?.id;

      if (businessId) {
        const { error } = await supabase
          .from("businesses")
          .update({ name: name.trim(), business_type: type, language: locale } as never)
          .eq("id", businessId)
          .eq("owner_id", user.id);
        if (error) throw error;
      } else {
        const { data: createdBiz, error } = await supabase
          .from("businesses")
          .insert({ owner_id: user.id, name: name.trim(), business_type: type, language: locale } as never)
          .select("id")
          .single();
        if (error) throw error;
        if (!createdBiz) throw new Error("Business could not be created.");
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: ownerName.trim() || null,
        preferred_language: locale,
      } as never);
      if (profileError) throw profileError;

      await queryClient.invalidateQueries({ queryKey: ["business"] });
      void navigate({ to: "/" });
    } catch (error) {
      console.error("Onboarding submit error:", error);
      toast.error(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : t("common.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <main className="mx-auto w-full max-w-md px-5 py-10">Loading…</main>;

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="text-2xl font-bold">{t("onboarding.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.voiceExample")}</p>
      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div>
          <Label htmlFor="biz">{t("onboarding.businessName")}</Label>
          <Input id="biz" required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-12 text-base" />
        </div>
        <div>
          <Label htmlFor="owner">{t("onboarding.ownerName")}</Label>
          <Input id="owner" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="mt-1.5 h-12 text-base" />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t("onboarding.businessType")}</legend>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((option) => (
              <button key={option.value} type="button" aria-pressed={type === option.value} onClick={() => setType(option.value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${type === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {t(option.label)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t("onboarding.language")}</legend>
          <div className="flex gap-2">
            {LOCALES.map((option) => (
              <button key={option.code} type="button" aria-pressed={locale === option.code} onClick={() => setLocale(option.code)} className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-semibold ${locale === option.code ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {option.native}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim()}>{busy ? "Setting up…" : t("onboarding.finish")}</Button>
      </form>
    </main>
  );
}
