// Per-language common typo replacement tables.
// Applied when the user presses Space or Enter after a word.

const RULES_ES: Record<string, string> = {
  "qeu": "que", "Qeu": "Que", "ess": "es", "esot": "esto", "etso": "esto",
  "cuandp": "cuando", "proque": "porque", "Proque": "Porque",
  "tamien": "también", "Tamien": "También", "tambien": "también", "Tambien": "También",
  "despues": "después", "Despues": "Después", "atras": "atrás", "Atras": "Atrás",
  "entonces": "entonces", "ademas": "además", "Ademas": "Además",
  "mediante": "mediante", "segun": "según", "Segun": "Según",
  "analisis": "análisis", "Analisis": "Análisis", "sintesis": "síntesis",
  "metodologia": "metodología", "Metodologia": "Metodología",
  "conclusion": "conclusión", "Conclusion": "Conclusión",
  "introduccion": "introducción", "Introduccion": "Introducción",
  "capitulo": "capítulo", "Capitulo": "Capítulo",
  "seccion": "sección", "Seccion": "Sección",
  "funcion": "función", "Funcion": "Función",
  "relacion": "relación", "Relacion": "Relación",
  "tesis": "tesis", "imagen": "imagen",
};

const RULES_EN: Record<string, string> = {
  "teh": "the", "Teh": "The", "hte": "the", "Hte": "The",
  "adn": "and", "Adn": "And", "nad": "and", "Nad": "And",
  "fro": "for", "Fro": "For", "fo": "for",
  "thsi": "this", "Thsi": "This", "taht": "that", "Taht": "That",
  "wiht": "with", "Wiht": "With", "whit": "with", "Whit": "With",
  "ot": "to", "ot ": "to ", "dont": "don't", "Dont": "Don't",
  "cant": "can't", "Cant": "Can't", "wont": "won't", "Wont": "Won't",
  "its": "its", "recieve": "receive", "Recieve": "Receive",
  "beleive": "believe", "Beleive": "Believe", "alot": "a lot", "Alot": "A lot",
  "seperate": "separate", "Seperate": "Separate", "occured": "occurred",
  "definately": "definitely", "Definately": "Definitely",
  "reserach": "research", "Reserach": "Research",
  "analsyis": "analysis", "Analsyis": "Analysis",
  "methodoology": "methodology",
};

const RULES_FR: Record<string, string> = {
  "jai": "j'ai", "cest": "c'est", "ca": "ça", "Ca": "Ça",
  "deja": "déjà", "Deja": "Déjà", "etait": "était", "Etait": "Était",
  "tres": "très", "Tres": "Très", "meme": "même", "Meme": "Même",
  "aussi": "aussi", "apres": "après", "Apres": "Après",
  "grace": "grâce", "Grace": "Grâce", "bientot": "bientôt",
  "systeme": "système", "Systeme": "Système", "methode": "méthode",
  "analyse": "analyse", "theorie": "théorie", "Theorie": "Théorie",
};

const RULES_DE: Record<string, string> = {
  "dass": "dass", "das": "das", "Ubrigens": "Übrigens",
  "uber": "über", "Uber": "Über", "fur": "für", "Fur": "Für",
  "konnen": "können", "Konnen": "Können", "mussen": "müssen",
  "zuruck": "zurück", "Zuruck": "Zurück", "schliesslich": "schließlich",
  "Schliesslich": "Schließlich", "grosse": "große", "Grosse": "Große",
  "strasse": "Straße", "Strasse": "Straße",
  "Kapitel": "Kapitel", "Abschnitt": "Abschnitt",
};

const RULES: Record<string, Record<string, string>> = {
  es: RULES_ES,
  en: RULES_EN,
  fr: RULES_FR,
  de: RULES_DE,
};

export function autocorrectWord(word: string, lang: string): string | null {
  const rules = RULES[lang];
  if (!rules) return null;
  return rules[word] ?? null;
}

export function applyAutocorrect(
  text: string,
  cursorPos: number,
  lang: string
): { newText: string; newCursor: number } | null {
  const before = text.slice(0, cursorPos);
  const wordMatch = before.match(/(\S+)$/);
  if (!wordMatch) return null;

  const word = wordMatch[1];
  const replacement = autocorrectWord(word, lang);
  if (!replacement || replacement === word) return null;

  const wordStart = cursorPos - word.length;
  const newText = text.slice(0, wordStart) + replacement + text.slice(cursorPos);
  const newCursor = wordStart + replacement.length;
  return { newText, newCursor };
}
