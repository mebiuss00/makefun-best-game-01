// A small seeded generator (mulberry32) so a level, a screenshot scene and a
// playtest always play the same way from the same seed.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from the generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one entry of `list` from the generator. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
