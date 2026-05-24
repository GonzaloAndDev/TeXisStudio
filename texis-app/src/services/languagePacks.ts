/**
 * Language pack service — fetch catalog, install, uninstall, load UI locale.
 *
 * Architecture:
 *  - Catalog lives at CATALOG_URL (GitHub raw)
 *  - UI locale JSON cached in localStorage (key: tx-lang-pack-ui:{id})
 *  - Spelling dicts fetched on-demand from CDN URL (browser HTTP cache handles persistence)
 *  - Installed packs metadata in localStorage (key: tx-installed-packs)
 */

import type { LangCatalog, LangPackEntry, InstalledLangPack } from "../types";

const CATALOG_URL =
  "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio/main/community/languages/catalog.json";

const INSTALLED_KEY = "tx-installed-packs";

// ── Catalog ───────────────────────────────────────────────────────────────

let _catalogCache: LangCatalog | null = null;

export async function fetchCatalog(force = false): Promise<LangCatalog> {
  if (_catalogCache && !force) return _catalogCache;
  const res = await fetch(CATALOG_URL, { cache: force ? "no-cache" : "default" });
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  _catalogCache = (await res.json()) as LangCatalog;
  return _catalogCache;
}

// ── Installed packs ───────────────────────────────────────────────────────

export function loadInstalledPacks(): InstalledLangPack[] {
  try {
    const raw = localStorage.getItem(INSTALLED_KEY);
    return raw ? (JSON.parse(raw) as InstalledLangPack[]) : [];
  } catch {
    return [];
  }
}

function saveInstalledPacks(packs: InstalledLangPack[]): void {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(packs));
}

export function isInstalled(id: string): boolean {
  return loadInstalledPacks().some((p) => p.id === id);
}

// ── Install ───────────────────────────────────────────────────────────────

export async function installPack(
  entry: LangPackEntry,
  onProgress?: (step: "ui" | "spelling" | "autocorrect" | "done") => void,
): Promise<InstalledLangPack> {
  // 1 — Fetch UI locale JSON
  onProgress?.("ui");
  let ui_data: Record<string, unknown> | undefined;
  if (entry.capabilities.ui && entry.ui_url) {
    const res = await fetch(entry.ui_url);
    if (!res.ok) throw new Error(`UI locale fetch failed: ${res.status}`);
    ui_data = (await res.json()) as Record<string, unknown>;
    // Persist locale data so it's available offline
    localStorage.setItem(`tx-lang-pack-ui:${entry.id}`, JSON.stringify(ui_data));
  }

  // 2 — Pre-fetch spelling dicts to warm browser HTTP cache
  if (entry.capabilities.spelling && entry.spelling_aff_url && entry.spelling_dic_url) {
    onProgress?.("spelling");
    await Promise.all([
      fetch(entry.spelling_aff_url),
      fetch(entry.spelling_dic_url),
    ]);
  }

  // 3 — Fetch autocorrect table
  if (entry.capabilities.autocorrect && entry.autocorrect_url) {
    onProgress?.("autocorrect");
    const res = await fetch(entry.autocorrect_url);
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(`tx-lang-pack-autocorrect:${entry.id}`, JSON.stringify(data));
    }
  }

  onProgress?.("done");

  const installed: InstalledLangPack = {
    id: entry.id,
    version: entry.version,
    installed_at: new Date().toISOString(),
    entry,
    ui_data,
  };

  const packs = loadInstalledPacks().filter((p) => p.id !== entry.id);
  packs.push(installed);
  saveInstalledPacks(packs);
  return installed;
}

// ── Uninstall ─────────────────────────────────────────────────────────────

export function uninstallPack(id: string): void {
  const packs = loadInstalledPacks().filter((p) => p.id !== id);
  saveInstalledPacks(packs);
  localStorage.removeItem(`tx-lang-pack-ui:${id}`);
  localStorage.removeItem(`tx-lang-pack-autocorrect:${id}`);
}

// ── Restore installed locale data on app start ────────────────────────────

/** Returns locale data for all installed packs that have UI. */
export function getInstalledLocales(): Array<{ id: string; data: Record<string, unknown> }> {
  return loadInstalledPacks()
    .filter((p) => p.entry.capabilities.ui)
    .map((p) => {
      // Prefer freshly persisted copy over the copy stored in the pack entry
      const raw = localStorage.getItem(`tx-lang-pack-ui:${p.id}`);
      const data = raw
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (p.ui_data ?? {});
      return { id: p.id, data };
    });
}

/** Returns spelling dict URLs for an installed language (if available). */
export function getSpellingUrls(id: string): { aff: string; dic: string } | null {
  const pack = loadInstalledPacks().find((p) => p.id === id);
  if (!pack?.entry.capabilities.spelling) return null;
  if (!pack.entry.spelling_aff_url || !pack.entry.spelling_dic_url) return null;
  return { aff: pack.entry.spelling_aff_url, dic: pack.entry.spelling_dic_url };
}
