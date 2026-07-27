export function createRng(seed = Date.now()) {
  let state = seed >>> 0;

  return function rng() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pick(items, rng) {
  return items[Math.floor(rng() * items.length)];
}
