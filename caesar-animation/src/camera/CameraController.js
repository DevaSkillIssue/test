/**
 * Cinematic camera system.
 *
 * A scene's camera is a list of shot segments (from Timeline: start shot + cuts). Each segment
 * has a framing (`shot`), an `angle`, a subject (`target`: cast id or "group") and a `move`
 * that progresses over the segment with easing. Cuts are hard unless `blend` > 0, in which
 * case the camera eases from the previous framing. Shake and the whip/zoom scene transitions
 * are layered on top. `evaluateCamera` is a pure function of time; `applyCamera` writes the
 * result into a THREE.PerspectiveCamera.
 *
 * World convention: y up, ground at y = 0, the "front" camera looks down -z.
 */
import { clamp, lerp, lerpArray, Easing } from '../animation/Keyframes.js';
import { smoothNoise } from '../util/random.js';

/** dist: metres from subject; height: camera height; look: aim height; fov: vertical degrees. */
export const SHOTS = {
  extreme_wide: { dist: 17, height: 5.0, look: 1.2, fov: 50 },
  wide: { dist: 10, height: 2.8, look: 1.1, fov: 46 },
  full: { dist: 6.5, height: 1.7, look: 1.0, fov: 42 },
  medium: { dist: 4.2, height: 1.5, look: 1.15, fov: 40 },
  close: { dist: 2.2, height: 1.55, look: 1.45, fov: 36 },
  extreme_close: { dist: 1.25, height: 1.6, look: 1.55, fov: 32 },
};

/** yaw: radians around the subject (+ = camera swings to +x); roll for dutch angles. */
export const ANGLES = {
  front: { yaw: 0, heightAdd: 0, heightMul: 1, lookAdd: 0, roll: 0 },
  low: { yaw: 0, heightAdd: 0, heightMul: 0.25, lookAdd: 0.45, roll: 0 },
  high: { yaw: 0, heightAdd: 2.5, heightMul: 1.6, lookAdd: -0.25, roll: 0 },
  left: { yaw: -0.6, heightAdd: 0, heightMul: 1, lookAdd: 0, roll: 0 },
  right: { yaw: 0.6, heightAdd: 0, heightMul: 1, lookAdd: 0, roll: 0 },
  dutch: { yaw: 0.25, heightAdd: 0, heightMul: 1, lookAdd: 0, roll: 0.14 },
};

export const MOVES = [
  'static', 'track', 'dolly_in', 'dolly_out', 'push_in', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right',
  'truck_left', 'truck_right', 'tilt_up', 'tilt_down', 'crane_up', 'crane_down', 'orbit_left', 'orbit_right', 'handheld',
];

const TRACK_LAG_SAMPLES = 6;
const TRACK_LAG_STEP = 0.1;

/**
 * @param sceneTl    compiled scene (Timeline.compileTimeline().scenes[i])
 * @param t          absolute time
 * @param subjectPos (targetId, time) -> [x, y, z]  subject position lookup ("group" handled by caller)
 * @param fx         { whip, zoom } from Timeline.transitionState
 * @param opts       { handheld: amplitude in metres, seed }
 */
export function evaluateCamera(sceneTl, t, subjectPos, fx = { whip: 0, zoom: 0 }, opts = {}) {
  const segs = sceneTl.camera.segments;
  let i = 0;
  for (let k = 0; k < segs.length; k++) if (t >= segs[k].start) i = k;
  let state = segmentState(segs[i], t, subjectPos);
  const seg = segs[i];
  if (i > 0 && seg.blend > 0 && t < seg.start + seg.blend) {
    const prev = segmentState(segs[i - 1], t, subjectPos);
    const w = Easing.easeInOutCubic((t - seg.start) / seg.blend);
    state = {
      position: lerpArray(prev.position, state.position, w),
      lookAt: lerpArray(prev.lookAt, state.lookAt, w),
      fov: lerp(prev.fov, state.fov, w),
      roll: lerp(prev.roll, state.roll, w),
    };
  }

  // Shake events: decaying, deterministic noise.
  const seed = opts.seed ?? 0;
  let shake = 0;
  (sceneTl.camera.shake || []).forEach((s, n) => {
    const u = (t - s.start) / s.duration;
    if (u < 0 || u > 1) return;
    const env = (1 - u) * (1 - u) * s.intensity;
    shake += env;
    const k = 0.28 * env;
    state.position = [
      state.position[0] + k * smoothNoise(t * 31, seed + n * 13),
      state.position[1] + k * 0.8 * smoothNoise(t * 29, seed + n * 13 + 5),
      state.position[2],
    ];
    state.lookAt = [state.lookAt[0] + k * 0.5 * smoothNoise(t * 27, seed + n * 13 + 9), state.lookAt[1], state.lookAt[2]];
  });
  state.roll += 0.04 * shake * smoothNoise(t * 23, seed + 3);

  // Subtle handheld breathing so held shots never look frozen.
  const hh = (opts.handheld ?? 0.012) * (seg.move === 'handheld' ? 4 : 1);
  state.position = [
    state.position[0] + hh * smoothNoise(t * 0.9, seed + 21),
    state.position[1] + hh * smoothNoise(t * 1.1, seed + 37),
    state.position[2],
  ];

  // Scene transitions: whip pan swings the aim sideways; zoom punches the lens in/out.
  if (fx.whip) {
    const right = rightVector(state.position, state.lookAt);
    const dist = Math.hypot(...state.lookAt.map((v, k) => v - state.position[k]));
    state.lookAt = state.lookAt.map((v, k) => v + right[k] * fx.whip * dist * 1.6);
  }
  if (fx.zoom) state.fov = clamp(state.fov * (1 - 0.45 * fx.zoom), 8, 100);
  // Indoor sets have a ceiling: keep the camera (and its aim) under it.
  if (opts.maxHeight !== undefined) {
    state.position[1] = Math.min(state.position[1], opts.maxHeight);
    state.lookAt[1] = Math.min(state.lookAt[1], opts.maxHeight - 0.3);
  }
  return state;
}

function segmentState(seg, t, subjectPos) {
  const shot = SHOTS[seg.shot];
  if (!shot) throw new Error(`unknown shot "${seg.shot}"`);
  const angle = ANGLES[seg.angle || 'front'];
  if (!angle) throw new Error(`unknown camera angle "${seg.angle}"`);
  if (!MOVES.includes(seg.move)) throw new Error(`unknown camera move "${seg.move}"`);
  const span = Math.max(seg.end - seg.start, 1e-3);
  const p = Easing.easeInOutQuad(clamp((t - seg.start) / span));

  // Subject: tracked (lagged average, deterministic) or frozen at the segment start.
  let subject;
  if (seg.move === 'track') {
    subject = [0, 0, 0];
    for (let k = 0; k < TRACK_LAG_SAMPLES; k++) {
      const sp = subjectPos(seg.target, Math.max(seg.start, t - k * TRACK_LAG_STEP));
      subject = subject.map((v, j) => v + sp[j] / TRACK_LAG_SAMPLES);
    }
  } else {
    subject = subjectPos(seg.target, seg.start);
  }

  let dist = shot.dist, height = shot.height * angle.heightMul + angle.heightAdd, look = shot.look + angle.lookAdd;
  let fov = shot.fov, yaw = angle.yaw, lateralCam = 0, lateralLook = 0;
  switch (seg.move) {
    case 'dolly_in': dist *= lerp(1.3, 0.82, p); break;
    case 'dolly_out': dist *= lerp(0.82, 1.3, p); break;
    case 'push_in': dist *= lerp(1.1, 0.9, p); break;
    case 'zoom_in': fov *= lerp(1.15, 0.72, p); break;
    case 'zoom_out': fov *= lerp(0.72, 1.15, p); break;
    case 'pan_left': lateralLook = lerp(1.1, -1.1, p); break;
    case 'pan_right': lateralLook = lerp(-1.1, 1.1, p); break;
    case 'truck_left': lateralCam = lateralLook = lerp(1.4, -1.4, p); break;
    case 'truck_right': lateralCam = lateralLook = lerp(-1.4, 1.4, p); break;
    case 'tilt_up': look += lerp(-0.9, 0.9, p); break;
    case 'tilt_down': look += lerp(0.9, -0.9, p); break;
    case 'crane_up': height += lerp(-0.8, 2.6, p); break;
    case 'crane_down': height += lerp(2.6, -0.8, p); break;
    case 'orbit_left': yaw -= lerp(0, 0.75, p); break;
    case 'orbit_right': yaw += lerp(0, 0.75, p); break;
    default: break; // static, track, handheld
  }
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const position = [
    subject[0] + Math.sin(yaw) * dist + right[0] * lateralCam,
    Math.max(0.25, height),
    subject[2] + Math.cos(yaw) * dist + right[2] * lateralCam,
  ];
  const lookAt = [subject[0] + right[0] * lateralLook, look, subject[2] + right[2] * lateralLook];
  return { position, lookAt, fov, roll: angle.roll };
}

export function rightVector(position, lookAt) {
  const f = [lookAt[0] - position[0], 0, lookAt[2] - position[2]];
  const len = Math.hypot(f[0], f[2]) || 1;
  return [-f[2] / len, 0, f[0] / len];
}

/** Write a camera state into a THREE.PerspectiveCamera. */
export function applyCamera(camera, state) {
  camera.position.set(...state.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...state.lookAt);
  if (state.roll) camera.rotateZ(state.roll);
  if (camera.fov !== state.fov) {
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
  }
}
