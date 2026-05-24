import nspell from "nspell";

type NSpell = ReturnType<typeof nspell>;

const cache: Record<string, Promise<NSpell>> = {};

async function loadDictionary(lang: string): Promise<NSpell> {
  const [affRes, dicRes] = await Promise.all([
    fetch(`/dictionaries/${lang}/index.aff`),
    fetch(`/dictionaries/${lang}/index.dic`),
  ]);
  if (!affRes.ok || !dicRes.ok) throw new Error(`Dictionary ${lang} not found`);
  const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
  return nspell({ aff, dic });
}

export function getSpeller(lang: string): Promise<NSpell> {
  if (!cache[lang]) cache[lang] = loadDictionary(lang);
  return cache[lang];
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
