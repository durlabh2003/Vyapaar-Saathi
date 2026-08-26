import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, useT, LOCALES } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Vyapaar Saathi" },
      {
        name: "description",
        content: "Sign in or create your Vyapaar Saathi account to manage your business.",
      },
      { property: "og:title", content: "Vyapaar Saathi — Your business companion" },
      {
        property: "og:description",
        content: "Manage sales, expenses and udhaar in one simple place.",
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
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === "signup" && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: name.trim(),
              business_name: businessName.trim(),
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          toast.success(t("auth.checkEmail"));
        } else {
          toast.success("Account created successfully.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
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
      toast.error(result.error instanceof Error ? result.error.message : t("common.error"));
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[760px] overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-primary-foreground/10" />
          <div className="absolute -bottom-32 -left-24 size-80 rounded-full bg-primary-foreground/10" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/15">
                <Store className="size-6" aria-hidden />
              </div>
              <span className="text-xl font-bold">{t("app.name")}</span>
            </div>

            <div className="mt-20 max-w-lg">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-sm font-semibold">
                <Sparkles className="size-4" aria-hidden />
                Built for everyday business
              </div>
              <h1 className="text-5xl font-black leading-[1.05] tracking-tight xl:text-6xl">
                Your shop. Your numbers. Your Saathi.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-8 text-primary-foreground/80">
                Keep sales, expenses, customers and udhaar organised without turning your day into paperwork.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid gap-3 sm:grid-cols-2">
            {[
              "Record sales and expenses",
              "Track customer udhaar",
              "See business insights",
              "Use voice to add entries",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-3 py-3 text-sm font-semibold">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[760px] flex-col justify-center p-5 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="lg:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Store className="size-5" aria-hidden />
                  </div>
                  <span className="text-xl font-bold">{t("app.name")}</span>
                </div>
              </div>

              <div className="ml-auto flex gap-1 rounded-full border border-border bg-muted/50 p-1">
                {LOCALES.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    aria-pressed={locale === option.code}
                    onClick={() => setLocale(option.code)}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      locale === option.code
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.native}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-7">
              <p className="mb-2 text-sm font-semibold text-primary">
                {mode === "signin" ? "Welcome back" : "Start your journey"}
              </p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                {mode === "signin" ? "Sign in to your account" : "Create your account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mode === "signin"
                  ? "Pick up where you left off and keep your business moving."
                  : "Create your free account and start organising your shop today."}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                  mode === "signin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                  mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Create account
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-xl font-semibold"
              onClick={google}
              disabled={busy}
            >
              <span className="grid size-6 place-items-center rounded-full border border-border bg-background text-xs font-black">G</span>
              Continue with Google
            </Button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">or continue with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === "signup" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name" icon={<UserRound className="size-4" />}>
                    <Input
                      id="name"
                      required
                      autoComplete="name"
                      placeholder="Rahul Sharma"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-12 rounded-xl pl-10"
                    />
                  </Field>
                  <Field label="Business name" icon={<Store className="size-4" />}>
                    <Input
                      id="businessName"
                      required
                      autoComplete="organization"
                      placeholder="Sharma General Store"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      className="h-12 rounded-xl pl-10"
                    />
                  </Field>
                </div>
              ) : null}

              <Field label={t("auth.email")} icon={<Mail className="size-4" />}>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-xl pl-10"
                />
              </Field>

              <Field label={t("auth.password")} icon={<LockKeyhole className="size-4" />}>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-xl pl-10 pr-12"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              {mode === "signup" ? (
                <Field label="Confirm password" icon={<LockKeyhole className="size-4" />}>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-12 rounded-xl pl-10 pr-12"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
              ) : null}

              <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base font-bold" disabled={busy}>
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                {!busy ? <ArrowRight className="size-5" aria-hidden /> : null}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>Your account is secured by Supabase authentication. We never store your password in the app.</span>
            </div>

            <div className="mt-5 flex flex-col gap-3 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:underline"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
              </button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mx-auto text-muted-foreground"
                onClick={() => void navigate({ to: "/" })}
              >
                Try Demo Mode
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
