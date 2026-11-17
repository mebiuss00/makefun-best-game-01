// Keyboard and mouse input. The game reads directions every step; a click on a
// neighbouring floor cell steps there, and clicks on the overlay screens' buttons
// are handed to the screen that is showing.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';

const KEY_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MUTE,
};

/** Keys the game owns: the page never scrolls on them. */
const GAME_KEYS = new Set([...Object.keys(KEY_DIRECTIONS), ...Object.keys(KEY_ACTIONS)]);

export function createInput(canvas) {
  const held = new Set();
  const pressedActions = [];
  const clicks = [];
  let mouse = { x: 0, y: 0, inside: false };
  /** The order directions were pressed in, so the newest held one wins. */
  const directionOrder = [];

  function onKeyDown(event) {
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (KEY_DIRECTIONS[event.code]) {
      directionOrder.push(event.code);
    } else if (KEY_ACTIONS[event.code]) {
      pressedActions.push(KEY_ACTIONS[event.code]);
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
    const at = directionOrder.indexOf(event.code);
    if (at !== -1) directionOrder.splice(at, 1);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
      inside: true,
    };
  }

  function onMouseLeave() {
    mouse = { x: 0, y: 0, inside: false };
  }

  function onClick(event) {
    onMouseMove(event);
    clicks.push({ x: mouse.x, y: mouse.y });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('click', onClick);

  return {
    /** The direction currently held, newest press first, or null. */
    direction() {
      for (let index = directionOrder.length - 1; index >= 0; index -= 1) {
        if (held.has(directionOrder[index])) return KEY_DIRECTIONS[directionOrder[index]];
      }
      return null;
    },
    /** Actions pressed since the last call, in order. */
    consumeActions() {
      return pressedActions.splice(0, pressedActions.length);
    },
    /** Clicks since the last call, in logical canvas coordinates. */
    consumeClicks() {
      return clicks.splice(0, clicks.length);
    },
    mouse() {
      return mouse;
    },
  };
}
