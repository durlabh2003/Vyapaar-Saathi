import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, useT, LOCALES } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Vyapaar Saathi" },
      {
        name: "description",
        content: "Sign in to keep your shop's sales, expenses and udhaar in one place.",
      },
      { property: "og:title", content: "Sign in — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Sign in to keep your shop's sales, expenses and udhaar in one place.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) toast.success(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(t("common.error"));
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("app.name")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("auth.subtitle")}</p>
      </div>

      <div className="flex gap-2">
        {LOCALES.map((option) => (
          <button
            key={option.code}
            type="button"
            aria-pressed={locale === option.code}
            onClick={() => setLocale(option.code)}
            className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-semibold ${
              locale === option.code
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {option.native}
          </button>
        ))}
      </div>

      <Button size="lg" variant="secondary" className="w-full" onClick={google} disabled={busy}>
        {t("auth.google")}
      </Button>

      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 h-12 text-base"
          />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 h-12 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
        </Button>
      </form>

      <button
        type="button"
        className="text-sm font-semibold text-primary"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
      </button>

      <p className="text-xs text-muted-foreground">{t("auth.phoneNote")}</p>
    </main>
  );
}
