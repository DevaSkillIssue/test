// Unit tests for the pure animation core (no browser needed): node --test tests/js/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KeyframeTrack, Easing } from '../../src/animation/Keyframes.js';
import { compileTimeline, transitionState, sceneIndexAt } from '../../src/animation/Timeline.js';
import { SceneAnimator, ACTION_NAMES } from '../../src/animation/Animator.js';
import { solveSkeleton, BASE_POSE } from '../../src/characters/Character.js';
import { EXPRESSIONS } from '../../src/characters/Expressions.js';
import { evaluateCamera, SHOTS, ANGLES, MOVES } from '../../src/camera/CameraController.js';

const story = JSON.parse(fs.readFileSync(new URL('../../input/test_scene.json', import.meta.url)));
const schema = JSON.parse(fs.readFileSync(new URL('../../config/story.schema.json', import.meta.url)));

test('keyframe track interpolates numbers and arrays with easing', () => {
  const tr = new KeyframeTrack([{ time: 0, value: [0, 0] }, { time: 2, value: [10, 20], ease: 'linear' }]);
  assert.deepEqual(tr.valueAt(1), [5, 10]);
  assert.deepEqual(tr.valueAt(-1), [0, 0]);
  assert.deepEqual(tr.valueAt(5), [10, 20]);
  assert.equal(Easing.easeInOutCubic(0.5), 0.5);
});

test('schema enums match the engine registries', () => {
  const d = schema.$defs;
  assert.deepEqual([...d.action_name.enum].sort(), [...ACTION_NAMES].sort());
  assert.deepEqual([...d.expression.enum].sort(), [...EXPRESSIONS].sort());
  assert.deepEqual([...d.shot.enum].sort(), Object.keys(SHOTS).sort());
  assert.deepEqual([...d.angle.enum].sort(), Object.keys(ANGLES).sort());
  assert.deepEqual([...d.move.enum].sort(), [...MOVES].sort());
});

test('timeline: planned durations, frame count, scene lookup', () => {
  const tl = compileTimeline(story, { fps: 30 });
  assert.equal(tl.duration, 6.5);
  assert.equal(tl.frameCount, 195);
  assert.equal(sceneIndexAt(tl, 3.49), 0);
  assert.equal(sceneIndexAt(tl, 3.5), 1);
  assert.equal(tl.scenes[1].start, 3.5);
  assert.equal(tl.scenes[0].camera.segments.length, 2);
  assert.equal(tl.scenes[0].camera.segments[0].end, 2.0);
});

test('timeline: voiceover timing stretches scenes and at_word anchors events', () => {
  const timing = { scenes: [{ scene_id: 't1_street', start: 0, duration: 4.0 }, { scene_id: 't2_office', start: 4.0, duration: 3.0 }] };
  const words = [{ word: 'Max', start: 0.3, end: 0.6 }, { word: 'jumps,', start: 2.71, end: 3.0 }];
  const tl = compileTimeline(story, { timing, words, fps: 30 });
  const jump = tl.scenes[0].actions.find((a) => a.action === 'jump');
  assert.equal(jump.start, 2.71, 'jump anchored to the spoken word');
  const walk = tl.scenes[0].actions.find((a) => a.action === 'walk');
  assert.ok(Math.abs(walk.start - 0.2 * (4.0 / 3.5)) < 1e-9, 'scene-relative time scaled by stretch');
  assert.equal(tl.scenes[1].start, 4.0);
  assert.throws(() => compileTimeline(story, { timing: { scenes: [{ scene_id: 't1_street', start: 0, duration: 4 }] } }));
});

test('timeline: missing at_word falls back to time with a warning', () => {
  const tl = compileTimeline(story, { words: [{ word: 'nothing', start: 0.1, end: 0.2 }] });
  assert.ok(tl.warnings.some((w) => w.includes('jumps')));
  assert.equal(tl.scenes[0].actions.find((a) => a.action === 'jump').start, 2.0);
});

test('transitions: whip out of scene 1, fade at the end', () => {
  const tl = compileTimeline(story);
  assert.equal(transitionState(tl, 1.0).whip, 0);
  assert.ok(transitionState(tl, 3.45).whip > 0);
  assert.ok(transitionState(tl, 3.55).whip < 0);
  assert.ok(transitionState(tl, 6.49).fade > 0.9);
});

test('skeleton is grounded and actions change the pose', () => {
  const pts = solveSkeleton(BASE_POSE);
  const minFoot = Math.min(pts.footL[1], pts.footR[1], pts.toeL[1], pts.toeR[1]);
  assert.ok(Math.abs(minFoot) < 1e-9);
  assert.ok(pts.head[1] > 1.5 && pts.head[1] < 1.9, `head height ${pts.head[1]}`);
  const lying = solveSkeleton({ ...BASE_POSE, rot: Math.PI / 2 });
  assert.ok(lying.head[1] < 0.4, 'lying body is near the ground');
});

test('animator: walking moves the character to the target, deterministically', () => {
  const tl = compileTimeline(story);
  const an = new SceneAnimator(tl.scenes[0]);
  const a = an.stateAt('max', 0.0);
  const mid = an.stateAt('max', 1.0);
  const end = an.stateAt('max', 1.9);
  assert.deepEqual(a.position, [-1.8, 0, 0]);
  assert.ok(mid.position[0] > -1.8 && mid.position[0] < 0.2);
  assert.deepEqual(end.position, [0.2, 0, 0.3]);
  assert.notDeepEqual(mid.pose, a.pose);
  assert.deepEqual(an.stateAt('max', 1.0), mid, 'same t -> same state');
  // Jump lifts the root.
  const air = Math.max(...[2.4, 2.5, 2.6].map((t) => an.stateAt('max', t).pose.rootY));
  assert.ok(air > 0.3, `jump height ${air}`);
  // Sam waves toward the camera, happy.
  const sam = an.stateAt('sam', 1.0);
  assert.equal(sam.facing, 0);
  assert.equal(sam.expression, 'happy');
});

test('animator: fall holds the lying pose with dizzy face', () => {
  const tl = compileTimeline(story);
  const an = new SceneAnimator(tl.scenes[1]);
  const s = an.stateAt('max', tl.scenes[1].start + 2.9);
  assert.ok(Math.abs(s.pose.rot - 1.57) < 0.05);
  assert.equal(s.expression, 'dizzy');
  assert.deepEqual(s.position, [1.3, 0, 0.2]);
});

test('camera: shots, cut blend, tracking and shake are deterministic', () => {
  const tl = compileTimeline(story);
  const sc = tl.scenes[0];
  const an = new SceneAnimator(sc);
  const subject = (id, t) => an.positionAt(id, t).pos;
  const c0 = evaluateCamera(sc, 0.5, subject);
  const c1 = evaluateCamera(sc, 1.5, subject);
  assert.ok(c1.position[0] > c0.position[0], 'tracking follows the walking subject');
  const cutStart = evaluateCamera(sc, 2.0, subject);
  const blended = evaluateCamera(sc, 2.2, subject);
  const settled = evaluateCamera(sc, 2.6, subject);
  assert.ok(Math.abs(cutStart.position[2] - c1.position[2]) < 1.5, 'blend starts near previous framing');
  assert.ok(settled.position[2] < blended.position[2], 'camera dollies in');
  assert.deepEqual(evaluateCamera(sc, 2.2, subject), blended);
  const sc2 = tl.scenes[1];
  const an2 = new SceneAnimator(sc2);
  const sub2 = (id, t) => an2.positionAt(id, t).pos;
  const still = evaluateCamera({ ...sc2, camera: { ...sc2.camera, shake: [] } }, 5.5, sub2);
  const shaken = evaluateCamera(sc2, 5.5, sub2);
  assert.notDeepEqual(still.position, shaken.position);
});

test('animator: an action interrupting a walk stops the character (no slide, no teleport)', () => {
  const s = structuredClone(story);
  s.scenes[0].actions = [
    { time: 0.0, character: 'max', action: 'walk', duration: 2.0, target: [2.2, 0, 0] },
    { time: 1.0, character: 'max', action: 'shock', duration: 0.6 },
    { time: 2.0, character: 'max', action: 'walk', duration: 1.0, target: [-1.0, 0, 0] },
  ];
  const tl = compileTimeline(s);
  const an = new SceneAnimator(tl.scenes[0]);
  const atCut = an.positionAt('max', 1.0).pos;
  assert.deepEqual(an.positionAt('max', 1.5).pos, atCut, 'frozen during the reaction');
  const justAfter = an.positionAt('max', 2.01).pos;
  assert.ok(Math.abs(justAfter[0] - atCut[0]) < 0.05, 'next walk starts from where he stopped');
  assert.deepEqual(an.positionAt('max', 3.5).pos, [-1.0, 0, 0]);
});

test('timeline: falls add an automatic impact shake', () => {
  const tl = compileTimeline(story);
  const fall = tl.scenes[1].actions.find((a) => a.action === 'fall');
  assert.ok(tl.scenes[1].camera.shake.some((s) => Math.abs(s.start - (fall.start + 0.72 * fall.duration)) < 0.3));
});

test('timeline: misheard anchor words resolve through the script alignment, never before narration starts', () => {
  const timing = { scenes: [{ scene_id: 't1_street', start: 0, duration: 4.0, audio_start: 0.25 }, { scene_id: 't2_office', start: 4.0, duration: 3.0, audio_start: 4.25 }] };
  const words = [
    { word: 'Max', start: 0.1, end: 0.6 },
    { word: 'dumps', script: 'jumps', start: 2.71, end: 3.0 },
  ];
  const tl = compileTimeline(story, { timing, words });
  assert.equal(tl.scenes[0].actions.find((a) => a.action === 'jump').start, 2.71);
  assert.deepEqual(tl.warnings, []);
});
