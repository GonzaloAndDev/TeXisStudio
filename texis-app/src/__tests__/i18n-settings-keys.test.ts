// Targeted test for settings.* keys that are critical for the release-hardening UX:
// the updater-disabled state must have a visible, non-fallback message in every language.

import { describe, it, expect } from "vitest";
import en from "../i18n/locales/en.json";
import es from "../i18n/locales/es.json";
import fr from "../i18n/locales/fr.json";
import de from "../i18n/locales/de.json";
import ptBR from "../i18n/locales/pt-BR.json";
import zh from "../i18n/locales/zh.json";
import ja from "../i18n/locales/ja.json";

type SettingsSection = { update_disabled?: string; update_check_btn?: string; update_error?: string };
type Locale = { settings?: SettingsSection };

const LOCALES: Array<[string, Locale]> = [
  ["en", en as Locale],
  ["es", es as Locale],
  ["fr", fr as Locale],
  ["de", de as Locale],
  ["pt-BR", ptBR as Locale],
  ["zh", zh as Locale],
  ["ja", ja as Locale],
];

const UPDATE_KEYS: Array<keyof SettingsSection> = [
  "update_disabled",
  "update_check_btn",
  "update_error",
];

describe("i18n — settings updater keys present in all locales", () => {
  for (const [lang, locale] of LOCALES) {
    for (const key of UPDATE_KEYS) {
      it(`${lang}: settings.${key} is a non-empty string`, () => {
        const value = locale.settings?.[key];
        expect(value, `settings.${key} missing in ${lang}.json`).toBeDefined();
        expect(typeof value).toBe("string");
        expect((value as string).trim().length, `settings.${key} is empty in ${lang}.json`).toBeGreaterThan(0);
      });
    }
  }

  it("update_disabled is not the same string as update_up_to_date in en", () => {
    // Ensure the disabled state has a distinct message, not reusing "up to date".
    const settings = (en as { settings: Record<string, string> }).settings;
    expect(settings["update_disabled"]).not.toBe(settings["update_up_to_date"]);
  });
});
