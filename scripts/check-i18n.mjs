#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const bundledDir = join(root, "texis-app", "src", "i18n", "locales");
const languagesRepo = process.env.TEXIS_LANGUAGES_REPO
  ? resolve(process.env.TEXIS_LANGUAGES_REPO)
  : resolve(root, "..", "TeXisStudio-Languages");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function flatten(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function compareLocale(label, path, canonicalKeys) {
  const data = readJson(path);
  const keys = new Set(flatten(data));
  const missing = canonicalKeys.filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !canonicalKeys.includes(key));
  return { label, missing, extra };
}

const canonicalPath = join(bundledDir, "en.json");
const canonicalKeys = flatten(readJson(canonicalPath)).sort();
const checks = [];

for (const file of readdirSync(bundledDir).filter((name) => name.endsWith(".json")).sort()) {
  checks.push(compareLocale(`bundled:${file.replace(/\.json$/, "")}`, join(bundledDir, file), canonicalKeys));
}

const packsDir = join(languagesRepo, "packs");
if (existsSync(packsDir)) {
  for (const id of readdirSync(packsDir).sort()) {
    const uiPath = join(packsDir, id, "ui.json");
    if (existsSync(uiPath)) checks.push(compareLocale(`pack:${id}`, uiPath, canonicalKeys));
  }
}

const failed = checks.filter((check) => check.missing.length || check.extra.length);
if (failed.length) {
  for (const check of failed) {
    console.error(`\\n${check.label}`);
    if (check.missing.length) console.error(`  missing: ${check.missing.join(", ")}`);
    if (check.extra.length) console.error(`  extra: ${check.extra.join(", ")}`);
  }
  process.exit(1);
}

console.log(`i18n OK: ${checks.length} locale files match ${canonicalKeys.length} keys.`);
