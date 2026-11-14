# Test report

## Part A — audit of Prompts 1–7

**Result:** `pnpm check` green — lint, 272 unit tests, build, 42 e2e runs (21 tests × 1280×720 and 1920×1080).

### Tests added in this audit

| Area | File | Tests added | Total now |
| --- | --- | --- | --- |
| Engine helpers with only indirect coverage (format, mission helpers, history, effects, events, crew AI, autopilot, planning, read-outs, recruitment, score, detectors) | `src/engine/__tests__/engineAudit.test.ts` | 32 | 32 |
| Full-run determinism (Moon + Mars: state, score, causes) | `engineAudit.test.ts` | 1 | 1 |
| Content integrity (validation, portraits, dialogue, icons, event ids, base slots incl. no overlap, phase sums, ownership) | `src/content/contentIntegrity.test.ts` | 9 | 9 |
| Guards (no `Math.random` in `src`, engine imports no React/screens/ui/store) | `contentIntegrity.test.ts` | 3 | 3 |
| e2e design system (every component, Modal Esc + focus trap, focus ring) | `e2e/design-system.spec.ts` | 1 | 1 |
| e2e selection (destination gating + reset confirm, difficulty + seed persist, 5 seats, callsign) | `e2e/selection.spec.ts` | 3 | 3 |
| e2e recruit (budget, no-Practical warning, suggested team, invalid reason, reload) | `e2e/recruit.spec.ts` | 3 | 3 |
| e2e planning (ownership locks, Mission Director, supplies slider, rocket → mass bar, accepted trade → margins, standing orders Mars only) | `e2e/planning.spec.ts` | 5 | 12 |

Unit tests by file: physics 21, launch check 13, budget 9, team balance 5, long duration 16, mission 22, debrief 19, planning 18, recruitment 11, purity 3, rng 11, content 23, store 9, icons 1, audit 33.

Every exported engine function now has at least one direct test (audited with a grep over
`export function` names against the test files).

### Bugs found and fixed

1. **Style guide listed the 5 player characters ("You") as recruitable crew** — e2e design-system spec; now shows the 8 candidates only.
2. **Horizontal scrollbar at 1280×720 in a real window** — found in the headed (`e2e:watch`) run: `body { min-width: 1280px }` plus a 15 px classic scrollbar made the page 15 px too wide. Headless Chromium uses overlay scrollbars, so earlier runs missed it. Removed the hard minimum.
3. **Two suit markers overlapped on the base picture** — found in the visible Moon play-through (slots 4% apart, markers 32 px). Moved the second suit slot; a content test now keeps every pair of slots a marker-width apart.

### Not fixed

- None outstanding. Placeholder art (portraits, backgrounds, base pictures) and crew dialogue are still placeholders by design.

### Visible play-throughs (A4)

Headed Edge, narrated, 2 s pause per screen. The Playwright **MCP** browser is not connected in
this session, so the play-throughs ran as headed Playwright scripts instead.

- Moon (Science Lead): 12 screens, no broken images, no overflow; mass bar 9,250 / 8,000 kg matches its tooltip; Sana accepted the habitat swap; Back kept the team and the traded design. Bug 3 found, fixed and replayed.
- Mars (Science Lead): 12 screens, no issues; mass bar 13,717 / 12,000 kg matches the tooltip; Standing Orders panel present.

### Where to look

- e2e screenshots: `e2e/screenshots/<viewport>/` (gitignored)
- HTML report: `pnpm exec playwright show-report e2e/playwright-report`
- Watch the suite: `pnpm e2e:watch`
