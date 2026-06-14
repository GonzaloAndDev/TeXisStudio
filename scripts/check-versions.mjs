#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function cargoVersion(relativePath) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const match = source.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error(`No package version found in ${relativePath}`);
  return match[1];
}

function sourceVersion(relativePath) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const match = source.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  if (!match) throw new Error(`No APP_VERSION found in ${relativePath}`);
  return match[1];
}

function readmeVersion() {
  const source = readFileSync(join(root, "README.md"), "utf8");
  const match = source.match(/^Version:\s*([^\s]+)$/m);
  if (!match) throw new Error("No Version field found in README.md");
  return match[1];
}

const versions = new Map([
  ["texis-app/package.json", readJson("texis-app/package.json").version],
  ["README.md", readmeVersion()],
  ["texis-app/package-lock.json", readJson("texis-app/package-lock.json").version],
  ["texis-app/src-tauri/tauri.conf.json", readJson("texis-app/src-tauri/tauri.conf.json").version],
  ["texis-app/src/version.ts", sourceVersion("texis-app/src/version.ts")],
  ["texis-app/src-tauri/Cargo.toml", cargoVersion("texis-app/src-tauri/Cargo.toml")],
  ["texis-core/Cargo.toml", cargoVersion("texis-core/Cargo.toml")],
  ["texis-cli/Cargo.toml", cargoVersion("texis-cli/Cargo.toml")],
]);

const expected = versions.values().next().value;
const mismatches = [...versions].filter(([, version]) => version !== expected);

if (mismatches.length) {
  console.error("Version mismatch:");
  for (const [path, version] of versions) console.error(`  ${path}: ${version}`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expected)) {
  console.error(`Invalid semantic version: ${expected}`);
  process.exit(1);
}

console.log(`Versions OK: ${expected} (${versions.size} manifests)`);
