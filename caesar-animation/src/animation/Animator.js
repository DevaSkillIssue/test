/**
 * Character animator: evaluates a character's full state at an absolute time t.
 *
 * - Actions are timeline events ({ action, start, duration, target?, expression?, facing? }).
 * - Each action produces a pose from keyframed partial poses (one-shot actions) or
 *   closed-form cycles (walk/run/talk/...). Poses blend for BLEND seconds at every change.
 * - Moving actions (walk/run/jump/fall with a target) produce position segments; the gait
 *   phase is driven by distance travelled, so feet don't slide.
 * - Everything is a pure function of (compiled timeline, t): the same t always gives the
 *   same state, which is what makes offline frame rendering deterministic.
 */
import { BASE_POSE } from '../characters/Character.js';
import { clamp, lerpObject, Easing } from './Keyframes.js';

const BLEND = 0.2;
const TAU = Math.PI * 2;
const P = (o) => ({ ...BASE_POSE, ...o });

/** Interpolate keyed partial poses: keys = [[progress, partialPose], ...]. */
function keyPose(p, keys) {
  if (p <= keys[0][0]) return P(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, a] = keys[i - 1], [p1, b] = keys[i];
      return lerpObject(P(a), P(b), Easing.smoothstep((p - p0) / (p1 - p0)));
    }
  }
  return P(keys[keys.length - 1][1]);
}

function idlePose(t) {
  const b = Math.sin(t * 2.1);
  return P({ lean: 0.02 * b, head: 0.03 * Math.sin(t * 0.8), aLs: 0.14 + 0.03 * b, aRs: -0.12 - 0.03 * b });
}

function gait(phase, c) {
  const s = Math.sin(phase);
  return P({
    lHip: c.hip * s, rHip: -c.hip * s,
    lKnee: c.kneeBase + c.knee * Math.max(0, Math.cos(phase)),
    rKnee: c.kneeBase + c.knee * Math.max(0, Math.cos(phase + Math.PI)),
    aLs: -c.arm * s, aRs: c.arm * s, aLe: c.elbow, aRe: c.elbow,
    lean: c.lean, head: -c.lean * 0.4,
  });
}

const ramp = (lt, dur, inT = 0.25, outT = 0.25) =>
  Easing.smoothstep(clamp(lt / inT)) * Easing.smoothstep(clamp((dur - lt) / outT));

const SIT = { lean: -0.05, lHip: 1.55, lKnee: 1.55, rHip: 1.45, rKnee: 1.5, aLs: 0.75, aLe: 0.5, aRs: 0.65, aRe: 0.6 };
const LYING = { rot: 1.57, aLs: 3.05, aRs: 2.95, lHip: -0.1, lKnee: 0.3, rHip: 0.05, rKnee: 0.35, head: -0.1 };

/**
 * Action library. pose(lt, dur, p, ctx) -> pose. `hold`: keep the final pose after the action
 * ends (instead of blending back to idle). `stride`: metres per gait cycle for moving actions.
 * `expression`: default face while the action runs (string or fn(p)).
 */
export const ACTIONS = {
  idle: { pose: (lt, d, p, c) => idlePose(c.t) },
  talk: {
    pose: (lt) => P({
      aLs: 0.7 + 0.35 * Math.sin(lt * 3.1), aLe: 1.0 + 0.3 * Math.sin(lt * 4.3),
      aRs: -0.1 + 0.15 * Math.sin(lt * 2.3), aRe: 0.3,
      head: 0.06 * Math.sin(lt * 5), mouth: Math.abs(Math.sin(lt * 11)) * 0.9,
    }),
  },
  walk: {
    moves: true, stride: 1.25,
    pose: (lt, d, p, c) => gait(c.phase, { hip: 0.42, knee: 0.7, kneeBase: 0.05, arm: 0.38, elbow: 0.25, lean: 0.07 }),
  },
  run: {
    moves: true, stride: 2.6,
    pose: (lt, d, p, c) => gait(c.phase, { hip: 0.8, knee: 1.45, kneeBase: 0.2, arm: 0.95, elbow: 1.5, lean: 0.3 }),
  },
  jump: {
    moves: true,
    pose: (lt, d, p, c) => {
      const pose = keyPose(p, [
        [0, {}],
        [0.22, { lHip: 0.75, lKnee: 1.5, rHip: 0.65, rKnee: 1.4, lean: 0.3, aLs: -0.7, aRs: -0.8 }],
        [0.34, { lHip: -0.1, lKnee: 0.05, rHip: -0.2, rKnee: 0.1, lean: 0.05, aLs: 2.7, aRs: 2.5, aLe: 0.1, aRe: 0.1 }],
        [0.56, { lHip: 0.7, lKnee: 1.2, rHip: 0.5, rKnee: 1.1, aLs: 2.4, aRs: 2.2, aLe: 0.4, aRe: 0.4 }],
        [0.8, { lHip: 0.15, lKnee: 0.2, rHip: -0.1, rKnee: 0.2, aLs: 1.4, aRs: 1.2 }],
        [0.9, { lHip: 0.6, lKnee: 1.2, rHip: 0.5, rKnee: 1.1, lean: 0.25, aLs: 0.8, aRs: 0.6 }],
        [1, {}],
      ]);
      if (p > 0.3 && p < 0.82) pose.rootY = 0.6 * (c.intensity ?? 1) * Math.sin(Math.PI * (p - 0.3) / 0.52);
      return pose;
    },
  },
  fall: {
    moves: true, hold: true,
    expression: (p) => (p < 0.72 ? 'scared' : 'dizzy'),
    pose: (lt, d, p) => {
      const pose = keyPose(p, [
        [0, {}],
        [0.2, { rot: 0.25, lean: 0.1, aLs: 1.8, aRs: -0.6, aLe: 0.6, lHip: -0.4, rHip: 0.5, rKnee: 0.6 }],
        [0.45, { rot: 0.7, aLs: 2.6, aRs: 2.2, lHip: -0.6, lKnee: 0.2, rHip: -0.3, rKnee: 0.8, head: -0.3 }],
        [0.72, { rot: 1.5, aLs: 2.9, aRs: 2.7, aLe: 0.3, lHip: -0.3, lKnee: 0.6, rHip: -0.1, rKnee: 0.9, head: -0.4 }],
        [0.85, { rot: 1.57, aLs: 3.0, aRs: 2.9, lHip: -0.4, lKnee: 0.9, rHip: -0.2, rKnee: 1.1, head: -0.2 }],
        [1, LYING],
      ]);
      const flail = clamp((p - 0.08) / 0.1) * clamp((0.7 - p) / 0.1);
      pose.aLs += 0.45 * Math.sin(lt * 26) * flail;
      pose.aRs += 0.45 * Math.sin(lt * 23 + 1) * flail;
      if (p > 0.72 && p < 0.92) pose.rootY = 0.07 * Math.sin(Math.PI * (p - 0.72) / 0.2);
      return pose;
    },
  },
  get_up: {
    expression: (p) => (p < 0.6 ? 'dizzy' : 'neutral'),
    pose: (lt, d, p) => keyPose(p, [
      [0, LYING],
      [0.35, { rot: 1.2, aLs: 1.7, aLe: -0.3, aRs: 1.6, aRe: -0.3, lHip: -0.1, lKnee: 0.4, rHip: 0, rKnee: 0.5 }],
      [0.65, { rot: 0.45, lHip: 1.2, lKnee: 1.8, rHip: 0.6, rKnee: 1.0, aLs: 0.8, aRs: 0.5, lean: 0.2 }],
      [1, {}],
    ]),
  },
  sleep: {
    hold: true, expression: 'sleepy',
    pose: (lt) => P({ rot: -1.57, aLs: 0.1, aRs: 0.05, lHip: 0, lKnee: 0.05, rHip: 0, rKnee: 0.1, lean: 0.03 * Math.sin(lt * 1.4) }),
  },
  sit: { hold: true, pose: (lt, d, p) => keyPose(p, [[0, {}], [0.5, { lean: 0.25, lHip: 1.0, lKnee: 0.9, rHip: 0.9, rKnee: 0.8, aLs: 0.5, aRs: 0.4 }], [1, SIT]]) },
  stand_up: { pose: (lt, d, p) => keyPose(p, [[0, SIT], [0.5, { lean: 0.35, lHip: 0.9, lKnee: 0.9, rHip: 0.8, rKnee: 0.8 }], [1, {}]]) },
  look_around: {
    expression: 'thinking',
    pose: (lt, d) => {
      const r = ramp(lt, d, 0.3, 0.3);
      return lerpObject(idlePose(lt), { aLs: 2.35, aLe: 2.1, lean: 0.08, lookX: Math.sin(lt * 2.4), head: 0.08 * Math.sin(lt * 1.2) }, r);
    },
    facing: (lt, d) => (Math.floor(lt / Math.max(0.4, d / 3)) % 2 === 0 ? 1 : -1),
  },
  look_down: { hold: true, pose: (lt, d, p) => keyPose(p, [[0, {}], [1, { head: 0.55, lean: 0.12, lookX: 0.3, aLs: 0.25, aRs: -0.05 }]]) },
  point: {
    hold: true,
    pose: (lt, d, p, c) => {
      const elev = c.pointElevation ?? 0;
      const r = Easing.smoothstep(clamp(lt / 0.25));
      return lerpObject(P({}), { aLs: 1.57 + elev, aLe: 0, aRs: -0.25, aRe: 1.1, lean: 0.05 }, r);
    },
  },
  wave: {
    expression: 'happy', facing: () => 0,
    pose: (lt, d) => lerpObject(idlePose(lt), { aLs: 2.6, aLe: 0.35 * Math.sin(lt * 10) }, ramp(lt, d, 0.2, 0.2)),
  },
  celebrate: {
    expression: 'happy',
    pose: (lt) => P({
      aLs: 2.75, aRs: 2.55, aLe: 0.45 + 0.4 * Math.sin(lt * 12), aRe: 0.45 + 0.4 * Math.sin(lt * 12 + 1),
      rootY: 0.18 * Math.abs(Math.sin(lt * 6)), mouth: 0.6,
    }),
  },
  shock: {
    expression: 'surprised',
    pose: (lt, d, p) => {
      const pose = keyPose(p, [
        [0, {}],
        [0.15, { lean: -0.25, aLs: 2.3, aRs: 2.0, aLe: 0.7, aRe: 0.7, lHip: -0.2, rHip: 0.2 }],
        [1, { lean: -0.12, aLs: 1.9, aRs: 1.7, aLe: 0.9, aRe: 0.9 }],
      ]);
      if (lt < 0.35) pose.rootY = 0.28 * Math.sin(Math.PI * lt / 0.35);
      return pose;
    },
  },
  sad: {
    expression: 'sad',
    pose: (lt) => P({ lean: 0.3 + 0.03 * Math.sin(lt * 1.3), head: 0.45, aLs: 0.05, aLe: 0.05, aRs: -0.02, aRe: 0.05 }),
  },
  angry: {
    expression: 'angry',
    pose: (lt) => P({ aLs: 0.55, aLe: 1.7, aRs: 0.45, aRe: 1.6, lean: 0.12 + 0.04 * Math.sin(lt * 30) }),
  },
  arms_crossed: { expression: 'smug', hold: true, pose: (lt) => P({ aLs: 0.25, aLe: 1.9, aRs: 0.3, aRe: 1.85, lean: -0.06, head: 0.04 * Math.sin(lt * 4) }) },
  facepalm: {
    expression: 'sad',
    pose: (lt, d, p) => keyPose(p, [[0, {}], [0.3, { aLs: 2.2, aLe: 2.15, head: 0.35, lean: 0.1 }], [0.85, { aLs: 2.2, aLe: 2.15, head: 0.42, lean: 0.14 }], [1, {}]]),
  },
  shrug: {
    pose: (lt, d, p) => keyPose(p, [[0, {}], [0.3, { aLs: 0.6, aLe: 2.0, aRs: -0.5, aRe: 1.9, head: -0.15 }], [0.8, { aLs: 0.6, aLe: 2.0, aRs: -0.5, aRe: 1.9, head: 0.12 }], [1, {}]]),
  },
  think: {
    expression: 'thinking',
    pose: (lt) => P({ aLs: 1.25, aLe: 2.45 + 0.06 * Math.sin(lt * 6), aRs: 0.5, aRe: 1.5, head: -0.12, lookX: 0.5 }),
  },
  laugh: {
    expression: 'happy',
    pose: (lt) => P({ lean: -0.12 + 0.12 * Math.sin(lt * 14), aLs: 0.6, aLe: 1.6, aRs: 1.5 + 0.1 * Math.sin(lt * 14), aRe: 0.1, mouth: 0.7 + 0.3 * Math.abs(Math.sin(lt * 14)) }),
  },
  use_phone: {
    item: 'phone',
    pose: (lt) => P({ aLs: 1.15, aLe: 1.35 + 0.03 * Math.sin(lt * 9), head: 0.35, lean: 0.08, lookX: 0.2 }),
  },
};

export const ACTION_NAMES = Object.keys(ACTIONS);
const FACING = { left: -1, right: 1, camera: 0 };
const progressCurve = (p) => 0.6 * p + 0.4 * Easing.smoothstep(p);

/**
 * Per-scene animator. Build once per compiled scene; then call stateAt(id, t) every frame.
 */
export class SceneAnimator {
  constructor(sceneTl) {
    this.scene = sceneTl;
    this.chars = new Map();
    for (const c of sceneTl.data.characters) {
      const acts = sceneTl.actions.filter((a) => a.character === c.id).map((a) => ({ ...a }));
      for (const a of acts) {
        if (!ACTIONS[a.action]) throw new Error(`scene ${sceneTl.id}: unknown action "${a.action}"`);
      }
      if (c.action) {
        if (!ACTIONS[c.action]) throw new Error(`scene ${sceneTl.id}: unknown initial action "${c.action}"`);
        // Initial state (e.g. already sitting / sleeping when the scene opens), fully blended in.
        acts.unshift({ action: c.action, start: sceneTl.start - 100, duration: 1, synthetic: true });
      }
      this.chars.set(c.id, this.buildTracks(c, acts));
    }
  }

  buildTracks(c, acts) {
    let pos = [...c.position];
    let facing = FACING[c.facing ?? 'right'];
    let dist = 0;
    const segments = [];
    const facingKeys = [{ time: -Infinity, facing }];
    for (const a of acts) {
      const def = ACTIONS[a.action];
      // Any new action interrupts a motion still in progress: the character stops where it is
      // (no sliding through a reaction, no teleport when the next move starts).
      const last = segments[segments.length - 1];
      if (last && !a.synthetic && a.start < last.end && a.start >= last.start) {
        const p = progressCurve(clamp((a.start - last.start) / (last.end - last.start)));
        last.cut = a.start;
        last.cutPos = last.from.map((v, i) => v + (last.to[i] - v) * p);
        last.cutLen = last.len * p;
        pos = last.cutPos;
        dist = last.distBefore + last.cutLen;
      }
      if (def.moves && a.target) {
        const to = [...a.target];
        const len = Math.hypot(to[0] - pos[0], to[2] - pos[2]);
        segments.push({ start: a.start, end: a.start + a.duration, from: pos, to, len, distBefore: dist, action: a });
        if (Math.abs(to[0] - pos[0]) > 0.05) facing = Math.sign(to[0] - pos[0]);
        pos = to;
        dist += len;
      } else if (a.target && !def.moves) {
        if (Math.abs(a.target[0] - pos[0]) > 0.05) facing = Math.sign(a.target[0] - pos[0]);
      }
      if (a.facing) facing = FACING[a.facing];
      facingKeys.push({ time: a.start, facing, action: a });
    }
    return { def: c, acts, segments, facingKeys };
  }

  positionAt(id, t) {
    const tr = this.chars.get(id);
    if (!tr) throw new Error(`no character "${id}" in scene ${this.scene.id}`);
    let pos = tr.def.position, dist = 0, moving = null;
    for (const s of tr.segments) {
      if (s.cut !== undefined && t >= s.cut) { pos = s.cutPos; dist = s.distBefore + s.cutLen; continue; }
      if (t >= s.end) { pos = s.to; dist = s.distBefore + s.len; continue; }
      if (t >= s.start) {
        const p = progressCurve(clamp((t - s.start) / (s.end - s.start)));
        pos = s.from.map((v, i) => v + (s.to[i] - v) * p);
        dist = s.distBefore + s.len * p;
        moving = s;
      }
      break;
    }
    return { pos, dist, moving };
  }

  stateAt(id, t) {
    const tr = this.chars.get(id);
    if (!tr) throw new Error(`no character "${id}" in scene ${this.scene.id}`);
    const { pos, dist } = this.positionAt(id, t);
    const acts = tr.acts;
    let k = -1;
    for (let i = 0; i < acts.length; i++) if (acts[i].start <= t) k = i;

    const ctxFor = (a) => {
      const def = ACTIONS[a.action];
      const lt = t - a.start;
      let phase = 0;
      if (def.stride) {
        const seg = tr.segments.find((s) => s.action === a);
        phase = seg ? ((seg.distBefore + seg.len * progressCurve(clamp(lt / a.duration))) / def.stride) * TAU
          : lt * (def.stride > 2 ? 2.4 : 1.6) * TAU; // in-place gait
      }
      let pointElevation = 0;
      if (a.target) {
        const dx = Math.hypot(a.target[0] - pos[0], a.target[2] - pos[2]);
        pointElevation = clamp(Math.atan2(a.target[1] - 1.4, Math.max(dx, 0.1)), -0.8, 0.8);
      }
      return { t, phase, intensity: a.intensity, pointElevation, distance: dist };
    };
    const actionPose = (a, lt) => {
      const def = ACTIONS[a.action];
      return def.pose(lt, a.duration, clamp(lt / a.duration), ctxFor(a));
    };
    const rawPose = (i) => {
      const a = acts[i], def = ACTIONS[a.action];
      const lt = t - a.start;
      if (lt <= a.duration || def.hold || a.synthetic) return actionPose(a, lt);
      const w = Easing.smoothstep(clamp((lt - a.duration) / BLEND));
      return lerpObject(actionPose(a, a.duration), idlePose(t), w);
    };

    let pose;
    if (k < 0) pose = idlePose(t);
    else {
      pose = rawPose(k);
      const since = t - acts[k].start;
      if (since < BLEND) pose = lerpObject(k > 0 ? rawPose(k - 1) : idlePose(t), pose, Easing.smoothstep(since / BLEND));
    }

    // Expression: explicit expressions persist; action defaults apply only while the action runs.
    let expression = tr.def.expression || 'neutral';
    for (let i = 0; i <= k; i++) if (acts[i].expression) expression = acts[i].expression;
    let item = null;
    if (k >= 0) {
      const a = acts[k], def = ACTIONS[a.action];
      const lt = t - a.start;
      const active = lt <= a.duration || def.hold || a.synthetic;
      if (active && !a.expression && def.expression) {
        expression = typeof def.expression === 'function' ? def.expression(clamp(lt / a.duration)) : def.expression;
      }
      if (active && def.item) item = def.item;
    }

    // Facing: last facing key at or before t; some actions modulate it while active.
    let facing = tr.facingKeys[0].facing;
    for (const f of tr.facingKeys) if (f.time <= t) facing = f.facing;
    if (k >= 0) {
      const a = acts[k], def = ACTIONS[a.action], lt = t - a.start;
      if (def.facing && !a.facing && lt <= a.duration) {
        const m = def.facing(lt, a.duration);
        facing = m === 0 ? 0 : (facing === 0 ? m : facing * m);
      }
    }

    return { id, position: pos, pose, expression, facing, item };
  }
}
