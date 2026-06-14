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

/**
 * Reads a value from localStorage with a strongly-typed fallback. An optional
 * `validate` predicate guards against corrupted or out-of-domain persisted
 * values — without it, a stale or hand-edited storage entry like
 *   localStorage["tx-user-mode"] = '"garbage"'
 * would propagate through the app as a string outside the allowed union and
 * break exhaustive switches downstream.
 */
function load<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      console.warn(`[settings] invalid persisted value for ${key}, falling back`);
      return fallback;
    }
    return parsed as T;
  } catch (e) {
    console.warn(`[settings] failed to read ${key}:`, e);
    return fallback;
  }
}

function save<T>(key: string, v: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    // Quota errors (rare but real on the SmartTV / private-mode webview) used
    // to disappear silently — the in-memory state was updated but reload
    // discarded the change. Surface to the console so it's at least diagnosable.
    console.warn(`[settings] failed to persist ${key}:`, e);
  }
}

// ── Validators for persisted enums / unions ───────────────────────
const isUserMode = (v: unknown): v is "basic" | "advanced" =>
  v === "basic" || v === "advanced";
const isUiScale = (v: unknown): v is "normal" | "large" | "xlarge" =>
  v === "normal" || v === "large" || v === "xlarge";
const isWindowMode = (v: unknown): v is WindowMode =>
  v === "default" || v === "remember" || v === "maximized";
const isStringOrNull = (v: unknown): v is string | null =>
  v === null || typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isString = (v: unknown): v is string => typeof v === "string";
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isLatexBackend = (v: unknown): v is LatexBackend =>
  v === "tectonic" || v === "latexmk";

export const useSettingsStore = create<SettingsState>((set) => ({
  lang: readStoredUiLanguage(),
  userMode: load<"basic" | "advanced">("tx-user-mode", "basic", isUserMode),
  uiScale: load<"normal" | "large" | "xlarge">("tx-ui-scale", "normal", isUiScale),
  windowMode: load<WindowMode>("tx-window-mode", "default", isWindowMode),
  spellLang: load<string | null>("tx-spell-lang", "es", isStringOrNull),
  autocorrectEnabled: load<boolean>("tx-autocorrect", true, isBool),
  grammarAutoCheck: load<boolean>("tx-grammar-auto", false, isBool),
  grammarEnabled: load<boolean>("tx-grammar", true, isBool),
  customDictionary: load<string[]>("tx-custom-dict", [], isStringArray),
  userName: load<string>("tx-user-name", "", isString),
  userInstitution: load<string>("tx-user-institution", "", isString),
  userEmail: load<string>("tx-user-email", "", isString),
  projectDir: load<string>("tx-project-dir", "", isString),
  latexPrimaryBackend: load<LatexBackend>("tx-latex-primary-backend", "tectonic", isLatexBackend),
  latexAllowFallback: load<boolean>("tx-latex-allow-fallback", true, isBool),
  latexBackendUserExplicit: load<boolean>("tx-latex-backend-explicit", false, isBool),

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
      const trimmed = word.trim();
      // Reject empty additions — they used to slip through and silently bloat
      // the dictionary on disk. Case-insensitive dedupe matches how the
      // spellchecker actually queries the dict.
      if (!trimmed) return s;
      const lower = trimmed.toLowerCase();
      if (s.customDictionary.some((w) => w.toLowerCase() === lower)) return s;
      const next = [...s.customDictionary, trimmed];
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
