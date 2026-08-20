import { Mic, ScanLine } from "lucide-react";

import { useEntry } from "./EntryProvider";
import { useT } from "@/lib/i18n";

export function MicFab() {
  const t = useT();
  const { openVoice, openBill } = useEntry();

  return (
    <>
      <button
        type="button"
        onClick={openBill}
        aria-label={t("bill.scan")}
        className="fixed bottom-16 right-4 z-50 flex size-12 items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg active:scale-95"
      >
        <ScanLine className="size-6" aria-hidden />
      </button>
      <button
        type="button"
        onClick={openVoice}
        aria-label={t("home.recordByVoice")}
        className="fixed bottom-14 left-1/2 z-50 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-xl active:scale-95"
      >
        <Mic className="size-7" aria-hidden />
      </button>
    </>
  );
}
