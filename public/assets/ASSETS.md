# Expected asset files

Every file the sample content refers to. Until a file exists, the game shows a generated
placeholder (images) or stays silent (audio), so missing files never break the build or the demo.

Rules: WebP for images, MP3 for audio, each image **< 300 KB**, whole folder **< 10 MB**.
Record author, source and license for every file in the `License` column here **and** in
`/CREDITS.md` before committing it.

## Portraits — `portraits/` — 512 × 512 WebP

| File                             | For                              | License |
| -------------------------------- | -------------------------------- | ------- |
| `crew-mina-okafor.webp`          | Dr. Mina Okafor (science)        |         |
| `crew-jonas-reyes.webp`          | Jonas Reyes (power_life)         |         |
| `crew-priya-natarajan.webp`      | Priya Natarajan (comms_nav)      |         |
| `crew-theo-lindqvist.webp`       | Theo Lindqvist (launch_budget)   |         |

Convention: `crew-<crew id>.webp`, matching the `portrait` field in `src/content/crew.json`.

## Backgrounds — `backgrounds/` — 1920 × 1080 WebP

| File                 | For                                   | License |
| -------------------- | ------------------------------------- | ------- |
| `title.webp`         | Title screen                          |         |
| `control-room.webp`  | Isometric control room (mission run)  |         |
| `moon-surface.webp`  | Moon destination / surface scenes     |         |
| `mars-surface.webp`  | Mars destination / surface scenes     |         |

## Sprites — `sprites/` — WebP, size per sprite

Not referenced by the sample content yet. Crew sprites, consoles, rover and rocket go here
(Kenney.nl CC0 packs are the planned source).

| File | For | License |
| ---- | --- | ------- |
|      |     |         |

## Sounds — `sounds/` — MP3, short one-shots (< 3 s unless noted)

| File             | Used when                                   | License |
| ---------------- | ------------------------------------------- | ------- |
| `alarm.mp3`      | Critical resource or system failure         |         |
| `launch.mp3`     | Rocket launch (5–8 s)                       |         |
| `radio.mp3`      | Crew radio chatter / message received       |         |
| `success.mp3`    | Event resolved successfully, mission success |         |
| `fail.mp3`       | Event failed, mission failure               |         |
| `eva.mp3`        | Spacewalk / surface EVA starts              |         |
| `click.mp3`      | UI button press                             |         |
| `warning.mp3`    | Resource margin low                         |         |
| `nova-beep.mp3`  | NOVA lesson popup opens                     |         |
| `transmit.mp3`   | Data downlink / transmission                |         |

## Music — `music/` — MP3, loopable

Optional. Not referenced by the sample content yet.

| File | For | License |
| ---- | --- | ------- |
|      |     |         |
