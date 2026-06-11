// Verifies that every locale file has exactly the same keys as en.json.
// Bundled locales must remain exact structural peers of en.json.

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

function placeholders(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{\{[^}]+\}\}/g)]
    .map((match) => match[0])
    .sort();
}

function flatValues(obj: JsonObj, prefix = "", out = new Map<string, unknown>()): Map<string, unknown> {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatValues(value as JsonObj, path, out);
    } else out.set(path, value);
  }
  return out;
}

const referenceValues = flatValues(en as JsonObj);

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

    it(`${lang}: no missing keys`, () => {
      const missing = [...referenceKeys].filter((key) => !localeKeys.has(key));
      expect(missing, `Missing keys in ${lang}.json`).toEqual([]);
    });

    it(`${lang}: interpolation placeholders match en.json`, () => {
      const values = flatValues(locale);
      const mismatches = [...referenceKeys].filter((key) =>
        JSON.stringify(placeholders(referenceValues.get(key))) !== JSON.stringify(placeholders(values.get(key))),
      );
      expect(mismatches, `Placeholder mismatches in ${lang}.json`).toEqual([]);
    });
  }
});
