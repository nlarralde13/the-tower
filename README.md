# The Tower

A small roguelite prototype built with Next.js that generates 8x8 tower floors, lets you explore room-by-room, and layers in flavor text, scenes, and simple UI flows. This repository includes the floor generator, dev tools, a lightweight run state store, and a basic play experience.

## Features
- 8x8 procedural floor generation with reproducible seeds
- Fixed seeds in `public/data` for repeatable floors (e.g., Floor 1 / Floor 5)
- Room types: entry, exit, boss, combat, trap, loot, out, special, empty, blocked
- Per-room flavor text pools (snarky, configurable per type)
- Play page with scene viewer, D‑pad, and a compact 8×8 map
- Dev page to tweak densities and export/import seeds
- Minimal NextAuth (Google) wiring for gated pages

## Tech Stack
- Next.js (App Router)
- TypeScript, React
- Zustand for run state (`src/store/runStore.ts`)
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
- Go to `/climb` to start a run (auth‑gated)
- The play UI is at `/play`
- Dev tools at `/dev` for generation controls and seed IO

## Project Structure
- `src/app` — Next.js routes and UI
  - `page.tsx` (home), `climb`, `play`, `traders`, `crafters`, `inn`, `training`
  - `api/` — server routes; `auth/[...nextauth]`, `floors/from-public`
- `src/components` — shared UI (PageSurface, menus, etc.)
- `src/store/runStore.ts` — run lifecycle, movement, scene pools, journal
- `src/engine` — generation algorithms and seed IO
- `src/types/tower.ts` — core types (RoomType, FloorGrid, FloorSeed, etc.)
- `src/game` — player‑facing strings and helpers
  - `flavor/` — per‑room flavor text files
  - `flavor.ts` — exports `chooseFlavor` and `exitsFlavor`
  - `content/flavor.ts` — wrapper for engine imports
- `public/data` — example seed JSON and ruleset template
- `public/images/scenes` — scene imagery placeholders

## Key Flows
- Start/Resume: `/climb` uses Zustand action `enterRun()` to seed and enter Floor 1, then routes to `/play`.
- Movement: D‑pad triggers `useRunStore.getState().move(dir)`. Movement updates `playerPos`, adds a journal entry, and picks a scene path from per‑type pools.
- Flavor: `chooseFlavor(type)` returns a randomized per‑type line; UI combines it with exit hints.
- Map: The map shades unvisited rooms dark; visited rooms are white; the current room has a marker and highlighted border. The map resets naturally on floor change based on `journal` entries filtered by the current floor.

## Seed & Ruleset
- Example seeds: `public/data/floor-seed-f1-s1130215123.json`, `public/data/floor-seed-f5-s3707387099.json`
- Ruleset template: `public/data/rulesetTemplate.json` (per‑floor ratios, difficulty)
- API: `POST /api/floors/from-public` loads a seed from `/public/data` and returns a generated grid

## Testing
- Jest is configured via `jest.config.js` and `jest.setup.ts`
- Add focused tests near logic in `src/engine` and `src/store`

## Accessibility
- Announcements via `aria-live` for action feedback in `/play`
- Buttons adopt shared styles and focus outlines in `globals.css`

## Contributing
- See `DEVELOPER.md` for architecture and guidelines
- PRs should keep changes scoped, typed, and consistent with existing patterns

## License
- Proprietary/in‑repo use unless otherwise noted (no license file provided)
