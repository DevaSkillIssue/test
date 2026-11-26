/**
 * Sound-effect timeline.
 *
 * buildSfxEvents() resolves every SFX cue to an absolute time + file + volume:
 *   - cues written in story.json (sound_effects[], possibly anchored to a spoken word),
 *   - optional automatic cues for actions (a fall gets a thud on impact) and transitions,
 *     defined in config/sfx.json -> action_cues / transition_cues.
 * The compositor mixes these with FFmpeg; the browser preview plays them with SfxPlayer.
 */
import { TRANSITION_TIME } from '../animation/Timeline.js';

export function buildSfxEvents(tl, sfxLib, { autoActionSfx = true } = {}) {
  const cues = sfxLib.cues || {};
  const events = [];
  const push = (cue, time, volume, source) => {
    const def = cues[cue];
    if (!def) throw new Error(`Unknown sound effect cue "${cue}" (not in config/sfx.json)`);
    if (time < 0 || time >= tl.videoDuration) return;
    events.push({ cue, time: Math.round(time * 1000) / 1000, volume: (volume ?? 1) * (def.volume ?? 1), file: def.file, category: def.category, source });
  };
  for (const sc of tl.scenes) for (const s of sc.sfx) push(s.cue, s.time, s.volume, 'story');

  if (autoActionSfx) {
    const near = (cue, time) => events.some((e) => e.cue === cue && Math.abs(e.time - time) < 0.3);
    for (const sc of tl.scenes) {
      for (const a of sc.actions) {
        for (const ac of sfxLib.action_cues?.[a.action] || []) {
          const time = a.start + ac.at * a.duration;
          if (!near(ac.cue, time)) push(ac.cue, time, 1, `auto:${a.action}`);
        }
      }
      const tc = sfxLib.transition_cues?.[sc.transitionOut];
      if (tc && sc.index < tl.scenes.length - 1) {
        const time = sc.end - (TRANSITION_TIME[sc.transitionOut] || 0);
        if (!near(tc, time)) push(tc, time, 1, `auto:transition:${sc.transitionOut}`);
      }
    }
  }
  return events.sort((a, b) => a.time - b.time || a.cue.localeCompare(b.cue));
}

/** Browser-only WebAudio player used by the mobile preview to audition SFX in sync. */
export class SfxPlayer {
  constructor(audioCtx, events, baseUrl = '/') {
    this.ctx = audioCtx;
    this.events = events;
    this.baseUrl = baseUrl;
    this.buffers = new Map();
    this.sources = [];
  }

  async load() {
    const files = [...new Set(this.events.map((e) => e.file))];
    await Promise.all(files.map(async (f) => {
      try {
        const res = await fetch(this.baseUrl + f);
        if (!res.ok) throw new Error(res.status);
        this.buffers.set(f, await this.ctx.decodeAudioData(await res.arrayBuffer()));
      } catch (err) {
        console.warn(`[sfx] could not load ${f}: ${err}`); // preview keeps playing without this cue
      }
    }));
  }

  start(offset, volume = 0.8) {
    this.stop();
    const now = this.ctx.currentTime;
    for (const e of this.events) {
      const buf = this.buffers.get(e.file);
      if (!buf || e.time + buf.duration < offset) continue;
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      gain.gain.value = e.volume * volume;
      src.buffer = buf;
      src.connect(gain).connect(this.ctx.destination);
      const delay = e.time - offset;
      if (delay >= 0) src.start(now + delay);
      else src.start(now, -delay);
      this.sources.push(src);
    }
  }

  stop() {
    for (const s of this.sources) { try { s.stop(); } catch { /* already stopped */ } }
    this.sources = [];
  }
}
