#!/usr/bin/env node
// Linter de contenido (Programa de Excelencia §8).
//
// Verifica que los archivos de locale no usen variantes inconsistentes de los
// términos canónicos del producto (glosario en docs/content/glossary.json).
// Coincidencia por palabra completa y sensible a mayúsculas; solo variantes
// objetivamente incorrectas (no preferencias de estilo).
//
// Uso: node scripts/content-lint.mjs   (exit ≠ 0 si hay violaciones)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const glossaryPath = join(root, "docs", "content", "glossary.json");
const localesDir = join(root, "texis-app", "src", "i18n", "locales");

const glossary = JSON.parse(readFileSync(glossaryPath, "utf8"));

// Escapa metacaracteres de regex.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Construye, por variante prohibida, un regex de palabra completa. Para variantes
// que empiezan/terminan en carácter de palabra usamos \b; si contienen espacios
// (p. ej. "Texis Studio") delimitamos por no-letra.
function variantRegex(variant) {
  const body = esc(variant);
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u");
}

const rules = glossary.terms.flatMap((t) =>
  t.forbidden.map((v) => ({ canonical: t.canonical, variant: v, re: variantRegex(v) })),
);

function walk(value, path, fn) {
  if (typeof value === "string") return fn(value, path);
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`, fn));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, fn);
  }
}

const violations = [];
for (const file of readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
  const tree = JSON.parse(readFileSync(join(localesDir, file), "utf8"));
  walk(tree, "", (str, path) => {
    for (const rule of rules) {
      if (rule.re.test(str)) {
        violations.push({ file, path, variant: rule.variant, canonical: rule.canonical, str });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} variante(s) de término inconsistente(s):`);
  for (const v of violations.slice(0, 40)) {
    console.error(`  ${v.file} ${v.path}: "${v.variant}" → usar "${v.canonical}"`);
  }
  process.exit(1);
}
console.log("✓ Contenido consistente con el glosario de producto.");
