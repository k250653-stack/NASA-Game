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

## UI rules

- Build screens ONLY from the tokens and components in `src/ui/` (see the "Dev: UI kit" screen
  and [THEME.md](THEME.md)). Need something new? Add it to `src/ui/` and the styleguide first.
- No hardcoded hex colours or font names outside `src/index.css`. ESLint rejects hex literals.
- Minimum supported size is 1280x720; layouts must not break at 1920x1080.
- Keyboard accessible: visible focus rings, every control reachable with Tab, Esc closes modals.
- Text contrast must meet WCAG AA on the dark background. Use `text-primary`, `text-muted` or
  `text-subtle`; never dim text with opacity.
- Numbers use `font-mono tabular-nums` so values do not jump when they change.
- Animate with Motion; the app root sets `reducedMotion="user"`.
- Content icons are Tabler names registered in `src/ui/icons.ts`.

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

## Definition of done (every task)

- Run `pnpm check`. All must pass.
- Then use the Playwright MCP browser to open the dev server, play through the screens you changed like a real player, look at the screenshots, and read the browser console.
- If anything is broken, overlapping, unreadable, or logs errors: fix it and repeat. Max 3 fix rounds; if still failing, stop and report exactly what's wrong.
- Extend e2e/smoke.spec.ts whenever you add a new screen or interaction.
- End every task with a short "Verified in browser:" list of what you checked.

`pnpm check` = lint + unit tests + build + `pnpm e2e` (Playwright, headless, both 1280x720 and
1920x1080). The smoke test reuses a running `pnpm dev` on port 5173 or starts one, and writes
screenshots to `e2e/screenshots/` (gitignored). Navigation buttons and selectable cards carry
`data-testid` attributes (`next-button`, `back-button`, `destination-card-<id>`, ...): keep them
when editing components.
