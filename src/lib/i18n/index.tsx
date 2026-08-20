import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { LOCALES, translations, type Locale, type TranslationKey } from "./translations";

const STORAGE_KEY = "vs.locale";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  speechLang: string;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return !!value && LOCALES.some((l) => l.code === value);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    const nav = window.navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("hi")) setLocaleState("hi");
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = translations[locale];
    return {
      locale,
      setLocale,
      t: (key) => dict[key] ?? translations.en[key] ?? key,
      speechLang: LOCALES.find((l) => l.code === locale)?.speech ?? "en-IN",
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export { LOCALES };
export type { Locale, TranslationKey };
