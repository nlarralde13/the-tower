# Developer Guide

This document explains the architecture, main modules, and conventions for The Tower.

## Architecture
- App Router (Next.js) renders pages under `src/app/*`.
- State: A single Zustand store in `src/store/runStore.ts` manages the “run”: seeds, grid, movement, scene selection, simple journal, and dev flags.
- Engine: Floor generation and seed IO in `src/engine/*` (deterministic with seeds).
- Game: Player‑facing copy and helpers in `src/game/*` (flavor, exits copy, command engine used by ConsolePanel prototype).
- UI: Reusable components in `src/components/*` (PageSurface, MainMenu, ThumbBar, etc.), global styles in `src/app/globals.css`.

## Key Types
- `RoomType`: `entry | exit | boss | combat | trap | loot | out | special | empty | blocked`.
- `FloorGrid`: `{ width, height, cells[], entry, exit, boss? }`.
- `FloorSeed`: serialized knobs + RNG seed to reproduce a floor.
- See `src/types/tower.ts` for details.

## runStore (Gameplay State)
- Entry point actions:
  - `enterRun()` — creates a run, loads ruleset, generates Floor 1, sets player at entry.
  - `resumeFromStorage()` — restores last run from localStorage.
  - `ascend()` — switches to next floor using fixed public seeds for 1–4 or 5.
  - `move(dir)` — validates neighbor, updates `playerPos`, selects a scene path from a per‑type pool, and logs a journal entry.
- Scene pools: defined in `initialPools()`; `drawFromPool()` picks an image path and prevents immediate repetition per room type.
- Journal: list of `{ t, floor, x, y, type, scene }` entries used by UI and (now) the Map.

## Generation
- `generateFloorFromSeed(seed, cfg)` — main deterministic generator.
- Ratios live in rulesets (`public/data/rulesetTemplate.json`) or per floor config.
- A corridor (entry→exit) is carved first; bands expand to meet open/blocked targets.

## Flavor System
- Per‑room content files in `src/game/flavor/*.ts` (arrays of strings per type).
- `src/game/flavor.ts` imports them and exports:
  - `chooseFlavor(type)` — returns a randomized line for a `RoomType`.
  - `exitsFlavor(dirs)` — converts exits to natural language.
- `src/game/content/flavor.ts` is a compatibility wrapper for engine imports and also provides the “wall” quip for void/blocked.

## Play UI
- `src/app/play/page.tsx` renders:
  - Left menu (desktop): quick links.
  - Middle: SceneViewer and controls (ThumbBar).
  - Right: Map panel (replaces the old Journal).
- Movement feedback: Attempting to go into a wall announces “Why are you running face first into that wall?”.
- Map panel:
  - 32×32 tiles; dark gray for unknown, white for visited; current tile shows a circular marker and gold border.
  - Resets per floor by filtering journal entries where `entry.floor === currentFloor`.
  - Opens inline on mobile and in the right column on desktop.

## Styling
- `PageSurface` uses CSS variables to set background image and optional overlay.
- Panels follow the `.tower-shell` (center layout) and `.menu-panel` (card) styles.
- Shared button classes: `.btn`, `.btn--primary`, `.btn--ghost` in `globals.css`.

## Auth
- `src/app/api/auth/[...nextauth]/route.ts` defines a Google provider.
- Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.
- `AuthGate` component guards certain pages.

## Dev Tools
- `/dev` page provides sliders for room ratios, seed controls, and seed import/export.
- `src/app/api/floors/from-public/route.ts` allows POSTing a path under `/public/data` to return a generated grid.

## Testing
- Jest configuration in `jest.config.js`; setup in `jest.setup.ts`.
- Prefer colocated tests near the engine and store logic.

## Conventions
- Keep changes narrowly scoped; avoid gratuitous renames.
- Maintain deterministic behavior in the generator when given the same seed.
- Keep per‑room copy in `src/game/flavor/*` and reuse `chooseFlavor()`.
- UI additions should use existing panel and button styles when possible.

## Roadmap Ideas
- Combat loop prototype; inventory and loot interactions.
- Fog‑of‑war map (show adjacent unknown differently).
- Multiple scene variants per room type with weighted pools.
- Expanded auth providers and user profiles.
- More tests around generator edge cases.
