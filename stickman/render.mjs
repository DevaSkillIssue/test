// Usage: node render.mjs <story.json> [--sheet]
// Writes out/<name>/contact.jpg (one still per shot) and, without --sheet, out/<name>/<name>.mp4.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { validateStory, estimateDuration, buildTimeline } from './lib.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const [storyPath, ...flags] = process.argv.slice(2);
if (!storyPath) { console.error('usage: node render.mjs <story.json> [--sheet]'); process.exit(1); }

const story = validateStory(JSON.parse(fs.readFileSync(storyPath, 'utf8')));
const name = path.basename(storyPath, '.json');
const outDir = path.join(ROOT, 'out', name);
const voiceDir = path.join(outDir, 'voice');
fs.mkdirSync(voiceDir, { recursive: true });
const fps = story.fps || 30;

const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// Voice: one mp3 per shot. Files already in out/<name>/voice/NN.mp3 are reused, so you can drop in your own.
async function voice(i, text) {
  const file = path.join(voiceDir, `${String(i + 1).padStart(2, '0')}.mp3`);
  if (!fs.existsSync(file) && process.env.ELEVENLABS_API_KEY) {
    const id = story.voice || process.env.ELEVENLABS_VOICE_ID;
    if (!id) throw new Error('set "voice" in the story or ELEVENLABS_VOICE_ID to an ElevenLabs voice id');
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: story.voiceModel || 'eleven_multilingual_v2' }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`voice ${path.basename(file)}`);
  }
  return fs.existsSync(file) ? { file, dur: probe(file) } : { file: null, dur: estimateDuration(text) };
}

const voices = [];
for (const [i, sh] of story.shots.entries()) voices.push(await voice(i, sh.text));
const hasVoice = voices.every(v => v.file);
if (!hasVoice && voices.some(v => v.file)) console.warn('some shots have no voice file: rendering silent');
const timeline = buildTimeline(story.shots, voices.map(v => v.dur));
const total = timeline.at(-1).start + timeline.at(-1).dur;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  // Serve this folder under a fake origin so ES module imports work without a web server.
  await page.route('http://stick.local/**', route => {
    const f = path.join(ROOT, new URL(route.request().url()).pathname);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404 });
    route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.html') ? 'text/html' : 'text/javascript' });
  });
  await page.goto('http://stick.local/scene.html');
  await page.waitForFunction(() => window.setup);
  await page.evaluate(([s, tl]) => window.setup(s, tl), [story, timeline]);

  const jpg = d => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
  fs.writeFileSync(path.join(outDir, 'contact.jpg'), jpg(await page.evaluate(() => window.contactSheet())));
  console.log(`contact sheet: ${path.join(outDir, 'contact.jpg')} (${story.shots.length} shots, ${total.toFixed(1)}s)`);
  if (flags.includes('--sheet')) process.exit(process.exitCode || 0);

  const mp4 = path.join(outDir, `${name}.mp4`);
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
  if (hasVoice) {
    const list = path.join(voiceDir, 'list.txt');
    fs.writeFileSync(list, voices.map(v => `file '${v.file.replace(/'/g, "'\\''")}'`).join('\n'));
    args.push('-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'aac', '-b:a', '160k');
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-t', total.toFixed(3), mp4);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, bad) => ff.on('close', c => (c ? bad(new Error(`ffmpeg exited ${c}`)) : ok())));
  const n = Math.ceil(total * fps);
  for (let f = 0; f < n; f++) {
    const buf = jpg(await page.evaluate(T => window.frame(T), f / fps));
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % fps === 0) process.stdout.write(`\rframe ${f}/${n}`);
  }
  ff.stdin.end();
  await done;
  console.log(`\nvideo: ${mp4}${hasVoice ? '' : ' (silent: no voice files, set ELEVENLABS_API_KEY)'}`);
} finally {
  await browser.close();
}
