import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Send, Mic, Volume2, VolumeX, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { SectionTitle } from "@/components/app/EmptyState";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askBusinessQuestion } from "@/lib/ai/ai.functions";
import { EXPENSE_CATEGORIES } from "@/lib/business/constants";
import {
  averageSale,
  dailySeries,
  expenseByCategory,
  inRange,
  payables,
  receivables,
  topParties,
  totals,
} from "@/lib/business/metrics";
import { useBusiness, useCustomers, useTransactions } from "@/lib/data/hooks";
import { compactMoney, daysAgo, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { speakText, stopSpeaking, isSpeaking } from "@/lib/voice/tts";
import { useEntry } from "@/components/app/EntryProvider";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Vyapaar Saathi" },
      {
        name: "description",
        content: "Sales trends, expense split and custom AI business Q&A for your shop.",
      },
      { property: "og:title", content: "Insights — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Sales trends, expense split and custom AI business Q&A for your shop.",
      },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { t, locale } = useI18n();
  const { openVoice } = useEntry();
  const { data: business } = useBusiness();
  const { data: txns = [] } = useTransactions(business?.id, { days: 120 });
  const { data: customers = [] } = useCustomers(business?.id);
  const askFn = useServerFn(askBusinessQuestion);

  const [range, setRange] = useState<7 | 30>(7);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);

  const [speaking, setSpeaking] = useState(false);

  const scoped = inRange(txns, daysAgo(range - 1));
  const sums = totals(scoped);
  const series = dailySeries(scoped, range);
  const peak = Math.max(...series.map((day) => day.sales), 1);
  const categories = expenseByCategory(scoped);
  const maxCategory = Math.max(...categories.map((row) => row.amount), 1);
  const top = topParties(scoped, "customer_id");

  const labelFor = (value: string) =>
    EXPENSE_CATEGORIES.find((category) => category.value === value)?.label ??
    ("cat.misc" as TranslationKey);

  const handleAskQuestion = async (queryText?: string) => {
    const textToAsk = (queryText ?? question).trim();
    if (!textToAsk || !business) return;
    setQuestion(textToAsk);
    setAsking(true);
    setAnswer(null);
    stopSpeaking();
    setSpeaking(false);

    try {
      const res = await askFn({
        data: {
          businessId: business.id,
          question: textToAsk,
          locale: locale,
        },
      });
      setAnswer(res.answer);
      setSpeaking(true);
      speakText(res.answer, locale, () => setSpeaking(false));
    } catch (err) {
      console.warn("Server AI Q&A failed, attempting deterministic client answer:", err);
      try {
        const { loadSnapshot, answerQuestion } = await import("@/lib/ai/answer.server");
        const { supabase } = await import("@/integrations/supabase/client");
        const snapshot = await loadSnapshot(supabase, business.id);
        const response = await answerQuestion(textToAsk, snapshot, locale);
        setAnswer(response.answer);
        setSpeaking(true);
        speakText(response.answer, locale, () => setSpeaking(false));
      } catch {
        const fallbackError = t("common.error");
        setAnswer(fallbackError);
        setSpeaking(true);
        speakText(fallbackError, locale, () => setSpeaking(false));
      }
    } finally {
      setAsking(false);
    }
  };

  const sampleQuestions =
    locale === "hi"
      ? [
          "इस हफ़्ते कितना कुल मुनाफ़ा हुआ?",
          "किस ग्राहक पर सबसे ज़्यादा उधार बाकी है?",
          "मेरा सबसे बड़ा ख़र्चा कौन सा है?",
          "कौन सा सामान कम स्टॉक में है?",
        ]
      : locale === "en"
        ? [
            "What was my total profit this week?",
            "Which customer owes me the most money?",
            "What are my highest expense items?",
            "Which products need stock reordering?",
          ]
        : [
            "Is hafte kitna net profit hua?",
            "Kis customer ka sabse zyada udhaar baki hai?",
            "Sabse bada kharcha kis cheez ka hua?",
            "Konsa product low stock mein hai?",
          ];

  const handleCopyAnswer = () => {
    if (!answer) return;
    void navigator.clipboard.writeText(answer);
    setCopied(true);
    toast.success("Answer copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell title={t("insights.title")}>
      {/* Range Selector */}
      <div className="flex gap-2">
        {([7, 30] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={`min-h-11 flex-1 rounded-full border px-3 font-semibold transition-all ${
              range === value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {value === 7 ? t("insights.week") : t("insights.month")}
          </button>
        ))}
      </div>

      {/* Interactive AI Insights & Business Q&A Card */}
      <div className="mt-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{t("insights.askTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("insights.askSubtitle")}</p>
            </div>
          </div>
        </div>

        {/* Preset Sample Chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sampleQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void handleAskQuestion(q)}
              disabled={asking}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
            >
              ✨ {q}
            </button>
          ))}
        </div>

        {/* Input & Voice Controls */}
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAskQuestion();
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("insights.askPlaceholder")}
            className="h-11 flex-1 rounded-2xl text-sm"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={openVoice}
            title="Speak Question"
            className="size-11 shrink-0 rounded-2xl border-primary/30 text-primary hover:bg-primary/10"
          >
            <Mic className="size-5" aria-hidden />
          </Button>

          <Button
            type="submit"
            size="icon"
            disabled={asking || !question.trim()}
            className="size-11 shrink-0 rounded-2xl"
          >
            <Send className="size-5" aria-hidden />
          </Button>
        </form>

        {/* AI Answer Card */}
        {asking ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-primary/10 bg-primary/5 p-3.5 text-xs font-medium text-primary">
            <Sparkles className="size-4 animate-spin" />
            <span>{t("insights.thinking")}</span>
          </div>
        ) : answer ? (
          <div className="mt-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Vyapaar AI Answer
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (speaking || isSpeaking()) {
                      stopSpeaking();
                      setSpeaking(false);
                    } else {
                      setSpeaking(true);
                      speakText(answer, locale, () => setSpeaking(false));
                    }
                  }}
                  className="h-8 gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  {speaking ? (
                    <>
                      <VolumeX className="size-4 animate-pulse text-destructive" />
                      <span className="text-destructive">Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-4" />
                      <span>{t("insights.listen")}</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAnswer}
                  className="size-8 rounded-xl text-muted-foreground hover:bg-muted"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-2.5 whitespace-pre-line text-sm font-medium text-foreground leading-relaxed">
              {answer}
            </p>
          </div>
        ) : null}
      </div>

      {/* KPI Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label={t("insights.revenue")} value={sums.sales} tone="income" />
        <StatCard
          label={t("home.expenses")}
          value={sums.expenses + sums.purchases}
          tone="expense"
        />
        <StatCard label={t("home.profit")} value={sums.profit} tone="primary" large />
        <StatCard label={t("insights.avgOrder")} value={averageSale(scoped)} tone="neutral" />
      </div>

      {/* Sales Trend Chart */}
      <SectionTitle>{t("insights.salesTrend")}</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex h-40 items-end gap-1.5">
          {series.map((day) => (
            <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${Math.max((day.sales / peak) * 100, 2)}%` }}
                role="img"
                aria-label={`${day.day}: ${money(day.sales)}`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{series[0]?.day.slice(5)}</span>
          <span className="num">{compactMoney(peak)}</span>
          <span>{series[series.length - 1]?.day.slice(5)}</span>
        </p>
      </div>

      {/* Expense Split */}
      <SectionTitle>{t("insights.expenseSplit")}</SectionTitle>
      {categories.length ? (
        <ul className="space-y-2 rounded-2xl border border-border bg-card p-4">
          {categories.map((row) => (
            <li key={row.category}>
              <div className="flex justify-between gap-2 text-sm font-semibold">
                <span className="truncate">{t(labelFor(row.category))}</span>
                <span className="num shrink-0">{money(row.amount)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-expense"
                  style={{ width: `${(row.amount / maxCategory) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("common.none")}
        </p>
      )}

      {/* Top Customers */}
      <SectionTitle>{t("insights.topCustomers")}</SectionTitle>
      {top.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {top.map((row) => (
            <li key={row.id} className="flex justify-between gap-2 px-4 py-3 font-semibold">
              <span className="truncate">
                {customers.find((customer) => customer.id === row.id)?.name ?? "—"}
              </span>
              <span className="num shrink-0">{money(row.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("common.none")}
        </p>
      )}

      {/* Snapshot */}
      <SectionTitle>{t("home.snapshot")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("insights.receivables")} value={receivables(txns)} tone="pending" />
        <StatCard label={t("insights.payables")} value={payables(txns)} tone="expense" />
      </div>
    </AppShell>
  );
}
