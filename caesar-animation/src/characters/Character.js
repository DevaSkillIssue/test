/**
 * Stickman character model: template resolution + 2D skeleton solving.
 *
 * Coordinate system (character space, in world units / metres):
 *   +x = the direction the character faces, +y = up, origin = pelvis before grounding.
 * Joint angles are measured from "straight down"; positive rotates toward +x (forward).
 * The skeleton is grounded so its lowest point (feet, knees, pelvis or head) touches y = 0;
 * jumps are applied by the renderer as a separate world-space offset (pose.rootY).
 *
 * Pure module: no DOM, no Three.js.
 */

export const DEFAULT_PROPORTIONS = {
  headR: 0.17,
  neck: 0.05,
  torso: 0.55,
  upperArm: 0.3,
  forearm: 0.28,
  thigh: 0.42,
  shin: 0.42,
  foot: 0.11,
  lineWidth: 0.065,
};

/** The neutral standing pose every action starts from and blends back to. */
export const BASE_POSE = Object.freeze({
  rootY: 0, rot: 0, lean: 0, head: 0, lookX: 0, mouth: 0,
  aLs: 0.14, aLe: 0.12, aRs: -0.12, aRe: 0.12,
  lHip: 0.06, lKnee: 0.04, rHip: -0.06, rKnee: 0.04,
});

/** Merge a cast entry with its template from config/characters.json. */
export function resolveCharacter(castEntry, templates) {
  const tpl = templates[castEntry.template];
  if (!tpl) throw new Error(`Unknown character template "${castEntry.template}" for "${castEntry.id}"`);
  const merged = { ...tpl, ...(castEntry.overrides || {}) };
  return {
    id: castEntry.id,
    name: castEntry.name || castEntry.id,
    color: merged.color,
    headFill: merged.head_fill || '#ffffff',
    accessory: merged.accessory || 'none',
    accent: merged.accent || merged.color,
    outline: merged.outline || 'rgba(255,255,255,0.9)',
    scale: merged.scale || 1,
    proportions: { ...DEFAULT_PROPORTIONS, ...(merged.proportions || {}) },
  };
}

const dir = (theta) => [Math.sin(theta), -Math.cos(theta)];
const add = (p, v, len) => [p[0] + v[0] * len, p[1] + v[1] * len];

/** Solve joint positions for a pose. Returns points in character space, grounded at y = 0. */
export function solveSkeleton(pose, prop = DEFAULT_PROPORTIONS) {
  const P = prop;
  const pelvis = [0, 0];
  const up = [Math.sin(pose.lean), Math.cos(pose.lean)];
  const neckBase = add(pelvis, up, P.torso);
  const shoulder = add(pelvis, up, P.torso * 0.9);
  const headDir = [Math.sin(pose.lean + pose.head), Math.cos(pose.lean + pose.head)];
  const head = add(neckBase, headDir, P.neck + P.headR);

  const arm = (s, e) => {
    const elbow = add(shoulder, dir(s + pose.lean), P.upperArm);
    const hand = add(elbow, dir(s + pose.lean + e), P.forearm);
    return { elbow, hand };
  };
  const leg = (h, k) => {
    const knee = add(pelvis, dir(h), P.thigh);
    const foot = add(knee, dir(h - k), P.shin);
    const toe = [foot[0] + P.foot, foot[1]];
    return { knee, foot, toe };
  };
  const armL = arm(pose.aLs, pose.aLe), armR = arm(pose.aRs, pose.aRe);
  const legL = leg(pose.lHip, pose.lKnee), legR = leg(pose.rHip, pose.rKnee);

  const pts = {
    pelvis, neckBase, shoulder, head,
    elbowL: armL.elbow, handL: armL.hand, elbowR: armR.elbow, handR: armR.hand,
    kneeL: legL.knee, footL: legL.foot, toeL: legL.toe,
    kneeR: legR.knee, footR: legR.foot, toeR: legR.toe,
  };

  // Whole-body rotation around the pelvis (positive = topple forward).
  const c = Math.cos(pose.rot), s = Math.sin(pose.rot);
  for (const k of Object.keys(pts)) {
    const [x, y] = pts[k];
    pts[k] = [x * c + y * s, -x * s + y * c];
  }

  // Ground the body: lowest load-bearing point sits on y = 0 (hands may dip below to reach).
  const ground = ['pelvis', 'kneeL', 'kneeR', 'footL', 'footR', 'toeL', 'toeR'].map((k) => pts[k][1]);
  ground.push(pts.head[1] - P.headR);
  const minY = Math.min(...ground);
  for (const k of Object.keys(pts)) pts[k] = [pts[k][0], pts[k][1] - minY];
  pts.headAngle = pose.lean + pose.head - pose.rot;
  return pts;
}
