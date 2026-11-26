/**
 * Offline frame renderer: drives headless Chromium (WebGL) through a frame queue.
 *
 *   node scripts/render.mjs [--story input/story.json] [--preview] [--width 1080 --height 1920]
 *        [--fps 30] [--out output/frames] [--format jpeg|png] [--quality 0.94] [--workers 2]
 *        [--start 0 --end N] [--resume] [--no-audio-timing]
 *
 * - Each worker is a browser page with the full production loaded; frames are pulled from a
 *   shared queue, rendered at t = frame / fps (never real time), written as they arrive
 *   (nothing is kept in memory) via tmp-file + rename so a crash never leaves partial frames.
 * - Failed frames are retried; a crashed page is recreated. --resume skips frames on disk.
 * Env: CHROMIUM_PATH (custom browser), CHROMIUM_ARGS (extra flags, e.g. GPU flags in the cloud).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, loadProduction, readJSON, abs, rel, log, loadPlaywright } from './lib.mjs';
import { startServer } from './serve.mjs';

const args = parseArgs();
const settings = readJSON('config/settings.json');
const base = args.preview ? settings.preview : settings.video;
const width = Number(args.width || base.width);
const height = Number(args.height || base.height);
const fps = Number(args.fps || base.fps);
const format = (args.format || settings.render.frame_format) === 'png' ? 'png' : 'jpeg';
const quality = Number(args.quality || settings.render.jpeg_quality);
const workers = Math.max(1, Number(args.workers || settings.render.workers));
const retries = Number(settings.render.retries ?? 3);
const outDir = abs(args.out || 'output/frames');
const storyPath = args.story || 'input/story.json';
const timingPath = args['no-audio-timing'] ? '' : args.timing || 'output/audio/scene_timing.json';
const wordsPath = args['no-audio-timing'] ? '' : args.words || 'output/audio/transcription.json';

if (!(width > 0 && height > 0 && fps > 0)) throw new Error('invalid width/height/fps');
if (width % 2 || height % 2) throw new Error('width and height must be even (required by H.264 yuv420p)');

const { tl, timingOk } = loadProduction({ story: storyPath, timing: timingPath, words: wordsPath, fps });
const first = Number(args.start || 0);
const last = Math.min(Number(args.end ?? tl.frameCount - 1), tl.frameCount - 1);
const ext = format === 'png' ? 'png' : 'jpg';
const frameName = (i) => path.join(outDir, `frame_${String(i).padStart(5, '0')}.${ext}`);

fs.mkdirSync(outDir, { recursive: true });
if (!args.resume) {
  for (const f of fs.readdirSync(outDir)) if (/^frame_\d+\.(png|jpg)(\.tmp)?$/.test(f)) fs.unlinkSync(path.join(outDir, f));
}
const queue = [];
for (let i = first; i <= last; i++) if (!(args.resume && fs.existsSync(frameName(i)))) queue.push(i);

log(`render: ${rel(storyPath)} ${width}x${height}@${fps} ${format}, frames ${first}..${last} (${queue.length} to render), ${workers} worker(s), audio timing: ${timingOk ? 'voiceover' : 'planned'}`);

const server = await startServer({ port: 0 });
const port = server.address().port;
const qs = new URLSearchParams({ story: storyPath, width, height, fps, timing: timingOk ? timingPath : '', words: timingOk ? wordsPath : '' });
const url = `http://127.0.0.1:${port}/render.html?${qs}`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean)],
});

async function openPage(n) {
  const page = await browser.newPage({ viewport: { width: Math.min(width, 1280), height: Math.min(height, 1280) } });
  page.on('pageerror', (e) => log(`worker ${n} page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log(`worker ${n} console: ${m.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.__production && (window.__production.ready || window.__production.error), null, { timeout: 120000 });
  const state = await page.evaluate(() => ({ error: window.__production.error, info: window.__production.info }));
  if (state.error) throw new Error(`renderer failed to initialise: ${state.error}`);
  if (state.info.frameCount !== tl.frameCount) throw new Error(`frame count mismatch browser=${state.info.frameCount} node=${tl.frameCount}`);
  return page;
}

let done = 0;
const total = queue.length;
const t0 = Date.now();
let lastReport = 0;
const mime = format === 'png' ? 'image/png' : 'image/jpeg';

async function worker(n) {
  let page = await openPage(n);
  while (queue.length) {
    const i = queue.shift();
    let attempt = 0;
    for (;;) {
      try {
        const dataUrl = await page.evaluate(([t, m, q]) => window.__production.renderFrame(t, m, q), [i / fps, mime, quality]);
        const comma = dataUrl.indexOf(',');
        if (comma < 0 || dataUrl.length < 1000) throw new Error('empty frame data');
        const file = frameName(i);
        fs.writeFileSync(file + '.tmp', Buffer.from(dataUrl.slice(comma + 1), 'base64'));
        fs.renameSync(file + '.tmp', file);
        break;
      } catch (err) {
        attempt++;
        log(`worker ${n}: frame ${i} failed (attempt ${attempt}/${retries}): ${err.message}`);
        if (attempt >= retries) throw new Error(`frame ${i} failed after ${retries} attempts: ${err.message}`);
        if (page.isClosed() || /crash|closed|Target/i.test(err.message)) {
          await page.close().catch(() => {});
          page = await openPage(n);
        }
      }
    }
    done++;
    const now = Date.now();
    if (now - lastReport > 5000 || done === total) {
      lastReport = now;
      const rate = done / ((now - t0) / 1000);
      log(`rendered ${done}/${total} (${((done / total) * 100).toFixed(0)}%) ${rate.toFixed(2)} fps, ETA ${((total - done) / rate).toFixed(0)}s`);
    }
  }
  await page.close();
}

try {
  if (total > 0) await Promise.all(Array.from({ length: Math.min(workers, total) }, (_, n) => worker(n)));
  // Verify the whole requested range exists before declaring success.
  const missing = [];
  for (let i = first; i <= last; i++) if (!fs.existsSync(frameName(i))) missing.push(i);
  if (missing.length) throw new Error(`missing ${missing.length} frames, first: ${missing.slice(0, 5).join(', ')}`);
  const manifest = {
    story: rel(storyPath), width, height, fps, format: ext, frame_count: tl.frameCount, first, last,
    pattern: 'frame_%05d.' + ext, duration: tl.videoDuration, audio_timing: timingOk,
    render_seconds: Math.round((Date.now() - t0) / 100) / 10,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log(`done: ${last - first + 1} frames in ${rel(outDir)} (${manifest.render_seconds}s)`);
} catch (err) {
  log(`ERROR ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
