/**
 * Keyframe interpolation primitives shared by the animator, camera and props.
 * Pure functions only (no Three.js, no DOM) so they run identically in Node tests
 * and in the browser renderer.
 */

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpArray = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

export const Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  smoothstep: (t) => t * t * (3 - 2 * t),
  smootherstep: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

export function ease(name, t) {
  const fn = Easing[name];
  if (!fn) throw new Error(`Unknown easing "${name}"`);
  return fn(clamp(t));
}

/**
 * A track of keyframes `{ time, value, ease? }` where value is a number or an array of numbers.
 * `ease` on a key describes the curve used when interpolating *into* that key.
 */
export class KeyframeTrack {
  constructor(keys) {
    if (!Array.isArray(keys) || keys.length === 0) throw new Error('KeyframeTrack needs at least one key');
    this.keys = [...keys].sort((a, b) => a.time - b.time);
  }

  valueAt(t) {
    const k = this.keys;
    if (t <= k[0].time) return k[0].value;
    const last = k[k.length - 1];
    if (t >= last.time) return last.value;
    let i = 1;
    while (k[i].time < t) i++;
    const a = k[i - 1], b = k[i];
    const span = b.time - a.time;
    const p = span > 0 ? ease(b.ease || 'easeInOutCubic', (t - a.time) / span) : 1;
    return Array.isArray(a.value) ? lerpArray(a.value, b.value, p) : lerp(a.value, b.value, p);
  }
}

/** Blend two flat objects of numbers (poses, camera states). Keys missing in `b` keep `a`. */
export function lerpObject(a, b, t) {
  const out = { ...a };
  for (const key of Object.keys(b)) {
    const va = a[key], vb = b[key];
    if (typeof vb === 'number' && typeof va === 'number') out[key] = lerp(va, vb, t);
    else if (Array.isArray(vb) && Array.isArray(va)) out[key] = lerpArray(va, vb, t);
    else out[key] = t < 0.5 ? va : vb;
  }
  return out;
}
