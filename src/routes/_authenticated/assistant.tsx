import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Sparkles, Volume2, VolumeX } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askBusinessQuestion } from "@/lib/ai/ai.functions";
import { useBusiness } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { speakText, stopSpeaking, isSpeaking } from "@/lib/voice/tts";

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
  const { t, locale } = useI18n();
  const { data: business } = useBusiness();
  const ask = useServerFn(askBusinessQuestion);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || !business) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    stopSpeaking();
    setSpeakingIndex(null);

    try {
      const response = await ask({
        data: {
          businessId: business.id,
          question: text,
          locale: locale,
        },
      });
      const newMessages: Message[] = [
        ...messages,
        { role: "user", text },
        { role: "assistant", text: response.answer },
      ];
      setMessages(newMessages);
      const answerIndex = newMessages.length - 1;
      setSpeakingIndex(answerIndex);
      speakText(response.answer, locale, () => setSpeakingIndex(null));
    } catch {
      const fallbackErr = t("common.error");
      const newMessages: Message[] = [
        ...messages,
        { role: "user", text },
        { role: "assistant", text: fallbackErr },
      ];
      setMessages(newMessages);
      const answerIndex = newMessages.length - 1;
      setSpeakingIndex(answerIndex);
      speakText(fallbackErr, locale, () => setSpeakingIndex(null));
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
          <div key={index} className="flex flex-col space-y-1">
            <div
              className={`max-w-[90%] whitespace-pre-line rounded-2xl px-4 py-3 text-base ${
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-primary-soft font-medium text-primary"
              }`}
            >
              {message.text}
            </div>
            {message.role === "assistant" ? (
              <button
                type="button"
                onClick={() => {
                  if (speakingIndex === index || isSpeaking()) {
                    stopSpeaking();
                    setSpeakingIndex(null);
                  } else {
                    setSpeakingIndex(index);
                    speakText(message.text, locale, () => setSpeakingIndex(null));
                  }
                }}
                className="ml-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                {speakingIndex === index ? (
                  <>
                    <VolumeX className="size-3.5 animate-pulse text-destructive" />
                    <span className="text-destructive">Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="size-3.5" />
                    <span>{t("insights.listen")}</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
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
