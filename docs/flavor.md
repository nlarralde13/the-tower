Flavor Text System
==================

Where: `src/game/flavor.ts`

What it does
------------
- Provides short, editable flavor lines for each room type (`entry`, `empty`, `exit`, `combat`, `trap`, `loot`, `special`, `out`, `boss`).
- Exposes two helpers:
  - `chooseFlavor(type: RoomType): string` — returns a random line for the room type.
  - `exitsFlavor(dirs: string[]): string` — turns direction names (e.g., `north`, `east`) into a sentence like `You see doors North and East.`

How to edit flavor
------------------
1. Open `src/game/flavor.ts`.
2. Add, remove, or rewrite strings inside `ROOM_FLAVOR` arrays for each room type.
3. Save; the Play view picks a random line on render and appends exit text.

Room types
----------
- `entry`, `empty`, `exit`, `combat`, `trap`, `loot`, `special`, `out`, `boss`

Tips
----
- Keep lines short (1–2 sentences) for readability on mobile.
- Avoid embedding exits/directions in the base line — the UI will add `You see a door …` automatically based on the current room’s exits.
- If you need deterministic per-room text later, swap `Math.random()` with a seeded RNG keyed to room coordinates.

