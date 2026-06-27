export interface CompileHistoryEntry {
  id: string;
  projectPath: string;
  projectTitle?: string;
  profileId?: string;
  success: boolean;
  createdAt: string;
  durationMs?: number;
  backend?: string;
  pdfPath?: string;
  qualityScore?: number;
  finalGatePassed?: boolean;
  errorCodes?: string[];
}

const STORAGE_KEY = "texis.compileHistory.v1";
const MAX_ENTRIES = 50;

export function loadCompileHistory(projectPath?: string, limit = 8): CompileHistoryEntry[] {
  const entries = readAll();
  const filtered = projectPath
    ? entries.filter((entry) => entry.projectPath === projectPath)
    : entries;
  return filtered.slice(0, limit);
}

export function recordCompileHistory(
  entry: Omit<CompileHistoryEntry, "id" | "createdAt"> & Partial<Pick<CompileHistoryEntry, "id" | "createdAt">>,
): CompileHistoryEntry {
  const normalized: CompileHistoryEntry = {
    ...entry,
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
  const next = [normalized, ...readAll()].slice(0, MAX_ENTRIES);
  writeAll(next);
  return normalized;
}

function readAll(): CompileHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CompileHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Observabilidad local no debe romper compilación ni exportación.
  }
}

function isEntry(value: unknown): value is CompileHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string"
    && typeof entry.projectPath === "string"
    && typeof entry.success === "boolean"
    && typeof entry.createdAt === "string";
}
