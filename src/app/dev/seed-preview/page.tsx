import { generateFloorFromPublicSeed } from "@/engine/seedIO";

export default async function Page() {
  const grid = await generateFloorFromPublicSeed(
    "/data/floor-seed-f1-s1130215123.json", // your uploaded sample
    {
      difficulty: 1,
      room_ratios: { combat: 0.3, trap: 0.2, loot: 0.2, out: 0.15, special: 0.15, empty: 0.2 },
      boss_room: false,
    }
  );

  // ...render your grid
  return <pre>{JSON.stringify(grid, null, 2)}</pre>;
}
