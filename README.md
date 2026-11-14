# Mission Control

Single-player space mission design game for the NASA Space Apps Challenge 2026.
Vite + React + TypeScript, Tailwind, Zustand, Zod, Vitest. Static site, no backend.

- Stack and architecture: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- Rules every contributor (and Claude Code session) follows: [CLAUDE.md](CLAUDE.md)
- Expected asset files: [public/assets/ASSETS.md](public/assets/ASSETS.md) · credits: [CREDITS.md](CREDITS.md)

## Commands

```bash
pnpm install
pnpm dev        # dev server
pnpm build      # type-check + production build to dist/
pnpm preview    # serve dist/
pnpm test       # vitest (engine + content tests)
pnpm lint       # eslint
pnpm format     # prettier --write .
```

## Layout

```
src/
  engine/     pure TypeScript simulation (no React)
  content/    JSON game data + load.ts (Zod-validated at startup)
  schemas/    Zod schemas, types via z.infer
  store/      Zustand slices (game, design, crew, mission), persisted to localStorage
  screens/    one component per game phase
  nova/       NOVA tutor popup + viz/ components
  controlroom/ isometric scene and sprites
  ui/         shared components, asset + sound helpers
public/assets/ portraits, sprites, backgrounds, sounds, music (WebP / MP3)
```
