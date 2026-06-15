/**
 * Vocabulary pack service — fetch, install, uninstall domain vocabulary packs.
 *
 * Vocabulary packs are fully independent wordlists for domain-specific terms
 * (engineering, mathematics, medicine, etc.). They are NOT language packs —
 * they don't provide UI translations or grammar rules. They extend the
 * spell-checker with specialized terminology.
 *
 * Multiple packs can be active simultaneously. Their term lists are merged
 * at runtime when spell-checking is invoked.
 *
 * Custom repos: any HTTPS URL pointing to a catalog.json with a vocabulary_packs
 * section is supported. Users add their own domain-specific repos without
 * affecting the official repo.
 *
 * Security:
 *  - All URLs validated: HTTPS only (custom repos) or HTTPS + allowlist (official)
 *  - Catalog entries validated before use
 *  - Fetch responses checked for content-type and size
 *  - Installation validates pack_url before any network request
 */

import type {
  VocabPackEntry,
  InstalledVocabPack,
  CustomVocabRepo,
} from "../types";

// ── Storage keys ─────────────────────────────────────────────────────────────

const INSTALLED_VOCAB_KEY = "tx-installed-vocab-packs";
const CUSTOM_REPOS_KEY    = "tx-custom-vocab-repos";
const OFFICIAL_CATALOG    = "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio-Languages/main/catalog.json";

/** Max size for catalog JSON responses (500 KB) */
const MAX_CATALOG_BYTES = 500 * 1024;
/** Max size for individual pack YAML files (2 MB) */
const MAX_PACK_BYTES = 2 * 1024 * 1024;

/** Hosts from which official packs and catalogs may be served. */
const ALLOWED_OFFICIAL_HOSTS = new Set([
  "raw.githubusercontent.com",
  "cdn.jsdelivr.net",
]);

// ── URL validation ────────────────────────────────────────────────────────────

/** Minimum bar for any URL: HTTPS protocol and no path traversal. */
function requireHttps(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label}: URL inválida "${url}"`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label}: solo se permiten URLs HTTPS (recibido "${url}")`);
  }
  if (parsed.pathname.includes("..")) {
    throw new Error(`${label}: path traversal detectado en "${url}"`);
  }
}

/** Full validation for official sources: HTTPS + known host allowlist. */
function validateOfficialUrl(url: string | undefined, label: string): void {
  if (!url) return;
  requireHttps(url, label);
  const parsed = new URL(url);
  if (!ALLOWED_OFFICIAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `${label}: host "${parsed.hostname}" no está en la lista de hosts permitidos. ` +
        `Permitidos: ${[...ALLOWED_OFFICIAL_HOSTS].join(", ")}`,
    );
  }
}

// ── Safe fetch ────────────────────────────────────────────────────────────────

/**
 * Fetches a URL and validates:
 * - HTTP status is 2xx
 * - Content-Type is not text/html (avoids CDN error pages)
 * - Content-Length header, when present, does not exceed maxBytes
 */
async function safeFetch(url: string, label: string, maxBytes: number): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label}: fallo HTTP ${res.status} (${res.statusText})`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `${label}: el servidor devolvió HTML en vez del archivo esperado ` +
        `(posiblemente una página de error del CDN)`,
    );
  }
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(
      `${label}: respuesta demasiado grande (${contentLength} bytes, máx ${maxBytes})`,
    );
  }
  return res;
}

// ── Catalog entry validation ──────────────────────────────────────────────────

/** Validates that a raw object has the required shape for a VocabPackEntry. */
function validateVocabEntry(e: unknown): e is VocabPackEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return false;
  if (typeof o.name !== "string") return false;
  if (typeof o.version !== "string") return false;
  if (typeof o.pack_url !== "string" || !o.pack_url.trim()) return false;
  return true;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadInstalledVocabPacks(): InstalledVocabPack[] {
  try {
    const raw = localStorage.getItem(INSTALLED_VOCAB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveInstalledVocabPacks(packs: InstalledVocabPack[]): void {
  localStorage.setItem(INSTALLED_VOCAB_KEY, JSON.stringify(packs));
}

export function loadCustomRepos(): CustomVocabRepo[] {
  try {
    const raw = localStorage.getItem(CUSTOM_REPOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomRepos(repos: CustomVocabRepo[]): void {
  localStorage.setItem(CUSTOM_REPOS_KEY, JSON.stringify(repos));
}

// ── Catalog fetching ──────────────────────────────────────────────────────────

export async function fetchVocabPacksFromCatalog(): Promise<VocabPackEntry[]> {
  const res = await safeFetch(OFFICIAL_CATALOG, "catálogo oficial", MAX_CATALOG_BYTES);
  const text = await res.text();
  if (text.length > MAX_CATALOG_BYTES) {
    throw new Error(`Catálogo oficial demasiado grande (${text.length} bytes, máx ${MAX_CATALOG_BYTES})`);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("El catálogo oficial no es JSON válido");
  }
  const raw = Array.isArray(data.vocabulary_packs) ? data.vocabulary_packs as unknown[] : [];
  return raw.filter((e) => {
    const ok = validateVocabEntry(e);
    if (!ok) console.warn("[vocabularyPacks] entrada de catálogo inválida, ignorada:", e);
    return ok;
  }) as VocabPackEntry[];
}

/**
 * Fetches vocabulary packs from a user-supplied URL.
 * Enforces HTTPS (no host allowlist — custom repos can be on any HTTPS host).
 */
export async function fetchVocabPacksFromUrl(url: string): Promise<VocabPackEntry[]> {
  requireHttps(url, "URL de repositorio personalizado");
  const res = await safeFetch(url, `catálogo en ${url}`, MAX_CATALOG_BYTES);
  const text = await res.text();
  if (text.length > MAX_CATALOG_BYTES) {
    throw new Error(`Catálogo demasiado grande (${text.length} bytes, máx ${MAX_CATALOG_BYTES})`);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`La respuesta de "${url}" no es JSON válido`);
  }
  const raw = Array.isArray(data.vocabulary_packs) ? data.vocabulary_packs as unknown[] : [];
  return raw.filter((e) => {
    const ok = validateVocabEntry(e);
    if (!ok) console.warn("[vocabularyPacks] entrada inválida en repo personalizado, ignorada:", e);
    return ok;
  }) as VocabPackEntry[];
}

// ── Pack installation ─────────────────────────────────────────────────────────

export async function installVocabPack(entry: VocabPackEntry): Promise<InstalledVocabPack> {
  // Validate pack_url before any network request.
  // Use the stricter official-host check when the URL is on a known safe host;
  // fall back to HTTPS-only for packs from custom repos.
  try {
    const parsed = new URL(entry.pack_url);
    if (ALLOWED_OFFICIAL_HOSTS.has(parsed.hostname)) {
      validateOfficialUrl(entry.pack_url, `${entry.id}.pack_url`);
    } else {
      requireHttps(entry.pack_url, `${entry.id}.pack_url`);
    }
  } catch (e) {
    throw new Error(`pack_url del pack "${entry.id}" es inválida: ${String(e)}`);
  }

  const res = await safeFetch(entry.pack_url, `pack "${entry.id}"`, MAX_PACK_BYTES);
  const text = await res.text();
  if (text.length > MAX_PACK_BYTES) {
    throw new Error(
      `Pack "${entry.id}" demasiado grande (${text.length} bytes, máx ${MAX_PACK_BYTES})`,
    );
  }

  const terms = extractTermsFromPackYaml(text);

  const installed: InstalledVocabPack = {
    id: entry.id,
    version: entry.version,
    installed_at: new Date().toISOString(),
    entry,
    terms,
  };

  const all = loadInstalledVocabPacks().filter((p) => p.id !== entry.id);
  all.push(installed);
  saveInstalledVocabPacks(all);
  return installed;
}

export function uninstallVocabPack(id: string): void {
  const all = loadInstalledVocabPacks().filter((p) => p.id !== id);
  saveInstalledVocabPacks(all);
}

// ── Custom repos ──────────────────────────────────────────────────────────────

export async function addCustomRepo(alias: string, url: string): Promise<CustomVocabRepo> {
  // Validate URL before persisting — reject non-HTTPS immediately.
  requireHttps(url, "URL de repositorio personalizado");

  let packs: VocabPackEntry[] = [];
  let error: string | undefined;
  try {
    packs = await fetchVocabPacksFromUrl(url);
  } catch (e) {
    error = String(e);
  }

  const repo: CustomVocabRepo = {
    id: alias.trim().replace(/\s+/g, "-").toLowerCase(),
    url,
    added_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    packs,
    error,
  };

  const all = loadCustomRepos().filter((r) => r.id !== repo.id);
  all.push(repo);
  saveCustomRepos(all);
  return repo;
}

export function removeCustomRepo(id: string): void {
  saveCustomRepos(loadCustomRepos().filter((r) => r.id !== id));
}

export async function syncCustomRepo(id: string): Promise<CustomVocabRepo> {
  const repos = loadCustomRepos();
  const repo = repos.find((r) => r.id === id);
  if (!repo) throw new Error(`Repo ${id} not found`);

  let packs: VocabPackEntry[] = [];
  let error: string | undefined;
  try {
    packs = await fetchVocabPacksFromUrl(repo.url);
  } catch (e) {
    error = String(e);
  }

  const updated = { ...repo, packs, last_synced_at: new Date().toISOString(), error };
  saveCustomRepos(repos.map((r) => (r.id === id ? updated : r)));
  return updated;
}

// ── Runtime — merge active terms ──────────────────────────────────────────────

/**
 * Returns the merged set of terms from all currently installed vocabulary packs.
 * Call this when initializing the spell-checker to extend its dictionary.
 */
export function getMergedVocabTerms(): string[] {
  const packs = loadInstalledVocabPacks();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const pack of packs) {
    for (const term of (pack.terms ?? [])) {
      const lower = term.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(term);
      }
    }
  }
  return result;
}

// ── YAML terms extraction ─────────────────────────────────────────────────────

/**
 * Extrae los términos de un pack.yaml.
 * Usa un parser línea a línea robusto que maneja:
 * - Términos simples:      `- palabra`
 * - Términos con comillas: `- "two words"` o `- 'two words'`
 * - Términos con dos puntos en el valor: `- std::vector` (escaped as `"std::vector"`)
 * - Comentarios: líneas que comienzan con #
 * - Bloques YAML anidados: detecta fin de bloque por indentación
 */
function extractTermsFromPackYaml(yaml: string): string[] {
  const terms: string[] = [];
  const lines = yaml.split("\n");
  let inTermsBlock = false;
  let termsIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ignorar comentarios
    if (trimmed.startsWith("#")) continue;
    // Ignorar líneas vacías
    if (!trimmed) continue;

    // Detectar inicio del bloque terms:
    if (trimmed === "terms:" || trimmed === "terms: []") {
      inTermsBlock = true;
      // La indentación del bloque será la de los items (línea siguiente con -)
      termsIndent = -1;
      continue;
    }

    if (!inTermsBlock) continue;

    // Calcular indentación de la línea actual
    const indent = line.length - line.trimStart().length;

    // Una clave de nivel superior (sin guión, con dos puntos, misma o menor indentación) termina el bloque
    if (
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("#") &&
      trimmed.includes(":") &&
      indent === 0
    ) {
      inTermsBlock = false;
      termsIndent = -1;
      continue;
    }

    // Primer item: establecer la indentación del bloque
    if (trimmed.startsWith("-") && termsIndent === -1) {
      termsIndent = indent;
    }

    // Si la indentación baja por debajo del bloque → terminó
    if (termsIndent >= 0 && !trimmed.startsWith("-") && indent < termsIndent) {
      inTermsBlock = false;
      termsIndent = -1;
      continue;
    }

    // Extraer el término
    if (trimmed.startsWith("- ")) {
      let term = trimmed.slice(2).trim();
      // Eliminar comentarios inline: `- palabra # comentario`
      const commentIdx = term.indexOf(" #");
      if (commentIdx > 0) term = term.slice(0, commentIdx).trim();
      // Eliminar comillas envolventes
      term = term.replace(/^(['"])(.*)\1$/, "$2").trim();
      if (term && !term.startsWith("#")) {
        terms.push(term);
      }
    } else if (trimmed === "-") {
      // Término vacío — ignorar
    }
  }

  return terms;
}
