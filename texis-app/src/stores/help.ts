import { create } from "zustand";

export type HelpSection = "start" | "figures" | "latex" | "errors" | "faq";

interface HelpStore {
  open: boolean;
  section: HelpSection;
  openHelp: (section?: HelpSection) => void;
  closeHelp: () => void;
}

export const useHelpStore = create<HelpStore>((set) => ({
  open: false,
  section: "start",
  openHelp: (section = "start") => set({ open: true, section }),
  closeHelp: () => set({ open: false }),
}));
