// Verifies that every locale file has exactly the same keys as en.json.
// A missing key means that language falls back to the fallback chain (es → en),
// which is acceptable — but extra keys in a locale indicate a sync error.

import { describe, it, expect } from "vitest";
import en from "../i18n/locales/en.json";
import es from "../i18n/locales/es.json";
import de from "../i18n/locales/de.json";
import fr from "../i18n/locales/fr.json";
import ja from "../i18n/locales/ja.json";
import zh from "../i18n/locales/zh.json";
import ptBR from "../i18n/locales/pt-BR.json";

type JsonObj = Record<string, unknown>;

function flatKeys(obj: JsonObj, prefix = ""): string[] {
  const result: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result.push(...flatKeys(v as JsonObj, path));
    } else {
      result.push(path);
    }
  }
  return result;
}

const referenceKeys = new Set(flatKeys(en as JsonObj));

const LOCALES: Array<[string, JsonObj]> = [
  ["es", es as JsonObj],
  ["de", de as JsonObj],
  ["fr", fr as JsonObj],
  ["ja", ja as JsonObj],
  ["zh", zh as JsonObj],
  ["pt-BR", ptBR as JsonObj],
];

describe("i18n locale coverage", () => {
  for (const [lang, locale] of LOCALES) {
    const localeKeys = new Set(flatKeys(locale));

    it(`${lang}: no extra keys beyond en.json`, () => {
      const extra = [...localeKeys].filter((k) => !referenceKeys.has(k));
      expect(extra, `Extra keys in ${lang}.json`).toEqual([]);
    });

    it(`${lang}: no missing critical keys (common.* and home.*)`, () => {
      const critical = [...referenceKeys].filter(
        (k) => k.startsWith("common.") || k.startsWith("home."),
      );
      const missing = critical.filter((k) => !localeKeys.has(k));
      expect(missing, `Missing critical keys in ${lang}.json`).toEqual([]);
    });
  }
});
