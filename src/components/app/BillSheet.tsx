import { useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { ManualDraft } from "./ManualEntrySheet";
import { extractBill } from "@/lib/ai/ai.functions";
import type { BillExtraction } from "@/lib/ai/bill.types";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

const ACCEPT = "image/*,application/pdf";

export function BillSheet({
  open,
  onClose,
  onReview,
}: {
  open: boolean;
  onClose: () => void;
  onReview: (draft: ManualDraft) => void;
}) {
  const t = useT();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<{
    url: string | null;
    name: string;
    isPdf: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillExtraction | null>(null);

  const reset = () => {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setResult(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    setResult(null);
    setPreview({ url: isPdf ? null : URL.createObjectURL(file), name: file.name, isPdf });
    setBusy(true);
    try {
      const body = new FormData();
      body.set("bill", file);
      body.set("filename", file.name);
      const data = await extractBill({ data: body });
      setResult(data);
    } catch {
      toast.error(t("bill.failed"));
    } finally {
      setBusy(false);
    }
  };

  const review = () => {
    if (!result) return;
    const noteParts = [
      t("bill.fromBill"),
      result.billNumber ? `#${result.billNumber}` : null,
      result.billDate,
    ].filter(Boolean);
    onReview({
      type: result.type,
      amount: result.total,
      partyName: result.partyName,
      category: result.category,
      paymentMethod: result.paymentMethod,
      notes: noteParts.join(" · "),
      source: "manual",
      confidence: result.confidence,
    });
    close();
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{t("bill.title")}</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-8">
          {!preview ? (
            <>
              <p className="text-sm text-muted-foreground">{t("bill.help")}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold active:scale-[0.98]"
                >
                  <Camera className="size-8 text-primary" aria-hidden />
                  {t("bill.camera")}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold active:scale-[0.98]"
                >
                  <ImageIcon className="size-8 text-primary" aria-hidden />
                  {t("bill.file")}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-muted">
                {preview.url ? (
                  <img
                    src={preview.url}
                    alt={t("bill.preview")}
                    className="max-h-56 w-full object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <FileText className="size-8 text-primary" aria-hidden />
                    <span className="truncate text-sm font-semibold">{preview.name}</span>
                  </div>
                )}
              </div>

              {busy ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  {t("bill.reading")}
                </div>
              ) : null}

              {result ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {t(`txn.${result.type}`)}
                    </span>
                    <span className="num text-2xl font-bold">
                      {result.total ? money(result.total) : "—"}
                    </span>
                  </div>
                  {result.partyName ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("common.name")}: </span>
                      {result.partyName}
                    </p>
                  ) : null}
                  {result.items.length ? (
                    <ul className="space-y-1 border-t border-border pt-2 text-sm">
                      {result.items.map((item, index) => (
                        <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                          <span className="truncate">
                            {item.name}
                            {item.quantity ? ` × ${item.quantity}` : ""}
                          </span>
                          <span className="num text-muted-foreground">
                            {item.amount ? money(item.amount) : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {result.confidence < 0.6 ? (
                    <p className="text-sm font-semibold text-destructive">
                      {t("bill.lowConfidence")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={reset}
                  disabled={busy}
                >
                  <RefreshCw className="size-5" aria-hidden />
                  {t("bill.retake")}
                </Button>
                <Button size="lg" className="flex-1" onClick={review} disabled={busy || !result}>
                  {t("bill.review")}
                </Button>
              </div>
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
