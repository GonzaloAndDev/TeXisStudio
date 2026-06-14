import nspell from "nspell";
import { getSpellingUrls } from "./languagePacks";

type NSpell = ReturnType<typeof nspell>;

const cache: Record<string, Promise<NSpell>> = {};

// Bundled dicts live at /dictionaries/{lang}/index.{aff,dic}
const BUNDLED_LANGS = new Set(["en", "es", "fr", "de"]);

// Dictionary fetches over a slow connection (or an offline community pack
// host) should not hang the panel indefinitely. 20 s is generous for a
// localhost-style bundled fetch and still bounded enough to surface real
// network failures.
const DICT_FETCH_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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

  const [affRes, dicRes] = await Promise.all([
    fetchWithTimeout(affUrl, DICT_FETCH_TIMEOUT_MS),
    fetchWithTimeout(dicUrl, DICT_FETCH_TIMEOUT_MS),
  ]);
  if (!affRes.ok || !dicRes.ok) {
    throw new Error(`Dictionary ${lang} fetch failed (${affRes.status}/${dicRes.status})`);
  }
  const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
  return nspell({ aff, dic });
}

export function getSpeller(lang: string): Promise<NSpell> {
  let p = cache[lang];
  if (!p) {
    p = loadDictionary(lang);
    cache[lang] = p;
    // If the load rejects, evict the failed promise so a subsequent call
    // retries instead of permanently returning the cached rejection.
    p.catch(() => {
      if (cache[lang] === p) delete cache[lang];
    });
  }
  return p;
}

/** Bust the cache for a language — call after installing/uninstalling a pack. */
export function invalidateSpeller(lang: string): void {
  delete cache[lang];
}

/**
 * Tokenizador LaTeX-aware: extrae solo texto visible para el corrector ortográfico.
 * Salta comandos LaTeX, entornos matemáticos, comentarios y argumentos técnicos.
 */
function tokenizeLatex(source: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];

  // Construimos una máscara de caracteres "visibles" (true = es texto revisable)
  // El resto (comandos, math, comentarios) queda marcado como false
  const visible = new Uint8Array(source.length).fill(1);

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    // 1. Comentario LaTeX: % hasta fin de línea
    if (ch === "%" && (i === 0 || source[i - 1] !== "\\")) {
      const end = source.indexOf("\n", i);
      const commentEnd = end === -1 ? source.length : end + 1;
      visible.fill(0, i, commentEnd);
      i = commentEnd;
      continue;
    }

    // 2. Entornos matemáticos: $$...$$ y $...$
    if (ch === "$") {
      const isDouble = source[i + 1] === "$";
      const closeMarker = isDouble ? "$$" : "$";
      const searchFrom = i + closeMarker.length;
      const closeIdx = source.indexOf(closeMarker, searchFrom);
      const mathEnd = closeIdx === -1 ? source.length : closeIdx + closeMarker.length;
      visible.fill(0, i, mathEnd);
      i = mathEnd;
      continue;
    }

    // 3. \[...\] y \(...\)
    if (ch === "\\" && (source[i + 1] === "[" || source[i + 1] === "(")) {
      const closeMarker = source[i + 1] === "[" ? "\\]" : "\\)";
      const closeIdx = source.indexOf(closeMarker, i + 2);
      const mathEnd = closeIdx === -1 ? source.length : closeIdx + 2;
      visible.fill(0, i, mathEnd);
      i = mathEnd;
      continue;
    }

    // 4. Comandos LaTeX: \command
    if (ch === "\\") {
      // \comando → marcar el nombre del comando como invisible
      let j = i + 1;
      // Comandos de una sola letra especial (\{, \}, \%, etc.)
      if (j < source.length && !isAlpha(source[j])) {
        visible.fill(0, i, j + 1);
        i = j + 1;
        continue;
      }
      // Comando alfanumérico
      while (j < source.length && isAlpha(source[j])) j++;
      const cmdName = source.slice(i + 1, j);
      visible.fill(0, i, j);

      // Saltar espacios opcionales después del comando
      while (j < source.length && source[j] === " ") j++;

      // Argumentos opcionales [...]
      if (j < source.length && source[j] === "[") {
        const closeOpt = findMatchingBracket(source, j, "[", "]");
        visible.fill(0, j, closeOpt);
        j = closeOpt;
      }

      // Argumentos obligatorios {...}
      // Para comandos que toman texto visible (\textbf, \emph, \text*, etc.)
      // el contenido SÍ se revisa — solo marcamos la llave como invisible
      const TEXT_COMMANDS = new Set([
        "textbf", "textit", "emph", "text", "textrm", "texttt", "textsc",
        "textsl", "underline", "textup", "textsf", "textmd", "textlf",
        "mbox", "hbox", "vbox", "fbox", "footnote", "caption", "title",
        "author", "chapter", "section", "subsection", "subsubsection",
        "paragraph", "subparagraph",
      ]);

      const SKIP_COMMANDS = new Set([
        "cite", "citet", "citep", "parencite", "textcite", "autocite",
        "citeauthor", "citeyear", "citealt", "citealp",
        "label", "ref", "pageref", "autoref", "cref", "Cref", "nameref",
        "eqref", "vref",
        "includegraphics", "input", "include", "bibliography", "addbibresource",
        "usepackage", "documentclass", "newcommand", "renewcommand",
        "gls", "glspl", "Gls", "acrshort", "acrlong", "acr",
        "url", "href", "hyperref",
        "begin", "end",
        "color", "textcolor", "colorbox",
        "setlength", "setcounter", "addtocounter",
        "bibitem",
      ]);

      if (j < source.length && source[j] === "{") {
        if (SKIP_COMMANDS.has(cmdName)) {
          // Marcar el argumento completo como invisible
          const closeArg = findMatchingBrace(source, j);
          visible.fill(0, j, closeArg);
          j = closeArg;
        } else if (TEXT_COMMANDS.has(cmdName)) {
          // Solo marcar las llaves, el contenido queda visible
          visible[j] = 0;
          const closeArg = findMatchingBrace(source, j);
          if (closeArg < source.length) visible[closeArg - 1] = 0;
          j = closeArg;
        } else {
          // Comando desconocido: ser conservador y saltar el argumento
          const closeArg = findMatchingBrace(source, j);
          visible.fill(0, j, closeArg);
          j = closeArg;
        }
      }

      i = j;
      continue;
    }

    // 5. Entorno \begin{nombre}...\end{nombre}
    // ya manejado por la detección de \begin arriba (el argumento {nombre} se salta)

    i++;
  }

  // Ahora extraer tokens de las posiciones visibles
  const wordRe = /[A-Za-zÀ-ÖØ-öø-ÿÁáÉéÍíÓóÚúÑñÜüÄäÖöÜüÂâÊêÎîÔôÛûÀàÈèÙùÃãÕõ'-]+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(source)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    // Verificar que la mayor parte del token es visible
    let visibleChars = 0;
    for (let k = start; k < end; k++) {
      if (visible[k]) visibleChars++;
    }
    if (visibleChars < m[0].length * 0.6) continue; // Más del 40% invisible → saltar

    const word = m[0].replace(/^'+|'+$/g, "");
    if (word.length > 1) {
      tokens.push({ word, start, end });
    }
  }

  return tokens;
}

function isAlpha(ch: string): boolean {
  return /[A-Za-z@]/.test(ch);
}

function findMatchingBrace(source: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}

function findMatchingBracket(source: string, openPos: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openPos; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}

/** Tokenizador para texto plano (no LaTeX). Usado en paneles sin LaTeX. */
function tokenizePlain(text: string): { word: string; start: number; end: number }[] {
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
  customWords: string[] = [],
  isLatex = true,
): Promise<SpellError[]> {
  const speller = await getSpeller(lang);
  const tokens = isLatex ? tokenizeLatex(text) : tokenizePlain(text);
  // Custom dictionary previously scanned linearly per token (O(N×M)) — turn it
  // into a lowercase Set once so each lookup is O(1). Matters on long sections
  // with long user dictionaries.
  const customLower = new Set<string>();
  for (const w of customWords) customLower.add(w.toLowerCase());
  const errors: SpellError[] = [];

  for (const { word, start, end } of tokens) {
    const lower = word.toLowerCase();
    if (customLower.has(lower)) continue;
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
