import { create } from "zustand";

export interface CursorPosition {
  line: number;
  column: number;
}

interface WorkspaceState {
  openFiles: string[];
  activeFile: string | null;
  zoomLevel: number;
  cursorPositions: Record<string, CursorPosition>;
  lastBuildSummary: { success: boolean; pdf_path?: string; duration_ms?: number } | null;
}

interface WorkspaceStore extends WorkspaceState {
  hydrate: (state: WorkspaceState) => void;
  setOpenFiles: (files: string[]) => void;
  setActiveFile: (file: string | null) => void;
  addOpenFile: (file: string) => void;
  removeOpenFile: (file: string) => void;
  setZoomLevel: (level: number) => void;
  setCursorPosition: (file: string, pos: CursorPosition) => void;
  getCursorPosition: (file: string) => CursorPosition | undefined;
  setLastBuildSummary: (summary: WorkspaceState["lastBuildSummary"]) => void;
  reset: () => void;
}

const INITIAL_STATE: WorkspaceState = {
  openFiles: [],
  activeFile: null,
  zoomLevel: 1,
  cursorPositions: {},
  lastBuildSummary: null,
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...INITIAL_STATE,

  hydrate: (state) => set({ ...state }),

  setOpenFiles: (files) => set({ openFiles: files }),

  setActiveFile: (file) => set({ activeFile: file }),

  addOpenFile: (file) =>
    set((state) => ({
      openFiles: state.openFiles.includes(file)
        ? state.openFiles
        : [...state.openFiles, file],
    })),

  removeOpenFile: (file) =>
    set((state) => ({
      openFiles: state.openFiles.filter((f) => f !== file),
      activeFile: state.activeFile === file ? null : state.activeFile,
    })),

  setZoomLevel: (level) => set({ zoomLevel: level }),

  setCursorPosition: (file, pos) =>
    set((state) => ({
      cursorPositions: { ...state.cursorPositions, [file]: pos },
    })),

  getCursorPosition: (file) => get().cursorPositions[file],

  setLastBuildSummary: (summary) => set({ lastBuildSummary: summary }),

  reset: () => set(INITIAL_STATE),
}));
