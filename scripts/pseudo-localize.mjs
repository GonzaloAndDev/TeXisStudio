#!/usr/bin/env node
// Pseudolocalización (Programa de Excelencia §7).
//
// Genera un locale "pseudo" a partir de en.json para detectar, mediante prueba
// visual, texto cortado, layouts rígidos, cadenas concatenadas y claves visibles.
// Acentúa el texto, lo envuelve en corchetes y lo expande ~40 % (las traducciones
// reales suelen ser más largas), PRESERVANDO los placeholders intactos.
//
// Uso:
//   node scripts/pseudo-localize.mjs           # escribe pseudo.json
//   node scripts/pseudo-localize.mjs --check   # valida que se preserven los placeholders (CI)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "texis-app", "src", "i18n", "locales");
const enPath = join(localesDir, "en.json");
const outPath = join(localesDir, "pseudo.json");

// Placeholders soportados: {{var}}, {0}, %s, %d.
const PLACEHOLDER = /(\{\{[^}]+\}\}|\{\d+\}|%[sd])/g;

const ACCENTS = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ǧ", h: "ĥ", i: "í",
  j: "ĵ", k: "ķ", l: "ł", m: "ɱ", n: "ñ", o: "ó", p: "þ", q: "ɋ", r: "ř",
  s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ǧ", H: "Ĥ", I: "Í",
  J: "Ĵ", K: "Ķ", L: "Ł", M: "Ɱ", N: "Ñ", O: "Ó", P: "Þ", Q: "Ɋ", R: "Ř",
  S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

function accent(text) {
  let out = "";
  for (const ch of text) out += ACCENTS[ch] ?? ch;
  return out;
}

function placeholders(text) {
  return (text.match(PLACEHOLDER) ?? []).sort();
}

// Pseudo-localiza una cadena, sin tocar los placeholders.
function pseudo(text) {
  const parts = text.split(PLACEHOLDER);
  const transformed = parts
    .map((p) => (PLACEHOLDER.test(p) ? p : accent(p)))
    .join("");
  PLACEHOLDER.lastIndex = 0;
  // Expansión ~40 % para revelar truncamiento; padding visible.
  const padLen = Math.max(2, Math.round(text.replace(PLACEHOLDER, "").length * 0.4));
  const pad = "·".repeat(padLen);
  return `⟦${transformed}${pad}⟧`;
}

function walk(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, fn));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, fn);
    return out;
  }
  return value;
}

const en = JSON.parse(readFileSync(enPath, "utf8"));
const check = process.argv.includes("--check");

if (check) {
  const mismatches = [];
  walk(en, (str) => {
    const before = placeholders(str);
    const after = placeholders(pseudo(str));
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      mismatches.push({ str, before, after });
    }
    return str;
  });
  if (mismatches.length > 0) {
    console.error(`✗ Pseudolocalización corrompe placeholders en ${mismatches.length} cadena(s):`);
    for (const m of mismatches.slice(0, 10)) {
      console.error(`  "${m.str}"  ${JSON.stringify(m.before)} → ${JSON.stringify(m.after)}`);
    }
    process.exit(1);
  }
  console.log("✓ Pseudolocalización preserva todos los placeholders.");
} else {
  const pseudoTree = walk(en, pseudo);
  writeFileSync(outPath, JSON.stringify(pseudoTree, null, 2) + "\n", "utf8");
  console.log(`✓ Escrito ${outPath} (locale pseudo para pruebas visuales).`);
}
