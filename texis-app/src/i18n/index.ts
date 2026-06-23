import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import es from "./locales/es.json";
import en from "./locales/en.json";

import { getInstalledLocales } from "../services/languagePacks";
import { persistUiLanguage, readStoredUiLanguage } from "./languageState";

type LocaleModule = { default: Record<string, unknown> };

const UI_LOCALE_LOADERS: Record<string, () => Promise<LocaleModule>> = {
  de: () => import("./locales/de.json"),
  fr: () => import("./locales/fr.json"),
  ja: () => import("./locales/ja.json"),
  zh: () => import("./locales/zh.json"),
  "pt-BR": () => import("./locales/pt-BR.json"),
};

const loadingLocales: Record<string, Promise<boolean> | undefined> = {};

// Build initial resources from the core fallback locales + already-installed language packs.
const bundled: Record<string, { t: Record<string, unknown> }> = {
  es: { t: es as Record<string, unknown> },
  en: { t: en as Record<string, unknown> },
};

const installed = getInstalledLocales();
for (const { id, data } of installed) {
  bundled[id] = { t: data };
}

const initialLanguage = persistUiLanguage(readStoredUiLanguage());

i18n
  .use(initReactI18next)
  .init({
    resources: bundled,
    lng: initialLanguage,
    ns: ["t"],
    defaultNS: "t",
    fallbackLng: ["es", "en"],
    interpolation: { escapeValue: false },
  });

i18n.on("languageChanged", (language) => {
  persistUiLanguage(language);
});

export default i18n;

/** Register a locale at runtime (called after installing a language pack). */
export function registerDynamicLocale(id: string, data: Record<string, unknown>): void {
  i18n.addResourceBundle(id, "t", data, true, true);
}

/** Register an installed remote locale from localStorage before switching to it. */
export async function ensureDynamicLocale(id: string): Promise<boolean> {
  if (i18n.hasResourceBundle(id, "t")) return true;

  const bundledLoader = UI_LOCALE_LOADERS[id];
  if (bundledLoader) {
    loadingLocales[id] ??= bundledLoader()
      .then((mod) => {
        registerDynamicLocale(id, mod.default);
        return true;
      })
      .catch(() => false);
    return loadingLocales[id] ?? false;
  }

  const raw = localStorage.getItem(`tx-lang-pack-ui:${id}`);
  if (!raw) return false;

  try {
    registerDynamicLocale(id, JSON.parse(raw) as Record<string, unknown>);
    return true;
  } catch {
    return false;
  }
}

if (!i18n.hasResourceBundle(initialLanguage, "t")) {
  void ensureDynamicLocale(initialLanguage).then((loaded) => {
    if (loaded && i18n.language === initialLanguage) {
      void i18n.changeLanguage(initialLanguage);
    }
  });
}

// ── Bundled language catalogue ───────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español",   flag: "🇲🇽", bundled: true  },
  { code: "en", label: "English",   flag: "🇺🇸", bundled: true  },
  { code: "fr", label: "Français",  flag: "🇫🇷", bundled: true  },
  { code: "de", label: "Deutsch",   flag: "🇩🇪", bundled: true  },
  { code: "ja", label: "日本語",     flag: "🇯🇵", bundled: true  },
  { code: "zh", label: "中文",       flag: "🇨🇳", bundled: true  },
  { code: "pt-BR", label: "Português", flag: "🇧🇷", bundled: true },
];

// Spell-check language codes (null = no Hunspell dict bundled)
export const SPELL_CHECK_LANGS: Record<string, string | null> = {
  es: "es",
  en: "en",
  fr: "fr",
  de: "de",
  ja: null,
  zh: null,
  "pt-BR": null,
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
