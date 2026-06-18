// Wrappers type-safe sobre las invoke calls de Tauri.
// Si no estamos en Tauri (dev en browser), usa datos mock.

import { invoke } from "@tauri-apps/api/core";
import type {
  BatchDoiResult,
  BibReference,
  CloudFolder,
  CompilationResult,
  DependencyIssue,
  DoctorReport,
  ExportDeliveryResult,
  LatexInfo,
  PdfPostflightResult,
  PreambleConfig,
  ProfileInfo,
  ProfileLockStatus,
  ProfileStatus,
  ProfileUpdatePayload,
  ProjectModel,
  RecentProject,
  SectionProgress,
  ValidationReport,
  ZoteroImportResult,
  ZoteroItem,
  ZoteroStatus,
} from "../types";

// re-export convenience
export type { ProfileInfo };

type DialogFilter = { name: string; extensions: string[] };

type ImportTexResult = {
  project_path: string;
  name: string;
  profile_id: string;
  imported_from: string;
  sections_count: number;
};

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Respuestas mock para desarrollo en browser sin Tauri
const BROWSER_MOCKS: Record<string, unknown> = {
  get_platform: "macos",
  list_project_assets: [],
  detect_build_conflicts: [],
  force_regenerate_build: null,
  save_external_copy_and_regenerate: { copy_saved_as: "" },
  analyze_glossary: { entries: [], acronyms: [], is_empty: true, has_issues: false, undefined_references: [] },
  analyze_packages: { missing: [], declared: [], conflicts: [], requires_shell_escape: false, has_blocking_issues: false },
  detect_latex: {
    has_latexmk: false,
    has_xelatex: false,
    has_biber: false,
    is_usable: false,
    latexmk_usable: false,
    latexmk_version: undefined,
    texlive_year: undefined,
    has_tectonic: false,
    tectonic_version: undefined,
    available_backends: [],
    preferred_backend: undefined,
  } satisfies LatexInfo,
  get_cloud_folders: [] as CloudFolder[],
  list_references: [
    { key: "goodfellow2016deep",  entry_type: "book",    title: "Deep Learning",                                         author: "Goodfellow, Ian and Bengio, Yoshua and Courville, Aaron", year: "2016", journal: "" },
    { key: "lecun2015deep",       entry_type: "article", title: "Deep learning",                                         author: "LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey",    year: "2015", journal: "Nature" },
    { key: "vaswani2017attention",entry_type: "inproceedings", title: "Attention is All You Need",                      author: "Vaswani, Ashish et al.",                                  year: "2017", journal: "NeurIPS" },
    { key: "he2016deep",          entry_type: "inproceedings", title: "Deep Residual Learning for Image Recognition",   author: "He, Kaiming et al.",                                      year: "2016", journal: "CVPR" },
  ] as BibReference[],
  check_toolchain: { issues: [] as DependencyIssue[], has_critical: false },
  update_preamble_config: undefined,
  get_log_dir: "",
  open_in_system: undefined,
  run_system_doctor: {
    checks: [],
    environment_ok: false,
    has_critical_missing: false,
  } satisfies DoctorReport,
  check_profile_lock: { locked: false, lock: null } satisfies ProfileLockStatus,
  save_workspace_state: undefined,
  load_workspace_state: {
    open_files: [],
    active_file: null,
    zoom_level: 1,
    cursor_positions: {},
    last_build_summary: null,
  },
  get_profiles: [
    {
      id: "generic.thesis",
      name: "Tesis genérica",
      description: "Estructura clásica para licenciatura, especialidad, maestría, doctorado o posdoctorado.",
      meta: "XeLaTeX · biber · APA 7",
      tags: ["tesis", "licenciatura", "especialidad", "maestria", "doctorado", "posdoctorado"],
      sections_count: 13,
      sections: [],
      author: "Gonzalo Andrade Estrella",
      version: "0.1.0",
      status: "draft" as ProfileStatus,
    },
    {
      id: "generic.tesina",
      name: "Tesina genérica",
      description: "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
      meta: "XeLaTeX · biber · APA 7",
      tags: ["tesina", "licenciatura"],
      sections_count: 6,
      sections: [],
      author: "Gonzalo Andrade Estrella",
      version: "0.1.0",
      status: "draft" as ProfileStatus,
    },
  ] as ProfileInfo[],
  preview_bib_entry: "Smith, J. A., & Jones, M. B. (2024). Machine learning applications in academic writing. *Journal of Educational Technology*, *15*(3), 234–256. https://doi.org/10.1000/xyz123",
  generate_review_report: "# Reporte de revisión: Mi Tesis\n\n**Autor:** Estudiante Ejemplo\n\n## Estado de secciones\n\n| Sección | Estado | Notas |\n|---------|--------|-------|\n| Introducción | 🟡 Borrador | — |\n\n## Validación automática\n\n- **Errores:** 0\n- **Advertencias:** 0\n\nSin issues detectados. ✓\n",
  get_section_progress: [] as SectionProgress[],
};

/**
 * Wraps a raw Tauri invoke error so consumers always see a useful message.
 *
 * The Tauri runtime rejects with either a string, an Error, or an arbitrary
 * structured object depending on which backend handler failed. Callers using
 * `String(e)` ended up with `"[object Object]"` for structured errors and lost
 * the command name. We normalize to an Error with a stable shape and attach
 * the command + structured payload for diagnostics.
 */
export class TauriCommandError extends Error {
  readonly command: string;
  readonly cause: unknown;
  constructor(command: string, cause: unknown) {
    const detail =
      typeof cause === "string" ? cause :
      cause instanceof Error    ? cause.message :
      (() => { try { return JSON.stringify(cause); } catch { return String(cause); } })();
    super(`[${command}] ${detail}`);
    this.name = "TauriCommandError";
    this.command = command;
    this.cause = cause;
  }
}

// ── Mocks dinámicos para comandos con estado ──────────────────────────────
//
// Algunos comandos del backend (figuras de plugins) son stateful: el frontend
// guarda algo y luego lo lee. Mockearlos con un valor fijo no sirve — el flujo
// completo del editor de figuras requiere que load_figure_source devuelva lo
// que save_plugin_figure acaba de persistir. Usamos un Map en memoria para
// que el flujo end-to-end funcione en navegador (modo dev sin Tauri).

const _figureStore = new Map<string, { sourceJson: string; manifest?: { manualEdit?: boolean | null } | null }>();

const BROWSER_DYNAMIC_MOCKS: Record<string, (args?: Record<string, unknown>) => unknown> = {
  save_plugin_figure: (args) => {
    const figureId = String(args?.figureId ?? "");
    const sourceJson = args?.sourceJson;
    if (figureId && typeof sourceJson === "string") {
      const previous = _figureStore.get(figureId);
      const manualEdit = typeof args?.manualEdit === "boolean"
        ? args.manualEdit
        : previous?.manifest?.manualEdit ?? false;
      _figureStore.set(figureId, { sourceJson, manifest: { manualEdit } });
    }
    return undefined;
  },
  load_figure_source: (args) => {
    const figureId = String(args?.figureId ?? "");
    const stored = _figureStore.get(figureId);
    if (!stored) {
      // Fallback: devuelve un doc math-engine vacío para que el editor visual
      // pueda al menos renderizar sin romperse.
      return { sourceJson: JSON.stringify({ engineId: "math-engine", version: "1.0.0", mode: "equation", numbered: false, tree: [] }), manifest: null };
    }
    return stored;
  },
  delete_plugin_figure: (args) => {
    _figureStore.delete(String(args?.figureId ?? ""));
    return undefined;
  },
  compile_snippet_preview: () => undefined,
};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    try {
      return await invoke<T>(cmd, args);
    } catch (e) {
      // Re-throw a normalized error that always includes the command name and
      // a serializable detail string — the originals were sometimes plain
      // objects which stringified to "[object Object]" at the call site.
      throw new TauriCommandError(cmd, e);
    }
  }
  if (cmd in BROWSER_DYNAMIC_MOCKS) {
    return BROWSER_DYNAMIC_MOCKS[cmd](args) as T;
  }
  if (cmd in BROWSER_MOCKS) {
    return BROWSER_MOCKS[cmd] as T;
  }
  // Fallback para desarrollo en browser sin Tauri
  throw new TauriCommandError(cmd, "Tauri runtime is not available in this context");
}

/**
 * Public invoke wrapper that respects the browser-mode mock layer.
 *
 * Cualquier código de la app que llame al backend Tauri debe usar esta
 * función en vez del `invoke` crudo de `@tauri-apps/api`, para que las
 * rutas de desarrollo en navegador funcionen end-to-end.
 */
export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return call<T>(cmd, args);
}

export const api = {
  createProject: (
    name: string,
    profileId: string,
    outputPath: string
  ): Promise<{ project_path: string; name: string; profile_id: string }> =>
    call("create_project", { name, profileId, outputPath }),

  importTexProject: (
    texPath: string,
    outputPath: string,
    projectName?: string,
    profileId?: string,
  ): Promise<ImportTexResult> =>
    call("import_tex_project", { texPath, outputPath, projectName, profileId }),

  getProject: (projectPath: string): Promise<ProjectModel> =>
    call("get_project", { projectPath }),

  listRecentProjects: (searchDir: string): Promise<RecentProject[]> =>
    call("list_recent_projects", { searchDir }),

  saveSection: (
    projectPath: string,
    sectionId: string,
    blocks: unknown[]
  ): Promise<void> =>
    call("save_section", { projectPath, sectionId, blocks }),

  saveProject: (projectPath: string, project: unknown): Promise<void> =>
    call("save_project", { projectPath, project }),

  validateProject: (projectPath: string): Promise<ValidationReport> =>
    call("validate_project", { projectPath }),

  compileProject: (
    projectPath: string,
    backendName: string,
    draft: boolean,
    langConfig?: Record<string, unknown> | null,
  ): Promise<CompilationResult> =>
    call("compile_project", { projectPath, backendName, draft, langConfig: langConfig ?? null }),

  cancelCompile: (): Promise<void> =>
    call("cancel_compile"),

  createProfile: (profileId: string, payload: ProfileUpdatePayload): Promise<ProfileInfo> =>
    call("create_profile", { profileId, payload }),

  getProfiles: (): Promise<ProfileInfo[]> =>
    call("get_profiles"),

  getProfileDetail: (profileId: string): Promise<ProfileInfo> =>
    call("get_profile_detail", { profileId }),

  importProfile: (sourcePath: string): Promise<ProfileInfo> =>
    call("import_profile", { sourcePath }),

  exportProfile: (profileId: string, destPath: string): Promise<{ exported_to: string; profile_id: string }> =>
    call("export_profile", { profileId, destPath }),

  updateProfile: (profileId: string, payload: ProfileUpdatePayload): Promise<ProfileInfo> =>
    call("update_profile", { profileId, payload }),

  fetchRemoteProfile: (url: string, expectedSha256?: string): Promise<ProfileInfo> =>
    call("fetch_remote_profile", { url, expectedSha256: expectedSha256 ?? null }),

  fetchProfileCatalog: (url: string): Promise<unknown> =>
    call("fetch_profile_catalog", { url }),

  deleteProfile: (profileId: string): Promise<void> =>
    call("delete_profile", { profileId }),

  listReferences: (projectPath: string): Promise<BibReference[]> =>
    call("list_references", { projectPath }),

  importDoi: (doi: string): Promise<string> =>
    call("import_doi", { doi }),

  importDoisBatch: (dois: string[]): Promise<BatchDoiResult[]> =>
    call("import_dois_batch", { dois }),

  previewBibEntry: (bibtex: string, style: string): Promise<string> =>
    call("preview_bib_entry", { bibtex, style }),

  appendBibEntry: (projectPath: string, bibtex: string): Promise<string> =>
    call("append_bib_entry", { projectPath, bibtex }),

  // ── Snapshots ────────────────────────────────────────────────────
  createSnapshot: (projectPath: string, label: string): Promise<{ filename: string; label: string; created_at: string }> =>
    call("create_snapshot", { projectPath, label }),

  listSnapshots: (projectPath: string): Promise<{ filename: string; timestamp: string; label: string }[]> =>
    call("list_snapshots", { projectPath }),

  restoreSnapshot: (projectPath: string, snapshotFilename: string): Promise<void> =>
    call("restore_snapshot", { projectPath, snapshotFilename }),

  deleteSnapshot: (projectPath: string, snapshotFilename: string): Promise<void> =>
    call("delete_snapshot", { projectPath, snapshotFilename }),

  updateSectionMeta: (projectPath: string, sectionId: string, status: string, notes?: string): Promise<void> =>
    call("update_section_meta", { projectPath, sectionId, status, notes }),

  exportDelivery: (projectPath: string, outputPath: string, exportMode?: string): Promise<ExportDeliveryResult> =>
    call("export_delivery", { projectPath, outputPath, exportMode }),

  exportForTarget: (
    projectPath: string,
    outputDir: string,
    target: "overleaf" | "texstudio" | "vscode" | "local",
  ): Promise<{ artifact_path: string; info_url: string | null; note_key: string }> =>
    call("export_for_target", { projectPath, outputDir, target }),

  importFromSource: (params: {
    sourceDir: string;
    workDir: string;
    sourcePlatform: "overleaf" | "texstudio" | "miktex" | "texlive" | "vscode" | "other";
    mainFileHint?: string;
    overwrite?: boolean;
  }): Promise<{
    projectFile: string;
    warnings: string[];
    figuresCopied: number;
    bibsCopied: number;
  }> =>
    call("import_from_source", { params }),

  checkPdfPostflight: (projectPath: string): Promise<PdfPostflightResult> =>
    call("check_pdf_postflight", { projectPath }),

  generateReviewReport: (projectPath: string): Promise<string> =>
    call("generate_review_report", { projectPath }),

  getSectionProgress: (projectPath: string): Promise<SectionProgress[]> =>
    call("get_section_progress", { projectPath }),

  updateTypography: (
    projectPath: string,
    fontSize?: string,
    paperSize?: string,
    lineSpacing?: string,
    marginCm?: number,
  ): Promise<void> =>
    call("update_typography", { projectPath, fontSize, paperSize, lineSpacing, marginCm }),

  updatePreambleConfig: (
    projectPath: string,
    config: PreambleConfig,
  ): Promise<void> =>
    call("update_preamble_config", {
      projectPath,
      payload: {
        cjk_main_font:     config.cjk_main_font,
        cjk_japanese_font: config.cjk_japanese_font,
        cjk_korean_font:   config.cjk_korean_font,
        cyrillic_font:     (config as { cyrillic_font?: string }).cyrillic_font,
        main_font:         config.main_font,
        sans_font:         config.sans_font,
        mono_font:         config.mono_font,
        math_operators:    config.math_operators,
        extra_theorems:    config.extra_theorems,
        extra:             config.extra,
      },
    }),

  getPlatform: (): Promise<"macos" | "windows" | "linux" | string> =>
    call("get_platform"),

  getLogDir: (): Promise<string> =>
    call("get_log_dir"),

  openInSystem: (path: string): Promise<void> =>
    call("open_in_system", { path }),

  listProjectAssets: (projectPath: string): Promise<Array<{ name: string; path: string; ext: string }>> =>
    call("list_project_assets", { projectPath }),

  detectBuildConflicts: (projectPath: string): Promise<Array<{ file: string; kind: string }>> =>
    call("detect_build_conflicts", { projectPath }),

  forceRegenerateBuild: (projectPath: string): Promise<void> =>
    call("force_regenerate_build", { projectPath }),

  saveExternalCopyAndRegenerate: (projectPath: string, conflictedFile: string): Promise<{ copy_saved_as: string }> =>
    call("save_external_copy_and_regenerate", { projectPath, conflictedFile }),

  analyzeGlossary: (projectRoot: string): Promise<{
    entries: Array<{ key: string; name: string; description: string; status: string }>;
    acronyms: Array<{ key: string; short: string; long: string; status: string }>;
    is_empty: boolean;
    has_issues: boolean;
    undefined_references: string[];
  }> => call("analyze_glossary", { projectRoot }),

  analyzePackages: (projectRoot: string): Promise<{
    missing: Array<{ package_name: string; reason: string; priority: string; already_declared: boolean }>;
    declared: string[];
    conflicts: Array<{ package_a: string; package_b: string; description: string; resolution: string; is_blocking: boolean }>;
    requires_shell_escape: boolean;
    has_blocking_issues: boolean;
  }> => call("analyze_packages", { projectRoot }),

  detectLatex: (): Promise<LatexInfo> =>
    call("detect_latex"),

  checkToolchain: (projectPath: string, backend: string): Promise<{
    issues: DependencyIssue[];
    has_critical: boolean;
  }> => call("check_toolchain", { projectPath, backend }),

  getCloudFolders: (): Promise<CloudFolder[]> =>
    call("get_cloud_folders"),

  // ── Zotero ─────────────────────────────────────────────────────
  checkZoteroStatus: (): Promise<ZoteroStatus> =>
    call("check_zotero_status"),

  searchZotero: (query: string): Promise<ZoteroItem[]> =>
    call("search_zotero", { query }),

  importZoteroItems: (keys: string[]): Promise<ZoteroImportResult[]> =>
    call("import_zotero_items", { keys }),

  runSystemDoctor: (
    profileEngine: string,
    bibliographyBackend: string,
    bibliographyStyle: string,
    requiresPdfa: boolean,
  ): Promise<DoctorReport> =>
    call("run_system_doctor", { profileEngine, bibliographyBackend, bibliographyStyle, requiresPdfa }),

  checkProfileLock: (projectPath: string): Promise<ProfileLockStatus> =>
    call("check_profile_lock", { projectPath }),

  createProfileLock: (projectPath: string, profileId: string): Promise<ProfileLockStatus> =>
    call("create_profile_lock", { projectPath, profileId }),

  /** Compila una vista previa standalone del output.tex de una figura y devuelve la ruta al PDF. */
  compileSnippetPreview: (projectPath: string, figureId: string, backend: string): Promise<string | null> => {
    if (!isTauri()) return Promise.resolve(null);
    return call("compile_snippet_preview", { projectPath, figureId, backend });
  },

  /** Valida que un cuerpo LaTeX editado a mano compila, sin tocar output.tex.
   *  Resuelve si compila; rechaza con el error del compilador si falla. */
  validateFigureTex: (projectPath: string, figureId: string, texBody: string, backend: string): Promise<void> => {
    if (!isTauri()) return Promise.resolve();
    return call("validate_figure_snippet", { projectPath, figureId, texBody, backend });
  },

  /**
   * Abre el diálogo nativo de selección de carpeta. Retorna null si el usuario
   * cancela o si el dialog plugin no está disponible (e.g. plugin no registrado).
   * Antes los errores se tragaban en silencio y el usuario veía un click "muerto"
   * sin manera de diagnosticar; ahora los errores se reportan a la consola con
   * un prefijo identificable.
   */
  pickFolder: async (): Promise<string | null> => {
    if (!isTauri()) return null;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true, multiple: false });
      if (Array.isArray(result)) return result[0] ?? null;
      return result ?? null;
    } catch (e) {
      console.warn("[tauri] pickFolder failed:", e);
      return null;
    }
  },

  /** Abre el dialogo nativo de seleccion de archivo. Misma semantica que pickFolder. */
  pickFile: async (filters?: DialogFilter[]): Promise<string | null> => {
    if (!isTauri()) return null;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ multiple: false, filters });
      if (Array.isArray(result)) return result[0] ?? null;
      return result ?? null;
    } catch (e) {
      console.warn("[tauri] pickFile failed:", e);
      return null;
    }
  },

  saveWorkspaceState: (
    projectPath: string,
    state: {
      openFiles: string[];
      activeFile: string | null;
      zoomLevel: number;
      cursorPositions: Record<string, { line: number; column: number }>;
      lastBuildSummary: { success: boolean; pdf_path?: string; duration_ms?: number } | null;
    }
  ): Promise<void> =>
    call("save_workspace_state", {
      projectPath,
      state: {
        open_files: state.openFiles,
        active_file: state.activeFile,
        zoom_level: state.zoomLevel,
        cursor_positions: state.cursorPositions,
        last_build_summary: state.lastBuildSummary
          ? {
              success: state.lastBuildSummary.success,
              pdf_path: state.lastBuildSummary.pdf_path ?? null,
              duration_ms: state.lastBuildSummary.duration_ms ?? null,
            }
          : null,
      },
    }),

  loadWorkspaceState: (
    projectPath: string
  ): Promise<{
    open_files: string[];
    active_file: string | null;
    zoom_level: number;
    cursor_positions: Record<string, { line: number; column: number }>;
    last_build_summary: { success: boolean; pdf_path?: string; duration_ms?: number } | null;
  }> => call("load_workspace_state", { projectPath }),
};
