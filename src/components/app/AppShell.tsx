import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { MicFab } from "./MicFab";
import { SyncBadge } from "./SyncBadge";

type Props = {
  title: string;
  subtitle?: string | undefined;
  back?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
  /** Hide the bottom navigation for focused flows like onboarding. */
  bare?: boolean;
};

export function AppShell({ title, subtitle, back, action, children, bare }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          {back ? (
            <Link
              to={back}
              aria-label="Back"
              className="tap -ml-2 flex items-center justify-center rounded-full text-muted-foreground"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl leading-tight">{title}</h1>
            {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action}
          <SyncBadge />
        </div>
      </header>

      <main className={`mx-auto max-w-lg px-4 pt-4 ${bare ? "pb-8" : "pb-32"}`}>{children}</main>

      {bare ? null : (
        <>
          <MicFab />
          <BottomNav />
        </>
      )}
    </div>
  );
}
