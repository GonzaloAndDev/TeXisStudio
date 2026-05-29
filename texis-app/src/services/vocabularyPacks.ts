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
 * Custom repos: any URL pointing to a catalog.json with a vocabulary_packs
 * section is supported. Users add their own domain-specific repos without
 * affecting the official repo.
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
  const res = await fetch(OFFICIAL_CATALOG);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching catalog`);
  const data = await res.json();
  return (data.vocabulary_packs ?? []) as VocabPackEntry[];
}

export async function fetchVocabPacksFromUrl(url: string): Promise<VocabPackEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const data = await res.json();
  return (data.vocabulary_packs ?? []) as VocabPackEntry[];
}

// ── Pack installation ─────────────────────────────────────────────────────────

export async function installVocabPack(entry: VocabPackEntry): Promise<InstalledVocabPack> {
  const res = await fetch(entry.pack_url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching pack ${entry.id}`);
  const text = await res.text();

  // Parse YAML-like pack.yaml terms section (simple extraction without a YAML lib)
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
