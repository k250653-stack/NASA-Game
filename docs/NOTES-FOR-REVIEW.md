# Notes for review

## HQ hitbox editor (dev builds: `pnpm dev`)

1. In the HQ press **F2**. Every polygon appears with its vertices as small squares:
   walkable floor = green, blockers (furniture footprints) = red, occluders = blue (their
   `baseY` is the thick horizontal line), doorways = their door colour, stations = yellow.
   A status box (top left) shows the current "new" type and the selected polygon.
2. **Edit:**
   - **Drag a vertex** to move it.
   - **Click an edge** to add a vertex there (and keep dragging it).
   - **Right-click a vertex** to delete it (a polygon keeps at least 3).
   - **Click inside a polygon** to select it; **Delete** removes the selected one (room floors
     cannot be deleted, only reshaped).
   - **1–5** choose the type for new polygons: 1 walkable, 2 blocker, 3 occluder, 4 doorway,
     5 station. **N** starts a new polygon: click to place points, **Enter** closes it
     (3+ points), **Backspace** undoes the last point (or cancels).
   - **B** sets the selected occluder's `baseY` to the mouse's Y.
3. Changes apply immediately: walk around (WASD / arrows) to test collision and occlusion.
   Every click also logs its world coordinates to the console.
4. **Ctrl+S** downloads `hq-map.json` and copies it to the clipboard. Replace
   `src/world/rooms/hq-map.json` with it and commit.

Notes: new doorways get `room` = the first room and colour `accent`, new stations open
"planning"; edit those fields in the JSON. A production build only shows the read-only overlay.

---

Choices made while working unattended. Nothing here was run in a browser or tested; only
`npx tsc --noEmit` was run.

## HQ footprints, occlusion and the freeze

- **Freeze after a popup:** I could not reproduce it without running the game. Most likely
  cause: a closing popup returns focus to whatever was focused when it opened, and a React
  key handler there called `preventDefault`, which makes Phaser ignore the key. Fix: when the
  last popup or menu over the HQ or habitat closes, the leftover focus is released
  (`useReleaseFocus`), and both scenes now fully restore the keyboard when unpausing
  (plugin + manager enabled, capture on, key states reset). The reception desk station and its
  "HQ info" popup are removed (the desk is still furniture).
- **Collision:** blockers are footprints only (where objects touch the floor). Room floors are
  inset 12 px from every wall (not at the entrance). The player collides with a 14 × 7 px
  ellipse at the feet (`FOOT_RX`/`FOOT_RY` in `geometry.ts`). Doorway strips were extended so
  they still reach the inset floors; a script checked every room and station is reachable from
  the spawn with the foot ellipse.
- **Occluders:** door frames (both posts + beam) with `baseY` on the threshold, the entrance
  arch, front low walls (`baseY` 9999 = always in front where nothing walkable is in front of
  them), and tall furniture. One `baseY` per occluder: for slanted walls it is the middle of the
  floor line, so near the ends of a long slanted wall the switch point can be a little off;
  split such an occluder in two in the editor if it shows.

## Task 1 — Single connected HQ map

- **All positions are estimates from the picture.** Room floors, doorways, furniture, stations,
  occluders, the path and the debrief table spots in `src/world/rooms/hq-map.json` were read off
  `hq-map.png` with a coordinate grid. Tune them with the editor above. Map pixels = world pixels.
- **Doorways** are floor strips through each door opening that overlap both floors. A script
  checked that each one overlaps the lobby and its room, that the spawn is on the path, that the
  path meets the lobby floor, and that every station has free floor within reach. The amber door
  on Briefing's outer wall and Launch Control's blast door are decorative (not walkable).
- **Walkable outside:** only the stone path below the entrance (new games spawn on it at
  `spawn`). Grass, park and city are not walkable.
- **Behind furniture and through doors:** replaced by the occluders described above.
- **Locked rooms:** a dark overlay (75% black = 25% light) over the room's floor polygon only,
  not its walls, plus the padlock. The doorway is closed and a "Locked · reason" prompt shows
  within 30 px of it. Unlock: the overlay fades out over 1 s with the `unlock` sound (the sound
  file still does not exist, so it only logs a warning).
- **Camera:** whole-number zoom = floor(min(width / 600, height / 340)), e.g. 2× at 1280×720 and
  1366×768, 3× at 1920×1080. Below 600×340 it uses a fractional zoom. The camera is clamped to
  the map edges, follows the player and leans to the current room's centre (re-centres in about
  0.6 s). On the path outside it simply follows the player.
- **Debrief:** after a mission the player arrives at `briefingArrival` beside the meeting table and
  the crew stand at `tableSpots` (they still use the old tinted crew sprite).
- **Saves:** the world save version went 2 → 3. Old saved positions were on the old multi-room
  canvas, so they are dropped and the player starts at the front entrance.
- **Removed:** the five separate HQ room configs (hq-lobby, mission-planning, personnel, briefing,
  launch-control JSON), the portal code and the per-room camera pans. The habitat rooms are
  unchanged; their door `to` fields are no longer cross-checked (nothing uses them yet).
- **Left in place:** the old room pictures (`hq-lobby.jpg`, `missionplanning.jpg`, `personal.jpg`,
  `breifing.jpg`, `launchcontrol.jpg`) are no longer used but were not deleted.
- **Credits:** I don't know how `hq-map.png` was made. If it is AI-generated it needs a CREDITS.md
  row and, per the event rules, a visible watermark.

## Task 2 — Rocket launch on the main menu

- **Timeline** (`src/screens/menu/menuLaunch.ts`): menu text fades in 0.3 s; beeps at 0.35 /
  0.7 / 1.05 s while the base vapour grows; ignition at 1.3 s (flame sprite, `launch` rumble,
  ~0.9 s screen shake, smoke clouds rolling out along the pad); lift-off at 1.7 s, rising slow then
  fast for 2.6 s with a fading smoke trail while the scene dims; fade to black 4.1–4.5 s. Any key
  or click skips to a 0.3 s fade. Reduced motion (the game setting or the OS one): only the
  short fade, no shake.
- **Flame sprites are not whole-number scaled.** `rocket-*-flameon.png` are drawn at about
  2.3–2.45× the resolution of the standing `rocket-*.png`. To swap without the rocket jumping in
  size, the flame art is scaled by (rocket scale ÷ that ratio), e.g. 3 ÷ 2.44 ≈ 1.23× at
  1366×768, still with `image-rendering: pixelated`. The standing rocket and all smoke stay on
  whole pixels. The calibration (ratio, centre line, nozzle line per rocket) is in
  `src/ui/rocketSprite.ts` (`ROCKET_ART`) if the flame looks a few pixels off.
- **Smoke** is deterministic chunky square puffs snapped to the art-pixel grid (no randomness),
  computed from the launch clock in `launchSmoke.ts`.
- **Sandbox mode** also launches, and now also asks "Start a new mission?" when a save exists
  (the brief said the confirm applies before both). After the launch Sandbox still goes to the
  destination screen (its old direct flow); only PLAY GAME goes to "Choose your astronaut".
- **CONTINUE GAME** is unchanged: no launch.
- **Mid-task request:** the in-game launch sequence (Launch Check → lift-off) now also switches to
  the matching `rocket-*-flameon.png` at ignition, using the same calibrated component
  (`src/ui/RocketArt.tsx`).
- **Credits:** the three `rocket-*-flameon.png` files were untracked and are now committed. I
  don't know how they were made; if AI-generated they need CREDITS.md rows.

## Hitbox rules (measured from the hand-tuned Mission Planning room)

Measured by overlaying `src/world/rooms/hq-map.json` on `public/assets/backgrounds/hq-map.png`
(1672 × 941). All numbers are image pixels; "≈" means read off a 3× zoom by eye.

- **Back walls** (the wall face you can see, behind the room): the floor edge runs parallel to
  the wall's base line and stops **≈ 15 px below it** (planning back corner: wall base ≈ y 144,
  floor vertex `[462,159]`). Feet never touch the drawn wall face.
- **Low front walls** (the near walls you look over): the floor edge sits **≈ 4 px inside the
  top edge of the wall art** (planning: front wall top `[96,322]→[412,428]`, floor
  `[120,326]→[403,426]`). The front-wall occluder (`baseY: 9999`) starts exactly on that top
  edge, so the feet stop just before the wall is drawn over them.
- **Inner walls that stick into the room** (seen from their top, like the planning/lobby wall):
  the floor is notched along the wall's top edge, again ≈ 4 px inside
  (`[563,427] → [521,355] → [403,426]` follows `wall-planning-lobby` `[412,428] → [527,346]`).
  That wall gets its own occluder with a real `baseY` (400) instead of 9999.
- **Doorways:** the room floor reaches right up to the door line between the two posts
  (planning floor point `[563,427]` sits on the door's floor line), and the doorway area overlaps
  both the room floor and the lobby floor, so there is no gap to step across.
- **Furniture blockers = footprint only:** the part touching the floor, inset ≈ 2–6 px from the
  drawn outline. The holo-table blocker covers y 255–332 of an object drawn y 196–338, i.e.
  roughly the lower half (legs and chair feet), full drawn width.
- **Occluders for tall objects:** trace the drawn silhouette; `baseY` is the floor line where
  the object stands, ≈ 8 px above its lowest drawn pixel (holo-table: lowest point 338,
  `baseY` 330). Door frames: posts + top beam, `baseY` on the doorway floor line.

## Hitbox check (`node scripts/check-hitboxes.mjs`)

```
ok   room lobby: 10871/10885 free cells reachable
ok   room mission-planning: 4471/4471 free cells reachable
ok   room personnel: 3702/3702 free cells reachable
ok   room briefing: 3873/3873 free cells reachable
ok   room launch-control: 3446/3451 free cells reachable
ok   station star-map: nearest reachable point 0.0 px (reach 48)
ok   station desk-terminal: nearest reachable point 0.0 px (reach 48)
ok   station meeting-table: nearest reachable point 0.0 px (reach 48)
ok   station console-rows: nearest reachable point 0.0 px (reach 48)

RESULT: all checks passed
```

## Hitbox pass: what changed and what to check in F2

- **Lobby:** the floor is retraced (24 points).
  - Back walls: 15 px in front of the wall base.
  - Planning and Personnel door gaps: the floor reaches the door line.
  - Notches: around the briefing pillar at x 612 and the launch pillar at x 1060.
  - Front walls: just inside the low front walls, and down into the entrance gate between x 780 and 890.
  - Check: the west corner `[481,473]`, the east corner `[1176,472]`, and whether the bench blockers still sit right.
- **Personnel:** the floor follows the back walls, the front wall, and the notch where Launch Control's corner pokes in, from `[1418,398]` to `[1365,378]` to `[1273,427]`.
  - Removed the plant blocker in the back corner, because the plant stands against the wall, off the floor.
  - Check: the doorway edge from `[1150,336]` to `[1022,293]`.
- **Briefing:** the floor is the full room, with the back corner at `[307,533]`, the doorway at `[493,618]` to `[598,673]`, and the front corner at `[355,795]`.
  - Check: the west corner `[68,650]` near the cable art on the floor.
- **Launch Control:** the floor is the full room, with the back corner at `[1367,525]`, the east corner at `[1598,656]` and the front corner at `[1327,798]`.
  - The back console blocker now also covers its chairs, down to y 662.
  - Check: whether the gap between the two console rows should be walkable.
- **Front walls:** the occluders for the lobby front walls (both sides), Briefing, Launch and Personnel now start on the real top edge of the wall art.
  - The Personnel-to-Launch inner wall follows the notch.
- **Unchanged and still correct:** the door frames, door areas, the other blockers, all tall-furniture occluders and all station areas. Each was checked against the art.
