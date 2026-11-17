// The simulation: one wisp of light, a dark maze, lanterns to kindle, embers to
// gather and shadows to avoid. Everything steps in fixed 1/60 s slices, so a
// scene played forward from the same seed always ends the same way.

import {
  CLEAR_BASE_POINTS,
  CLEAR_LIGHT_POINTS,
  COMBO_MAX,
  COMBO_STEP,
  COMBO_WINDOW,
  EMBER_LIGHT,
  EMBER_POINTS,
  HIT_DAMAGE,
  INVULN_SECONDS,
  LANTERN_POINTS,
  LIGHT_DRAIN_BASE,
  LIGHT_DRAIN_PER_LEVEL,
  LIGHT_MAX,
  PLAYER_SPEED,
  SHADOW_CHASE_RANGE,
  SHADOW_SPEED,
} from './config.js';
import { LEVELS, findPath, parseLevel } from './levels.js';

export const EVENT_EMBER = 1;
export const EVENT_LANTERN = 2;
export const EVENT_HIT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_GATE = 64;

const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function cellKey(x, y) {
  return `${x},${y}`;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    player: null,
    shadows: [],
    light: LIGHT_MAX,
    score: 0,
    combo: 0,
    comboTimer: 0,
    lanternsLit: 0,
    time: 0,
    particles: [],
    popups: [],
    shake: 0,
    over: false,
    won: false,
    cleared: false,
    gateOpen: false,
    clickTarget: null,
    random,
  };

  function isWalkable(x, y) {
    if (!state.level) return false;
    if (x < 0 || y < 0 || x >= state.level.width || y >= state.level.height) return false;
    return !state.level.solid[y][x];
  }

  /** A fresh walker standing on `cell`, not yet moving. */
  function makeWalker(cell) {
    return {
      x: cell.x,
      y: cell.y,
      fromX: cell.x,
      fromY: cell.y,
      toX: cell.x,
      toY: cell.y,
      progress: 1,
      moving: false,
      dirX: 0,
      dirY: 1,
    };
  }

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = parseLevel(LEVELS[index]);
    state.player = makeWalker(state.level.start);
    state.player.invuln = 0;
    state.shadows = state.level.shadows.map((cell) => {
      const shadow = makeWalker(cell);
      shadow.think = random();
      return shadow;
    });
    state.light = LIGHT_MAX;
    state.lanternsLit = 0;
    state.gateOpen = false;
    state.cleared = false;
    state.won = false;
    state.over = false;
    state.clickTarget = null;
    state.combo = 0;
    state.comboTimer = 0;
    state.particles = [];
    state.popups = [];
  }

  function resetRun() {
    state.score = 0;
    state.time = 0;
    loadLevel(0);
  }

  function burst(x, y, colour, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.4 + random() * 0.8);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.5 + random() * 0.4,
        maxLife: 0.9,
        size: 0.08 + random() * 0.1,
        colour,
      });
    }
  }

  function popup(x, y, text, colour) {
    state.popups.push({ x, y, text, colour, life: 1.1 });
  }

  function multiplier() {
    return Math.min(1 + (state.combo - 1) * COMBO_STEP, COMBO_MAX);
  }

  /** A pickup chains the combo when it lands inside the combo window. */
  function chainCombo() {
    state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
    state.comboTimer = COMBO_WINDOW;
    return multiplier();
  }

  function collectAt(cell) {
    let events = 0;
    for (const ember of state.level.embers) {
      if (!ember.taken && ember.x === cell.x && ember.y === cell.y) {
        ember.taken = true;
        const gain = chainCombo();
        const points = Math.round(EMBER_POINTS * gain);
        state.score += points;
        state.light = Math.min(LIGHT_MAX, state.light + EMBER_LIGHT);
        burst(cell.x + 0.5, cell.y + 0.5, '#ffb347', 10, 2.5);
        popup(cell.x + 0.5, cell.y, `+${points}`, '#ffe9a8');
        events |= EVENT_EMBER;
      }
    }
    for (const lantern of state.level.lanterns) {
      if (!lantern.lit && lantern.x === cell.x && lantern.y === cell.y) {
        lantern.lit = true;
        state.lanternsLit += 1;
        const gain = chainCombo();
        const points = Math.round(LANTERN_POINTS * gain);
        state.score += points;
        burst(cell.x + 0.5, cell.y + 0.5, '#ffc95e', 18, 3);
        popup(cell.x + 0.5, cell.y, `+${points}`, '#ffc95e');
        events |= EVENT_LANTERN;
        if (state.lanternsLit === state.level.lanterns.length) {
          state.gateOpen = true;
          events |= EVENT_GATE;
        }
      }
    }
    if (state.gateOpen && state.level.exit.x === cell.x && state.level.exit.y === cell.y) {
      const bonus = CLEAR_BASE_POINTS + Math.round(state.light) * CLEAR_LIGHT_POINTS;
      state.score += bonus;
      popup(cell.x + 0.5, cell.y, `+${bonus} clear`, '#7dffb0');
      if (state.levelIndex === LEVELS.length - 1) {
        state.won = true;
        events |= EVENT_WIN;
      } else {
        state.cleared = true;
        events |= EVENT_CLEAR;
      }
    }
    return events;
  }

  /** Advance one walker one slice toward its target cell. */
  function stepWalker(walker, speed, dt) {
    if (!walker.moving) return true;
    walker.progress += (speed * dt);
    if (walker.progress >= 1) {
      walker.x = walker.toX;
      walker.y = walker.toY;
      walker.fromX = walker.toX;
      walker.fromY = walker.toY;
      walker.progress = 1;
      walker.moving = false;
      return true;
    }
    walker.x = walker.fromX + (walker.toX - walker.fromX) * walker.progress;
    walker.y = walker.fromY + (walker.toY - walker.fromY) * walker.progress;
    return false;
  }

  function startMove(walker, dir) {
    const toX = walker.toX + dir.x;
    const toY = walker.toY + dir.y;
    if (!isWalkable(toX, toY)) return false;
    walker.fromX = walker.toX;
    walker.fromY = walker.toY;
    walker.toX = toX;
    walker.toY = toY;
    walker.progress = 0;
    walker.moving = true;
    walker.dirX = dir.x;
    walker.dirY = dir.y;
    return true;
  }

  /** The first step of the shortest walk from `from` to `to`, or null. */
  function nextStepToward(from, to) {
    const path = findPath(state.level.solid, state.level.width, state.level.height, from, to);
    if (path === null || path.length === 0) return null;
    return { x: path[0].x - from.x, y: path[0].y - from.y };
  }

  // The gate is sacred ground: shadows never step within two cells of it, so a
  // player who lit every lantern can always reach the open gate.
  function nearExit(cell) {
    const exit = state.level.exit;
    return Math.abs(cell.x - exit.x) + Math.abs(cell.y - exit.y) <= 2;
  }

  function chooseShadowMove(shadow) {
    const at = { x: shadow.toX, y: shadow.toY };
    const playerCell = { x: Math.round(state.player.x), y: Math.round(state.player.y) };
    const distance = Math.abs(playerCell.x - at.x) + Math.abs(playerCell.y - at.y);
    if (distance <= SHADOW_CHASE_RANGE) {
      const step = nextStepToward(at, playerCell);
      if (step !== null) {
        const next = { x: at.x + step.x, y: at.y + step.y };
        if (!nearExit(next)) return step;
      }
    }
    const options = DIRECTIONS.filter((dir) => {
      if (dir.x === -shadow.dirX && dir.y === -shadow.dirY) return false;
      const cell = { x: at.x + dir.x, y: at.y + dir.y };
      if (nearExit(cell)) return false;
      return isWalkable(cell.x, cell.y);
    });
    if (options.length === 0) {
      const back = { x: -shadow.dirX, y: -shadow.dirY };
      return isWalkable(at.x + back.x, at.y + back.y) ? back : null;
    }
    return options[Math.floor(random() * options.length)];
  }

  function stepShadow(shadow, dt) {
    if (stepWalker(shadow, SHADOW_SPEED, dt)) {
      const next = chooseShadowMove(shadow);
      if (next !== null) startMove(shadow, next);
    }
  }

  function hitPlayer(shadow) {
    const player = state.player;
    player.invuln = INVULN_SECONDS;
    state.light = Math.max(0, state.light - HIT_DAMAGE);
    state.shake = 1;
    state.combo = 0;
    state.comboTimer = 0;
    burst(player.x + 0.5, player.y + 0.5, '#c86bff', 14, 3.5);
    // The wisp is knocked back to the cell its step started from.
    player.x = player.fromX;
    player.y = player.fromY;
    player.toX = player.fromX;
    player.toY = player.fromY;
    player.progress = 1;
    player.moving = false;
    state.clickTarget = null;
    if (state.light <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function step(dt, direction, options = {}) {
    if (state.over || state.won || state.cleared) return 0;
    const drain = options.drain !== false;
    let events = 0;
    state.time += dt;

    const player = state.player;
    if (player.invuln > 0) player.invuln -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (drain) {
      state.light -= (LIGHT_DRAIN_BASE + state.levelIndex * LIGHT_DRAIN_PER_LEVEL) * dt;
      if (state.light <= 0) {
        state.light = 0;
        state.over = true;
        state.shake = 1;
        return EVENT_OVER;
      }
    }

    if (direction !== null) state.clickTarget = null;
    const wanted = direction ?? null;
    let move = wanted;
    if (move === null && state.clickTarget !== null) {
      const at = { x: player.toX, y: player.toY };
      if (at.x === state.clickTarget.x && at.y === state.clickTarget.y) {
        state.clickTarget = null;
      } else {
        move = nextStepToward(at, state.clickTarget);
        if (move === null) state.clickTarget = null;
      }
    }
    if (stepWalker(player, PLAYER_SPEED, dt)) {
      events |= collectAt({ x: player.toX, y: player.toY });
      if (state.over || state.won || state.cleared) return events;
      if (move !== null) startMove(player, move);
    } else if (direction !== null) {
      // Only a held key queues a turn: a click-to-move step must never queue
      // itself, or the wisp would overshoot the cell it was sent to.
      player.queuedDir = direction;
    }

    for (const shadow of state.shadows) stepShadow(shadow, dt);

    // A shadow's touch lands when the two are close and the wisp is not safe.
    if (player.invuln <= 0) {
      for (const shadow of state.shadows) {
        if (Math.abs(shadow.x - player.x) < 0.55 && Math.abs(shadow.y - player.y) < 0.55) {
          events |= hitPlayer(shadow);
          break;
        }
      }
    }

    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 2 * dt;
      particle.vy *= 1 - 2 * dt;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    for (const item of state.popups) item.life -= dt;
    state.popups = state.popups.filter((item) => item.life > 0);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);

    // A queued turn applies the moment the wisp lands on a cell.
    if (!player.moving && player.queuedDir) {
      const queued = player.queuedDir;
      player.queuedDir = null;
      if (isWalkable(player.toX + queued.x, player.toY + queued.y)) startMove(player, queued);
    }
    return events;
  }

  /** Ambient drift for the title screen: particles only, no drain, no danger. */
  function stepAmbient(dt) {
    state.time += dt;
    if (random() < dt * 6) {
      const edge = Math.floor(random() * 4);
      const level = state.level;
      const x = edge === 0 ? 0.5 : edge === 1 ? level.width - 0.5 : 0.5 + random() * (level.width - 1);
      const y = edge === 2 ? 0.5 : edge === 3 ? level.height - 0.5 : 0.5 + random() * (level.height - 1);
      state.particles.push({
        x,
        y,
        vx: (random() - 0.5) * 0.4,
        vy: -0.3 - random() * 0.4,
        life: 2 + random() * 2,
        maxLife: 4,
        size: 0.06 + random() * 0.08,
        colour: '#ffb347',
      });
    }
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    resetRun,
    step,
    stepAmbient,
    isWalkable,
    nextStepToward,
    /** The light the level drains each second, for the HUD. */
    drainRate() {
      return LIGHT_DRAIN_BASE + state.levelIndex * LIGHT_DRAIN_PER_LEVEL;
    },
    /** Move the wisp to a cell (screenshot staging only). */
    placePlayer(x, y) {
      const player = state.player;
      player.x = x;
      player.y = y;
      player.fromX = x;
      player.fromY = y;
      player.toX = x;
      player.toY = y;
      player.progress = 1;
      player.moving = false;
    },
    /** Move one shadow to a cell (screenshot staging only). */
    placeShadow(index, x, y) {
      const shadow = state.shadows[index];
      if (!shadow) return;
      shadow.x = x;
      shadow.y = y;
      shadow.fromX = x;
      shadow.fromY = y;
      shadow.toX = x;
      shadow.toY = y;
      shadow.progress = 1;
      shadow.moving = false;
    },
    /** Set the light meter (screenshot staging only). */
    setLight(value) {
      state.light = value;
    },
    /** Light every lantern at once (screenshot staging only). */
    lightAllLanterns() {
      for (const lantern of state.level.lanterns) lantern.lit = true;
      state.lanternsLit = state.level.lanterns.length;
      state.gateOpen = true;
    },
  };
}
