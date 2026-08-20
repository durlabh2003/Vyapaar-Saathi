import { Link } from "@tanstack/react-router";
import { Home, ReceiptText, Users, BarChart3, Menu } from "lucide-react";

import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const items: { to: string; icon: typeof Home; label: TranslationKey; exact?: boolean }[] = [
  { to: "/", icon: Home, label: "nav.home", exact: true },
  { to: "/transactions", icon: ReceiptText, label: "nav.transactions" },
  { to: "/customers", icon: Users, label: "nav.customers" },
  { to: "/insights", icon: BarChart3, label: "nav.insights" },
  { to: "/more", icon: Menu, label: "nav.more" },
];

export function BottomNav() {
  const t = useT();

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ to, icon: Icon, label, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: !!exact }}
              className="tap flex flex-col items-center justify-center gap-1 py-2 text-muted-foreground data-[status=active]:text-primary"
            >
              <Icon className="size-6" aria-hidden />
              <span className="text-[11px] font-semibold leading-none">{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
