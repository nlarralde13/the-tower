# The Tower

A small roguelite prototype built with Next.js that generates 8x8 tower floors, lets you explore room-by-room, and layers in flavor text, scenes, and combat UI. This repository includes the floor generator, dev tools, a lightweight run state store, and a basic play experience.

## Features
- 8x8 procedural floor generation with reproducible seeds
- Fixed seeds in `public/data` for repeatable floors (e.g., Floor 1 / Floor 5)
- Room types: entry, exit, boss, combat, trap, loot, out, special, empty, blocked
- Per-room flavor text pools (snarky, configurable per type)
- Play surface at `/play` combines the `SceneViewer` (captioned with `chooseFlavor`/`exitsFlavor`), `ThumbBar` D-pad + inspect/ascend/flee actions, `ControlPad` menus, sliding drawers for Character/Inventory/Map/Journal, the compact map/journal rails, and `CombatOverlay`/`DefeatOverlay` anchored to the scene.
- Combat overlay renders a turn strip, compact log, floaters, and a stats rail with player/enemy `EntityPanel`s; `CombatRoot` wires `CombatConsole` for attack/skill/item/defend/flee targeting plus the victory panel that handles loot, search, and exit choices.
- Dev and preference surfaces: `/dev` tunes ratios, validates `rulesetTemplate`, previews seeds, and can push them into the run store, `/dev/combat-testing` sandbox lets you configure scenes, hero stats, and enemy lists before routing into combat, `/settings` persists retro/high-contrast/text/haptics/audio preferences, and `docs/flavor.md` explains how to edit room flavor lines.
- Minimal NextAuth (Google) wiring with `AuthGate` providing provider buttons (Google default, GitHub/Discord placeholders) and middleware protecting the climb/trader/crafter/inn/training flows.

## Tech Stack
- Next.js (App Router)
- TypeScript, React
- Zustand for run/combat/UI state (`src/store/runStore.ts`, `src/state/combatStore.ts`, `src/store/uiStore.ts`)
- LocalStorage-backed preference store for retro/haptics/audio (`src/hooks/usePreferences.tsx`) plus `useHaptics` for optional vibration/audio wake-ups
- NextAuth (Google) + `AuthGate` for gated runs and provider selection
- Jest for tests (basic setup)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm, npm, or yarn

### Install
- pnpm: `pnpm install`
- npm: `npm install`
- yarn: `yarn`

### Environment
Create `.env.local` at the repo root (see examples below).

Required for NextAuth Google provider (climb/play gating):
- `NEXTAUTH_SECRET=...`
- `NEXTAUTH_URL=http://localhost:3000`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`

Optional: add other NextAuth providers as needed in `src/app/api/auth/[...nextauth]/route.ts`.

### Scripts
- `pnpm dev` / `npm run dev` — start dev server
- `pnpm build` / `npm run build` — production build
- `pnpm start` / `npm run start` — run production server
- `pnpm test` / `npm run test` — run Jest tests

### Running
- Visit `/` for the main menu
- Go to `/climb` to start a run (auth-gated)
- The play UI is at `/play`
- Dev tools at `/dev` for generation controls and seed IO
- `/settings` exposes retro/high-contrast/text/haptics/audio toggles stored via `usePreferences`
- `/dev/combat-testing` is a sandbox for bespoke encounters (hero config, enemies, room type) backed by the same stores

## Project Structure
- `src/app` - Next.js routes; `page.tsx` home, `/climb`, `/play`, `/play/combat`, `/dev`, `/dev/combat-testing`, `/settings`, `/traders`, `/crafters`, `/inn`, `/training`, plus `layout.tsx` and `globals.css`
  - API routes live under `src/app/api/`, including `auth/[...nextauth]/route.ts` and `floors/from-public/route.ts`
- `src/components` - UI primitives: `PageSurface`, `SceneViewer`, `TopBar`, `ThumbBar`, `ControlPad` (Explore + Combat), `SlideDrawer`, `CombatOverlay`, `CombatRoot`, HUD widgets, and drawer content
- `src/store` - `runStore.ts` for the run lifecycle (grid, scene pools, run/combat logs, combat session, defeat overlay, dev toggles) and `uiStore.ts` for panel visibility, menu stacks, and input states
- `src/state` - `combatStore.ts` (Zustand store managing encounters, initiative, queue timing, and enemy turns)
- `src/hooks` - helpers like `usePreferences`, `useHaptics`, and the legacy `useGameLoop`
- `src/engine` - `generateFloor.ts`, `runFactory.ts`, RNG/path helpers, seed IO, plus `combat/*` and `items/itemRuntime.ts`
- `src/content` - curated `actions`, `enemies`, `items`, and `statuses` used by combat and HUD logic
- `src/utils` - `validateRuleset.ts` for dev validation and `audioManager.ts` for looping background music
- `src/game` - flavor text helpers (`flavor/`, `flavor.ts`, `content/flavor.ts`)
- `src/types/tower.ts` - core domain types
- `public/data` - seed exports (`floor-seed-*`) and `rulesetTemplate.json`
- `public/images` - scenes/backdrops plus `public/audio` (`tower_theme.mp3`)
- `docs/flavor.md` - how-to edit per-room flavor lines

## State & Persistence
- `src/store/runStore.ts` tracks `runId`, current floor, grid, player position, scene pools, visited/completed cells, run/combat logs, active combat session, `defeatOverlay`, `dev.gridOverlay`, and exposes actions such as `enterRun`, `move`, `ascend`, `engageCombat`, `attemptCombatFlee`, `resolveCombatExit`, `completeCombat`, `log*`, and `endRun`; the entire slice persists under `runState:v1`.
- `src/state/combatStore.ts` orchestrates encounter objects, initiative order, the player decision queue, enemy timing, `advanceTurn`, and helpers like `forceEnemyAdvance`/`endEncounter`.
- `src/store/uiStore.ts` stores `uiMode`, menu stacks, selected actions, drawer states, and convenience helpers (`enterCombatMode`, `exitCombatMode`, `toggle` panels) persisted via `ui-store-v1`.
- `src/hooks/usePreferences.tsx` feeds the `/settings` page and writes `pref:*` keys for retro, high contrast, large text, haptics, and music; `useHaptics.ts` honors those toggles, vibrates via `navigator.vibrate` or plays ticks via `AudioContext`, and `src/utils/audioManager.ts` drives the looping tower theme used on `/play`.

## Key Flows
- Start/Resume: `/climb` calls `runStore.enterRun()` (loads `rulesetTemplate.json`, builds a seed, and generates Floor 1), the run state persists to `runState:v1`, and `/play` begins with `audioManager.playMusic("/audio/tower_theme.mp3")`.
- Movement & controls: the `ThumbBar` D-pad (`onMove`) drives `runStore.move`; Inspect opens the journal drawer, Ascend is enabled only on exits, and Flee shows a timed confirmation before calling `runStore.endRun()` and returning to `/`; drawers are controlled through `uiStore.toggle`.
- Flavor & scenes: `runStore.sceneId` comes from per-room pools (`initialPools()`) and `chooseFlavor(type)`/`exitsFlavor(dirs)` produce captions; the optional dev grid overlay lives in `runStore.dev.gridOverlay`, and `SceneViewer` highlights the current cell while respecting `visitedRooms`.
- Combat: `runStore.engageCombat()` flips to `"combat"` mode, `CombatOverlay` (turn strip, `CompactLog`, floaters, stats rail with `EntityPanel`s) tracks `combatStore` telemetry, and `CombatRoot`/`CombatConsole` fire attack/skill/item/defend/flee decisions; a cleared room shows the victory panel (loot/search/exit buttons that hit `runStore.resolveCombatExit()`), while `defeatOverlay` renders a fullscreen defeat dialog until `runStore.endRun()` clears the run.
- Map & journal: `visitedRooms` and `completedRooms` drive the mini-map shading (`MapPanel`) and journal drawer entries log movement/combat events with categories; drawers live in `SlideDrawer` wrappers triggered by `TopBar` quick actions.
- Preferences & feedback: `/settings` writes retro/high-contrast/text/haptics/audio toggles via `usePreferences`, which applies `data-hc`, `data-bigtext`, and `data-music-off` tags; `useHaptics` (respecting `pref:haptics`/intensity) vibrates or plays ticks, and the same toggles control whether `audioManager` plays background music.
- Dev & experimental: `/dev` validates rulesets (`src/utils/validateRuleset.ts`), adjusts ratios, previews generated grids, and can hydrate the run via `runStore._devSetRunFromSeed`; `/dev/combat-testing` lets you spawn heroic stats, enemy lists, scenes, and room types before routing into live combat for iteration.

## Seed & Ruleset
- Example seeds: `public/data/floor-seed-f1-s1130215123.json`, `public/data/floor-seed-f5-s3707387099.json`
- Ruleset template: `public/data/rulesetTemplate.json` (per-floor ratios, difficulty)
- API: `POST /api/floors/from-public` loads a seed from `/public/data` and returns a generated grid

## Styling & Accessibility
- Shared tokens for gothic glass surfaces (`--glass-bg`, `--glass-border`, `--glass-shadow`, `--radius-sm`, `--radius-md`, `--blur-sm`) and retro-inspired base styles live in `src/app/globals.css`.
- `/settings` toggles (retro overlay, high contrast, large text, haptics, music) persist to `pref:*` keys via `usePreferences.tsx` and decorate `<html>` with `data-hc`, `data-bigtext`, and `data-music-off`; `useHaptics` respects `pref:haptics`/intensity and `navigator.vibrate` + audio ticks.
- Combat stats rail (`.stats-rail`, `.entity-panel`) and HUD widgets use CSS grid stacking on mobile, `EntityPanel`s expose `role="region"` with accessible meter labels, and `VictoryPanel`/`DefeatOverlay` provide descriptive buttons and dialog roles.
- `ThumbBar`, `ControlPad`, and `SlideDrawer` actions carry clear labels/ARIA hints, and the map (`MapPanel`) adds accessible titles/annotations for visited/current rooms.
- `CombatOverlay` retains `aria-live` announcements, while `SceneViewer` captions combine flavor text with exits for clarity.

## Testing
- Jest is configured via `jest.config.js` and `jest.setup.ts`
- Add focused tests near logic in `src/engine`, `src/store`, and combat/state modules

## Documentation
- `DEVELOPER.md` lists architecture, stores, and dev flows so you can navigate the implementation.
- `docs/flavor.md` describes how to edit room flavor text without touching game logic.
- `tools/check_utf8.py` helps verify any edits stay in UTF-8/ASCII if you need to enforce encoding.

## Contributing
- PRs should keep changes scoped, typed, and consistent with existing patterns; lean on the Documentation section when you need architectural context.

## License
- Proprietary/in-repo use unless otherwise noted (no license file provided)
