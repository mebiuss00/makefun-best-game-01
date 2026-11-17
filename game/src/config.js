// Emberkeeper — every tuning number and colour in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Logical canvas size, in pixels. */
export const VIEW = { width: 1280, height: 720 };

/** Height of the HUD bar across the top, in pixels. */
export const HUD_HEIGHT = 64;

/** localStorage key for the best score. */
export const BEST_KEY = 'emberkeeper.best';

/** localStorage key for the mute setting. */
export const MUTE_KEY = 'emberkeeper.muted';

/** The light meter: 100 at full, 0 and the dark takes you. */
export const LIGHT_MAX = 100;

/** How fast the wisp slides across the maze, in cells per second. */
export const PLAYER_SPEED = 7;

/** How fast a shadow drifts across the maze, in cells per second. */
export const SHADOW_SPEED = 1.75;

/** How far away, in cells, a shadow notices the wisp and gives chase. */
export const SHADOW_CHASE_RANGE = 3;

/** Light lost every second to the dark, plus a little more on each level. */
export const LIGHT_DRAIN_BASE = 0.9;
export const LIGHT_DRAIN_PER_LEVEL = 0.04;

/** Light a shadow's touch costs, and how long the wisp is safe afterwards. */
export const HIT_DAMAGE = 20;
export const INVULN_SECONDS = 1.5;

/** What one ember is worth: light back, and points. */
export const EMBER_LIGHT = 25;
export const EMBER_POINTS = 10;

/** Points for lighting a lantern. */
export const LANTERN_POINTS = 100;

/** Level-clear bonus: a flat award plus five points per light left. */
export const CLEAR_BASE_POINTS = 250;
export const CLEAR_LIGHT_POINTS = 5;

/** Pickups inside this window chain into a combo; the multiplier caps at x3. */
export const COMBO_WINDOW = 2.5;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;

/** The game's palette: a deep indigo night against warm amber light. */
export const PALETTE = {
  night: '#070a18',
  nightEdge: '#0b0f24',
  floor: '#171c33',
  floorAlt: '#1b2140',
  wall: '#2c3358',
  wallTop: '#454f7d',
  wallEdge: '#141830',
  hud: '#0a0d1f',
  hudLine: '#232a4d',
  text: '#f4ead2',
  textDim: '#9aa3c7',
  ember: '#ffb347',
  emberCore: '#ffe9a8',
  lanternLit: '#ffc95e',
  lanternUnlit: '#5a6285',
  exitClosed: '#3a4166',
  exitOpen: '#7dffb0',
  shadow: '#241a3d',
  shadowEye: '#c86bff',
  danger: '#ff5d6c',
  wisp: '#fff3c4',
};
