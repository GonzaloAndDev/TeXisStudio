import { defineConfig } from "vitest/config";
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
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "oxc" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Tauri loads from local disk — 500 kB limit is calibrated for HTTP.
    // The main index chunk is large because all 7 bundled UI locales (~826 kB raw)
    // are statically imported to guarantee synchronous availability at i18next init.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor libs that change rarely — isolate for better WebView cache reuse.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/(react-router|react-router-dom)\//.test(id)) return "vendor-router";
          if (/node_modules\/(i18next|react-i18next)\//.test(id)) return "vendor-i18n";
          if (/node_modules\/zustand\//.test(id)) return "vendor-state";
          if (/node_modules\/katex\//.test(id)) return "vendor-katex";
          if (/node_modules\/pdfjs-dist\//.test(id)) return "vendor-pdfjs";
          const uiLocale = id.match(/src\/i18n\/locales\/([^/?]+)\.json(?:$|\?)/);
          if (uiLocale) return `ui-i18n-${uiLocale[1]}`;
          const profileLocale = id.match(/TeXisStudio-Profiles\/i18n\/([^/?]+)\.json(?:$|\?)/);
          if (profileLocale) return `profile-i18n-${profileLocale[1]}`;
        },
      },
    },
  },
}));
