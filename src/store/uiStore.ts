import { create } from "zustand";

type PanelName = "character" | "map" | "journal" | "combatActions";

type UIState = {
  openPanels: Record<PanelName, boolean>;
  open: (panel: PanelName) => void;
  close: (panel: PanelName) => void;
  toggle: (panel: PanelName) => void;
  closeAll: () => void;
};

const PANEL_NAMES: PanelName[] = ["character", "map", "journal", "combatActions"];

function buildState(active?: PanelName): Record<PanelName, boolean> {
  return PANEL_NAMES.reduce((acc, name) => {
    acc[name] = name === active;
    return acc;
  }, {} as Record<PanelName, boolean>);
}

export const useUIStore = create<UIState>((set) => ({
  openPanels: buildState(),
  open: (panel) => set(() => ({ openPanels: buildState(panel) })),
  close: (panel) =>
    set((state) => ({
      openPanels: { ...state.openPanels, [panel]: false },
    })),
  toggle: (panel) =>
    set((state) => {
      const isOpen = state.openPanels[panel];
      return { openPanels: buildState(isOpen ? undefined : panel) };
    }),
  closeAll: () => set(() => ({ openPanels: buildState() })),
}));

export type { PanelName };
