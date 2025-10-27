// /src/ui/legendConfig.ts
export type LegendEntry = { label: string; color: string; dot?: boolean };

export const LEGEND: LegendEntry[] = [
  { label: "Void (dead space)", color: "#000000" },
  { label: "Empty",             color: "#1414bdff" },
  { label: "Combat",            color: "#e11d48" },
  { label: "Treasure",          color: "#eab308" },
  { label: "Trap",              color: "#a855f7" },
  { label: "Puzzle",            color: "#06b6d4" },
  { label: "Exit",              color: "#22c55e" },
  { label: "You (player)",      color: "#ffffff", dot: true },
];
