import nspell from "nspell";
import { getSpellingUrls } from "./languagePacks";

type NSpell = ReturnType<typeof nspell>;

const cache: Record<string, Promise<NSpell>> = {};

// Bundled dicts live at /dictionaries/{lang}/index.{aff,dic}
const BUNDLED_LANGS = new Set(["en", "es", "fr", "de"]);

async function loadDictionary(lang: string): Promise<NSpell> {
  let affUrl: string;
  let dicUrl: string;

  if (BUNDLED_LANGS.has(lang)) {
    affUrl = `/dictionaries/${lang}/index.aff`;
    dicUrl = `/dictionaries/${lang}/index.dic`;
  } else {
    // Community pack — URLs come from installed pack metadata
    const urls = getSpellingUrls(lang);
    if (!urls) throw new Error(`No spelling dictionary installed for lang: ${lang}`);
    affUrl = urls.aff;
    dicUrl = urls.dic;
  }

  const [affRes, dicRes] = await Promise.all([fetch(affUrl), fetch(dicUrl)]);
  if (!affRes.ok || !dicRes.ok) throw new Error(`Dictionary ${lang} not found`);
  const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
  return nspell({ aff, dic });
}

export function getSpeller(lang: string): Promise<NSpell> {
  if (!cache[lang]) cache[lang] = loadDictionary(lang);
  return cache[lang];
}

/** Bust the cache for a language — call after installing/uninstalling a pack. */
export function invalidateSpeller(lang: string): void {
  delete cache[lang];
}

function tokenize(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /[A-Za-zÀ-ÖØ-öø-ÿÁáÉéÍíÓóÚúÑñÜüÄäÖöÜüÂâÊêÎîÔôÛûÀàÈèÙùÃãÕõ'-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const word = m[0].replace(/^'+|'+$/g, "");
    if (word.length > 1) tokens.push({ word, start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

export interface SpellError {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

export async function checkText(
  text: string,
  lang: string,
  customWords: string[] = []
): Promise<SpellError[]> {
  const speller = await getSpeller(lang);
  const tokens = tokenize(text);
  const errors: SpellError[] = [];

  for (const { word, start, end } of tokens) {
    const lower = word.toLowerCase();
    if (customWords.some((w) => w.toLowerCase() === lower)) continue;
    if (speller.correct(word) || speller.correct(lower)) continue;
    errors.push({ word, start, end, suggestions: speller.suggest(word).slice(0, 5) });
  }

  return errors;
}

export function checkWord(word: string, speller: NSpell, customWords: string[]): boolean {
  const lower = word.toLowerCase();
  if (customWords.some((w) => w.toLowerCase() === lower)) return true;
  return speller.correct(word) || speller.correct(lower);
}

export function suggestWord(word: string, speller: NSpell): string[] {
  return speller.suggest(word).slice(0, 6);
}
