import { create } from "zustand";

interface SettingsState {
  lang: string;
  spellLang: string | null;
  autocorrectEnabled: boolean;
  grammarAutoCheck: boolean;
  grammarEnabled: boolean;
  customDictionary: string[];

  setLang: (lang: string) => void;
  setSpellLang: (lang: string | null) => void;
  setAutocorrect: (v: boolean) => void;
  setGrammarAutoCheck: (v: boolean) => void;
  setGrammarEnabled: (v: boolean) => void;
  addToCustomDictionary: (word: string) => void;
  removeFromCustomDictionary: (word: string) => void;
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
  lang: load("tx-lang", "es"),
  spellLang: load("tx-spell-lang", "es"),
  autocorrectEnabled: load("tx-autocorrect", true),
  grammarAutoCheck: load("tx-grammar-auto", false),
  grammarEnabled: load("tx-grammar", true),
  customDictionary: load("tx-custom-dict", []),

  setLang: (lang) => {
    save("tx-lang", lang);
    set({ lang });
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
}));
