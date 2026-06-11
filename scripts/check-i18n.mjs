#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundledDir = join(root, "texis-app", "src", "i18n", "locales");
const languagesRepo = process.env.TEXIS_LANGUAGES_REPO
  ? resolve(process.env.TEXIS_LANGUAGES_REPO)
  : resolve(root, "..", "TeXisStudio-Languages");
const pluginsDir = resolve(root, "..", "TeXisStudio-Plugins", "visual-plugins", "i18n");
const profilesDir = resolve(root, "..", "TeXisStudio-Profiles", "i18n");

function readJson(path) {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

function flatten(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function flatEntries(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flatEntries(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [[prefix, value]];
}

function placeholders(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{\{[^}]+\}\}/g)]
    .map((match) => match[0])
    .sort();
}

function compareLocale(label, path, canonicalData, canonicalKeys) {
  const data = readJson(path);
  const keys = new Set(flatten(data));
  const missing = canonicalKeys.filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !canonicalKeys.includes(key));
  const canonicalValues = new Map(flatEntries(canonicalData));
  const values = new Map(flatEntries(data));
  const placeholderErrors = canonicalKeys.flatMap((key) => {
    if (!values.has(key)) return [];
    const expected = placeholders(canonicalValues.get(key));
    const actual = placeholders(values.get(key));
    return JSON.stringify(expected) === JSON.stringify(actual)
      ? []
      : [`${key} (${expected.join(" ")} != ${actual.join(" ")})`];
  });
  const sameAsEnglish = canonicalKeys.filter((key) =>
    typeof canonicalValues.get(key) === "string" &&
    canonicalValues.get(key) === values.get(key),
  ).length;
  return { label, missing, extra, placeholderErrors, sameAsEnglish };
}

const canonicalPath = join(bundledDir, "en.json");
const canonicalData = readJson(canonicalPath);
const canonicalKeys = flatten(canonicalData).sort();
const checks = [];

for (const file of readdirSync(bundledDir).filter((name) => name.endsWith(".json")).sort()) {
  checks.push(compareLocale(`bundled:${file.replace(/\.json$/, "")}`, join(bundledDir, file), canonicalData, canonicalKeys));
}

const packsDir = join(languagesRepo, "packs");
const languageIds = new Set(["en", "es"]);
if (existsSync(packsDir)) {
  for (const id of readdirSync(packsDir).sort()) {
    const uiPath = join(packsDir, id, "ui.json");
    if (existsSync(uiPath)) {
      languageIds.add(id);
      checks.push(compareLocale(`pack:${id}`, uiPath, canonicalData, canonicalKeys));
    }
  }
}

function addCatalogChecks(dir, prefix) {
  if (!existsSync(dir)) return;
  const enPath = join(dir, "en.json");
  const en = readJson(enPath);
  const keys = flatten(en).sort();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    checks.push(compareLocale(`${prefix}:${file.replace(/\.json$/, "")}`, join(dir, file), en, keys));
  }
}

addCatalogChecks(pluginsDir, "plugins");
addCatalogChecks(profilesDir, "profiles");

function localeIds(dir) {
  return new Set(readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, "")));
}

const idErrors = [];
for (const [label, ids] of [["plugins", localeIds(pluginsDir)], ["profiles", localeIds(profilesDir)]]) {
  const missing = [...languageIds].filter((id) => !ids.has(id));
  const extra = [...ids].filter((id) => !languageIds.has(id));
  if (missing.length || extra.length) idErrors.push(`${label} (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const hardcodedAllow = [
  /^(?:Tectonic|MiKTeX|TeX Live 2024|TeXisStudio|LaTeX|XeLaTeX|LuaLaTeX|pdfLaTeX|PDF|UI|CI|ACR|babel|polyglossia)$/,
  /^(?:book|article|report|memoir|APA 7|Vancouver|IEEE|Chicago 17|MLA 9|MHRA|ABNT|GB\/T 7714)$/,
  /^(?:GitHub: GonzaloAndDev|grammar_remote: false)$/,
  /^(?:Gonzalo Andrade Estrella|AGPL v3 \+ Commons Clause)$/,
  /^(?:1\.5 cm|4\.0 cm)$/,
  /^(?:e\.g\. \\ce\{H2O\})$/,
];

function allowedHardcoded(value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || !/[A-Za-zÀ-ÿ]/.test(text)) return true;
  if (!text.includes(" ")) return true;
  return hardcodedAllow.some((pattern) => pattern.test(text));
}

const hardcoded = [];
const staticKeys = new Set();
for (const path of walk(join(root, "texis-app", "src")).filter((file) => file.endsWith(".tsx"))) {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(/\b(?:t|i18n\.t)\(\s*["']([^"']+)["']/g)) staticKeys.add(match[1]);
  for (const match of source.matchAll(/<(?:span|div|p|button|strong|em|li|option|code|h[1-6])\b[^>]*>\s*([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)\s*<\/(?:span|div|p|button|strong|em|li|option|code|h[1-6])>/g)) {
    if (!allowedHardcoded(match[1])) hardcoded.push(`${path.slice(root.length + 1)}: ${match[1].trim()}`);
  }
  for (const match of source.matchAll(/\b(?:title|aria-label)="([^"]*[A-Za-zÀ-ÿ][^"]*)"/g)) {
    if (!allowedHardcoded(match[1])) hardcoded.push(`${path.slice(root.length + 1)}: ${match[1].trim()}`);
  }
}

const availableStaticKeys = new Set([
  ...canonicalKeys,
  ...flatten(readJson(join(pluginsDir, "en.json"))),
  ...flatten(readJson(join(profilesDir, "en.json"))),
]);
const missingStaticKeys = [...staticKeys].filter((key) =>
  !availableStaticKeys.has(key)
  && !(availableStaticKeys.has(`${key}_one`) && availableStaticKeys.has(`${key}_other`)),
).sort();

const failed = checks.filter((check) => check.missing.length || check.extra.length || check.placeholderErrors.length);
if (failed.length) {
  for (const check of failed) {
    console.error(`\\n${check.label}`);
    if (check.missing.length) console.error(`  missing: ${check.missing.join(", ")}`);
    if (check.extra.length) console.error(`  extra: ${check.extra.join(", ")}`);
    if (check.placeholderErrors.length) console.error(`  placeholders: ${check.placeholderErrors.join(", ")}`);
  }
}

if (hardcoded.length) {
  console.error("\nHardcoded visible UI text:");
  for (const item of hardcoded) console.error(`  ${item}`);
}

if (missingStaticKeys.length) console.error(`\nStatic t() keys missing from English resources: ${missingStaticKeys.join(", ")}`);
if (idErrors.length) console.error(`\nLocale ID mismatch: ${idErrors.join("; ")}`);

const unchangedByGroup = checks.reduce((totals, check) => {
  const group = check.label.split(":", 1)[0];
  totals[group] = (totals[group] ?? 0) + check.sameAsEnglish;
  return totals;
}, {});
console.log(`Unchanged strings (review only): ${Object.entries(unchangedByGroup).map(([group, count]) => `${group}=${count}`).join(", ")}`);

if (failed.length || hardcoded.length || missingStaticKeys.length || idErrors.length) process.exit(1);
console.log(`i18n OK: ${checks.length} locale files; bundled/packs match ${canonicalKeys.length} keys.`);
