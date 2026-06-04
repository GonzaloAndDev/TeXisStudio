import { create } from "zustand";
import type { LangCatalog, LangPackEntry, InstalledLangPack } from "../types";
import {
  fetchCatalog,
  installPack,
  uninstallPack,
  loadInstalledPacks,
} from "../services/languagePacks";
import { registerDynamicLocale } from "../i18n/index";

interface LangPacksState {
  /** Remote catalog (null = not yet fetched) */
  catalog: LangCatalog | null;
  catalogLoading: boolean;
  catalogError: string | null;

  /** Currently installed packs (persisted in localStorage) */
  installed: InstalledLangPack[];

  /** IDs currently being installed */
  installing: Set<string>;
  installProgress: Record<string, string>;

  /** IDs currently being uninstalled */
  uninstalling: Set<string>;

  // Actions
  loadCatalog: (force?: boolean) => Promise<void>;
  install: (entry: LangPackEntry) => Promise<void>;
  uninstall: (id: string) => void;
  isInstalled: (id: string) => boolean;
  reload: () => void;
}

export const useLangPacksStore = create<LangPacksState>((set, get) => ({
  catalog: null,
  catalogLoading: false,
  catalogError: null,
  installed: loadInstalledPacks(),
  installing: new Set(),
  installProgress: {},
  uninstalling: new Set(),

  loadCatalog: async (force = false) => {
    if (get().catalogLoading) return;
    set({ catalogLoading: true, catalogError: null });
    try {
      const catalog = await fetchCatalog(force);
      set({ catalog, catalogLoading: false });
    } catch (e) {
      set({ catalogError: String(e), catalogLoading: false });
    }
  },

  install: async (entry) => {
    const { installing } = get();
    if (installing.has(entry.id)) return;

    const next = new Set(installing);
    next.add(entry.id);
    set({ installing: next });

    try {
      const installedPack = await installPack(entry, (step) => {
        set((s) => ({ installProgress: { ...s.installProgress, [entry.id]: step } }));
      });
      if (installedPack.ui_data) {
        registerDynamicLocale(entry.id, installedPack.ui_data);
      }
      set((s) => {
        const updated = new Set(s.installing);
        updated.delete(entry.id);
        const { [entry.id]: _, ...rest } = s.installProgress;
        return {
          installing: updated,
          installProgress: rest,
          installed: loadInstalledPacks(),
        };
      });
    } catch (e) {
      set((s) => {
        const updated = new Set(s.installing);
        updated.delete(entry.id);
        return { installing: updated };
      });
      throw e;
    }
  },

  uninstall: (id) => {
    const { uninstalling } = get();
    const next = new Set(uninstalling);
    next.add(id);
    set({ uninstalling: next });
    uninstallPack(id);
    set((s) => {
      const updated = new Set(s.uninstalling);
      updated.delete(id);
      return { uninstalling: updated, installed: loadInstalledPacks() };
    });
  },

  isInstalled: (id) => get().installed.some((p) => p.id === id),

  reload: () => set({ installed: loadInstalledPacks() }),
}));
