# Sounds and music

Every sound already plays without files: `src/ui/sfx.ts` generates retro 8-bit versions with
ZzFX, and `src/ui/drone.ts` plays a quiet ambient drone instead of music. Drop an mp3 with the
exact name below into this folder (or `../music/`) and the game uses it instead, no code
changes. Missing files fail silently. Add every file you use to `CREDITS.md`.

Keep effects short (under 1 s except `launch`), quiet and soft (no harsh highs). Mono is fine.

## Sound effects — `public/assets/sounds/<name>.mp3`

| File | Plays when |
| ---- | ---------- |
| `click.mp3` | Buttons, cards and main-menu items are pressed |
| `hover.mp3` | The pointer moves onto a main-menu item (very soft) |
| `door.mp3` | Walking through a door; the camera pans to the next room (whoosh) |
| `footstep.mp3` | Every ~300 ms while walking (~220 ms running); pitch varies slightly |
| `popup-open.mp3` | A station, event or crew popup opens |
| `popup-close.mp3` | That popup closes |
| `alarm.mp3` | An urgent event popup opens (plays 3 times) |
| `success.mp3` | Your action succeeded; mission complete card; launch sequence ends |
| `fail.mp3` | Your action failed; mission failed card |
| `launch.mp3` | Lift-off rumble |
| `countdown-beep.mp3` | Each launch countdown number |
| `radio.mp3` | A routine event comes in (short static burst) |
| `nova-beep.mp3` | NOVA talking: a short blip every few letters, pitch varies |
| `unlock.mp3` | A locked HQ room lights up |
| `typewriter.mp3` | Spare tiny tick for typed text |

## Music — `public/assets/music/<name>.mp3` (looping, 1.5 s crossfade)

| File | Plays |
| ---- | ----- |
| `menu.mp3` | Title screen |
| `hq.mp3` | Earth HQ (walking and station popups) |
| `mission.mp3` | Habitat during the mission (calm) |
| `tension.mp3` | While an urgent event popup is open, then fades back |
| `debrief.mp3` | Mission debrief |

Music starts after the first click or key press (browser autoplay rules) and follows the music
volume slider and toggle in Settings; effects follow the sound volume slider and toggle.

## Suggested free sources

- Kenney audio packs, CC0: https://kenney.nl/assets/category:Audio
  (Interface Sounds, Digital Audio, Sci-fi Sounds, Impact Sounds; "UI Audio" for clicks).
- Freesound, filter by the CC0 license: https://freesound.org
  (search "radio static", "rocket launch rumble", "footstep metal", "airlock").
- For music, OpenGameArt (check each track's license): https://opengameart.org

Convert to mp3 (e.g. 128 kbps), trim silence, and normalise quietly (about −16 LUFS for music).
