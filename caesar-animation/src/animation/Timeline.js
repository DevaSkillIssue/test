/**
 * Timeline compiler.
 *
 * Turns story.json (scene-relative times) into an absolute, deterministic timeline:
 *   - scene start/end come from the real voiceover layout (output/audio/scene_timing.json)
 *     when available, otherwise from each scene's planned `duration`;
 *   - event times are scene-relative seconds, scaled when a scene was stretched to fit
 *     its narration, or anchored to a spoken word (`at_word`) using Whisper timestamps;
 *   - camera cuts become contiguous shot segments.
 *
 * Pure module (no DOM / Three.js): Node tests, the plan script and the browser renderer
 * all compile the same timeline from the same inputs.
 */
import { clamp, ease } from './Keyframes.js';

/** Seconds each transition occupies on EACH side of a scene boundary. */
export const TRANSITION_TIME = { cut: 0, fade: 0.3, flash: 0.12, whip: 0.2, zoom: 0.25 };

export function normalizeWord(w) {
  return String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function compileTimeline(story, { timing = null, words = null, fps = 30 } = {}) {
  if (!story || !Array.isArray(story.scenes) || story.scenes.length === 0) {
    throw new Error('story.scenes must be a non-empty array');
  }
  if (!(fps > 0)) throw new Error(`invalid fps ${fps}`);
  const warnings = [];
  const timingById = new Map((timing?.scenes || []).map((s) => [s.scene_id, s]));

  let cursor = 0;
  const scenes = story.scenes.map((scene, index) => {
    const tm = timingById.get(scene.scene_id);
    if (timing && !tm) throw new Error(`scene_timing.json has no entry for scene "${scene.scene_id}"`);
    const start = tm ? tm.start : cursor;
    const duration = tm ? tm.duration : scene.duration;
    if (!(duration > 0)) throw new Error(`scene "${scene.scene_id}" has non-positive duration`);
    if (Math.abs(start - cursor) > 1e-3) {
      throw new Error(`scene "${scene.scene_id}" starts at ${start}s but previous scene ends at ${cursor}s`);
    }
    cursor = start + duration;
    return {
      index,
      id: scene.scene_id,
      audioStart: tm?.audio_start,
      start,
      end: start + duration,
      duration,
      scale: duration / scene.duration,
      data: scene,
    };
  });

  const allWords = (words || []).map((w) => ({ ...w, norm: normalizeWord(w.word), scriptNorm: w.script ? normalizeWord(w.script) : null }));

  for (const sc of scenes) {
    const scene = sc.data;
    // Whisper often starts the first word after a pause too early, so assign words by midpoint.
    const sceneWords = allWords.filter((w) => (w.start + w.end) / 2 >= sc.start && (w.start + w.end) / 2 < sc.end);
    const resolve = (time, atWord, what) => {
      if (atWord && allWords.length) {
        const target = normalizeWord(String(atWord).split(/\s+/)[0]);
        const hit = sceneWords.find((w) => w.norm === target) || sceneWords.find((w) => w.scriptNorm === target);
        if (hit) return clamp(Math.max(hit.start, sc.audioStart ?? sc.start), sc.start, sc.end);
        warnings.push(`scene ${sc.id}: ${what} at_word "${atWord}" not found in transcript; using time ${time ?? 0}s`);
      }
      return clamp(sc.start + (time ?? 0) * sc.scale, sc.start, sc.end);
    };

    sc.actions = (scene.actions || [])
      .map((a, i) => ({ ...a, order: i, start: resolve(a.time, a.at_word, `action ${a.action}`) }))
      .sort((a, b) => a.start - b.start || a.order - b.order);

    const cam = scene.camera;
    const cuts = (cam.cuts || [])
      .map((c, i) => ({ ...c, order: i, start: resolve(c.time, c.at_word, 'camera cut') }))
      .sort((a, b) => a.start - b.start || a.order - b.order);
    const segments = [{ start: sc.start, shot: cam.shot, target: cam.target, move: cam.move || 'static', angle: cam.angle || 'front', blend: 0 }];
    for (const c of cuts) {
      const prev = segments[segments.length - 1];
      segments.push({
        start: c.start,
        shot: c.shot || prev.shot,
        target: c.target || prev.target,
        move: c.move || 'static',
        angle: c.angle || prev.angle,
        blend: c.blend || 0,
      });
    }
    segments.forEach((s, i) => (s.end = i + 1 < segments.length ? segments[i + 1].start : sc.end));
    const shake = (cam.shake || []).map((s) => ({ ...s, start: resolve(s.time, s.at_word, 'camera shake') }));
    // Falls get an automatic impact shake at the moment the body hits the ground (72% of the action).
    for (const a of sc.actions) {
      if (a.action !== 'fall') continue;
      const impact = a.start + 0.72 * a.duration;
      if (!shake.some((s) => Math.abs(s.start - impact) < 0.3)) {
        shake.push({ start: impact, duration: 0.45, intensity: 0.7 * (a.intensity ?? 1), auto: true });
      }
    }
    sc.camera = {
      segments: segments.filter((s) => s.end > s.start || s === segments[segments.length - 1]),
      shake,
    };

    sc.sfx = (scene.sound_effects || []).map((s) => ({
      cue: s.cue,
      volume: s.volume ?? 1,
      time: resolve(s.time, s.at_word, `sfx ${s.cue}`),
      source: 'story',
    }));

    sc.propMotions = (scene.props || []).map((p) =>
      p.motion ? { start: resolve(p.motion.time, p.motion.at_word, `prop ${p.type}`), duration: p.motion.duration, to: p.motion.to } : null,
    );

    sc.transitionIn = sc.index > 0 ? scenes[sc.index - 1].data.transition : 'cut';
    sc.transitionOut = scene.transition;
  }

  const duration = scenes[scenes.length - 1].end;
  const frameCount = Math.ceil(duration * fps - 1e-9);
  return { fps, duration, frameCount, videoDuration: frameCount / fps, scenes, seed: story.seed ?? 1, warnings };
}

export function sceneIndexAt(tl, t) {
  const s = tl.scenes;
  for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].start) return i;
  return 0;
}

/**
 * Transition effect amounts at time t.
 * fade: overlay opacity 0..1 (color black or white); whip: signed camera yaw amount; zoom: punch-in amount.
 */
export function transitionState(tl, t) {
  const out = { fade: 0, color: 'black', whip: 0, zoom: 0 };
  const i = sceneIndexAt(tl, t);
  const sc = tl.scenes[i];
  const isLast = i === tl.scenes.length - 1;
  const apply = (kind, amount, entering) => {
    if (amount <= 0) return;
    if (kind === 'fade') out.fade = Math.max(out.fade, ease('easeInOutQuad', amount));
    else if (kind === 'flash') { out.fade = Math.max(out.fade, amount * amount); out.color = 'white'; }
    else if (kind === 'whip') { out.whip = (entering ? -1 : 1) * amount * amount; out.fade = Math.max(out.fade, 0.25 * amount); out.color = 'white'; }
    else if (kind === 'zoom') { out.zoom = (entering ? -0.6 : 1) * amount * amount; out.fade = Math.max(out.fade, 0.35 * amount * amount); out.color = 'white'; }
  };
  const outLen = TRANSITION_TIME[sc.transitionOut] || 0;
  // The final scene's transition only ever fades/flashes out; there is nothing to whip into.
  if (outLen > 0 && t > sc.end - outLen && !(isLast && (sc.transitionOut === 'whip' || sc.transitionOut === 'zoom'))) {
    apply(sc.transitionOut, (t - (sc.end - outLen)) / outLen, false);
  }
  const inLen = TRANSITION_TIME[sc.transitionIn] || 0;
  if (inLen > 0 && t < sc.start + inLen) apply(sc.transitionIn, 1 - (t - sc.start) / inLen, true);
  return out;
}
