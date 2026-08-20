import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Pencil, Check, Send, Square, Package, BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { interpretUtterance, askBusinessQuestion, transcribeSpeech } from "@/lib/ai/ai.functions";
import { TXN_LABEL } from "@/lib/business/constants";
import {
  useBusiness,
  useCreateTransaction,
  useCreateProduct,
  useUpdateProduct,
  useProducts,
  useCreateReminder,
  resolveParty,
} from "@/lib/data/hooks";
import { money } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n";
import { parseLocally, type Interpretation } from "@/lib/voice/localParser";
import { speakText } from "@/lib/voice/tts";
import { useVoiceRecorder } from "@/lib/voice/useVoiceRecorder";
import type { ManualDraft } from "@/components/app/ManualEntrySheet";

type Stage = "capture" | "transcribing" | "thinking" | "confirm" | "answer";

const CONFIDENT = 0.75;

function toLocalInput(iso?: string | null) {
  const date = iso ? new Date(iso) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function VoiceSheet({
  open,
  onClose,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  onEdit: (draft: ManualDraft) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { data: business } = useBusiness();
  const { data: products } = useProducts(business?.id);
  const createTransaction = useCreateTransaction();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const createReminder = useCreateReminder();
  const interpret = useServerFn(interpretUtterance);
  const ask = useServerFn(askBusinessQuestion);
  const transcribe = useServerFn(transcribeSpeech);
  const recorder = useVoiceRecorder();

  const [stage, setStage] = useState<Stage>("capture");
  const [typed, setTyped] = useState("");
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState<Interpretation | null>(null);
  const [answer, setAnswer] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [partyInput, setPartyInput] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [dueInput, setDueInput] = useState(toLocalInput());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      recorder.cancel();
      return;
    }
    setStage("capture");
    setTyped("");
    setHeard("");
    setResult(null);
    setAnswer("");
    recorder.reset();
    if (recorder.supported) void recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !business) return;
    setHeard(trimmed);
    setStage("thinking");

    let interpretation: Interpretation;
    try {
      interpretation = (await interpret({
        data: { text: trimmed, businessId: business.id },
      })) as Interpretation;
    } catch {
      interpretation = parseLocally(trimmed);
    }

    if (interpretation.spokenResponse) {
      speakText(interpretation.spokenResponse, interpretation.language ?? "hi-en");
    }

    if (interpretation.kind === "question") {
      try {
        const response = await ask({
          data: { businessId: business.id, question: interpretation.question ?? trimmed },
        });
        setAnswer(response.answer);
        speakText(response.answer, interpretation.language ?? "hi-en");
      } catch {
        setAnswer(t("common.error"));
      }
      setStage("answer");
      return;
    }

    if (
      interpretation.kind === "unknown" ||
      (interpretation.kind === "transaction" && !interpretation.type)
    ) {
      toast.error(t("voice.notUnderstood"));
      setStage("capture");
      return;
    }

    void logInteraction(business.id, trimmed, interpretation);
    setResult(interpretation);
    setAmountInput(interpretation.amount ? String(interpretation.amount) : "");
    setPartyInput(interpretation.partyName ?? "");
    setItemInput(interpretation.productName ?? "");
    setQtyInput(interpretation.quantity ? String(interpretation.quantity) : "");
    setDueInput(toLocalInput(interpretation.dueAt));
    setStage("confirm");
  };

  const logInteraction = async (
    businessId: string,
    transcript: string,
    interpretation: Interpretation,
  ) => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.from("voice_interactions").insert({
      business_id: businessId,
      transcript,
      detected_language: interpretation.language,
      intent: interpretation.kind === "transaction" ? interpretation.type : interpretation.kind,
      extracted: interpretation as never,
      confidence: interpretation.confidence,
    } as never);
  };

  /** Stop the mic, check for browser transcript, or upload clip for server transcription. */
  const stopAndProcess = async () => {
    const { clip, transcript: browserTranscript } = await recorder.stop();

    if (browserTranscript && browserTranscript.trim()) {
      await handleText(browserTranscript.trim());
      return;
    }

    if (!clip) {
      toast.error(t("voice.noSpeech"));
      return;
    }
    setStage("transcribing");
    try {
      const body = new FormData();
      body.append("audio", clip, "recording.wav");
      body.append("language", locale === "hi-en" ? "" : locale);
      const { text } = await transcribe({ data: body });
      await handleText(text);
    } catch (err) {
      console.error("STT error:", err);
      toast.error(t("voice.noSpeech"));
      setStage("capture");
    }
  };

  const draftFrom = (interpretation: Interpretation): ManualDraft => ({
    type: interpretation.type!,
    amount: Number(amountInput) || interpretation.amount || null,
    partyName: partyInput || interpretation.partyName || null,
    category: interpretation.category ?? null,
    paymentMethod: interpretation.paymentMethod ?? (interpretation.onCredit ? "credit" : "cash"),
    notes: interpretation.notes ?? null,
    source: "voice",
    confidence: interpretation.confidence,
  });

  const matchedProduct = products?.find(
    (product) => product.name.trim().toLowerCase() === itemInput.trim().toLowerCase(),
  );

  const saveTransaction = async () => {
    if (!result || !business) return;
    const amount = Number(amountInput) || 0;
    if (amount <= 0) return;

    const onCredit = result.onCredit || result.paymentMethod === "credit";
    const finalPartyName =
      partyInput.trim() || (result.type === "sale" && !onCredit ? "Cash / Anonymous" : partyInput.trim());

    const needsParty =
      (result.type === "sale" && onCredit) ||
      result.type === "purchase" ||
      result.type === "payment_in" ||
      result.type === "payment_out";
    if (needsParty && !finalPartyName) return;

    const isCustomer = result.type === "sale" || result.type === "payment_in";
    let customerId: string | null = null;
    let vendorId: string | null = null;
    if (finalPartyName) {
      const party = await resolveParty(
        isCustomer ? "customers" : "vendors",
        business.id,
        finalPartyName,
      );
      if (isCustomer) customerId = party?.id ?? null;
      else vendorId = party?.id ?? null;
    }

    const paid =
      result.type === "payment_in" || result.type === "payment_out"
        ? amount
        : onCredit
          ? 0
          : amount;

    const saved = await createTransaction.mutateAsync({
      business_id: business.id,
      type: result.type!,
      amount,
      amount_paid: paid,
      payment_method: result.paymentMethod ?? "cash",
      category: result.type === "expense" ? (result.category ?? "misc") : null,
      customer_id: customerId,
      vendor_id: vendorId,
      party_name: finalPartyName || null,
      notes: result.notes ?? null,
      source: "voice",
      ai_confidence: result.confidence,
    });

    toast.success(saved.queued ? t("common.offline") : t("voice.recorded"));
    speakText(
      `${finalPartyName ? finalPartyName + " ke liye " : ""} ₹${amount} ki entry save ho gayi`,
      result.language,
    );
  };

  const saveStock = async () => {
    if (!result || !business) return;
    const quantity = Number(qtyInput) || 0;
    const name = itemInput.trim();
    if (!name || quantity <= 0) return;

    const direction = result.stockDirection ?? "in";
    if (matchedProduct) {
      const current = Number(matchedProduct.stock) || 0;
      const next =
        direction === "set"
          ? quantity
          : direction === "out"
            ? current - quantity
            : current + quantity;
      await updateProduct.mutateAsync({ id: matchedProduct.id, stock: Math.max(next, 0) });
    } else {
      await createProduct.mutateAsync({
        business_id: business.id,
        name,
        stock: direction === "out" ? 0 : quantity,
        ...(result.unit ? { unit: result.unit } : {}),
      });
    }
    toast.success(t("voice.stockUpdated"));
    speakText(`${name} ka stock update ho gaya`, result.language);
  };

  const saveReminder = async () => {
    if (!result || !business) return;
    const due = new Date(dueInput);
    if (Number.isNaN(due.getTime())) return;

    let customerId: string | null = null;
    if (partyInput.trim()) {
      const party = await resolveParty("customers", business.id, partyInput);
      customerId = party?.id ?? null;
    }
    await createReminder.mutateAsync({
      business_id: business.id,
      customer_id: customerId,
      amount: Number(amountInput) || null,
      due_at: due.toISOString(),
      note: result.reminderNote ?? result.notes ?? null,
    });
    toast.success(t("voice.reminderSaved"));
    speakText("Payment reminder save ho gaya", result.language);
  };

  const confirm = async () => {
    if (!result) return;
    setSaving(true);
    try {
      if (result.kind === "stock") await saveStock();
      else if (result.kind === "reminder") await saveReminder();
      else await saveTransaction();
      onClose();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const isTxn = result?.kind === "transaction";
  const missingAmount = stage === "confirm" && isTxn && !(Number(amountInput) > 0);
  const missingParty =
    stage === "confirm" &&
    isTxn &&
    result.type !== "expense" &&
    !(result.type === "sale" && !(result.onCredit || result.paymentMethod === "credit")) &&
    !partyInput.trim();
  const missingItem = stage === "confirm" && result?.kind === "stock" && !itemInput.trim();
  const missingQty = stage === "confirm" && result?.kind === "stock" && !(Number(qtyInput) > 0);
  const blocked = missingAmount || missingParty || missingItem || missingQty;

  const title =
    stage === "capture"
      ? recorder.recording
        ? t("voice.listening")
        : t("voice.tapToSpeak")
      : stage === "transcribing"
        ? t("voice.transcribing")
        : stage === "thinking"
          ? t("voice.thinking")
          : stage === "answer"
            ? t("assistant.title")
            : result?.kind === "stock"
              ? t("voice.stockTitle")
              : result?.kind === "reminder"
                ? t("voice.reminderTitle")
                : t("voice.confirmTitle");

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-1">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-8">
          {stage === "capture" ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="relative flex size-32 items-center justify-center">
                {recorder.recording ? (
                  <span
                    className="mic-ring absolute inset-0 rounded-full bg-primary"
                    style={{ opacity: 0.35 + Math.min(recorder.level * 2, 0.6) }}
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    recorder.recording ? void stopAndProcess() : void recorder.start(locale)
                  }
                  aria-label={recorder.recording ? t("common.confirm") : t("voice.tapToSpeak")}
                  className="relative flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
                >
                  {recorder.supported ? (
                    recorder.recording ? (
                      <Square className="size-9" aria-hidden />
                    ) : (
                      <Mic className="size-10" aria-hidden />
                    )
                  ) : (
                    <MicOff className="size-10" aria-hidden />
                  )}
                </button>
              </div>

              <p aria-live="polite" className="min-h-12 text-center text-base font-semibold">
                {recorder.error === "denied"
                  ? t("voice.micDenied")
                  : recorder.error === "empty"
                    ? t("voice.noSpeech")
                    : recorder.error === "failed" || !recorder.supported
                      ? t("voice.unsupported")
                      : recorder.recording
                        ? t("voice.listening")
                        : ""}
              </p>

              {recorder.recording ? (
                <Button size="lg" className="w-full" onClick={() => void stopAndProcess()}>
                  <Check className="mr-1 size-5" aria-hidden />
                  {t("common.confirm")}
                </Button>
              ) : null}

              <form
                className="flex w-full gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  recorder.cancel();
                  void handleText(typed);
                }}
              >
                <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={t("voice.typeInstead")}
                  className="h-12 text-base"
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="secondary"
                  aria-label={t("common.confirm")}
                >
                  <Send className="size-5" aria-hidden />
                </Button>
              </form>

              <div className="w-full rounded-2xl bg-muted p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {t("voice.examples")}
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  <li>“{t("voice.example1")}”</li>
                  <li>“{t("voice.example2")}”</li>
                  <li>“{t("voice.example3")}”</li>
                  <li>“{t("voice.example4")}”</li>
                </ul>
              </div>
            </div>
          ) : null}

          {stage === "transcribing" || stage === "thinking" ? (
            <p className="py-10 text-center text-lg font-semibold text-muted-foreground">
              {stage === "transcribing" ? t("voice.transcribing") : t("voice.thinking")}
            </p>
          ) : null}

          {stage === "answer" ? (
            <div className="space-y-4">
              <p className="whitespace-pre-line rounded-2xl bg-primary-soft p-4 text-base font-medium text-primary">
                {answer}
              </p>
              <p className="text-xs text-muted-foreground">{t("assistant.hint")}</p>
              <Button size="lg" className="w-full" onClick={onClose}>
                {t("common.close")}
              </Button>
            </div>
          ) : null}

          {stage === "confirm" && result ? (
            <div className="space-y-4">
              {heard ? (
                <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  “{heard}”
                </p>
              ) : null}

              <div className="rounded-2xl border border-border bg-card p-4">
                {result.kind === "transaction" ? (
                  <>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {t(TXN_LABEL[result.type!])}
                      {result.onCredit ? ` • ${t("txn.credit")}` : ""}
                    </p>
                    <p className="num mt-1 text-3xl font-bold">
                      {Number(amountInput) > 0 ? money(Number(amountInput)) : "—"}
                    </p>
                  </>
                ) : result.kind === "stock" ? (
                  <>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                      <Package className="size-4" aria-hidden />
                      {result.stockDirection === "out"
                        ? t("voice.stockOut")
                        : result.stockDirection === "set"
                          ? t("voice.stockSet")
                          : t("voice.stockIn")}
                    </p>
                    <p className="num mt-1 text-3xl font-bold">
                      {qtyInput || "—"} {result.unit ?? ""}
                    </p>
                    {itemInput && !matchedProduct ? (
                      <p className="mt-2 text-xs font-semibold text-pending">
                        {t("voice.newItem")}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                      <BellRing className="size-4" aria-hidden />
                      {t("more.reminders")}
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {result.reminderNote ?? result.notes ?? ""}
                    </p>
                  </>
                )}

                {result.kind !== "reminder" && result.notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">“{result.notes}”</p>
                ) : null}
                {result.confidence < CONFIDENT ? (
                  <p className="mt-2 rounded-lg bg-pending-soft px-2 py-1 text-xs font-semibold text-pending">
                    {t("voice.confirmTitle")}
                  </p>
                ) : null}
              </div>

              {result.kind === "stock" ? (
                <>
                  <div>
                    <label htmlFor="v-item" className="mb-1.5 block font-semibold">
                      {missingItem ? t("voice.missingItem") : t("voice.item")}
                    </label>
                    <Input
                      id="v-item"
                      list="v-item-options"
                      value={itemInput}
                      onChange={(event) => setItemInput(event.target.value)}
                      className="h-12 text-base"
                    />
                    <datalist id="v-item-options">
                      {(products ?? []).map((product) => (
                        <option key={product.id} value={product.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="v-qty" className="mb-1.5 block font-semibold">
                      {t("voice.quantity")}
                    </label>
                    <Input
                      id="v-qty"
                      inputMode="decimal"
                      value={qtyInput}
                      onChange={(event) => setQtyInput(event.target.value)}
                      className="num h-14 text-2xl font-bold"
                    />
                  </div>
                </>
              ) : null}

              {result.kind === "reminder" ? (
                <>
                  <div>
                    <label htmlFor="v-due" className="mb-1.5 block font-semibold">
                      {t("voice.dueDate")}
                    </label>
                    <Input
                      id="v-due"
                      type="datetime-local"
                      value={dueInput}
                      onChange={(event) => setDueInput(event.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="v-r-amount" className="mb-1.5 block font-semibold">
                      {t("common.amount")}
                    </label>
                    <Input
                      id="v-r-amount"
                      inputMode="decimal"
                      value={amountInput}
                      onChange={(event) => setAmountInput(event.target.value)}
                      className="num h-12 text-base font-bold"
                    />
                  </div>
                </>
              ) : null}

              {missingAmount ? (
                <div>
                  <label htmlFor="v-amount" className="mb-1.5 block font-semibold">
                    {t("voice.missingAmount")}
                  </label>
                  <Input
                    id="v-amount"
                    inputMode="decimal"
                    autoFocus
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    className="num h-14 text-2xl font-bold"
                  />
                </div>
              ) : null}

              {(isTxn && result.type !== "expense") || result.kind === "reminder" ? (
                <div>
                  <label htmlFor="v-party" className="mb-1.5 block font-semibold">
                    {missingParty ? t("voice.missingParty") : t("common.name")}
                  </label>
                  <Input
                    id="v-party"
                    value={partyInput}
                    onChange={(event) => setPartyInput(event.target.value)}
                    placeholder={result?.type === "sale" ? "Cash / Anonymous (Default)" : t("common.name")}
                    className="h-12 text-base"
                  />
                  {isTxn && result?.type === "sale" ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPartyInput("Cash / Anonymous")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          partyInput === "Cash / Anonymous"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-muted-foreground hover:bg-card"
                        }`}
                      >
                        👤 Cash / Anonymous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartyInput("Other Sale")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          partyInput === "Other Sale"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-muted-foreground hover:bg-card"
                        }`}
                      >
                        🏷️ Other Sale
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartyInput("Walk-in Customer")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          partyInput === "Walk-in Customer"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-muted-foreground hover:bg-card"
                        }`}
                      >
                        🛍️ Walk-in
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    if (isTxn) {
                      onEdit(draftFrom(result));
                      onClose();
                    } else {
                      setResult(null);
                      setStage("capture");
                    }
                  }}
                >
                  <Pencil className="mr-1 size-4" aria-hidden />
                  {isTxn ? t("common.edit") : t("voice.recordAgain")}
                </Button>
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={blocked || saving}
                  onClick={() => void confirm()}
                >
                  <Check className="mr-1 size-5" aria-hidden />
                  {t("common.confirm")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
