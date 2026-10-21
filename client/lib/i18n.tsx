"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import hi from "@/locales/hi.json";
import pt from "@/locales/pt.json";
import zh from "@/locales/zh.json";
import fr from "@/locales/fr.json";
import useAuthStore from "@/store/authStore";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "fr", label: "Français" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];
const DICTS: Record<string, Record<string, string>> = { en, es, hi, pt, zh, fr };
const LOCALES: Record<string, string> = { en: "en-IN", es: "es-ES", hi: "hi-IN", pt: "pt-BR", zh: "zh-CN", fr: "fr-FR" };

type Ctx = { lang: Lang; t: (key: string, params?: Record<string, any>) => string; fmtDate: (d: any, opts?: Intl.DateTimeFormatOptions) => string; setLocalLang: (l: Lang) => void };
const I18nContext = createContext<Ctx | null>(null);

export function translate(lang: string, key: string, params?: Record<string, any>) {
  let s = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s: any) => s.user);
  const [localLang, setLocal] = useState<Lang>("en");
  useEffect(() => { const l = localStorage.getItem("lang") as Lang; if (l && DICTS[l]) setLocal(l); }, []);
  const lang: Lang = (user?.language && DICTS[user.language] ? user.language : localLang) as Lang;
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem("lang", lang); }, [lang]);
  const t = useCallback((key: string, params?: Record<string, any>) => translate(lang, key, params), [lang]);
  const fmtDate = useCallback((d: any, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) => (d ? new Date(d).toLocaleString(LOCALES[lang], opts) : "—"), [lang]);
  const setLocalLang = (l: Lang) => setLocal(l);
  const v = useMemo(() => ({ lang, t, fmtDate, setLocalLang }), [lang, t, fmtDate]);
  return <I18nContext.Provider value={v}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
/** Translate an axios error using the server's `code` field. */
export function errorText(t: Ctx["t"], error: any) {
  const d = error?.response?.data;
  if (d?.code) {
    const k = `errors.${d.code}`;
    const tr = t(k, d);
    if (tr !== k) return tr;
  }
  return d?.message || error?.message || t("errors.generic");
}
