/**
 * Browser entry point, used by both pages:
 *   render.html  - headless offline renderer driven by scripts/render.mjs (window.__production)
 *   index.html   - responsive mobile preview with play/scrub, voiceover and SFX
 *
 * URL parameters (all optional): story, timing, words, width, height, fps, preview=1
 */
import { FrameRenderer } from './rendering/FrameRenderer.js';
import { buildSfxEvents, SfxPlayer } from './audio/AudioTimeline.js';

const params = new URLSearchParams(location.search);

async function fetchJSON(path, optional = false) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`failed to load ${path}: HTTP ${res.status}`);
  }
  return res.json();
}

async function createProduction(canvas, defaults) {
  const settings = await fetchJSON('config/settings.json');
  const templates = await fetchJSON('config/characters.json');
  const storyPath = params.get('story') || 'input/story.json';
  const story = await fetchJSON(storyPath);
  const timingPath = params.get('timing') ?? 'output/audio/scene_timing.json';
  const wordsPath = params.get('words') ?? 'output/audio/transcription.json';
  const timing = timingPath ? await fetchJSON(timingPath, true) : null;
  const transcription = wordsPath ? await fetchJSON(wordsPath, true) : null;
  // Only use audio timing that belongs to this story (scene ids must match).
  const ids = story.scenes.map((s) => s.scene_id).join(',');
  const timingOk = timing && timing.scenes.map((s) => s.scene_id).join(',') === ids;

  const r = settings.render;
  const width = Number(params.get('width') || defaults.width);
  const height = Number(params.get('height') || defaults.height);
  const fps = Number(params.get('fps') || defaults.fps);
  canvas.width = width;
  canvas.height = height;
  const renderer = new FrameRenderer({
    canvas, width, height, story, templates, fps,
    timing: timingOk ? timing : null,
    words: timingOk && transcription ? transcription.words : null,
    settings: {
      shadows: r.shadows, shadowMapSize: r.shadow_map_size, characterTextureSize: r.character_texture_size,
      handheld: r.handheld, vignette: r.vignette,
    },
  });
  return { renderer, settings, story, timingOk, storyPath };
}

async function initRenderMode() {
  const canvas = document.getElementById('stage');
  const api = { ready: false, error: null };
  window.__production = api;
  try {
    const { renderer } = await createProduction(canvas, { width: 1080, height: 1920, fps: 30 });
    api.info = renderer.info;
    api.renderFrame = (t, mime = 'image/jpeg', quality = 0.94) => {
      renderer.renderAt(t);
      return canvas.toDataURL(mime, quality);
    };
    api.renderOnly = (t) => renderer.renderAt(t);
    api.ready = true;
  } catch (err) {
    api.error = String(err && err.stack || err);
    console.error(err);
  }
}

async function initPreviewMode() {
  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const status = $('status');
  try {
    const { settings, ...prod } = await createProduction(canvas, settings0());
    const { renderer, timingOk } = prod;
    const info = renderer.info;
    const sfxLib = await fetchJSON('config/sfx.json');
    const sfxEvents = buildSfxEvents(renderer.timeline, sfxLib, { autoActionSfx: settings.audio.auto_action_sfx });

    const audio = new Audio();
    let hasVoice = false;
    if (timingOk) {
      audio.src = 'output/audio/voiceover.mp3';
      audio.preload = 'auto';
      hasVoice = await new Promise((res) => { audio.oncanplaythrough = () => res(true); audio.onerror = () => res(false); });
    }
    let actx = null, sfx = null;
    const scrub = $('scrub');
    scrub.max = info.duration;
    const sceneList = $('scenes');
    for (const s of info.scenes) {
      const b = document.createElement('button');
      b.textContent = s.id;
      b.onclick = () => seek(s.start);
      sceneList.appendChild(b);
    }

    let playing = false, t = 0, startWall = 0, startT = 0;
    const draw = () => {
      renderer.renderAt(t);
      scrub.value = t;
      $('time').textContent = `${t.toFixed(2)} / ${info.duration.toFixed(2)}s`;
    };
    const seek = (to) => {
      t = Math.min(Math.max(0, to), info.duration);
      if (playing) { pause(); play(); } else draw();
    };
    const play = async () => {
      if (t >= info.duration - 0.01) t = 0;
      if (!actx) {
        actx = new AudioContext();
        sfx = new SfxPlayer(actx, sfxEvents, '');
        await sfx.load();
      }
      await actx.resume();
      playing = true;
      startWall = performance.now();
      startT = t;
      if (hasVoice) { audio.currentTime = t; audio.play().catch(() => {}); }
      sfx.start(t, settings.audio.sfx_volume);
      $('play').textContent = 'Pause';
      requestAnimationFrame(loop);
    };
    const pause = () => {
      playing = false;
      audio.pause();
      sfx?.stop();
      $('play').textContent = 'Play';
    };
    // Preview follows the voiceover clock when present so lips/actions stay in sync with audio.
    const loop = () => {
      if (!playing) return;
      t = hasVoice && !audio.paused ? audio.currentTime : startT + (performance.now() - startWall) / 1000;
      if (t >= info.duration) { t = info.duration; draw(); pause(); return; }
      draw();
      requestAnimationFrame(loop);
    };
    $('play').onclick = () => (playing ? pause() : play());
    scrub.oninput = () => seek(Number(scrub.value));
    status.textContent = `${prod.storyPath} · ${info.scenes.length} scenes · ${info.duration.toFixed(1)}s · ${canvas.width}x${canvas.height}` +
      (hasVoice ? ' · voiceover' : ' · no voiceover yet (planned timing)');
    draw();
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    console.error(err);
  }

  function settings0() {
    // Phones get a lighter default resolution; ?width=&height= overrides.
    const small = Math.min(screen.width, screen.height) < 700;
    return small ? { width: 360, height: 640, fps: 30 } : { width: 540, height: 960, fps: 30 };
  }
}

if (params.get('preview') === '1' || document.body.dataset.mode === 'preview') initPreviewMode();
else initRenderMode();
