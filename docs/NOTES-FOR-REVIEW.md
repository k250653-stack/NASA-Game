# Notes for review

Choices made while working unattended. Nothing here was run in a browser or tested; only
`npx tsc --noEmit` was run.

## Task 1 — Single connected HQ map

- **All positions are estimates from the picture.** Room floors, doorways, furniture, stations,
  occluders, the path and the debrief table spots in `src/world/rooms/hq-map.json` were read off
  `hq-map.png` with a coordinate grid. Expect to tune them: press **F2** in the HQ to see every
  polygon (floors green, furniture red, doorways in their door colour, stations cyan, occluder
  silhouettes purple) and click to log world coordinates. Map pixels = world pixels.
- **Doorways** are floor strips through each door opening that overlap both floors. A script
  checked that each one overlaps the lobby and its room, that the spawn is on the path, that the
  path meets the lobby floor, and that every station has free floor within reach. The amber door
  on Briefing's outer wall and Launch Control's blast door are decorative (not walkable).
- **Walkable outside:** only the stone path below the entrance (new games spawn on it at
  `spawn`). Grass, park and city are not walkable.
- **Behind furniture:** tall objects (holo table, Personnel desk, filing cabinet, glass case,
  meeting table, both console rows, reception desk, rocket pedestal) are drawn a second time,
  masked to a silhouette (footprint raised by a height), and depth-sorted by foot Y with the
  player. Silhouettes are convex hulls, so the player can be clipped by a few pixels of floor
  next to an object. Plants and benches are blocked but not occluders.
- **Walls:** the map is one picture, so the player is always drawn over walls (including when
  walking through a door frame). Front walls are low, as the brief said, so this should read fine.
- **Locked rooms:** a dark overlay (75% black = 25% light) over the room's floor polygon only,
  not its walls, plus the padlock. The doorway is closed and a "Locked · reason" prompt shows
  within 30 px of it. Unlock: the overlay fades out over 1 s with the `unlock` sound (the sound
  file still does not exist, so it only logs a warning).
- **Camera:** whole-number zoom = floor(min(width / 600, height / 340)), e.g. 2× at 1280×720 and
  1366×768, 3× at 1920×1080. Below 600×340 it uses a fractional zoom. The camera is clamped to
  the map edges, follows the player and leans to the current room's centre (re-centres in about
  0.6 s). On the path outside it simply follows the player.
- **Lobby reception desk** opens a small "HQ info" popup (destination, scenario, seat, crew
  recruited, and what opens next). This is a new station kind (`opens: "info"`).
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
