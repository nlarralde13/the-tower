import { generateFloorFromPublicSeed } from "@/engine/seedIO";

export default async function Page() {
  const grid = await generateFloorFromPublicSeed(
    "/data/floor-seed-f1-s1130215123.json", // your uploaded sample
    { /* your FloorConfig defaults here */ }
  );

  // ...render your grid
  return <pre>{JSON.stringify(grid, null, 2)}</pre>;
}
