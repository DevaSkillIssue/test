/**
 * Browser rendering test (headless Chromium + WebGL), run with: npm run test:render
 *
 * Checks: the Three.js scene loads; the character is drawn; character and camera animation
 * change the image; rendering is deterministic (same t -> identical pixels, in any order and
 * in a different page); the frame exporter writes a complete, correctly sized frame sequence.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startServer, ROOT } from '../scripts/serve.mjs';
import { loadPlaywright } from '../scripts/lib.mjs';

const W = 270, H = 480;
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(['ok', name]); console.log(`ok - ${name}`); }
  catch (e) { results.push(['FAIL', name]); console.log(`not ok - ${name}\n   ${e.stack || e}`); }
};

const server = await startServer({ port: 0 });
const url = `http://127.0.0.1:${server.address().port}/render.html?story=input/test_scene.json&width=${W}&height=${H}&timing=&words=`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__production && (window.__production.ready || window.__production.error), null, { timeout: 60000 });
  return { page, errors };
}

/** Render t and return { hash, stats } computed in the page from the actual pixels. */
const frame = (page, t) => page.evaluate(async (t) => {
  window.__production.renderOnly(t);
  const src = document.getElementById('stage');
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let hash = 2166136261, blue = 0, sum = 0;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) {
    hash = Math.imul(hash ^ (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16)), 16777619);
    // The test hero ("sleepy" template) is drawn in #2b4fa8.
    if (Math.abs(d[i] - 0x2b) < 30 && Math.abs(d[i + 1] - 0x4f) < 30 && Math.abs(d[i + 2] - 0xa8) < 35) blue++;
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    sum += l;
    lum.push(l);
  }
  const mean = sum / lum.length;
  const variance = lum.reduce((a, l) => a + (l - mean) ** 2, 0) / lum.length;
  return { hash: hash >>> 0, blue, mean, std: Math.sqrt(variance) };
}, t);

try {
  const { page, errors } = await open();

  await check('three.js scene loads without errors', async () => {
    const state = await page.evaluate(() => ({ error: window.__production.error, info: window.__production.info }));
    assert.equal(state.error, null);
    assert.equal(state.info.frameCount, 195);
    assert.deepEqual(errors, []);
  });

  await check('frame is a real image (not blank / not black)', async () => {
    const f = await frame(page, 1.0);
    assert.ok(f.mean > 30 && f.mean < 240, `mean luminance ${f.mean}`);
    assert.ok(f.std > 15, `contrast ${f.std}`);
  });

  await check('character renders (hero colour present)', async () => {
    const f = await frame(page, 1.0);
    assert.ok(f.blue > 150, `only ${f.blue} hero pixels`);
  });

  await check('character animation changes the image', async () => {
    const a = await frame(page, 0.6), b = await frame(page, 0.75);
    assert.notEqual(a.hash, b.hash);
  });

  await check('camera animation (dolly-in after cut) changes framing', async () => {
    const a = await frame(page, 2.1), b = await frame(page, 3.0);
    assert.notEqual(a.hash, b.hash);
    assert.ok(b.blue > a.blue, `closer shot should show a bigger character (${a.blue} -> ${b.blue})`);
  });

  await check('deterministic: same t gives identical pixels regardless of render order', async () => {
    const first = await frame(page, 2.2);
    await frame(page, 5.0);
    await frame(page, 0.1);
    const again = await frame(page, 2.2);
    assert.equal(first.hash, again.hash);
    const other = await open();
    const fresh = await frame(other.page, 2.2);
    assert.equal(first.hash, fresh.hash, 'a fresh page renders the same frame');
    await other.page.close();
  });

  await check('scene transition renders (whip/flash overlay around the cut)', async () => {
    const mid = await frame(page, 3.49);
    assert.ok(mid.mean > 30, 'transition frame is not black');
  });

  await page.close();

  await check('frame exporter writes a complete sequence', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
    execFileSync('node', ['scripts/render.mjs', '--story', 'input/test_scene.json', '--no-audio-timing', '--width', String(W), '--height', String(H), '--start', '0', '--end', '29', '--out', out, '--workers', '2'], { cwd: ROOT, stdio: 'pipe' });
    const files = fs.readdirSync(out).filter((f) => f.startsWith('frame_')).sort();
    assert.equal(files.length, 30);
    assert.equal(files[0], 'frame_00000.jpg');
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(out, files[0])]).toString().trim();
    assert.equal(probe, `${W},${H}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')));
    assert.equal(manifest.frame_count, 195);
    fs.rmSync(out, { recursive: true });
  });
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} render checks passed`);
process.exit(failed ? 1 : 0);
