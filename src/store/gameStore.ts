import { create } from "zustand";
type Meta = { gold: number; shards: number; unlocked: string[] };

export const useGameStore = create<{
  meta: Meta; setMeta: (p: Partial<Meta>) => void;
}>()((set) => ({
  meta: { gold: 0, shards: 0, unlocked: ["Warrior"] },
  setMeta: (p) => set((s) => ({ meta: { ...s.meta, ...p } })),
}));
