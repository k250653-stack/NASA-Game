# Mission Control — Final Tech Stack

NASA Space Apps Challenge 2026 · Space Mission Design Game
Status: **Locked** · Last updated: 2026-11-14

---

## 1. Guiding principles

1. **One language:** TypeScript everywhere.
2. **No backend:** the game is a static site. Nothing can crash on a server during judging.
3. **Logic is separate from visuals:** the simulation engine is pure TypeScript with no React inside. The UI only displays what the engine returns.
4. **Content is data:** crew, parts, rockets, destinations, events and lessons live in JSON files, not in code.
5. **Reproducible runs:** a seeded random generator, so the demo run is the same every time.

---

## 2. The stack

| Layer                           | Choice                                                     | Purpose                                                  |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Language                        | **TypeScript**                                             | Type safety across 4 people + Claude Code                |
| Build tool                      | **Vite**                                                   | Fast dev server, static build output                     |
| UI framework                    | **React**                                                  | All screens and panels                                   |
| Styling                         | **Tailwind CSS**                                           | Fast, consistent UI styling                              |
| Animation                       | **Motion** (`motion` package, formerly Framer Motion)      | Popups, sprites, crew movement, resource bars            |
| Game state                      | **Zustand** (+ `persist` middleware)                       | One store for the whole game, save/load via localStorage |
| Simulation engine               | **Pure TypeScript** in `src/engine/`                       | Physics, budgets, events, crew AI, scoring               |
| Random numbers                  | **Seeded RNG** (mulberry32, ~10 lines, no dependency)      | Repeatable runs + fixed demo seed                        |
| Content validation              | **Zod**                                                    | Validates every JSON content file at load time           |
| Tests                           | **Vitest**                                                 | Engine only (~15 tests: physics, budget, scoring)        |
| Lesson visuals                  | **SVG + Motion**, **Canvas** for orbit animation           | NOVA's 5 reusable visual components                      |
| Formulas                        | **KaTeX**                                                  | Proper equations in NOVA popups                          |
| Charts                          | **Recharts**                                               | Debrief graphs, resource-over-time                       |
| Control room scene              | **React + Motion** sprites on an isometric background      | Home base visuals                                        |
| Control room upgrade (optional) | **PixiJS**                                                 | Only if we need many animated or walking sprites         |
| Sound                           | **Howler.js**                                              | Alarms, radio chatter, NOVA beep, launch                 |
| AI teammates                    | **Rule-based TypeScript** (no LLM)                         | Predictable, explainable decisions                       |
| Assets                          | **Kenney.nl CC0 packs** + generated portraits, as **WebP** | Isometric room, space props, crew portraits              |
| Package manager                 | **pnpm**                                                   | Fast installs                                            |
| Code quality                    | **ESLint + Prettier**                                      | Consistent code across the team                          |
| Version control                 | **Git + GitHub**, one branch per lane                      | Parallel work                                            |
| Hosting                         | **Vercel** (Netlify as backup)                             | Push to GitHub → live link                               |

---

## 3. Deliberately NOT used

| Rejected                                   | Reason                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Godot / Unity                              | Game is ~80% UI; heavy web export; editor-bound workflow is hard for Claude Code             |
| Next.js                                    | No server rendering or API routes needed; Vite is simpler                                    |
| Any backend / database (MongoDB, Firebase) | Nothing to store server-side; saves use localStorage                                         |
| Socket.IO / real-time multiplayer          | Single player with AI teammates                                                              |
| Gemini / any LLM                           | Unpredictable output during demo; can't be balanced                                          |
| Three.js / React Three Fiber               | 3D costs 8–12 hours and adds nothing judges score (optional only if time is left at the end) |
| Redux                                      | Too much setup for a 48-hour project                                                         |

---

## 4. Folder structure

```
mission-control/
├─ CLAUDE.md                 # rules every Claude Code session follows
├─ TECH_STACK.md             # this file
├─ public/
│  └─ assets/                # WebP sprites, portraits, backgrounds, sounds
└─ src/
   ├─ engine/                # PURE TS — no React imports
   │  ├─ rng.ts              # seeded random generator
   │  ├─ physics.ts          # orbits, power, signal, mass, life support
   │  ├─ budget.ts           # mass / power / money totals and margins
   │  ├─ crewAI.ts           # AI teammate decisions + reasons
   │  ├─ teamBalance.ts      # Thinker / Practical / Leader checks
   │  ├─ events.ts           # event triggers, options, outcomes
   │  ├─ mission.ts          # turn loop: drain → science → events
   │  ├─ score.ts            # weighted score
   │  └─ causes.ts           # cause chains for the Failure Review Board
   ├─ content/               # JSON game data
   │  ├─ destinations.json   # Moon, Mars
   │  ├─ scenarios.json
   │  ├─ crew.json
   │  ├─ parts.json          # instruments, power, comms, life support, suits
   │  ├─ rockets.json
   │  ├─ events.json
   │  └─ lessons.json        # NOVA lessons, each with a source URL
   ├─ schemas/               # Zod schemas + TS types derived from them
   ├─ store/                 # Zustand slices
   │  ├─ designSlice.ts
   │  ├─ crewSlice.ts
   │  └─ missionSlice.ts
   ├─ screens/
   │  ├─ Title.tsx
   │  ├─ DestinationSelect.tsx
   │  ├─ ScenarioSelect.tsx
   │  ├─ RoleSelect.tsx
   │  ├─ Recruit.tsx
   │  ├─ PlanningBoard.tsx
   │  ├─ LaunchCheck.tsx
   │  ├─ MissionControl.tsx
   │  ├─ FailureReview.tsx
   │  └─ Codex.tsx
   ├─ nova/
   │  ├─ NovaPopup.tsx       # popup shell: predict → explain → visual → apply
   │  └─ viz/
   │     ├─ OrbitViz.tsx
   │     ├─ PowerViz.tsx
   │     ├─ SignalViz.tsx
   │     ├─ MassViz.tsx
   │     └─ LifeSupportViz.tsx
   ├─ controlroom/           # isometric scene, crew sprites, movement paths
   ├─ ui/                    # shared bars, cards, buttons, modals
   └─ main.tsx
```

---

## 5. Destinations are data (Moon / Mars)

The player chooses the destination at the start. The engine never has `if (mars)` checks. It only reads numbers from `destinations.json`.

```jsonc
// content/destinations.json (values to be verified against NASA sources)
[
  {
    "id": "moon",
    "name": "Moon — South Pole",
    "transitDays": 3, // approx. one way
    "signalDelaySec": 1.3, // approx. one way
    "sunlightFactor": 1.0, // relative to Earth orbit
    "gravityG": 0.17,
    "resupplyPossible": true,
    "hazards": ["dust", "cold_night", "solar_flare"],
    "source": "<NASA URL>",
  },
  {
    "id": "mars",
    "name": "Mars — Jezero Region",
    "transitDays": 210, // approx. one way, varies by launch window
    "signalDelaySec": 600, // varies roughly 3–22 min one way
    "sunlightFactor": 0.43, // ~1 / 1.52²
    "gravityG": 0.38,
    "resupplyPossible": false,
    "hazards": ["dust_storm", "radiation", "solar_flare"],
    "source": "<NASA URL>",
  },
]
```

**Build order:** Moon first, end to end. Mars is added only after the Moon loop works. That means new JSON values, a few Mars-only events and 2–3 Mars lessons, with no engine changes.

---

## 6. Movement

Movement exists, but it is **scripted animation, not player-controlled walking.** The player clicks and the characters move.

| Movement                                       | How it's built                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| Crew walking to a console when assigned a task | Motion: animate sprite along a fixed path between console positions |
| Spacewalk / EVA animation                      | Motion: sprite follows a path outside the habitat                   |
| Rover driving on the surface map               | Motion or Canvas: rover moves along waypoints                       |
| Spacecraft travelling Earth → Moon / Mars      | Canvas: dot moves along a drawn trajectory                          |
| Launch                                         | Motion: rocket sprite + shake + particles (CSS)                     |

**Upgrade path:** if we want many characters walking at once, switch only `controlroom/` to **PixiJS**. Nothing else changes.

No WASD or free movement. It would cost hours and adds nothing the brief asks for.

---

## 7. Rules for `CLAUDE.md`

Copy these into `CLAUDE.md` at the repo root so every Claude Code session follows them:

1. Files in `src/engine/` **never** import React or anything from `src/screens`, `src/ui`, `src/store`.
2. UI components never compute physics or scores; they call engine functions.
3. **No magic numbers in components.** All game values live in `src/content/*.json`.
4. Every JSON content file has a Zod schema in `src/schemas/`; types come from `z.infer`.
5. Every entry in `lessons.json` has a `source` URL.
6. Read Zustand state **only with selectors**: `useStore(s => s.design.mass)`, never `useStore()`.
7. All randomness goes through `engine/rng.ts`. Never use `Math.random()`.
8. Images go in `public/assets/` as WebP; keep the total under ~10 MB.
9. Use Tailwind for styling. No separate CSS files except `index.css`.
10. Keep components under ~200 lines; split if larger.

---

## 8. Work lanes (parallel from hour 0)

| Lane                  | Owns                                                 | Folders                           |
| --------------------- | ---------------------------------------------------- | --------------------------------- |
| 1. Engine and content | physics, budget, events, crew AI, scoring, JSON data | `engine/`, `content/`, `schemas/` |
| 2. Screens            | all game screens and shared UI                       | `screens/`, `ui/`, `store/`       |
| 3. NOVA               | popup, 5 visual components, lessons, fact-checking   | `nova/`, `content/lessons.json`   |
| 4. Visuals and sound  | control room, sprites, movement, sounds, demo video  | `controlroom/`, `public/assets/`  |

**First 2 hours:** agree on the Zod schemas together. They're the contract between lanes.

---

## 9. Risks and mitigations

| Risk                                       | Mitigation                                                 |
| ------------------------------------------ | ---------------------------------------------------------- |
| Whole-store subscriptions cause lag        | Selectors only (rule 6)                                    |
| Large assets → blank screen on venue Wi-Fi | WebP, < 10 MB total, loading screen                        |
| Merge conflicts in the store               | Store split into slices, each owned by one lane            |
| Unlucky random event ruins the demo        | Seeded RNG + fixed demo seed button                        |
| Wrong science numbers in lessons           | Lane 3 verifies every lesson against its NASA source       |
| Falling behind schedule                    | Drop animated control room → static image + portrait cards |

---

## 10. Setup commands

```bash
pnpm create vite mission-control --template react-ts
cd mission-control
pnpm add zustand zod motion recharts katex react-katex howler
pnpm add -D tailwindcss @tailwindcss/vite vitest @types/howler @types/react-katex eslint prettier
# optional later: pnpm add pixi.js @pixi/react
```

> Note: Tailwind's setup differs between major versions. Follow the current Vite guide on tailwindcss.com when installing.

**Deploy:** push to GitHub → import the repo in Vercel → framework preset "Vite" → done.
