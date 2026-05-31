#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const appDir = join(root, "texis-app");

const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);
const normalizedCommand = {
  run: "dev",
  start: "dev",
  app: "dev",
  installer: "build",
  installers: "build",
  compile: "build",
  compiler: "build",
  package: "build",
  dist: "build",
  check: "frontend-build",
  frontend: "frontend-build",
}[command] ?? command;

let activeTimer = null;

function run(cmd, cmdArgs, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd ?? root,
      stdio: "inherit",
      shell: options.shell ?? false,
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${cmd} ${cmdArgs.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function dev() {
  printDevContext();
  await ensureNodeModules();
  await runNpm(["run", "tauri", "dev"], appDir);
}

async function build() {
  startTimer("build");
  printBuildContext();
  switch (process.platform) {
    case "win32":
      await run("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", "build-windows.ps1"),
        ...args,
      ]);
      break;
    case "darwin":
      await run("bash", [join(root, "scripts", "build-mac.sh"), ...args]);
      break;
    case "linux":
      await run("bash", [join(root, "scripts", "build-linux.sh"), ...args]);
      break;
    default:
      throw new Error(`Sistema operativo no soportado para build local: ${process.platform}`);
  }
  finishTimer("build");
}

async function frontendBuild() {
  startTimer("frontend-build");
  printFrontendContext();
  await ensureNodeModules();
  await runNpm(["run", "build"], appDir);
  finishTimer("frontend-build");
}

async function ensureNodeModules() {
  if (existsSync(join(appDir, "node_modules"))) {
    return;
  }
  await runNpm(["ci"], appDir);
}

function runNpm(npmArgs, cwd) {
  if (process.platform === "win32") {
    const psCwd = cwd.replaceAll("'", "''");
    const commandLine = `$ErrorActionPreference='Stop'; Set-Location -LiteralPath '${psCwd}'; & npm.cmd ${npmArgs.join(" ")}`;
    return run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      commandLine,
    ]);
  }
  return run("npm", npmArgs, { cwd });
}

function help() {
  console.log(`
TeXisStudio helper

Usage:
  node scripts/texis.mjs run             Run the Tauri app in development mode
  node scripts/texis.mjs dev             Run the Tauri app in development mode
  node scripts/texis.mjs installer       Build installer/package for this OS
  node scripts/texis.mjs build           Detect OS and run the native build
  node scripts/texis.mjs frontend-build  Type-check and build the React frontend

Build targets:
  Windows -> scripts/build-windows.ps1
  Linux   -> scripts/build-linux.sh
  macOS   -> scripts/build-mac.sh
`);
}

function startTimer(label) {
  activeTimer = {
    label,
    startedAt: new Date(),
    startedMs: Date.now(),
  };

  console.log("");
  console.log("========================================");
  console.log(`  TeXisStudio ${label}`);
  console.log("========================================");
  console.log(`  Inicio : ${formatDate(activeTimer.startedAt)}`);
}

function finishTimer(label) {
  const finishedAt = new Date();
  const startedMs = activeTimer?.startedMs ?? Date.now();
  const elapsedMs = Date.now() - startedMs;

  console.log("");
  console.log("========================================");
  console.log(`  ${label} terminado`);
  console.log("========================================");
  console.log(`  Fin      : ${formatDate(finishedAt)}`);
  console.log(`  Duracion : ${formatDuration(elapsedMs)}`);
  console.log("");

  activeTimer = null;
}

function printBuildContext() {
  console.log(`  SO      : ${process.platform} ${process.arch}`);
  console.log(`  Root    : ${root}`);
  console.log(`  App     : ${appDir}`);
  console.log(`  Node    : ${process.version}`);
  console.log("");
}

function printFrontendContext() {
  console.log(`  Root    : ${root}`);
  console.log(`  App     : ${appDir}`);
  console.log(`  Node    : ${process.version}`);
  console.log("");
}

function printDevContext() {
  console.log("");
  console.log("========================================");
  console.log("  TeXisStudio dev");
  console.log("========================================");
  console.log(`  Root    : ${root}`);
  console.log(`  App     : ${appDir}`);
  console.log(`  Node    : ${process.version}`);
  console.log("  Comando : npm run tauri dev");
  console.log("");
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(":");
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min ${seconds} s`;
  }
  if (minutes > 0) {
    return `${minutes} min ${seconds} s`;
  }
  return `${seconds} s`;
}

try {
  if (normalizedCommand === "dev") {
    await dev();
  } else if (normalizedCommand === "build") {
    await build();
  } else if (normalizedCommand === "frontend-build") {
    await frontendBuild();
  } else {
    help();
    process.exit(command === "help" || command === "--help" || command === "-h" ? 0 : 1);
  }
} catch (error) {
  console.error(`\nError: ${error.message}`);
  if (activeTimer) {
    finishTimer(`${activeTimer.label} fallido`);
  }
  process.exit(1);
}
