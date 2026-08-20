import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

import { flushQueuedTransactions } from "@/lib/data/hooks";
import { pendingCount } from "@/lib/data/offlineQueue";
import { useT } from "@/lib/i18n";

/** Shows connectivity + queued-entry state so the user always knows their data is safe. */
export function SyncBadge() {
  const t = useT();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(pendingCount());

    const sync = async () => {
      setOnline(true);
      if (pendingCount() === 0) return;
      setSyncing(true);
      await flushQueuedTransactions();
      setQueued(pendingCount());
      setSyncing(false);
    };
    const offline = () => setOnline(false);

    window.addEventListener("online", sync);
    window.addEventListener("offline", offline);
    void sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", offline);
    };
  }, []);

  if (online && queued === 0 && !syncing) return null;

  return (
    <span
      role="status"
      className="flex items-center gap-1 rounded-full bg-pending-soft px-2 py-1 text-[11px] font-semibold text-pending"
    >
      {online ? (
        <RefreshCw className="size-3.5" aria-hidden />
      ) : (
        <CloudOff className="size-3.5" aria-hidden />
      )}
      {online ? t("common.syncing") : t("common.offline")}
    </span>
  );
}
