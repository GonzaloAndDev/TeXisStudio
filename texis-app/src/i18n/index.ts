import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import es from "./locales/es.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { t: es }, en: { t: en }, fr: { t: fr }, de: { t: de }, zh: { t: zh }, ja: { t: ja } },
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

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español", flag: "🇲🇽" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

export const SPELL_CHECK_LANGS: Record<string, string | null> = {
  es: "es",
  en: "en",
  fr: "fr",
  de: "de",
  zh: null,
  ja: null,
};

export const LT_LANG_CODES: Record<string, string> = {
  es: "es",
  en: "en-US",
  fr: "fr",
  de: "de-DE",
  zh: "zh-CN",
  ja: "ja-JP",
};
