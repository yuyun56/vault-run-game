// A tiny deterministic random source (mulberry32). A run is fully decided by
// its seed: the same seed always deals the same patrol phases and sparkle
// timings, which is what makes the screenshot scenes reproducible.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [0, n). */
    int(n) {
      return Math.floor(next() * n);
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
