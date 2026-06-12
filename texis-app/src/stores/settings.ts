import { create } from "zustand";
import { persistUiLanguage, readStoredUiLanguage } from "../i18n/languageState";
import type { LatexBackend } from "../lib/latexBackendPreference";
import type { WindowMode } from "../services/windowPreferences";

interface SettingsState {
  lang: string;
  userMode: "basic" | "advanced";
  uiScale: "normal" | "large" | "xlarge";
  windowMode: WindowMode;
  spellLang: string | null;
  autocorrectEnabled: boolean;
  grammarAutoCheck: boolean;
  grammarEnabled: boolean;
  customDictionary: string[];
  userName: string;
  userInstitution: string;
  userEmail: string;
  projectDir: string;
  latexPrimaryBackend: LatexBackend;
  latexAllowFallback: boolean;
  /** false = auto-upgrade allowed; true = user explicitly chose a backend */
  latexBackendUserExplicit: boolean;

  setLang: (lang: string) => void;
  setUserMode: (mode: "basic" | "advanced") => void;
  setUiScale: (scale: "normal" | "large" | "xlarge") => void;
  setWindowMode: (mode: WindowMode) => void;
  setSpellLang: (lang: string | null) => void;
  setAutocorrect: (v: boolean) => void;
  setGrammarAutoCheck: (v: boolean) => void;
  setGrammarEnabled: (v: boolean) => void;
  addToCustomDictionary: (word: string) => void;
  removeFromCustomDictionary: (word: string) => void;
  setUserName: (v: string) => void;
  setUserInstitution: (v: string) => void;
  setUserEmail: (v: string) => void;
  setProjectDir: (v: string) => void;
  setLatexPrimaryBackend: (backend: LatexBackend) => void;
  setLatexAllowFallback: (enabled: boolean) => void;
  setLatexBackendUserExplicit: (v: boolean) => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, v: T): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export const useSettingsStore = create<SettingsState>((set) => ({
  lang: readStoredUiLanguage(),
  userMode: load("tx-user-mode", "basic"),
  uiScale: load("tx-ui-scale", "normal"),
  windowMode: load("tx-window-mode", "default"),
  spellLang: load("tx-spell-lang", "es"),
  autocorrectEnabled: load("tx-autocorrect", true),
  grammarAutoCheck: load("tx-grammar-auto", false),
  grammarEnabled: load("tx-grammar", true),
  customDictionary: load("tx-custom-dict", []),
  userName: load("tx-user-name", ""),
  userInstitution: load("tx-user-institution", ""),
  userEmail: load("tx-user-email", ""),
  projectDir: load("tx-project-dir", ""),
  latexPrimaryBackend: load("tx-latex-primary-backend", "tectonic"),
  latexAllowFallback: load("tx-latex-allow-fallback", true),
  latexBackendUserExplicit: load("tx-latex-backend-explicit", false),

  setLang: (lang) => {
    set({ lang: persistUiLanguage(lang) });
  },
  setUserMode: (userMode) => {
    save("tx-user-mode", userMode);
    set({ userMode });
  },
  setUiScale: (uiScale) => {
    save("tx-ui-scale", uiScale);
    document.documentElement.dataset.uiScale = uiScale;
    set({ uiScale });
  },
  setWindowMode: (windowMode) => {
    save("tx-window-mode", windowMode);
    set({ windowMode });
  },
  setSpellLang: (spellLang) => {
    save("tx-spell-lang", spellLang);
    set({ spellLang });
  },
  setAutocorrect: (v) => {
    save("tx-autocorrect", v);
    set({ autocorrectEnabled: v });
  },
  setGrammarAutoCheck: (v) => {
    save("tx-grammar-auto", v);
    set({ grammarAutoCheck: v });
  },
  setGrammarEnabled: (v) => {
    save("tx-grammar", v);
    set({ grammarEnabled: v });
  },
  addToCustomDictionary: (word) =>
    set((s) => {
      if (s.customDictionary.includes(word)) return s;
      const next = [...s.customDictionary, word];
      save("tx-custom-dict", next);
      return { customDictionary: next };
    }),
  removeFromCustomDictionary: (word) =>
    set((s) => {
      const next = s.customDictionary.filter((w) => w !== word);
      save("tx-custom-dict", next);
      return { customDictionary: next };
    }),
  setUserName: (v) => { save("tx-user-name", v); set({ userName: v }); },
  setUserInstitution: (v) => { save("tx-user-institution", v); set({ userInstitution: v }); },
  setUserEmail: (v) => { save("tx-user-email", v); set({ userEmail: v }); },
  setProjectDir: (v) => { save("tx-project-dir", v); set({ projectDir: v }); },
  setLatexPrimaryBackend: (latexPrimaryBackend) => {
    save("tx-latex-primary-backend", latexPrimaryBackend);
    set({ latexPrimaryBackend });
  },
  setLatexAllowFallback: (latexAllowFallback) => {
    save("tx-latex-allow-fallback", latexAllowFallback);
    set({ latexAllowFallback });
  },
  setLatexBackendUserExplicit: (v) => {
    save("tx-latex-backend-explicit", v);
    set({ latexBackendUserExplicit: v });
  },
}));
