# Emberkeeper — keep the light alive

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mebiuss00/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mebiuss00/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A complete, original, light-keeper maze game that runs offline in a desktop
browser from static files — no build step, no network, no library. You are a
wisp of light in a dark maze: kindle every lantern, gather embers to feed your
fading light, dodge the shadows that hunt it, dash through danger, and slip
through the gate before the dark closes in.

## The game

Eight hand-built levels, each a darker maze than the last:

- **Kindle the lanterns** — walk onto every lantern in the level to light it.
  The gate only opens once they all burn.
- **Feed your light** — your light drains every second. Embers restore it
  (+25) and score points; pickups chained within a few seconds build a combo
  multiplier up to x3.
- **Dodge the shadows** — they drift the halls and give chase when you come
  close. A touch costs 20 light, breaks your combo, and knocks you back.
- **Dash** — Shift bursts forward at double speed, untouchable for a blink:
  a dash slips clean past a shadow. It needs a few seconds to gather again,
  and the HUD dash meter shows when it is ready.
- **Flare lanterns** — the blue-starred lanterns (from level 3) burst when
  kindled and freeze every shadow and wraith for 3.5 seconds, and score 150.
- **Wraiths** — from level 4, pale ghosts drift straight through the walls
  toward you. They only hunt while solid; while faded they are harmless —
  but they always know which side of the wall you are on.
- **Clear the level** — step through the open gate for a clear bonus (250 +
  5 per light left). Clear all eight levels and every lantern burns bright.

The HUD shows score, best score, level, lanterns lit, the light meter —
which pulses red when the dark is nearly on you — the dash meter, and a
countdown while the dark is frozen. Sounds are synthesised live with
WebAudio (dash whoosh, flare chime, a wraith's whisper when one is near);
there are no audio files.

## Controls

| Keys / mouse | Action |
| --- | --- |
| W A S D / arrow keys | Move the wisp |
| Shift | Dash — a brief untouchable burst of speed |
| Click a cell | Walk there (the wisp paths around walls) |
| Enter / Space, or click | Begin, next level, retry |
| P / Esc | Pause / resume |
| R | Restart the run |
| M | Mute / unmute |

## Run it

Serve `game/` with any static file server and open `index.html` in desktop
Chrome. Everything is plain ES modules — no build step, no network request.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output and writes the dossier with `vendor/makefun-game.ts`.
- `game/src/` — one module per job: `config` (all tuning and the palette),
  `levels` (the eight mazes as text maps, checked reachable at load),
  `world` (the simulation: movement, light, dashing, shadows, wraiths, the
  flare freeze, scoring),
  `render` (canvas drawing, the light-and-dark look, HUD and screens),
  `input` (keyboard and mouse), `audio` (synthesised sound),
  `shots` (the deterministic screenshot scenes) and `main` (boot and the
  fixed-step loop).

The simulation runs at a fixed 60 Hz, apart from rendering; the screenshot
scenes play the real rules forward from a fixed seed (`?shot=start|play|win|end&seed=1`).

## License

MIT — see `LICENSE`.

---
Entered on make.fun — [best-game-01](https://make.fun/bounty/best-game-01)
