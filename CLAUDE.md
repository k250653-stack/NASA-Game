# Mission Control — rules for every Claude Code session

Single-player space mission design game for the NASA Space Apps Challenge 2026. Static site,
TypeScript everywhere, no backend. The source of truth for the stack is
[docs/TECH_STACK.md](docs/TECH_STACK.md). Read it before changing architecture.

## Game loop

Destination → Scenario → Role → Recruit → Planning Board → Launch Check → Mission Run → Failure
Review → Redesign (back to Planning Board). A Codex collects every NOVA lesson unlocked.

- The player picks one of four roles (Science, Power & Life Support, Comms & Navigation,
  Launch & Budget). Rule-based AI teammates fill the other three and explain their decisions.
- NOVA is the in-game tutor: each lesson is predict → explain → visual → apply, with a NASA source.
- Navigation is `game.phase` in the Zustand store. There is no router; `App.tsx` renders the
  screen for the current phase.

## The 10 rules

1. Files in `src/engine/` **never** import React or anything from `src/screens`, `src/ui`,
   `src/store`.
2. UI components never compute physics or scores; they call engine functions.
3. **No magic numbers in components.** All game values live in `src/content/*.json`.
4. Every JSON content file has a Zod schema in `src/schemas/`; types come from `z.infer`.
5. Every entry in `lessons.json` has a `source` URL.
6. Read Zustand state **only with selectors**: `useStore(s => s.design.mass)`, never `useStore()`.
7. All randomness goes through `engine/rng.ts`. Never use `Math.random()`.
8. Images go in `public/assets/` as WebP; keep the total under ~10 MB.
9. Use Tailwind for styling. No separate CSS files except `index.css`.
10. Keep components under ~200 lines; split if larger.

Rules 1 and 7 are also enforced by ESLint (`pnpm lint`).

## Folder ownership (work lanes)

| Lane                  | Owns                                                 | Folders                           |
| --------------------- | ---------------------------------------------------- | --------------------------------- |
| 1. Engine and content | physics, budget, events, crew AI, scoring, JSON data | `engine/`, `content/`, `schemas/` |
| 2. Screens            | all game screens and shared UI                       | `screens/`, `ui/`, `store/`       |
| 3. NOVA               | popup, 5 visual components, lessons, fact-checking   | `nova/`, `content/lessons.json`   |
| 4. Visuals and sound  | control room, sprites, movement, sounds, demo video  | `controlroom/`, `public/assets/`  |

The Zod schemas in `src/schemas/` are the contract between lanes. Change them together.

## Conventions

- Package manager: **pnpm**. Scripts: `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm test`,
  `pnpm lint`, `pnpm format`.
- Path alias `@/` → `src/`.
- Content files are `{ "_note": "...", "items": [...] }`. `_note` marks approximate numbers.
  `src/content/load.ts` validates every file at startup and throws a readable error naming the
  file and field.
- Zod 4: use `z.strictObject(...)` (rejects unknown keys) and `{ error: '...' }` messages.
- Store slices keep state under one namespace (`game`, `design`, `crew`, `mission`) and expose
  flat actions. Only the namespaces are persisted (localStorage key `mission-control-save`).
- Images: use `<AssetImage kind id />` from `src/ui/AssetImage.tsx`; it falls back to a generated
  placeholder. Sounds: `playSound(id)` from `src/ui/sound.ts`; missing files warn once and stay
  silent. Expected files are listed in `public/assets/ASSETS.md`; credits go in `CREDITS.md`.
- TypeScript is pinned to 5.9 because typescript-eslint does not yet support TypeScript 7.
