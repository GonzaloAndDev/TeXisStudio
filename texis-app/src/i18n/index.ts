import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import es from "./locales/es.json";
import en from "./locales/en.json";

import { getInstalledLocales } from "../services/languagePacks";

// Build initial resources from bundled + already-installed language packs
const bundled: Record<string, { t: Record<string, unknown> }> = {
  es: { t: es as Record<string, unknown> },
  en: { t: en as Record<string, unknown> },
};

const installed = getInstalledLocales();
for (const { id, data } of installed) {
  bundled[id] = { t: data };
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: bundled,
    ns: ["t"],
    defaultNS: "t",
    fallbackLng: "es",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "tx-lang",
    },
    interpolation: { escapeValue: false },
  });

export default i18n;

/** Register a locale at runtime (called after installing a language pack). */
export function registerDynamicLocale(id: string, data: Record<string, unknown>): void {
  if (!i18n.hasResourceBundle(id, "t")) {
    i18n.addResourceBundle(id, "t", data, true, true);
  }
}

// ── Bundled language catalogue ───────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español",   flag: "🇲🇽", bundled: true  },
  { code: "en", label: "English",   flag: "🇺🇸", bundled: true  },
];

// Spell-check language codes (null = no Hunspell dict bundled)
export const SPELL_CHECK_LANGS: Record<string, string | null> = {
  es: "es",
  en: "en",
};

export const LT_LANG_CODES: Record<string, string> = {
  es: "es",
  en: "en-US",
  fr: "fr",
  de: "de-DE",
  zh: "zh-CN",
  ja: "ja-JP",
  ru: "ru-RU",
  "pt-BR": "pt-BR",
  th: "th",
  hi: "hi-IN",
};
