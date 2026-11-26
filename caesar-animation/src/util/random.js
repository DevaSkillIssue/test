/**
 * Deterministic pseudo-random helpers. Rendering must never call Math.random():
 * every "random" choice (window lights, tree sizes, shake phases) comes from a seed
 * so the same story renders identical frames every run.
 */

/** mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function seededRandom(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a), used to derive per-object seeds. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Smooth deterministic 1D noise in roughly [-1, 1] built from incommensurate sines. */
export function smoothNoise(t, seed = 0) {
  const p = (seed % 1000) * 0.6180339887;
  return (
    Math.sin(t * 1.0 + p) * 0.5 +
    Math.sin(t * 2.31 + p * 1.7) * 0.3 +
    Math.sin(t * 4.67 + p * 2.9) * 0.2
  );
}
