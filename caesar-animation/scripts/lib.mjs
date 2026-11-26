/** Shared Node helpers for the plan/render scripts. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compileTimeline } from '../src/animation/Timeline.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
export const rel = (p) => path.relative(ROOT, abs(p)).split(path.sep).join('/');

export function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(abs(p), 'utf8'));
  } catch (err) {
    throw new Error(`cannot read JSON ${p}: ${err.message}`);
  }
}
export const readOptionalJSON = (p) => (p && fs.existsSync(abs(p)) ? readJSON(p) : null);

/** Tiny --flag value parser. Flags without a value become true. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`unexpected argument ${argv[i]}`);
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

/**
 * Load story + (optional) voiceover timing + transcription and compile the timeline.
 * Timing/words are only used when they were produced for this story (same scene ids).
 */
export function loadProduction({ story = 'input/story.json', timing = 'output/audio/scene_timing.json', words = 'output/audio/transcription.json', fps = 30 } = {}) {
  const storyData = readJSON(story);
  const timingData = timing ? readOptionalJSON(timing) : null;
  const ids = storyData.scenes.map((s) => s.scene_id).join(',');
  const timingOk = !!timingData && timingData.scenes.map((s) => s.scene_id).join(',') === ids;
  const wordsData = timingOk && words ? readOptionalJSON(words) : null;
  const tl = compileTimeline(storyData, { timing: timingOk ? timingData : null, words: wordsData?.words || null, fps });
  return { story: storyData, timing: timingOk ? timingData : null, words: wordsData, tl, timingOk };
}

/** Playwright is pre-installed globally in some environments; resolve it via NODE_PATH too. */
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    throw new Error('playwright is not installed. Run: npm install playwright && npx playwright install chromium');
  }
}

export function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}
