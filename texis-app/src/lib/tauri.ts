// Wrappers type-safe sobre las invoke calls de Tauri.
// Si no estamos en Tauri (dev en browser), usa datos mock.

import { invoke } from "@tauri-apps/api/core";
import type {
  CompilationResult,
  LatexInfo,
  ProfileInfo,
  ProjectModel,
  RecentProject,
  ValidationReport,
} from "../types";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    return invoke<T>(cmd, args);
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
    draft: boolean
  ): Promise<CompilationResult> =>
    call("compile_project", { projectPath, backendName, draft }),

  getProfiles: (): Promise<ProfileInfo[]> =>
    call("get_profiles"),

  detectLatex: (): Promise<LatexInfo> =>
    call("detect_latex"),
};
