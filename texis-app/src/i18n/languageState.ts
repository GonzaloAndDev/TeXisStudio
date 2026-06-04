export const UI_LANGUAGE_STORAGE_KEY = "tx-lang";
export const DEFAULT_UI_LANGUAGE = "es";

const LANGUAGE_ALIASES: Record<string, string> = {
  "pt": "pt-BR",
  "pt-br": "pt-BR",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "iw": "he",
};

function parseStoredLanguage(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
  } catch {
    // Plain strings are the current storage format.
  }

  return trimmed;
}

export function normalizeUiLanguage(value?: string | null): string {
  const parsed = parseStoredLanguage(value ?? null) ?? DEFAULT_UI_LANGUAGE;
  const cleaned = parsed.trim();
  const lower = cleaned.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? cleaned;
}

export function readStoredUiLanguage(): string {
  try {
    return normalizeUiLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_LANGUAGE;
  }
}

export function persistUiLanguage(language: string): string {
  const normalized = normalizeUiLanguage(language);
  try {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures; i18next will still hold the runtime language.
  }
  return normalized;
}
