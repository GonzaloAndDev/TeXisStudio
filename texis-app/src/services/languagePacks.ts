/**
 * Language pack service — fetch catalog, install, uninstall, load UI locale.
 *
 * Architecture:
 *  - Catalog lives at CATALOG_URL (GitHub raw)
 *  - UI locale JSON cached in localStorage (key: tx-lang-pack-ui:{id})
 *  - Spelling dicts fetched on-demand from CDN URL (browser HTTP cache handles persistence)
 *  - Installed packs metadata in localStorage (key: tx-installed-packs)
 *
 * Security:
 *  - All URLs validated: HTTPS only, allowed hosts only
 *  - Catalog schema validated before using
 *  - Spell dict HTTP responses validated (status + content-type)
 *  - Installation is atomic: all assets fetched and validated before persisting
 */

import type { LangCatalog, LangPackEntry, InstalledLangPack, LangCapabilities } from "../types";

const CATALOG_URL =
  "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio-Languages/main/catalog.json";

const INSTALLED_KEY = "tx-installed-packs";

/** Max size for UI locale JSON (500 KB) */
const MAX_UI_BYTES = 500 * 1024;
/** Max size for spell dict files (5 MB each) */
const MAX_DICT_BYTES = 5 * 1024 * 1024;

/** Domains from which language pack assets may be served. */
const ALLOWED_ASSET_HOSTS = new Set([
  "raw.githubusercontent.com",
  "cdn.jsdelivr.net",
]);

// ── URL validation ────────────────────────────────────────────────────────────

function validateUrl(url: string | undefined, label: string): void {
  if (!url) return; // optional fields are allowed to be absent
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label}: invalid URL "${url}"`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label}: only HTTPS URLs are allowed (got "${url}")`);
  }
  if (!ALLOWED_ASSET_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `${label}: host "${parsed.hostname}" is not in the allow-list. ` +
        `Allowed: ${[...ALLOWED_ASSET_HOSTS].join(", ")}`,
    );
  }
  if (parsed.pathname.includes("..")) {
    throw new Error(`${label}: path traversal detected in URL "${url}"`);
  }
}

// ── Catalog validation ────────────────────────────────────────────────────────

const CAPABILITY_KEYS: Array<keyof LangCapabilities> = [
  "ui", "spelling", "autocorrect", "grammar_remote", "grammar_local",
  "latex_babel", "latex_polyglossia",
];

function validateCatalogEntry(entry: unknown): entry is LangPackEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;

  if (typeof e.id !== "string" || !e.id) return false;
  if (typeof e.name !== "string") return false;
  if (typeof e.version !== "string") return false;
  if (!e.capabilities || typeof e.capabilities !== "object") return false;

  // Validate capabilities shape
  const caps = e.capabilities as Record<string, unknown>;
  for (const key of CAPABILITY_KEYS) {
    if (typeof caps[key] !== "boolean") return false;
  }

  // Validate declared URLs
  try {
    validateUrl(e.ui_url as string | undefined, `${e.id}.ui_url`);
    validateUrl(e.spelling_aff_url as string | undefined, `${e.id}.spelling_aff_url`);
    validateUrl(e.spelling_dic_url as string | undefined, `${e.id}.spelling_dic_url`);
    validateUrl(e.autocorrect_url as string | undefined, `${e.id}.autocorrect_url`);
    validateUrl(e.latex_url as string | undefined, `${e.id}.latex_url`);
  } catch (err) {
    console.warn("[languagePacks] catalog entry rejected:", err);
    return false;
  }

  return true;
}

// ── Catalog ───────────────────────────────────────────────────────────────────

let _catalogCache: LangCatalog | null = null;

export async function fetchCatalog(force = false): Promise<LangCatalog> {
  if (_catalogCache && !force) return _catalogCache;

  const res = await fetch(CATALOG_URL, { cache: force ? "no-cache" : "default" });
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);

  const raw = (await res.json()) as Record<string, unknown>;

  if (!raw.packages || !Array.isArray(raw.packages)) {
    throw new Error("Catalog schema invalid: missing 'packages' array");
  }

  // Filter out invalid entries rather than rejecting the whole catalog
  const validPackages = (raw.packages as unknown[]).filter((e) => {
    const ok = validateCatalogEntry(e);
    if (!ok) console.warn("[languagePacks] skipped invalid catalog entry:", e);
    return ok;
  });

  const catalog: LangCatalog = {
    schema_version: typeof raw.schema_version === "string" ? raw.schema_version : "1.0",
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    packages: validPackages as LangPackEntry[],
  };

  _catalogCache = catalog;
  return catalog;
}

// ── Installed packs ───────────────────────────────────────────────────────────

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

// ── Install ───────────────────────────────────────────────────────────────────

/**
 * Fetch a URL and validate that:
 * - HTTP status is 2xx
 * - Content-Type is not text/html (would be an error page from CDN/GitHub)
 * - Response body size doesn't exceed maxBytes
 */
async function safeFetch(
  url: string,
  label: string,
  maxBytes: number,
): Promise<Response> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`${label}: fetch failed with status ${res.status} (${res.statusText})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `${label}: server returned HTML instead of the expected file ` +
        `(CDN/GitHub may have returned an error page)`,
    );
  }

  // Check Content-Length if available; actual size checked after reading
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`${label}: file too large (${contentLength} bytes, max ${maxBytes})`);
  }

  return res;
}

export async function installPack(
  entry: LangPackEntry,
  onProgress?: (step: "ui" | "spelling" | "autocorrect" | "done") => void,
): Promise<InstalledLangPack> {
  // ── Validate entry URLs before making any network requests ──────────────
  validateUrl(entry.ui_url, `${entry.id}.ui_url`);
  if (entry.capabilities.spelling) {
    validateUrl(entry.spelling_aff_url, `${entry.id}.spelling_aff_url`);
    validateUrl(entry.spelling_dic_url, `${entry.id}.spelling_dic_url`);
  }
  if (entry.capabilities.autocorrect) {
    validateUrl(entry.autocorrect_url, `${entry.id}.autocorrect_url`);
  }

  // ── Fetch all assets into memory first (atomic: nothing persisted yet) ──
  let ui_data: Record<string, unknown> | undefined;
  let autocorrectData: unknown | undefined;

  // 1 — UI locale
  if (entry.capabilities.ui && entry.ui_url) {
    onProgress?.("ui");
    const res = await safeFetch(entry.ui_url, `${entry.id} UI locale`, MAX_UI_BYTES);
    const text = await res.text();
    if (text.length > MAX_UI_BYTES) {
      throw new Error(`${entry.id} UI locale too large (${text.length} bytes, max ${MAX_UI_BYTES})`);
    }
    try {
      ui_data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`${entry.id} UI locale is not valid JSON`);
    }
  }

  // 2 — Spell dicts: validate HTTP response but rely on browser cache for persistence
  if (entry.capabilities.spelling && entry.spelling_aff_url && entry.spelling_dic_url) {
    onProgress?.("spelling");
    // Validate both files exist and are valid before declaring success
    await Promise.all([
      safeFetch(entry.spelling_aff_url, `${entry.id} .aff`, MAX_DICT_BYTES),
      safeFetch(entry.spelling_dic_url, `${entry.id} .dic`, MAX_DICT_BYTES),
    ]);
    // Note: we do NOT store dict content in localStorage (too large).
    // The browser HTTP cache provides persistence between sessions.
  }

  // 3 — Autocorrect table
  if (entry.capabilities.autocorrect && entry.autocorrect_url) {
    onProgress?.("autocorrect");
    const res = await safeFetch(entry.autocorrect_url, `${entry.id} autocorrect`, MAX_UI_BYTES);
    const text = await res.text();
    try {
      autocorrectData = JSON.parse(text);
    } catch {
      throw new Error(`${entry.id} autocorrect.json is not valid JSON`);
    }
  }

  // 4 — LaTeX language config (babel/polyglossia settings)
  let latexData: Record<string, unknown> | undefined;
  const needsLatex = entry.capabilities.latex_babel || entry.capabilities.latex_polyglossia;
  if (needsLatex && entry.latex_url) {
    const res = await safeFetch(entry.latex_url, `${entry.id} latex.json`, MAX_UI_BYTES);
    const text = await res.text();
    if (text.length > MAX_UI_BYTES) {
      throw new Error(`${entry.id} latex.json too large (${text.length} bytes, max ${MAX_UI_BYTES})`);
    }
    try {
      latexData = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`${entry.id} latex.json is not valid JSON`);
    }
  }

  // ── All assets valid — now persist atomically ────────────────────────────
  if (ui_data) {
    localStorage.setItem(`tx-lang-pack-ui:${entry.id}`, JSON.stringify(ui_data));
  }
  if (autocorrectData !== undefined) {
    localStorage.setItem(`tx-lang-pack-autocorrect:${entry.id}`, JSON.stringify(autocorrectData));
  }
  if (latexData !== undefined) {
    localStorage.setItem(`tx-lang-pack-latex:${entry.id}`, JSON.stringify(latexData));
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

// ── Uninstall ─────────────────────────────────────────────────────────────────

export function uninstallPack(id: string): void {
  const packs = loadInstalledPacks().filter((p) => p.id !== id);
  saveInstalledPacks(packs);
  localStorage.removeItem(`tx-lang-pack-ui:${id}`);
  localStorage.removeItem(`tx-lang-pack-autocorrect:${id}`);
  localStorage.removeItem(`tx-lang-pack-latex:${id}`);
}

// ── Restore installed locale data on app start ────────────────────────────────

/** Returns locale data for all installed packs that have UI. */
export function getInstalledLocales(): Array<{ id: string; data: Record<string, unknown> }> {
  return loadInstalledPacks()
    .filter((p) => p.entry.capabilities.ui)
    .map((p) => {
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

/**
 * Returns the stored latex.json config for an installed pack.
 * Only present when capabilities.latex_babel or latex_polyglossia is true
 * and the pack was installed after this version shipped.
 */
export function getLatexConfig(id: string): Record<string, unknown> | null {
  const pack = loadInstalledPacks().find((p) => p.id === id);
  if (!pack) return null;
  const needsLatex = pack.entry.capabilities.latex_babel || pack.entry.capabilities.latex_polyglossia;
  if (!needsLatex) return null;
  const raw = localStorage.getItem(`tx-lang-pack-latex:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
