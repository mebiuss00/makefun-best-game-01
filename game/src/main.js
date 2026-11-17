// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level clear, game over and victory.
//
// ?seed=N fixes the level's random drift. ?shot=start|play|win|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EVENT_CLEAR,
  EVENT_EMBER,
  EVENT_GATE,
  EVENT_HIT,
  EVENT_LANTERN,
  EVENT_OVER,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  createRenderer,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // The best score simply does not persist.
  }
}

let best = readBest();
let screen = SCREEN_TITLE;

function setStatus(text) {
  status.textContent = text;
}

function startRun() {
  audio.unlock();
  audio.click();
  world.resetRun();
  screen = SCREEN_PLAY;
  setStatus(`Level 1, ${world.state.level.name}. Light every lantern, then reach the gate.`);
}

/** The frame's clicks, matched against the buttons the screen just drew. */
function handleClicks(buttons) {
  for (const click of input.consumeClicks()) {
    let hit = false;
    for (const button of buttons) {
      if (click.x >= button.x && click.x <= button.x + button.width
        && click.y >= button.y && click.y <= button.y + button.height) {
        hit = true;
        if (button.id === 'begin') startRun();
        else if (button.id === 'resume') screen = SCREEN_PLAY;
        else if (button.id === 'next') nextLevel();
        else if (button.id === 'retry' || button.id === 'again') backToTitle();
      }
    }
    if (hit) continue;
    if (screen === SCREEN_TITLE) {
      startRun();
    } else if (screen === SCREEN_PLAY) {
      const cell = renderer.cellAt(world.state, click.x, click.y);
      if (cell !== null && world.isWalkable(cell.x, cell.y)
        && !(cell.x === world.state.player.toX && cell.y === world.state.player.toY)) {
        world.state.clickTarget = cell;
      }
    }
  }
}

function nextLevel() {
  audio.click();
  world.loadLevel(world.state.levelIndex + 1);
  screen = SCREEN_PLAY;
  setStatus(`Level ${world.state.levelIndex + 1}, ${world.state.level.name}.`);
}

function backToTitle() {
  audio.click();
  world.resetRun();
  screen = SCREEN_TITLE;
  setStatus('Emberkeeper. Press Enter or click to begin.');
}

function onEvents(events) {
  if (events & EVENT_EMBER) audio.ember(world.state.combo);
  if (events & EVENT_LANTERN) audio.lantern();
  if (events & EVENT_GATE) audio.gate();
  if (events & EVENT_HIT) audio.hurt();
  if (events & EVENT_CLEAR) {
    audio.clear();
    screen = SCREEN_CLEAR;
    setStatus(`Level ${world.state.levelIndex + 1} clear. Score ${world.state.score}.`);
  }
  if (events & EVENT_WIN) {
    audio.win();
    best = Math.max(best, world.state.score);
    saveBest(best);
    screen = SCREEN_WIN;
    setStatus(`Every lantern burns bright. Final score ${world.state.score}.`);
  }
  if (events & EVENT_OVER) {
    audio.over();
    best = Math.max(best, world.state.score);
    saveBest(best);
    screen = SCREEN_OVER;
    setStatus(`The dark took the light. Score ${world.state.score}.`);
  }
}

function handleActions() {
  for (const action of input.consumeActions()) {
    if (action === ACTION_MUTE) {
      audio.toggleMute();
    } else if (action === ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        setStatus('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        setStatus('Playing.');
      }
    } else if (action === ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startRun();
      else if (screen === SCREEN_CLEAR) nextLevel();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      else if (screen === SCREEN_OVER || screen === SCREEN_WIN) backToTitle();
    } else if (action === ACTION_RESTART) {
      if (screen === SCREEN_OVER || screen === SCREEN_WIN) backToTitle();
      else if (screen === SCREEN_PLAY) {
        world.resetRun();
        setStatus('A fresh run. Level 1.');
      }
    }
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  handleActions();
  if (screen === SCREEN_TITLE) {
    world.stepAmbient(elapsed);
  } else if (screen === SCREEN_PLAY) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const events = world.step(STEP, input.direction());
      onEvents(events);
      if (screen !== SCREEN_PLAY) {
        accumulator = 0;
        break;
      }
    }
  }
  const view = renderer.draw(world.state, screen, {
    best,
    muted: audio.muted,
    mouse: input.mouse(),
  });
  handleClicks(view.buttons);
  requestAnimationFrame(frame);
}

if (shot !== null) {
  // A staged scene for a screenshot: paint it twice, then signal readiness.
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  setStatus('Emberkeeper.');
  renderer.draw(world.state, screen, { best, muted: audio.muted, mouse: { x: 0, y: 0, inside: false } });
  renderer.draw(world.state, screen, { best, muted: audio.muted, mouse: { x: 0, y: 0, inside: false } });
  window.__shotReady = true;
} else {
  setStatus('Emberkeeper. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

// The playtest's window into the live game: state to read, never to cheat with.
window.__emberkeeper = {
  world,
  get screen() {
    return screen;
  },
  get best() {
    return best;
  },
};
