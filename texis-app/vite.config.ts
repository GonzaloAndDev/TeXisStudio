import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const PLUGINS_ROOT = resolve(__dirname, "../../TeXisStudio-Plugins/visual-plugins");

function copyDictionaries() {
  return {
    name: "copy-dictionaries",
    buildStart() {
      for (const lang of ["en", "es", "fr", "de"]) {
        const src = resolve(__dirname, "node_modules", `dictionary-${lang}`);
        const dst = resolve(__dirname, "public", "dictionaries", lang);
        mkdirSync(dst, { recursive: true });
        copyFileSync(`${src}/index.aff`, `${dst}/index.aff`);
        copyFileSync(`${src}/index.dic`, `${dst}/index.dic`);
      }
    },
  };
}

export default defineConfig(async () => ({
  plugins: [react(), copyDictionaries()],
  clearScreen: false,
  resolve: {
    alias: {
      // Map the plugin package root to its TypeScript source
      "@texisstudio/plugins": PLUGINS_ROOT,
      // Node.js builtins → browser-safe stubs (FigureStore never called in WebView)
      "node:fs": resolve(__dirname, "src/lib/node-stubs.ts"),
      "node:path": resolve(__dirname, "src/lib/node-stubs.ts"),
    },
    // Allow resolving .ts files directly from the plugins package (no pre-build needed)
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
