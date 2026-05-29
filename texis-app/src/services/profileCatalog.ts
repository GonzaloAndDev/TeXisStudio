/**
 * Profile catalog service — fetch and validate the TeXisStudio-Profiles catalog.
 *
 * Security:
 *  - Only HTTPS URLs accepted
 *  - Catalog host validated against allowlist
 *  - Catalog shape validated before returning entries
 *  - Each entry's download_url validated (HTTPS + allowed host)
 *  - Malformed entries skipped with a warning instead of crashing
 *
 * This mirrors the rigor of languagePacks.ts for the profiles catalog
 * (Propuesta D, Auditoría TeXisStudio v2.2).
 */

import type { AcademicLevel, ProfileStatus } from "../types";

export const PROFILE_CATALOG_URL =
  "https://github.com/GonzaloAndDev/TeXisStudio-Profiles/releases/latest/download/catalog.json";

/** Hosts from which profile catalog and profile ZIPs may be served. */
const ALLOWED_CATALOG_HOSTS = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "releases.githubusercontent.com",
]);

const ALLOWED_PROFILE_STATUS = new Set([
  "experimental", "draft", "reviewed", "verified", "stale", "deprecated",
]);

const ALLOWED_PROFILE_SCOPE = new Set([
  "institutional", "degree_specific", "program_specific", "discipline_specific",
]);

const ALLOWED_ACADEMIC_LEVELS = new Set([
  "bachillerato", "tecnico", "licenciatura",
  "especialidad", "maestria", "doctorado", "posdoctorado",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CatalogProfile {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  tags: string[];
  continent: string;
  country: string;
  institution?: string;
  institution_id?: string;
  city?: string;
  status?: ProfileStatus;
  style_id?: string;
  bibliography_style?: string;
  reviewed_at?: string | null;
  verified_at?: string | null;
  ci_evidence?: string;
  profile_scope?: "institutional" | "degree_specific" | "program_specific" | "discipline_specific";
  academic_level?: AcademicLevel;
  target_levels?: AcademicLevel[];
  discipline?: string;
  program_name?: string;
  faculty?: string;
  department?: string;
  download_url: string;
  sha256?: string | null;
}

export interface ProfileCatalog {
  profiles: CatalogProfile[];
  /** Total entries in the raw catalog (including skipped malformed ones) */
  rawCount: number;
  /** Entries skipped due to validation errors */
  skippedCount: number;
  /** Non-fatal warnings from validation */
  warnings: string[];
}

// ── URL validation ────────────────────────────────────────────────────────────

function validateCatalogUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL del catálogo inválida: "${url}"`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Solo se aceptan catálogos HTTPS (recibido: "${url}")`);
  }
  if (!ALLOWED_CATALOG_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Host "${parsed.hostname}" no está en la lista permitida. ` +
      `Permitidos: ${[...ALLOWED_CATALOG_HOSTS].join(", ")}`,
    );
  }
  if (parsed.pathname.includes("..")) {
    throw new Error(`Path traversal detectado en URL: "${url}"`);
  }
}

function validateDownloadUrl(url: string, profileId: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return `${profileId}: download_url debe ser HTTPS`;
    if (!ALLOWED_CATALOG_HOSTS.has(parsed.hostname))
      return `${profileId}: host "${parsed.hostname}" no permitido en download_url`;
    if (parsed.pathname.includes(".."))
      return `${profileId}: path traversal en download_url`;
    return null;
  } catch {
    return `${profileId}: download_url inválida: "${url}"`;
  }
}

// ── Entry validation ──────────────────────────────────────────────────────────

function validateEntry(raw: unknown, warnings: string[]): CatalogProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;

  // Required fields
  if (typeof e.id !== "string" || !e.id.trim()) return null;
  if (typeof e.name !== "string" || !e.name.trim()) return null;
  if (typeof e.download_url !== "string" || !e.download_url.trim()) return null;
  if (typeof e.continent !== "string") return null;
  if (typeof e.country !== "string") return null;

  // download_url validation
  const urlError = validateDownloadUrl(e.download_url as string, e.id as string);
  if (urlError) {
    warnings.push(`SKIPPED entry (invalid download_url): ${urlError}`);
    return null;
  }

  // tags — default to empty array if missing/wrong type
  const tags = Array.isArray(e.tags)
    ? (e.tags as unknown[]).filter((t) => typeof t === "string") as string[]
    : [];
  const verification = e.verification && typeof e.verification === "object"
    ? e.verification as Record<string, unknown>
    : {};
  const status = typeof e.status === "string" && ALLOWED_PROFILE_STATUS.has(e.status)
    ? e.status as ProfileStatus
    : undefined;
  const profileScope = typeof e.profile_scope === "string" && ALLOWED_PROFILE_SCOPE.has(e.profile_scope)
    ? e.profile_scope as CatalogProfile["profile_scope"]
    : undefined;
  const academicLevel = typeof e.academic_level === "string" && ALLOWED_ACADEMIC_LEVELS.has(e.academic_level)
    ? e.academic_level as AcademicLevel
    : undefined;
  const targetLevels = Array.isArray(e.target_levels)
    ? (e.target_levels as unknown[])
        .filter((level): level is AcademicLevel => typeof level === "string" && ALLOWED_ACADEMIC_LEVELS.has(level))
    : [];

  return {
    id: e.id as string,
    name: e.name as string,
    description: typeof e.description === "string" ? e.description : undefined,
    author: typeof e.author === "string" ? e.author : undefined,
    version: typeof e.version === "string" ? e.version : undefined,
    tags,
    continent: e.continent as string,
    country: e.country as string,
    institution: typeof e.institution === "string" ? e.institution : undefined,
    institution_id: typeof e.institution_id === "string" ? e.institution_id : undefined,
    city: typeof e.city === "string" ? e.city : undefined,
    status,
    style_id: typeof e.style_id === "string" ? e.style_id : undefined,
    bibliography_style: typeof e.bibliography_style === "string" ? e.bibliography_style : undefined,
    reviewed_at: typeof e.reviewed_at === "string"
      ? e.reviewed_at
      : (typeof verification.reviewed_at === "string" ? verification.reviewed_at : null),
    verified_at: typeof e.verified_at === "string"
      ? e.verified_at
      : (typeof verification.verified_at === "string" ? verification.verified_at : null),
    ci_evidence: typeof e.ci_evidence === "string"
      ? e.ci_evidence
      : (typeof verification.ci_evidence === "string" ? verification.ci_evidence : undefined),
    profile_scope: profileScope,
    academic_level: academicLevel,
    target_levels: targetLevels.length ? targetLevels : undefined,
    discipline: typeof e.discipline === "string" ? e.discipline : undefined,
    program_name: typeof e.program_name === "string" ? e.program_name : undefined,
    faculty: typeof e.faculty === "string" ? e.faculty : undefined,
    department: typeof e.department === "string" ? e.department : undefined,
    download_url: e.download_url as string,
    sha256: typeof e.sha256 === "string" ? e.sha256 : null,
  };
}

// ── Catalog fetching ──────────────────────────────────────────────────────────

/**
 * Fetch and validate the profile catalog from a URL.
 *
 * Throws if the URL is invalid, the fetch fails, or the response is not
 * parseable as JSON. Returns a `ProfileCatalog` with validated entries;
 * malformed entries are skipped (counted in `skippedCount`).
 */
export async function fetchProfileCatalog(
  url: string = PROFILE_CATALOG_URL,
): Promise<ProfileCatalog> {
  validateCatalogUrl(url);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al obtener catálogo de perfiles desde "${url}"`);
  }

  // Validate content-type loosely (GitHub releases serve application/octet-stream)
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("json") && !contentType.includes("octet-stream")) {
    throw new Error(
      `Tipo de contenido inesperado: "${contentType}". Se esperaba JSON.`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`El catálogo de perfiles no es JSON válido: ${e}`);
  }

  if (!data || typeof data !== "object") {
    throw new Error("El catálogo de perfiles no tiene la estructura esperada (no es un objeto)");
  }

  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.profiles)) {
    throw new Error(
      "El catálogo de perfiles no tiene la estructura esperada (falta campo 'profiles' como array)",
    );
  }

  const warnings: string[] = [];
  const rawEntries = raw.profiles as unknown[];
  const rawCount = rawEntries.length;
  const profiles: CatalogProfile[] = [];

  for (const entry of rawEntries) {
    const validated = validateEntry(entry, warnings);
    if (validated) {
      profiles.push(validated);
    }
  }

  const skippedCount = rawCount - profiles.length;
  if (skippedCount > 0) {
    console.warn(`[profileCatalog] ${skippedCount} entrada(s) omitida(s) por validación.`);
  }

  return { profiles, rawCount, skippedCount, warnings };
}
