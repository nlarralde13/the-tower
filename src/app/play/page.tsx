// app/play/page.tsx (server component)
import { generateFloorFromSeed } from "@/engine/generateFloor";
import { generateFloorForRun } from "@/engine/runFactory";
import ruleset from "@/public/data/rulesetTemplate.json"; // or fs read

export default async function PlayPage() {
  const floorIdx = 1; // example
  const floorTemplate = ruleset.floors.find((f: any) => f.floor === floorIdx);

  const grid = generateFloorForRun(
    floorTemplate,
    { /* your FloorConfig defaults */ },
    /* optional fixedSeed */ undefined,
    generateFloorFromSeed
  );

  return <pre>{JSON.stringify(grid, null, 2)}</pre>;
}
