import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askBusinessQuestion } from "@/lib/ai/ai.functions";
import { useBusiness } from "@/lib/data/hooks";
import { useT } from "@/lib/i18n";
import { speakText } from "@/lib/voice/tts";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Business assistant — Vyapaar Saathi" },
      {
        name: "description",
        content: "Ask about profit, udhaar or expenses and get grounded answers.",
      },
      { property: "og:title", content: "Business assistant — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Ask about profit, udhaar or expenses and get grounded answers.",
      },
    ],
  }),
  component: AssistantPage,
});

type Message = { role: "user" | "assistant"; text: string };

function AssistantPage() {
  const t = useT();
  const { data: business } = useBusiness();
  const ask = useServerFn(askBusinessQuestion);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || !business) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const response = await ask({ data: { businessId: business.id, question: text } });
      setMessages((prev) => [...prev, { role: "assistant", text: response.answer }]);
      speakText(response.answer);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t("common.error") }]);
    } finally {
      setBusy(false);
    }
  };

  const samples = [t("voice.example4"), t("home.toReceive"), t("insights.expenseSplit")];

  return (
    <AppShell title={t("assistant.title")} back="/">
      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-5 text-primary" aria-hidden />
              {t("assistant.placeholder")}
            </p>
            <ul className="mt-3 space-y-2">
              {samples.map((sample) => (
                <li key={sample}>
                  <button
                    type="button"
                    onClick={() => setQuestion(sample)}
                    className="tap w-full rounded-xl bg-muted px-3 py-2 text-left text-sm font-medium"
                  >
                    {sample}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <p
            key={index}
            className={`max-w-[90%] whitespace-pre-line rounded-2xl px-4 py-3 text-base ${
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-primary-soft font-medium text-primary"
            }`}
          >
            {message.text}
          </p>
        ))}

        {busy ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("assistant.thinking")}
          </p>
        ) : null}
      </div>

      <form className="mt-5 flex gap-2" onSubmit={submit}>
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("assistant.placeholder")}
          className="h-12 text-base"
        />
        <Button type="submit" size="lg" disabled={busy} aria-label={t("common.confirm")}>
          <Send className="size-5" aria-hidden />
        </Button>
      </form>

      <p className="mt-2 text-xs text-muted-foreground">{t("assistant.hint")}</p>
    </AppShell>
  );
}
