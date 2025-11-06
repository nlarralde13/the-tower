# Developer Guide

Concise architecture, routes, paths, and design notes for The Tower.

**Repo Shape**
- App Router UI under `src/app/*` with API routes.
- Deterministic generation + seed IO under `src/engine/*`.
- Gameplay run state in `src/store/runStore.ts`.
- Legacy flavor helpers and console prototype in `src/game/*`.
- Reusable UI in `src/components/*` and global styles in `src/app/globals.css`.

**Key Types**
- Room types: `entry | exit | boss | combat | trap | loot | out | special | empty | blocked`.
- Grid: `FloorGrid = { width, height, cells[], entry, exit, boss? }`.
- Seed: `FloorSeed` captures floor number, RNG seed, options, and ratios.
- Reference: `src/types/tower.ts`.

**Routes**
- Public pages
  - `/` home: `src/app/page.tsx`
  - `/dev` generator tools: `src/app/dev/page.tsx`
  - `/dev/seed-preview` server preview: `src/app/dev/seed-preview/page.tsx`
  - `/play` gameplay UI (client-state; redirects to `/climb` if no run): `src/app/play/page.tsx`
- Auth-protected via middleware
  - `/climb`: start a run, then route to `/play` — `src/app/climb/page.tsx`
  - `/traders`: `src/app/traders/page.tsx`
  - `/crafters`: `src/app/crafters/page.tsx`
  - `/inn`: `src/app/inn/page.tsx`
  - `/training`: `src/app/training/page.tsx`
- Middleware config and matchers: `middleware.ts` (protects the 5 routes above)
- App chrome and global CSS: `src/app/layout.tsx`, `src/app/globals.css`

**API**
- `POST /api/floors/from-public` — generate from a seed JSON in `public/`
  - File: `src/app/api/floors/from-public/route.ts`
  - Body: `{ relPath: "/data/floor-seed-...json", baseConfig?: Partial<FloorConfig> }`
- NextAuth (Google provider wired)
  - File: `src/app/api/auth/[...nextauth]/route.ts`
  - Add providers here; `.env.local` must define `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Auth**
- Server-side: `withAuth` middleware enforces auth on `/climb`, `/traders`, `/crafters`, `/inn`, `/training` — `middleware.ts`.
- Client-side: `AuthGate` wraps content on several pages (including home) and shows a provider chooser — `src/components/AuthGate.tsx`.

**State: runStore**
- File: `src/store/runStore.ts`
- Persists to `localStorage` under `runState:v1`.
- Actions
  - `enterRun()` — loads ruleset (`/data/rulesetTemplate.json`), builds seed, generates Floor 1, sets entry.
  - `resumeFromStorage()` — restores run on mount.
  - `move(dir)` — validates neighbor, updates `playerPos`, chooses a scene image from per-type pools, logs journal.
  - `ascend()` — requires being on `exit`; loads fixed floor seeds from `public/data` for floors 2–5 and regenerates grid.
  - `endRun()` — clears state and storage.
- Scene pools: `initialPools()` returns non-repeating pools per `RoomType`.
- Journal: entries `{ t, floor, x, y, type, scene }` used by the map.

**Combat Overlay**
- Entry point: `src/components/combat/CombatOverlay.tsx` mounted inside the scene viewer on `/play`.
- HUD pieces:
  - Turn strip (`TurnStrip`), combat log (`CompactLog`), and floaters (`Floaters`).
  - Stats rail (`.stats-rail`) sits under the TopBar and renders two `EntityPanel` instances for player (left) and active enemy (right).
  - `EntityPanel` lives at `src/components/console/HUD/EntityPanel.tsx` and expects clamped totals (`hpMax`, `mpMax`, `staMax`) plus status chips.
- Styling: `src/components/combat/combat.css` controls layout; the rail uses CSS grid (stacked on mobile <1024px, 12-column on desktop).
- Shared glass tokens (`--glass-bg`, `--glass-border`, `--glass-shadow`, `--radius-sm`, `--radius-md`, `--blur-sm`) are defined in `src/app/globals.css`.
- Panels are pure-presentational; no store writes. Clamp values before passing props.

**Engine: generation + seeds**
- Deterministic grid generation: `src/engine/generateFloor.ts`
  - Fixed size 8x8; random entry/exit (borders), optional boss.
  - Carves an A*-like river path with tunable wiggle and width; expands to hit open/blocked targets.
  - Locks a fraction of corridor tiles to `empty` (`pathEmptyBias`) to keep travel space readable.
  - Apportions remaining open cells into room types using Largest Remainder from provided ratios.
  - Ensures exit reachability and that entry has at least three passable neighbors.
- Seed utilities
  - Build seed from ruleset floor template: `src/engine/runFactory.ts`
  - Server-side seed loading from `public/`: `src/engine/seedIO.ts`
  - Client-side seed loading via fetch: `src/engine/seedIO.client.ts`
- RNG and helpers: `src/engine/rng.ts`, grid path helpers: `src/engine/path.ts`

**Play UI**
- Primary gameplay page: `src/app/play/page.tsx`
  - Left (desktop): inventory and character panels (placeholder content).
  - Middle: `SceneViewer` with caption composed from `chooseFlavor(type)` and `exitsFlavor(dirs)`; D-pad via `ThumbBar` for movement.
  - Right (desktop): map (visited vs unknown) plus journal; the combat overlay sits inside the viewer to keep HUD separate from the control pad.
  - Mobile: inventory/map slide-in drawers; dev overlay toggled by `?overlay=1`.
- Invalid move quip: "Why are you running face first into that wall?"

**Flavor System**
- Per-room flavor text modules: `src/game/flavor/*.ts` with aggregator `src/game/flavor.ts`.
- `chooseFlavor(type)` and `exitsFlavor(dirs)` used for captions on `/play`.

**Data**
- Example seeds
  - `public/data/floor-seed-f1-s1130215123.json`
  - `public/data/floor-seed-f5-s3707387099.json`
- Ruleset template for floors/ratios: `public/data/rulesetTemplate.json`

**Styling**
- Shared layout and panels in `globals.css` — `src/app/globals.css`.
- Common classes: `.tower-shell`, `.menu-panel`, `.btn`, `.btn--primary`, `.btn--ghost`.
- Combat overlay-specific classes: `.combat-root`, `.combat-hud`, `.stats-rail`, `.entity-panel`, `.entity-panel--ko`, `.status-chip` variants.
- Play layout CSS lives in `src/app/play/play.mobile.css` and `src/app/play/play.desktop.css`.

**Testing**
- Jest config: `jest.config.js`, setup: `jest.setup.ts`.
- Prefer colocated tests near `src/engine`, `src/store`, and new combat UI logic if behavior becomes stateful.

**Conventions**
- Keep generation deterministic for identical `FloorSeed` input.
- Avoid broad renames; match existing naming and style.
- UI additions should reuse shared tokens (`globals.css`) and avoid fixed positioning inside the viewer.
- Combat overlay components should be pure UI; derive state in `CombatOverlay` selectors.

**Notes & Gotchas**
- Home `/` wraps content with `AuthGate` (client-side), while middleware protects a subset of routes server-side.
- Only Google is configured in NextAuth by default; `AuthGate` shows multiple options, but add providers in `src/app/api/auth/[...nextauth]/route.ts` to enable them.
- `src/pages/_app.tsx` and `src/app/play/PlayClient.tsx` are legacy/prototype remnants; main routing uses the App Router and `src/app/play/page.tsx`.
