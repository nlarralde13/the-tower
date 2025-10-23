import type { RoomType } from "../types";

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const FLAVOR: Record<Exclude<RoomType, "void">, string[]> = {
  empty: [
    "The room smells faintly of disappointment and old decisions.",
    "An empty chamber. You feel judged by the architecture.",
    "There is nothing here except the sense you’re missing something obvious.",
    "Minimalist decor. Bold choice for a murder tower."
  ],
  combat: [
    "You are not alone. Whatever it is, it skipped leg day and courtesy.",
    "A scraping sound announces something that eats optimism professionally.",
    "Two glowing eyes. Possibly friendly. Statistically unlikely.",
    "The room offers combat. How hospitable."
  ],
  treasure: [
    "A chest sits here, trying very hard to be casual.",
    "Glinting loot. Almost certainly trapped. Probably.",
    "You spot treasure. It spots you back, menacingly shiny.",
    "Riches! Or mimics. The Tower loves a prank."
  ],
  trap: [
    "You step in and the floor develops opinions. Loud, pointy opinions.",
    "A click echoes. You have activated ‘learning by doing’.",
    "Air tastes of oil and regret. Mechanisms lurk.",
    "The walls lean in conspiratorially. You do not feel included."
  ],
  puzzle: [
    "A puzzle awaits, pretending to be smarter than you.",
    "Runes hum with smug energy. They know something.",
    "Levers, tiles, and the promise of feeling clever.",
    "A riddle room. Finally, something you can overthink."
  ],
  exit: [
    "An archway ahead, humming like a kettle that resents you.",
    "A stairwell spirals upward, optimistic about your cardio.",
    "Portal detected. It looks drafty and judgmental.",
    "The exit glows with bureaucratic efficiency."
  ],
};

export function flavorFor(type: RoomType) {
  if (type === "void") return "A perfect absence. The Tower’s way of saying ‘no’.";
  const pool = FLAVOR[type] ?? ["It’s a room. It contains consequences."];
  return pick(pool);
}
