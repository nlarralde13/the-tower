# Developer Guide

Concise architecture, routes, paths, and design notes for The Tower.

## Repo Shape
- `src/app` houses the App Router: `page.tsx` (home), `/climb`, `/play`, `/play/combat`, `/dev`, `/dev/combat-testing`, `/settings`, `/traders`, `/crafters`, `/inn`, `/training`, plus `layout.tsx`, `globals.css`, and API routes (`auth/[...nextauth]` + `floors/from-public`).
- `src/components` contains UI primitives (AuthGate, PageSurface, SceneViewer, TopBar, ThumbBar, SlideDrawer) as well as console/combat assets (ControlPad, CombatOverlay, CombatRoot, HUD panels, map/journal UI).
- `src/store` is where `runStore.ts` manages the exploratory run state and `uiStore.ts` manages panel visibility, menus, and combat UI mode.
- `src/state` defines `combatStore.ts`, the encounter-focused Zustand slice.
- `src/hooks` hosts helpers such as `usePreferences` (retro/haptics/music persistence), `useHaptics` (vibration/audio), and the legacy `useGameLoop`.
- `src/engine` spans floor generation, run factories, RNG/path helpers, seed IO, and the combat/item engines under `src/engine/combat` and `src/engine/items`.
- `src/content` provides definition files for `actions`, `enemies`, `items`, and `statuses`.
- `src/game` exposes flavor helpers (`src/game/flavor.ts`, `src/game/content/flavor.ts` and the per-type flavor pools).
- `src/types/tower.ts` describes `RoomType`, `FloorGrid`, `FloorSeed`, `FloorConfig`, etc.
- `src/utils` carries `validateRuleset.ts` (used on `/dev`) and `audioManager.ts`.
- `public/data` stores seed exports (`floor-seed-*.json`) plus `rulesetTemplate.json`; `public/images` contains scene art and backgrounds; `public/audio` hosts the looping `tower_theme.mp3`.
- `docs/flavor.md` documents how to edit per-room flavor text.
- `tools/check_utf8.py` is handy for confirming ASCII/UTF-8 compliance when touching text-heavy files.
- `__tests__` and Jest config live at the repo root (`jest.config.js`, `jest.setup.ts`).

## Pages & Routes
- `/` (home) renders `src/app/page.tsx` inside `PageSurface` and `AuthGate`, giving visitors login options before they start a run.
- `/climb` (`src/app/climb/page.tsx`) is the gated entry point that calls `runStore.enterRun()` (via `AuthGate` + `middleware`) and then routes to `/play`.
- `/play` (`src/app/play/page.tsx`) orchestrates the three-pane layout (rails for character/inventory, the scene viewer, controls, map/journal drawers) and keeps `useRunStore`/`useUIStore` state in sync.
- `/play/combat` (`src/app/play/combat/page.tsx`) is a locked-down variant that dims the scene viewer, forces `uiMode` into `"combat"`, mounts `CombatOverlay`, and hosts `CombatRoot` for the tactical pad.
- `/dev` (`src/app/dev/page.tsx`) offers generation knobs/validators; `/dev/combat-testing` (`src/app/dev/combat-testing/page.tsx`) lets you craft sandbox encounters with custom hero stats, enemy lists, and scenes before routing through the real run.
- `/settings` (`src/app/settings/page.tsx`) edits retro/high-contrast/text/haptics and music flags via `usePreferences`; changes persist to localStorage keys so the UI and CSS respond globally.
- `/traders`, `/crafters`, `/inn`, and `/training` are placeholder guild/house pages (`src/app/{traders,crafters,inn,training}/page.tsx`) that simply wrap their content with `AuthGate` for future expansion.
- `middleware.ts` protects `/climb`, `/play`, `/traders`, `/crafters`, `/inn`, and `/training` by redirecting unauthenticated requests to `/`; the same NextAuth session is checked via `getToken`.

## API & Auth
- `POST /api/floors/from-public` (`src/app/api/floors/from-public/route.ts`) accepts `{ relPath: "/data/floor-seed-...json", baseConfig?: Partial<FloorConfig> }`, loads the referenced JSON from `public/data`, and runs it through `generateFloorFromPublicSeed`.
- NextAuth is configured in `src/app/api/auth/[...nextauth]/route.ts` with `Google` as the default provider. Required env vars: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and (for secure cookies) `NEXTAUTH_URL`. Session tokens are handled via JWT with a 30-day lifetime and tweakable update age.
- `AuthGate.tsx` (client component) mirrors the middleware by showing provider buttons (Google, GitHub, Discord) but only Google is wired server-side unless you add more providers in the route file.

## State & Stores

### Run Store (`src/store/runStore.ts`)
- Stores the run snapshot: `runId`, `runSeed`, `floorSeeds`, `currentFloor`, `grid`, `playerPos`, `sceneId`, `mode`, `pools`, `visitedRooms`, `completedRooms`, `runLog`, `combatLog`/`combatLogBuffer`, `combatLogEncounterId`, `combatSession`, `activeCombat`, `defeatOverlay`, `dev.gridOverlay`, `nextEncounterSerial`, and `persistHydrated`.
- `initialPools()` seeds per-room type scene pools so `drawFromPool()` can randomly rotate a scene asset without repeats. When a pool empties it resets to the canonical list (e.g., `entry/entry_default.png`).
- Actions: `enterRun()` builds a seed via `runFactory`/`rulesetTemplate`, loads Floor 1, and persists to `runState:v1`; `resumeFromStorage()` hydrates that slice; `move()` updates `playerPos`, picks a scene, logs a movement entry, and notifies the map/journal; `roomTypeAt()` resolves the type of any coordinate; `engageCombat()`/`attemptCombatFlee()` hand off to `combatStore`; `resolveCombatExit()` checks `PASSABLE_ROOM_TYPES` neighbors and uses `move()` to continue; `ascend()` loads `public/data/floor-seed-f*-s*.json` seeds for later floors; `_devSetRunFromSeed()` lets `/dev` inject a specific grid.
- `completeCombat()` (victory/defeat) collects loot via `generateEnemyLoot`/`generateBossLoot`, adds combat/run log entries, marks rooms as cleared, writes `defeatOverlay` for losses, flips `combatSession` status to `"resolving"`, and eventually returns the UI to explore mode. Each change is serialized back to `localStorage.runState:v1` plus the `combatLog` buffer is flushed during `flushCombatToPersistent()`.
- `toggleGridOverlay()` flips the `dev.gridOverlay` flag that `SceneViewer` respects when its `showOverlay` prop is true.

### Combat Store (`src/state/combatStore.ts`)
- Maintains a single `encounter`, the `queue` of player decisions, `initiative`, `activeSide`, and `lastResolution`.
- `beginEncounter()` seeds the encounter via `startEncounter`, optionally forces a faction first, and schedules an enemy turn if the initial side is `"enemy"` (`ENEMY_TURN_DELAY_MS` default). `commitPlayerDecision()` pushes an action, `advanceTurn()` lets the AI act, and `forceEnemyAdvance()` is a public hook for UI components that need to skip delays.
- `endEncounter()` clears timers and resets the store so `CombatOverlay` can unmount.

### UI Store (`src/store/uiStore.ts`)
- Tracks `uiMode` (`explore | combat | extract | summary`), `inputsDisabled`, panel open states (`character`, `inventory`, `map`, `journal`), menu depth/path, selected skills/items, and target selections.
- Helpers `open`, `close`, `toggle`, `pushMenu`, `popMenu`, `enterCombatMode`, and `exitCombatMode` keep Play's drawers, quick actions, and combat pads in sync. The store persists to `ui-store-v1` so drawers survive reloads.

### Preferences & Haptics
- `usePreferences.tsx` keeps retro (`off | scanlines | filter`), `highContrast`, `textLarge`, `haptics`, `hapticsIntensity`, `musicEnabled`, and `musicVolume` in sync with `localStorage` under keys like `pref:hc`, `pref:musicVol`, etc. It also toggles `<html data-hc>`/`data-bigtext`/`data-music-off`.
- `useHaptics.ts` consults preferences plus the `prefers-reduced-motion` media query; if allowed it calls `navigator.vibrate()` or fires short `AudioContext` ticks. `PlayPage` triggers `useHaptics` on combat start, attacks, and when a flee attempt resolves.
- `audioManager.ts` loops `public/audio/tower_theme.mp3` with `playMusic()` and `fadeOutMusic()`; `/play` uses it when the run is resumed.

## UI Surface
- `PageSurface` (https://) wraps each route with a themed background, and `TopBar` offers quick action buttons that open drawers via `uiStore.toggle`.
- `SceneViewer.tsx` renders the current scene image (`sceneId`) with a caption that concatenates `chooseFlavor(type)` and `exitsFlavor(dirs)`; it also highlights the active cell, dims unexplored areas, and optionally draws the grid overlay when `runStore.dev.gridOverlay` is true.
- `ThumbBar.tsx` renders the compass D-pad plus `Ascend`, `Inspect`, and `Flee` hooks. `Flee` requires a timed confirmation, `Ascend` only appears while standing on an exit, and `Inspect` opens the journal drawer. `ActionButton` supports `onLongPress` for dual-purpose taps on compact combat controls.
- `ControlPad` lives under `src/components/console/ControlPad`. `ExplorePad` lazy-loads `ThumbBar` and wires `move`, `ascend`, `attemptCombatFlee`, and `openPanel`; `CombatPad` renders classed buttons for attack/skill/item/defend/flee when `combatStore` has an encounter. `CombatRoot.tsx` reads each entity into a lightweight VM and proxies actions into `CombatConsole.tsx`.
- `SlideDrawer.tsx` (and its CSS) powers the character/inventory/map/journal slide-ins. Each drawer (defined inline inside `src/app/play/page.tsx`) wraps `JournalPanel` or `MapPanel` content and responds to `uiStore.openPanels`.
- `MapPanel` builds an 8x8 grid of tiles using `visitedRooms` and highlights the current cell; the map also labels unexplored locations with darker colors. The Journal panel lists `runLog` entries (movement/combat/status/system) with metadata and text truncation/expansion logic.
- `CombatOverlay.tsx` (plus `combat.css`) subscribes to `useCombatStore`, `useUIStore`, and `useRunStore`; it renders `TurnStrip.tsx`, `CompactLog.tsx`, `Floaters.tsx`, and a stats rail with two `EntityPanel`s for the player and the first alive enemy. It watches `combatsession.status`/`activeCombat` to show the victory panel (loot/search buttons plus directional exit choices determined from `grid` and `PASSABLE_ROOM_TYPES`), while lost runs set `runStore.defeatOverlay` so `DefeatOverlay` appears.
- `EntityPanel.tsx` clamps meters, renders status chips (overflowing chips collapse with `+n`), and uses `role="region"`/`aria-labelledby` to stay accessible. The HUD also keeps `aria-live` regions in `CombatOverlay` for important announcements.
- `CombatConsole.tsx` exposes a JRPG-style menu stack (`root | skills | items | targets`), lets players cycle action types, and calls `onAct({ type, id, targets })`; `CombatRoot` provides fallback IDs/targets when the run store API doesn't give one.
- `VictoryPanel` (defined inside `CombatOverlay`) surfaces loot/search buttons plus `"N/S/E/W"` exit choices that call `runStore.resolveCombatExit`. Loot summaries are built via `buildLootSummary()` from `runStore`, and `generateEnemyLoot`/`generateBossLoot` dictate the results logged back to `runLog` via `runStore.logRunEvent`.
- `DefeatOverlay` (`src/components/run/DefeatOverlay.tsx`) blocks interaction with a modal until `RunStore.endRun()` clears state.

## Engine & Content
- `src/engine/generateFloor.ts` produces deterministic 8x8 grids: it chooses random entry/exit, optionally spawns a boss, carves river/corridor paths with `path.ts`, injects empty bias, and apportions remaining tiles using largest-remainder ratios defined in `FloorConfig`.
- `src/engine/runFactory.ts` builds `FloorSeed`s from the JSON ruleset template (`rulesetTemplate.json`) and seeds each floor section; `enterRun()` and `ascend()` rely on it.
- Seed IO lives in `src/engine/seedIO.ts` (server) and `seedIO.client.ts` (fetching from `/public/data`). `rng.ts` and `path.ts` support deterministic randomness and corridor-building helpers.
- Combat logic sits under `src/engine/combat`: `engine.ts` performs the turn resolution, `formulas.ts` encodes math for hits/crit/dmg, `statusRuntime.ts` and `effects/*` manage buffs/debuffs, `telemetry.ts` emits combat log lines, and `booster.ts` applies combat modifiers.
- `src/engine/items/itemRuntime.ts` handles item effects referenced by `health potion`-style entries in `content/items`.
- `src/content/actions`, `enemies`, `items`, and `statuses` enumerate the combat catalog (IDs referenced by `CombatConsole`, HUD tags, and loot profiles).
- `docs/flavor.md` describes how to edit the flavor text pools that `chooseFlavor()` consumes; keep the lines short and avoid embedding exits because `exitsFlavor()` handles them automatically.
- `public/data` contains seed snapshots like `floor-seed-f1-s1130215123.json`/`floor-seed-f5-s3707387099.json` that the dev page and `runStore.ascend()` consume.

## Dev Tools
- `/dev` renders a grid preview, vanity ratio sliders, and `validateRuleset()` output (http fetch + local validation). It exposes `mulberry32` for deterministic RNG, lets you paste a seed, tweaked ratios, or raw ruleset path, and calls `runStore._devSetRunFromSeed()` to hydrate a run manually.
- `/dev/combat-testing` lets you toggle `SandboxConfig` (scene, room type, floor, first strike), build a hero with astronaut stats/items, and spawn every enemy via `captureRunSnapshot()`/`combatStore.beginEncounter()`. The sidebar shows enemy IDs (from `src/content/enemies`) and hero items (from `src/content/items`) for reference.
- `tools/check_utf8.py` can be run when editing flavor files, docs, or other text-heavy assets to ensure you stay within UTF-8/ASCII if needed.

## Testing
- Jest is configured through `jest.config.js` with helpers in `jest.setup.ts`; tests live near logic in `__tests__` (targeting `src/engine`, `src/store`, and combat modules).

## Notes & Gotchas
- The run store and UI store both persist (`runState:v1` and `ui-store-v1`), so lean on their hydration flags (`persistHydrated`) before reading from them on the client.
- Preferences keys (`pref:retro`, `pref:hc`, `pref:textlg`, `pref:haptics`, `pref:haptics:intensity`, `pref:music`, `pref:musicVol`) must stay stable if you add new toggles; the same hooks control `document.documentElement` attributes.
- Auth still uses just the Google provider server-side; `AuthGate` advertises GitHub/Discord too, but you must add those entries inside `src/app/api/auth/[...nextauth]/route.ts` if you want them to work.
- The middleware only protects `/climb`, `/play`, `/traders`, `/crafters`, `/inn`, and `/training`; `/dev`, `/settings`, and `/` remain publicly accessible so you can iterate without auth friction.
- Victory exit buttons are generated from `grid.cells` adjacent to the combat origin plus the `PASSABLE_ROOM_TYPES` set (`entry | exit | boss | combat | trap | loot | out | special | empty`); blocked rooms get disabled buttons.
- `SceneViewer` highlights the current room and applies the dev grid overlay when `runStore.dev.gridOverlay` is true; toggle it via the developer debug console if you need to inspect room coordinates.
- `MapPanel` reads `visitedRooms` per-floor and draws the player's dot, while the journal drawer depends on `runLog` entries and their `category` tags (movement/combat/loot/status/system) for grouping/filters.
- `CombatOverlay` keeps `aria-live` regions for telemetry announcements; `Floaters` and `CompactLog` both reuse `combatStore.telemetry`. `CombatConsole` exposes a lightweight menu model (`root | skills | items | targets`) so you can add future action categories without top-level rework.
- `DefeatOverlay` will appear whenever `runStore.completeCombat()` marks a session as `"defeat"`; it stays until the player hits `End Run`.
