import { create } from "zustand";
import type { ContentBlock, LatexInfo, ProjectModel, ProjectSection, RecentProject, SectionStatus } from "../types";

function normalizeSection(section: ProjectSection): ProjectSection {
  return {
    ...section,
    blocks: Array.isArray(section.blocks) ? section.blocks : [],
    fields: section.fields ?? {},
    children: Array.isArray(section.children) ? section.children.map(normalizeSection) : [],
  };
}

function normalizeProject(model: ProjectModel): ProjectModel {
  return {
    ...model,
    sections: Array.isArray(model.sections) ? model.sections.map(normalizeSection) : [],
  };
}

interface ProjectStore {
  // Proyectos recientes
  recentProjects: RecentProject[];
  setRecentProjects: (projects: RecentProject[]) => void;

  // Proyecto activo
  activeProject: ProjectModel | null;
  activeProjectPath: string | null;
  openProject: (model: ProjectModel, path: string) => void;
  closeProject: () => void;
  updateProject: (model: Partial<ProjectModel>) => void;
  updateSectionBlocks: (sectionId: string, blocks: ContentBlock[]) => void;
  updateSectionMeta: (sectionId: string, status: SectionStatus, notes?: string) => void;

  // Sección activa en el editor
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;

  // Estado LaTeX
  latexInfo: LatexInfo | null;
  setLatexInfo: (info: LatexInfo) => void;

  // UI state
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  recentProjects: [],
  setRecentProjects: (projects) => set({ recentProjects: projects }),

  activeProject: null,
  activeProjectPath: null,
  openProject: (model, path) =>
    set(() => {
      const normalized = normalizeProject(model);
      return {
      activeProject: normalized,
      activeProjectPath: path,
      activeSectionId: normalized.sections.find(
        (s) => s.placement === "body" && s.enabled
      )?.id ?? null,
      };
    }),
  closeProject: () =>
    set({ activeProject: null, activeProjectPath: null, activeSectionId: null }),
  updateProject: (partial) =>
    set((state) =>
      state.activeProject
        ? { activeProject: { ...state.activeProject, ...partial } }
        : {}
    ),
  updateSectionBlocks: (sectionId, blocks) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = state.activeProject.sections.map((s) =>
        s.id === sectionId ? { ...s, blocks } : s
      );
      return { activeProject: { ...state.activeProject, sections } };
    }),
  updateSectionMeta: (sectionId, status, notes) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = state.activeProject.sections.map((s) =>
        s.id === sectionId ? { ...s, status, notes: notes ?? s.notes } : s
      );
      return { activeProject: { ...state.activeProject, sections } };
    }),

  activeSectionId: null,
  setActiveSectionId: (id) => set({ activeSectionId: id }),

  latexInfo: null,
  setLatexInfo: (info) => set({ latexInfo: info }),

  theme: "light",
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      return { theme: next };
    }),
}));
