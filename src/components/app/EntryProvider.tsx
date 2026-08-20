import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { BillSheet } from "./BillSheet";
import { ManualEntrySheet, type ManualDraft } from "./ManualEntrySheet";
import { VoiceSheet } from "@/components/voice/VoiceSheet";
import type { TxnType } from "@/lib/business/constants";

type EntryValue = {
  openVoice: () => void;
  openBill: () => void;
  openManual: (type: TxnType, draft?: Partial<ManualDraft>) => void;
};

const EntryContext = createContext<EntryValue | null>(null);

export function EntryProvider({ children }: { children: ReactNode }) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [draft, setDraft] = useState<ManualDraft | null>(null);

  const openVoice = useCallback(() => setVoiceOpen(true), []);
  const openBill = useCallback(() => setBillOpen(true), []);
  const openManual = useCallback(
    (type: TxnType, extra?: Partial<ManualDraft>) => setDraft({ type, ...extra }),
    [],
  );

  const value = useMemo(
    () => ({ openVoice, openBill, openManual }),
    [openVoice, openBill, openManual],
  );

  return (
    <EntryContext.Provider value={value}>
      {children}
      <VoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onEdit={(next) => setDraft(next)}
      />
      <BillSheet
        open={billOpen}
        onClose={() => setBillOpen(false)}
        onReview={(next) => setDraft(next)}
      />
      <ManualEntrySheet draft={draft} onClose={() => setDraft(null)} />
    </EntryContext.Provider>
  );
}

export function useEntry() {
  const ctx = useContext(EntryContext);
  if (!ctx) throw new Error("useEntry must be used inside EntryProvider");
  return ctx;
}
