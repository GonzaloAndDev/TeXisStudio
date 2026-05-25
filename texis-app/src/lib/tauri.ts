// Wrappers type-safe sobre las invoke calls de Tauri.
// Si no estamos en Tauri (dev en browser), usa datos mock.

import { invoke } from "@tauri-apps/api/core";
import type {
  BibReference,
  CloudFolder,
  CompilationResult,
  LatexInfo,
  ProfileInfo,
  ProfileUpdatePayload,
  ProjectModel,
  RecentProject,
  ValidationReport,
} from "../types";

// re-export convenience
export type { ProfileInfo };

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Respuestas mock para desarrollo en browser sin Tauri
const BROWSER_MOCKS: Record<string, unknown> = {
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
  get_profiles: [
    {
      id: "generic.thesis",
      name: "Tesis genérica",
      description: "Estructura clásica con marco teórico, metodología, resultados y conclusiones.",
      meta: "XeLaTeX · biber · APA 7",
      tags: ["tesis", "licenciatura", "maestria", "doctorado"],
      sections_count: 13,
      sections: [],
      author: "Gonzalo Andrade Estrella",
      version: "0.1.0",
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
    },
  ] as ProfileInfo[],
};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    return invoke<T>(cmd, args);
  }
  if (cmd in BROWSER_MOCKS) {
    return BROWSER_MOCKS[cmd] as T;
  }
  // Fallback para desarrollo en browser sin Tauri
  throw new Error(`Tauri no disponible. Comando: ${cmd}`);
}

export const api = {
  createProject: (
    name: string,
    profileId: string,
    outputPath: string
  ): Promise<{ project_path: string; name: string; profile_id: string }> =>
    call("create_project", { name, profileId, outputPath }),

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

  deleteProfile: (profileId: string): Promise<void> =>
    call("delete_profile", { profileId }),

  listReferences: (projectPath: string): Promise<BibReference[]> =>
    call("list_references", { projectPath }),

  importDoi: (doi: string): Promise<string> =>
    call("import_doi", { doi }),

  appendBibEntry: (projectPath: string, bibtex: string): Promise<void> =>
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

  exportDelivery: (projectPath: string, outputPath: string): Promise<string> =>
    call("export_delivery", { projectPath, outputPath }),

  updateTypography: (
    projectPath: string,
    fontSize?: string,
    paperSize?: string,
    lineSpacing?: string,
    marginCm?: number,
  ): Promise<void> =>
    call("update_typography", { projectPath, fontSize, paperSize, lineSpacing, marginCm }),

  detectLatex: (): Promise<LatexInfo> =>
    call("detect_latex"),

  getCloudFolders: (): Promise<CloudFolder[]> =>
    call("get_cloud_folders"),

  /** Abre el diálogo nativo de selección de carpeta. Retorna null si el usuario cancela. */
  pickFolder: async (): Promise<string | null> => {
    if (!isTauri()) return null;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true, multiple: false });
      if (Array.isArray(result)) return result[0] ?? null;
      return result ?? null;
    } catch {
      return null;
    }
  },
};
