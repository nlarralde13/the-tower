# Change Log — Procedural Tower Generation (Dev tools + Engine)

Date: 2025-10-31

## Overview

This log records the set of changes made to implement the distance-band corridor algorithm, add seed export/import for floors, introduce a boss density weight, and improve the Dev page tooling.

## Engine

- Distance-band corridor generation with seeded reproducibility.
  - Carves a guaranteed Entry → Exit path, then opens tiles outward in BFS distance bands until reaching the target `openFraction`.
  - Corridor width is controlled by `riverWidth + bandPadding` (clamped ≥ 0).
  - Blocks are the complement of opened tiles; symmetric “river” pattern around the path.
  - File: `src/engine/generateFloor.ts`.

- New options (backwards compatible):
  - `bandPadding?: number` — widens/tightens corridor beyond `riverWidth`.
  - `blockedFraction?: number` — alternative to `openFraction` (interpreted as `1 - blockedFraction`).
  - `mazeMode?: string | boolean` — accepted for compatibility; currently unused.

- Floor 1 entry/exit rule:
  - Entry at (3,7) or (4,7); Exit constrained to top two rows.

- New helper to generate from a serialized seed:
  - `export function generateFloorFromSeed(seed: FloorSeed, baseConfig: FloorConfig): FloorGrid`.
  - File: `src/engine/generateFloor.ts`.

## Types

- `RoomRatios` now supports optional `boss?: number` density weight.
  - File: `src/types/tower.ts`.

- New `FloorSeed` type that serializes a reproducible generation request:
  - Fields: `floor`, `seed`, optional `isFinalBossFloor`, `options` (minEmptyFraction, pathEmptyBias, open/blockedFraction, wiggle, riverWidth, optional bandPadding), and `roomRatios` (combat, trap, loot, out, special, optional boss/empty).
  - File: `src/types/tower.ts`.

## Validator

- Recognizes optional `boss` ratio key within `room_ratios`.
  - File: `src/utils/validateRuleset.ts`.

## Ruleset Template

- Adds `boss: 0.00` to each floor’s `room_ratios` as a documented example.
  - File: `public/data/rulesetTemplate.json`.

## Dev Tools UI (`/dev` page)

- Adds boss to “Room Density Weights” controls.
- Randomize controls:
  - “Random Seed” button — sets a new 32-bit seed.
  - “Random Weights” button — samples a Dirichlet-like distribution over all ratio keys.
- Seed export/import:
  - “Export Seed JSON” — downloads a `FloorSeed` JSON capturing current knobs for the selected floor.
  - “Import Seed JSON” — loads a seed file, reflects settings into the UI, and immediately generates the floor using `generateFloorFromSeed`.
  - File: `src/app/dev/page.tsx`.

## Notes on Boss Density

- On final floors that require boss-clear, the generator still places one guaranteed boss tile along the path. If `boss` density is also set, additional boss tiles may be assigned by weighted distribution; the generator subtracts one boss from the apportionment when the guaranteed boss exists.

## Compatibility

- Existing rulesets without `boss` remain valid. The validator now accepts `boss` when present.
- The dev page defaults `boss` to 0 if omitted in the ruleset.
- All changes preserve seeded RNG behavior and are additive.

