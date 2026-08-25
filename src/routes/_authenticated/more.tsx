import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, BellRing, LogIn, LogOut, Package, Sparkles, Store, UserCheck, Users } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { SectionTitle } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBusiness } from "@/lib/data/hooks";
import { useI18n, useT, LOCALES } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({
    meta: [
      { title: "More — Vyapaar Saathi" },
      { name: "description", content: "Language, business details and your assistant shortcuts." },
      { property: "og:title", content: "More — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Language, business details and your assistant shortcuts.",
      },
    ],
  }),
  component: MorePage,
});

function MorePage() {
  const t = useT();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { locale, setLocale } = useI18n();
  const { data: business } = useBusiness();

  const links = [
    { to: "/assistant", label: t("more.assistant"), icon: Sparkles },
    { to: "/products", label: t("more.products"), icon: Package },
    { to: "/reminders", label: t("more.reminders"), icon: BellRing },
    { to: "/insights", label: t("insights.title"), icon: BarChart3 },
    { to: "/customers", label: t("people.vendors"), icon: Users },
    { to: "/business", label: t("more.business"), icon: Store },
  ];

  return (
    <AppShell title={t("more.title")} subtitle={business?.name ?? undefined}>
      {/* Account Info Card */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {session?.user ? "Signed In Account" : "Guest / Demo Mode"}
            </p>
            <p className="text-sm font-bold text-foreground">
              {session?.user?.email ?? "demo@vyapaar.local"}
            </p>
          </div>
        </div>
        {!session?.user && (
          <Button
            size="sm"
            onClick={() => void navigate({ to: "/auth" })}
            className="rounded-full font-semibold"
          >
            Create Account
          </Button>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="tap flex items-center gap-3 px-4 py-4 font-semibold">
              <Icon className="size-5 text-primary" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <SectionTitle>{t("more.language")}</SectionTitle>
      <div className="flex gap-2">
        {LOCALES.map((option) => (
          <button
            key={option.code}
            type="button"
            aria-pressed={locale === option.code}
            onClick={() => setLocale(option.code)}
            className={`min-h-11 flex-1 rounded-full border px-3 font-semibold ${
              locale === option.code
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {option.native}
          </button>
        ))}
      </div>

      {session?.user ? (
        <Button
          variant="outline"
          size="lg"
          className="mt-8 w-full"
          onClick={() => void supabase.auth.signOut()}
        >
          <LogOut className="mr-2 size-5" aria-hidden />
          {t("auth.signOut")}
        </Button>
      ) : (
        <Button
          variant="default"
          size="lg"
          className="mt-8 w-full"
          onClick={() => void navigate({ to: "/auth" })}
        >
          <LogIn className="mr-2 size-5" aria-hidden />
          Sign In / Create Account
        </Button>
      )}
    </AppShell>
  );
}
