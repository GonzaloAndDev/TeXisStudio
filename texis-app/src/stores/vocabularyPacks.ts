import { create } from "zustand";
import type { VocabPackEntry, InstalledVocabPack, CustomVocabRepo } from "../types";
import {
  loadInstalledVocabPacks,
  fetchVocabPacksFromCatalog,
  installVocabPack,
  uninstallVocabPack,
  loadCustomRepos,
  addCustomRepo,
  removeCustomRepo,
  syncCustomRepo,
} from "../services/vocabularyPacks";

interface VocabPacksState {
  // Official catalog packs
  officialPacks: VocabPackEntry[];
  catalogLoading: boolean;
  catalogError: string | null;

  // Installed packs
  installed: InstalledVocabPack[];
  installing: Set<string>;
  uninstalling: Set<string>;
  /** Último error de instalación (red, pack inválido, cuota). null = sin error.
   *  Antes un fallo de install se tragaba silenciosamente: el spinner paraba y
   *  el usuario no veía nada. Ahora se surface en el panel. */
  installError: string | null;

  // Custom repos
  customRepos: CustomVocabRepo[];
  repoLoading: boolean;

  // Actions
  loadOfficialCatalog: () => Promise<void>;
  install: (entry: VocabPackEntry) => Promise<void>;
  uninstall: (id: string) => void;
  clearInstallError: () => void;
  isInstalled: (id: string) => boolean;
  addRepo: (alias: string, url: string) => Promise<void>;
  removeRepo: (id: string) => void;
  syncRepo: (id: string) => Promise<void>;
  reload: () => void;
}

export const useVocabPacksStore = create<VocabPacksState>((set, get) => ({
  officialPacks: [],
  catalogLoading: false,
  catalogError: null,
  installed: loadInstalledVocabPacks(),
  installing: new Set(),
  uninstalling: new Set(),
  installError: null,
  customRepos: loadCustomRepos(),
  repoLoading: false,

  loadOfficialCatalog: async () => {
    if (get().catalogLoading) return;
    set({ catalogLoading: true, catalogError: null });
    try {
      const packs = await fetchVocabPacksFromCatalog();
      set({ officialPacks: packs, catalogLoading: false });
    } catch (e) {
      set({ catalogError: String(e), catalogLoading: false });
    }
  },

  install: async (entry) => {
    const { installing } = get();
    if (installing.has(entry.id)) return;
    set((s) => ({ installing: new Set([...s.installing, entry.id]), installError: null }));
    try {
      await installVocabPack(entry);
      set((s) => {
        const next = new Set(s.installing);
        next.delete(entry.id);
        return { installing: next, installed: loadInstalledVocabPacks() };
      });
    } catch (e) {
      // Surface el error en estado (el panel lo muestra) en vez de tragarlo.
      set((s) => {
        const next = new Set(s.installing);
        next.delete(entry.id);
        return { installing: next, installError: String(e) };
      });
    }
  },

  clearInstallError: () => set({ installError: null }),

  uninstall: (id) => {
    set((s) => ({ uninstalling: new Set([...s.uninstalling, id]) }));
    uninstallVocabPack(id);
    set((s) => {
      const next = new Set(s.uninstalling);
      next.delete(id);
      return { uninstalling: next, installed: loadInstalledVocabPacks() };
    });
  },

  isInstalled: (id) => get().installed.some((p) => p.id === id),

  addRepo: async (alias, url) => {
    set({ repoLoading: true });
    try {
      await addCustomRepo(alias, url);
      set({ customRepos: loadCustomRepos(), repoLoading: false });
    } catch (e) {
      set({ repoLoading: false });
      throw e;
    }
  },

  removeRepo: (id) => {
    removeCustomRepo(id);
    set({ customRepos: loadCustomRepos() });
  },

  syncRepo: async (id) => {
    set({ repoLoading: true });
    try {
      await syncCustomRepo(id);
      set({ customRepos: loadCustomRepos(), repoLoading: false });
    } catch (e) {
      set({ repoLoading: false });
    }
  },

  reload: () => set({ installed: loadInstalledVocabPacks(), customRepos: loadCustomRepos() }),
}));
