import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/** View-mode for the Play screen (single screen, different states) */
export type UIMode = "explore" | "combat" | "extract" | "summary";

/** Drawer panels you already use across the app */
export type PanelName = "character" | "inventory" | "map" | "journal";

type OpenPanels = Record<PanelName, boolean>;

interface UIState {
  /* ──────────────── Global UI mode ──────────────── */
  uiMode: UIMode;

  /** Lock inputs during initiative banner / resolve window */
  inputsDisabled: boolean;

  /* ──────────────── JRPG menu state ──────────────── */
  menuDepth: 0 | 1 | 2;
  /** Breadcrumb of the current submenu path, e.g., ["Skills","Offense"] */
  menuPath: string[];
  /** Chosen action specifics (optional, used by CombatPad) */
  selectedSkillId?: string | null;
  selectedItemId?: string | null;
  selectedTargets: string[]; // entity ids

  /* ──────────────── Drawers / Panels ──────────────── */
  openPanels: OpenPanels;

  /* Panel controls (unchanged API) */
  open: (panel: PanelName) => void;
  close: (panel: PanelName) => void;
  toggle: (panel: PanelName) => void;

  /* Mode + menu helpers */
  setMode: (mode: UIMode) => void;
  setInputsDisabled: (v: boolean) => void;

  resetMenus: () => void;
  pushMenu: (label: string) => void;
  popMenu: () => void;

  setSelectedSkill: (id: string | null) => void;
  setSelectedItem: (id: string | null) => void;
  toggleTarget: (id: string) => void;
  clearTargets: () => void;

  /** Convenience: move into/out of combat mode and tidy panels */
  enterCombatMode: () => void;
  exitCombatMode: () => void;

  /** Hard reset of transient UI state (optional) */
  resetUI: () => void;
}

const initialPanels: OpenPanels = {
  character: false,
  inventory: false,
  map: false,
  journal: false,
};

const initialState: Pick<
  UIState,
  | "uiMode"
  | "inputsDisabled"
  | "menuDepth"
  | "menuPath"
  | "selectedItemId"
  | "selectedSkillId"
  | "selectedTargets"
  | "openPanels"
> = {
  uiMode: "explore",
  inputsDisabled: false,
  menuDepth: 0,
  menuPath: [],
  selectedItemId: null,
  selectedSkillId: null,
  selectedTargets: [],
  openPanels: initialPanels,
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        /* ───────── Panels ───────── */
        open: (panel) =>
          set((s) => ({
            openPanels: { ...Object.fromEntries(Object.keys(s.openPanels).map(k => [k as PanelName, false])) as OpenPanels, [panel]: true },
          })),
        close: (panel) =>
          set((s) => ({ openPanels: { ...s.openPanels, [panel]: false } })),
        toggle: (panel) =>
          set((s) => ({
            openPanels: { ...Object.fromEntries(Object.keys(s.openPanels).map(k => [k as PanelName, false])) as OpenPanels, [panel]: !s.openPanels[panel] },
          })),

        /* ───────── Mode / Inputs ───────── */
        setMode: (mode) => set({ uiMode: mode }),
        setInputsDisabled: (v) => set({ inputsDisabled: v }),

        /* ───────── Menus ───────── */
        resetMenus: () =>
          set({
            menuDepth: 0,
            menuPath: [],
            selectedItemId: null,
            selectedSkillId: null,
            selectedTargets: [],
          }),
        pushMenu: (label) =>
          set((s) => ({
            menuDepth: Math.min(2, (s.menuDepth + 1) as number) as 0 | 1 | 2,
            menuPath: [...s.menuPath, label],
          })),
        popMenu: () =>
          set((s) => {
            const path = s.menuPath.slice(0, -1);
            return {
              menuDepth: Math.max(0, s.menuDepth - 1) as 0 | 1 | 2,
              menuPath: path,
            };
          }),

        setSelectedSkill: (id) => set({ selectedSkillId: id, selectedItemId: null }),
        setSelectedItem: (id) => set({ selectedItemId: id, selectedSkillId: null }),

        toggleTarget: (id) =>
          set((s) => ({
            selectedTargets: s.selectedTargets.includes(id)
              ? s.selectedTargets.filter((t) => t !== id)
              : [...s.selectedTargets, id],
          })),
        clearTargets: () => set({ selectedTargets: [] }),

        /* ───────── Convenience helpers ───────── */
        enterCombatMode: () =>
          set({
            uiMode: "combat",
            inputsDisabled: false,
            openPanels: { ...initialPanels },
            menuDepth: 0,
            menuPath: [],
            selectedItemId: null,
            selectedSkillId: null,
            selectedTargets: [],
          }),
        exitCombatMode: () =>
          set({
            uiMode: "explore",
            inputsDisabled: false,
            openPanels: { ...initialPanels },
            menuDepth: 0,
            menuPath: [],
            selectedItemId: null,
            selectedSkillId: null,
            selectedTargets: [],
          }),

        resetUI: () => set({ ...initialState }),
      }),
      { name: "ui-store-v1" }
    )
  )
);
