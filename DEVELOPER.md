# Developer Guide

Concise architecture, routes, paths, and design notes for The Tower.

**Repo Shape**
- App Router UI under `src/app/*` with API routes.
- Deterministic generation + seed IO under `src/engine/*`.
- Gameplay run state in `src/store/runStore.ts`.
- Flavor and legacy console-prototype in `src/game/*`.
- Reusable UI in `src/components/*` and global styles in `src/app/globals.css`.

**Key Types**
- Room types: `entry | exit | boss | combat | trap | loot | out | special | empty | blocked`.
- Grid: `FloorGrid = { width, height, cells[], entry, exit, boss? }`.
- Seed: `FloorSeed` captures floor number, RNG seed, options, and ratios.
- Reference: `src/types/tower.ts:1`.

**Routes**
- Public pages
  - `/` home: `src/app/page.tsx:1`
  - `/dev` generator tools: `src/app/dev/page.tsx:1`
  - `/dev/seed-preview` server preview: `src/app/dev/seed-preview/page.tsx:1`
  - `/play` gameplay UI (client-state; redirects to `/climb` if no run): `src/app/play/page.tsx:1`
- Auth-protected via middleware
  - `/climb`: start a run, then route to `/play` — `src/app/climb/page.tsx:1`
  - `/traders`: `src/app/traders/page.tsx:1`
  - `/crafters`: `src/app/crafters/page.tsx:1`
  - `/inn`: `src/app/inn/page.tsx:1`
  - `/training`: `src/app/training/page.tsx:1`
- Middleware config and matchers: `middleware.ts:1` (protects the 5 routes above)
- App chrome and global CSS: `src/app/layout.tsx:1`, `src/app/globals.css:1`

**API**
- `POST /api/floors/from-public` — generate from a seed JSON in `public/`
  - File: `src/app/api/floors/from-public/route.ts:1`
  - Body: `{ relPath: "/data/floor-seed-...json", baseConfig?: Partial<FloorConfig> }`
- NextAuth (Google provider wired)
  - File: `src/app/api/auth/[...nextauth]/route.ts:1`
  - Add providers here; `.env.local` must define `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Auth**
- Server-side: `withAuth` middleware enforces auth on `/climb`, `/traders`, `/crafters`, `/inn`, `/training` — `middleware.ts:1`.
- Client-side: `AuthGate` wraps content on several pages (including home) and shows a provider chooser — `src/components/AuthGate.tsx:1`.

**State: runStore**
- File: `src/store/runStore.ts:1`
- Persists to `localStorage` under `runState:v1`.
- Actions
  - `enterRun()` — loads ruleset (`/data/rulesetTemplate.json`), builds seed, generates Floor 1, sets entry.
  - `resumeFromStorage()` — restores run on mount.
  - `move(dir)` — validates neighbor, updates `playerPos`, chooses a scene image from per-type pools, logs journal.
  - `ascend()` — requires being on `exit`; loads fixed floor seeds from `public/data` for floors 2–5 and regenerates grid.
  - `endRun()` — clears state and storage.
- Scene pools: `initialPools()` returns non-repeating pools per `RoomType`.
- Journal: entries `{ t, floor, x, y, type, scene }` used by the map.

**Engine: generation + seeds**
- Deterministic grid generation: `src/engine/generateFloor.ts:1`
  - Fixed size 8×8; random entry/exit (borders), optional boss.
  - Carves an A*-like “river” path with tunable wiggle and width; expands to hit open/blocked targets.
  - Locks a fraction of corridor tiles to `empty` (`pathEmptyBias`) to keep travel space readable.
  - Apportions remaining open cells into room types using Largest Remainder from provided ratios.
  - Ensures exit reachability and that entry has at least 3 passable neighbors.
- Seed utilities
  - Build seed from ruleset floor template: `src/engine/runFactory.ts:1`
  - Server-side seed loading from `public/`: `src/engine/seedIO.ts:1`
  - Client-side seed loading via fetch: `src/engine/seedIO.client.ts:1`
- RNG and helpers: `src/engine/rng.ts:1`, grid path helpers: `src/engine/path.ts:1`

**Play UI**
- Primary gameplay page: `src/app/play/page.tsx:1`
  - Left (desktop): Inventory + Character (static placeholders).
  - Middle: `SceneViewer` with caption composed from `chooseFlavor(type)` and `exitsFlavor(dirs)`; D-pad via `ThumbBar` for movement.
  - Right (desktop): Map (visited vs unknown) + Journal; final extract panel on Floor 5 exit.
  - Mobile: inventory/map slide-in drawers; dev overlay toggled by `?overlay=1`.
- Quip on invalid moves: “Why are you running face first into that wall?”
- Prototype console/legend grid: `src/app/play/PlayClient.tsx:1` with `GameViewer`/`ConsolePanel` (legacy dev aid, not the main UI path).

**Flavor System**
- Per-room flavor text modules: `src/game/flavor/*.ts` with aggregator `src/game/flavor.ts:1`.
- `chooseFlavor(type)` and `exitsFlavor(dirs)` used for captions on `/play`.

**Data**
- Example seeds
  - `public/data/floor-seed-f1-s1130215123.json`
  - `public/data/floor-seed-f5-s3707387099.json`
- Ruleset template for floors/ratios: `public/data/rulesetTemplate.json`

**Styling**
- Shared layout and panels in `globals.css` — `src/app/globals.css:1`.
- Common classes: `.tower-shell`, `.menu-panel`, `.btn`, `.btn--primary`, `.btn--ghost`.
- Play layout CSS (legacy/prototype): `src/app/play/tower.css:1`, `src/app/play/vertical.css:1`.

**Testing**
- Jest config: `jest.config.js:1`, setup: `jest.setup.ts:1`.
- Prefer colocated tests near `src/engine` and `src/store` logic.

**Conventions**
- Keep generation deterministic given the same `FloorSeed`.
- Avoid gratuitous renames; match existing naming and style.
- Keep room-flavor copy under `src/game/flavor/*`; reuse `chooseFlavor()`.
- UI should reuse panel/button styles and `PageSurface` backgrounds.

**Notes & Gotchas**
- Home `/` wraps content with `AuthGate` (client-side), while middleware protects a subset of routes server-side.
- Only Google is configured in NextAuth by default; `AuthGate` shows multiple options, but add providers in `src/app/api/auth/[...nextauth]/route.ts:1` to enable them.
- `src/pages/_app.tsx:1` and `src/app/play/PlayClient.tsx:1` are legacy/prototype remnants; main routing uses the App Router and `src/app/play/page.tsx`.

