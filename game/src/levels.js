// Emberkeeper's eight levels, drawn as text maps. One character per cell:
//   # wall   . floor   P the wisp's start   L lantern   F flare lantern
//   E ember   S shadow's start   W wraith's start   X the exit gate
//   (the gate opens once every lantern burns)
//
// A flare lantern counts toward the gate like any lantern, but kindling one
// bursts bright enough to freeze every shadow and wraith for a few seconds.
// A wraith ignores the walls entirely, so its start only needs to sit on a
// floor cell the wisp could reach — the load-time check below still asks for
// exactly that, so no level can strand the player behind a wall.

export const LEVELS = [
  {
    name: 'First Light',
    rows: [
      '###############',
      '#P...E....#..L#',
      '#..##.....#...#',
      '#..#..##E.#..##',
      '#.....#......##',
      '#.##..#..E....#',
      '#.#...####.##.#',
      '#...S....#...X#',
      '###############',
    ],
  },
  {
    name: 'Crossroads',
    rows: [
      '#################',
      '#P....#....E...L#',
      '#.##..#..###.#..#',
      '#.#..E#.S..#.#..#',
      '#.#.#####..#.#..#',
      '#...#......#...L#',
      '###.#.#.#.###.###',
      '#E..#...#.....#.#',
      '#.#####.###.#.#.#',
      '#..S....#E..#..X#',
      '#################',
    ],
  },
  {
    name: 'The Long Dark',
    rows: [
      '###################',
      '#P..E....#...#..L.#',
      '#.###.##.#.##.#.#.#',
      '#...#..E.#..S.....#',
      '###.####.#####.####',
      '#E....#....#..F...#',
      '#.##..#...#..#.##.#',
      '#.#S..#...E..#.L.##',
      '#.#.###..#..##.####',
      '#...S...#E...#...X#',
      '###################',
    ],
  },
  {
    name: 'Shadow Court',
    rows: [
      '#####################',
      '#P...E.....#...#...L#',
      '#.####.###.#.#.#.#.##',
      '#.#...W...E#...#.S..#',
      '#.#.##.#.###.#####..#',
      '#.E.#..#.....#...L#.#',
      '#####.####.#.#.##.#.#',
      '#E..S.#....#.....F..#',
      '#.###.#.####.###.##.#',
      '#.#.E.#......#.L#..S#',
      '#.#.#####.##.#.##.#.#',
      '#..S...#..E.....#..X#',
      '#####################',
    ],
  },
  {
    name: 'Emberdeep',
    rows: [
      '#####################',
      '#P..E...#.....#....L#',
      '#.##.#..#..##.#.##..#',
      '#.EE.#..#.S#..#..#.L#',
      '#.####..#..#..##.#..#',
      '#.#F....#..#..E..#..#',
      '#.#.#####..#####.#.##',
      '#WE.#....E...S#....##',
      '#.###...###.#.##.#..#',
      '#E#.E.#...#.#.L..S###',
      '#.#.#.#...#.#.#.#...#',
      '#..S...#E..#..L#...X#',
      '#####################',
    ],
  },
  {
    name: 'Wraith Hollow',
    rows: [
      '######################',
      '#P...#..L..E....#...L#',
      '#.##.#..##..E...#.#..#',
      '#..#.#..#..S....#.#F.#',
      '#..#....#..L...##....#',
      '#E..##..####..#...##.#',
      '#...#...W.E.#.#.S....#',
      '#.###.#####.#.###.##.#',
      '#...#.....#.#..S..#..#',
      '#.#.#..E..#..##.#S#E.#',
      '#.#..####...S..L#....#',
      '#L...#...E....#..E..X#',
      '######################',
    ],
  },
  {
    name: 'The Hollow Choir',
    rows: [
      '######################',
      '#P....#....E.....#..L#',
      '#.##..#..##.##.S.#...#',
      '#..#..E..#..L#..##.#.#',
      '#..####..#.#.#E.#..#.#',
      '#E..L....#...#..#W.#.#',
      '#.#####..#####..#.S..#',
      '#..E..#....S....###.##',
      '#.##..#..#####......L#',
      '#.#F..E..#..W..#.##..#',
      '#.#.#####..S...#..#E.#',
      '#L......E....#..S...X#',
      '######################',
    ],
  },
  {
    name: "Dawn's Door",
    rows: [
      '##########################',
      '#P.....#......E......#..L#',
      '#.###..#..####..###.S#.#.#',
      '#...#..E..#..S....#..#...#',
      '#.#.#..####..#.E..#..###.#',
      '#.#....E.....#..W....#F..#',
      '#.#####..##.E#..####.#.#.#',
      '#.....#.....E..L...#...#.#',
      '#.##..#..#######.#.###.#.#',
      '#..#..E..#..L..#.#..S....#',
      '#..####..#..S..#.#.#####.#',
      '#E......W....E...#...L...#',
      '#.####.######.S#.#.#.###.#',
      '#..S...E....L..#..F..E..X#',
      '##########################',
    ],
  },
];

/**
 * Turn a level's text rows into the grid the world steps on. Throws when the
 * rows are not a rectangle, when a start or an exit is missing, or when any
 * lantern, ember, shadow, wraith or the exit cannot be reached from the start.
 */
export function parseLevel(definition) {
  const rows = definition.rows;
  const height = rows.length;
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`Level ${definition.name}: row ${JSON.stringify(row)} is ${row.length} wide, expected ${width}`);
    }
  }
  const solid = [];
  let start = null;
  let exit = null;
  const lanterns = [];
  const embers = [];
  const shadows = [];
  const wraiths = [];
  for (let y = 0; y < height; y += 1) {
    solid.push(new Array(width).fill(false));
    for (let x = 0; x < width; x += 1) {
      const cell = rows[y][x];
      if (cell === '#') solid[y][x] = true;
      else if (cell === 'P') start = { x, y };
      else if (cell === 'X') exit = { x, y };
      else if (cell === 'L') lanterns.push({ x, y, lit: false, flare: false });
      else if (cell === 'F') lanterns.push({ x, y, lit: false, flare: true });
      else if (cell === 'E') embers.push({ x, y, taken: false });
      else if (cell === 'S') shadows.push({ x, y });
      else if (cell === 'W') wraiths.push({ x, y });
      else if (cell !== '.') throw new Error(`Level ${definition.name}: unknown cell ${JSON.stringify(cell)} at ${x},${y}`);
    }
  }
  if (start === null) throw new Error(`Level ${definition.name}: no player start`);
  if (exit === null) throw new Error(`Level ${definition.name}: no exit`);
  for (const target of [...lanterns, ...embers, ...shadows, ...wraiths, exit]) {
    if (!reachable(solid, width, height, start, target)) {
      throw new Error(`Level ${definition.name}: ${target.x},${target.y} cannot be reached from the start`);
    }
  }
  return { name: definition.name, width, height, solid, start, exit, lanterns, embers, shadows, wraiths };
}

/** Breadth-first reachability over floor cells, used by the load-time check. */
export function reachable(solid, width, height, from, to) {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [{ x: from.x, y: from.y }];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell.x === to.x && cell.y === to.y) return true;
    for (const step of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) continue;
      if (solid[next.y][next.x] || seen.has(`${next.x},${next.y}`)) continue;
      seen.add(`${next.x},${next.y}`);
      queue.push(next);
    }
  }
  return false;
}

/**
 * The shortest walk between two floor cells, as a list of steps, or null when
 * no walk exists. The autopilot and the shadow chase both walk this.
 */
export function findPath(solid, width, height, from, to) {
  if (from.x === to.x && from.y === to.y) return [];
  const key = (cell) => `${cell.x},${cell.y}`;
  const cameFrom = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length > 0) {
    const cell = queue.shift();
    for (const step of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) continue;
      if (solid[next.y][next.x] || cameFrom.has(key(next))) continue;
      cameFrom.set(key(next), cell);
      if (next.x === to.x && next.y === to.y) {
        const path = [next];
        let at = cell;
        while (at !== null && !(at.x === from.x && at.y === from.y)) {
          path.unshift(at);
          at = cameFrom.get(key(at));
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}
