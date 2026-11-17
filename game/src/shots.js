// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 18;
const END_LIMIT_SECONDS = 60;
const SAMPLE = 1 / 60;

const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * The autopilot's next step: toward the nearest unlit lantern, else the nearest
 * ember, else the open gate — but it flees when a shadow comes close, and it
 * never waits where it stands: moving beats standing still next to a shadow.
 * Returns a direction, or null when there is nowhere to go.
 */
function autopilot(world) {
  const state = world.state;
  const player = state.player;
  if (player.moving) return null;
  const at = { x: player.toX, y: player.toY };

  /** The distance from a cell to the nearest shadow. */
  const safest = (x, y) => {
    let nearest = Infinity;
    for (const shadow of state.shadows) {
      nearest = Math.min(nearest, Math.abs(shadow.x - x) + Math.abs(shadow.y - y));
    }
    return nearest;
  };

  /** The walkable neighbour farthest from every shadow. */
  const fleeStep = () => {
    let best = null;
    let bestDistance = -Infinity;
    for (const dir of DIRECTIONS) {
      const cellX = at.x + dir.x;
      const cellY = at.y + dir.y;
      if (!world.isWalkable(cellX, cellY)) continue;
      const distance = safest(cellX, cellY);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = dir;
      }
    }
    return best;
  };

  // A shadow close by: slip away when there is a safe cell to slip to. When
  // there is none, push on toward the goal instead of cowering: one touch
  // costs light, but the brief safety after it is enough to run through.
  if (safest(at.x, at.y) < 2) {
    const flee = fleeStep();
    if (flee !== null && safest(at.x + flee.x, at.y + flee.y) >= 2) return flee;
  }

  let target = null;
  let bestDistance = Infinity;
  const consider = (cell) => {
    const distance = Math.abs(cell.x - at.x) + Math.abs(cell.y - at.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = cell;
    }
  };
  for (const lantern of state.level.lanterns) if (!lantern.lit) consider(lantern);
  if (target === null) {
    for (const ember of state.level.embers) if (!ember.taken) consider(ember);
  }
  if (target === null && state.gateOpen) target = state.level.exit;
  if (target === null) return null;

  const planned = world.nextStepToward(at, target);
  if (planned === null) return null;
  if (safest(at.x + planned.x, at.y + planned.y) >= 1.2) return planned;
  // The planned step is hot: take a safe neighbour instead, or keep moving.
  const safe = fleeStep();
  if (safe !== null && safest(at.x + safe.x, at.y + safe.y) >= 1.2) return safe;
  return planned;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.loadLevel(2);
    for (let index = 0; index < PLAY_SECONDS / SAMPLE; index += 1) {
      const events = world.step(SAMPLE, autopilot(world));
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    world.loadLevel(4);
    world.lightAllLanterns();
    const exit = world.state.level.exit;
    const spot = DIRECTIONS.map((dir) => ({ x: exit.x + dir.x, y: exit.y + dir.y }))
      .find((cell) => world.isWalkable(cell.x, cell.y));
    world.placePlayer(spot.x, spot.y);
    const dir = { x: exit.x - spot.x, y: exit.y - spot.y };
    for (let index = 0; index < 600; index += 1) {
      const events = world.step(SAMPLE, dir);
      if (events & EVENT_WIN) break;
    }
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  if (name === 'end') {
    world.loadLevel(1);
    world.setLight(30);
    const player = world.state.player;
    const spot = DIRECTIONS.map((dir) => ({ x: player.toX + dir.x, y: player.toY + dir.y }))
      .find((cell) => world.isWalkable(cell.x, cell.y));
    world.placeShadow(0, spot.x, spot.y);
    for (let index = 0; index < END_LIMIT_SECONDS / SAMPLE; index += 1) {
      const at = { x: world.state.player.toX, y: world.state.player.toY };
      const shadow = world.state.shadows[0];
      const dir = world.nextStepToward(at, { x: Math.round(shadow.x), y: Math.round(shadow.y) });
      const events = world.step(SAMPLE, dir);
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  world.loadLevel(0);
  for (let index = 0; index < START_SECONDS / SAMPLE; index += 1) {
    world.stepAmbient(SAMPLE);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
