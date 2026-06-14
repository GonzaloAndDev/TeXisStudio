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
  addSection: (section: ProjectSection) => void;
  removeSection: (sectionId: string) => void;
  toggleSectionEnabled: (sectionId: string) => void;
  moveSectionUp: (sectionId: string) => void;
  moveSectionDown: (sectionId: string) => void;
  renameSection: (sectionId: string, title: string) => void;
  patchSection: (sectionId: string, patch: Partial<ProjectSection>) => void;
  reorderSection: (sectionId: string, targetId: string, position: "before" | "after") => void;
  insertSectionAt: (section: ProjectSection, index: number) => void;

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
  addSection: (section) =>
    set((state) => {
      if (!state.activeProject) return {};
      return { activeProject: { ...state.activeProject, sections: [...state.activeProject.sections, section] } };
    }),
  removeSection: (sectionId) =>
    set((state) => {
      if (!state.activeProject) return {};
      return { activeProject: { ...state.activeProject, sections: state.activeProject.sections.filter((s) => s.id !== sectionId) } };
    }),
  toggleSectionEnabled: (sectionId) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = state.activeProject.sections.map((s) =>
        s.id === sectionId ? { ...s, enabled: !s.enabled } : s
      );
      return { activeProject: { ...state.activeProject, sections } };
    }),
  moveSectionUp: (sectionId) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = [...state.activeProject.sections];
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx <= 0) return {};
      const prevIdx = idx - 1;
      if (sections[prevIdx].placement !== sections[idx].placement) return {};
      [sections[prevIdx], sections[idx]] = [sections[idx], sections[prevIdx]];
      return { activeProject: { ...state.activeProject, sections } };
    }),
  moveSectionDown: (sectionId) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = [...state.activeProject.sections];
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx < 0 || idx >= sections.length - 1) return {};
      const nextIdx = idx + 1;
      if (sections[nextIdx].placement !== sections[idx].placement) return {};
      [sections[idx], sections[nextIdx]] = [sections[nextIdx], sections[idx]];
      return { activeProject: { ...state.activeProject, sections } };
    }),
  renameSection: (sectionId, title) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = state.activeProject.sections.map((s) =>
        s.id === sectionId ? { ...s, title: title || undefined } : s
      );
      return { activeProject: { ...state.activeProject, sections } };
    }),
  patchSection: (sectionId, patch) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = state.activeProject.sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s
      );
      return { activeProject: { ...state.activeProject, sections } };
    }),
  insertSectionAt: (section, index) =>
    set((state) => {
      if (!state.activeProject) return {};
      const sections = [...state.activeProject.sections];
      sections.splice(Math.min(index, sections.length), 0, section);
      return { activeProject: { ...state.activeProject, sections } };
    }),
  reorderSection: (sectionId, targetId, position) =>
    set((state) => {
      if (!state.activeProject || sectionId === targetId) return {};
      const sections = [...state.activeProject.sections];
      const fromIdx = sections.findIndex((s) => s.id === sectionId);
      const toIdx   = sections.findIndex((s) => s.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return {};
      if (sections[fromIdx].placement !== sections[toIdx].placement) return {};
      const [moved] = sections.splice(fromIdx, 1);
      const newToIdx = sections.findIndex((s) => s.id === targetId);
      sections.splice(position === "before" ? newToIdx : newToIdx + 1, 0, moved);
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
