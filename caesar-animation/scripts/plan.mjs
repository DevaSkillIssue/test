/**
 * Compile the production plan: resolved timeline (output/timeline.json) and the
 * absolute sound-effect events for the compositor (output/audio/sfx_events.json).
 *
 * node scripts/plan.mjs [--story input/story.json] [--fps 30] [--no-audio-timing]
 */
import fs from 'node:fs';
import { parseArgs, loadProduction, readJSON, abs, rel, log } from './lib.mjs';
import { buildSfxEvents } from '../src/audio/AudioTimeline.js';
import { SceneAnimator } from '../src/animation/Animator.js';

const args = parseArgs();
const settings = readJSON('config/settings.json');
const fps = Number(args.fps || settings.video.fps);
const { tl, timingOk } = loadProduction({
  story: args.story || 'input/story.json',
  timing: args['no-audio-timing'] ? null : args.timing || 'output/audio/scene_timing.json',
  words: args.words || 'output/audio/transcription.json',
  fps,
});
// Building the animators validates actions/characters for every scene up front.
for (const sc of tl.scenes) new SceneAnimator(sc);

const sfxLib = readJSON('config/sfx.json');
const events = buildSfxEvents(tl, sfxLib, { autoActionSfx: settings.audio.auto_action_sfx });
const outDir = args['out-dir'] || 'output';
fs.mkdirSync(abs(`${outDir}/audio`), { recursive: true });
const plan = {
  fps: tl.fps, duration: tl.duration, video_duration: tl.videoDuration, frame_count: tl.frameCount,
  audio_timing: timingOk, warnings: tl.warnings,
  scenes: tl.scenes.map((s) => ({
    scene_id: s.id, start: +s.start.toFixed(3), end: +s.end.toFixed(3), environment: s.data.environment, lighting: s.data.lighting,
    transition_out: s.transitionOut,
    actions: s.actions.map((a) => ({ character: a.character, action: a.action, start: +a.start.toFixed(3), duration: a.duration, at_word: a.at_word })),
    camera: s.camera.segments.map((c) => ({ start: +c.start.toFixed(3), end: +c.end.toFixed(3), shot: c.shot, move: c.move, angle: c.angle, target: c.target, blend: c.blend })),
  })),
};
fs.writeFileSync(abs(`${outDir}/timeline.json`), JSON.stringify(plan, null, 2));
fs.writeFileSync(abs(`${outDir}/audio/sfx_events.json`), JSON.stringify({ duration: tl.videoDuration, events }, null, 2));
for (const w of tl.warnings) log(`WARNING ${w}`);
log(`plan: ${tl.scenes.length} scenes, ${tl.duration.toFixed(2)}s, ${tl.frameCount} frames @ ${fps}fps, audio timing: ${timingOk ? 'voiceover' : 'planned durations'}`);
log(`wrote ${rel(`${outDir}/timeline.json`)} and ${rel(`${outDir}/audio/sfx_events.json`)} (${events.length} sfx events)`);
