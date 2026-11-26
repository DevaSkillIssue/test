// Pure logic shared by render.mjs and the tests: story validation and word timing.
export const WORDS_PER_SEC = 3.67; // narration pace measured in the article's frame study
export const SETS = ['village', 'room', 'field'];
export const CAMERAS = ['push_in', 'pull_out', 'pan_left', 'pan_right', 'orbit', 'crane_up', 'low_angle', 'shake'];
export const ACTIONS = ['idle', 'walk', 'run', 'point', 'wave', 'shrug', 'cheer', 'jump', 'think'];
export const FACES = ['neutral', 'happy', 'sad', 'angry', 'shock', 'scared', 'smirk'];

const words = text => text.split(/\s+/).filter(Boolean);
export const estimateDuration = text => Math.max(1.2, words(text).length / WORDS_PER_SEC + 0.25);

export function validateStory(s) {
  const err = m => { throw new Error(`story: ${m}`); };
  if (!s || !Array.isArray(s.shots) || !s.shots.length) err('"shots" must be a non-empty array');
  const cast = s.cast || {};
  s.shots.forEach((sh, i) => {
    const at = `shot ${i + 1}`;
    if (typeof sh.text !== 'string' || !sh.text.trim()) err(`${at}: "text" is required`);
    if (sh.set && !SETS.includes(sh.set)) err(`${at}: unknown set "${sh.set}" (use ${SETS.join(', ')})`);
    if (sh.camera && !CAMERAS.includes(sh.camera)) err(`${at}: unknown camera "${sh.camera}" (use ${CAMERAS.join(', ')})`);
    for (const a of sh.actors || []) {
      if (!cast[a.id]) err(`${at}: actor "${a.id}" is not in "cast"`);
      if (a.action && !ACTIONS.includes(a.action)) err(`${at}: unknown action "${a.action}"`);
      for (const f of [].concat(a.face || [])) if (!FACES.includes(f)) err(`${at}: unknown face "${f}"`);
    }
    for (const k of ['speaker', 'focus']) if (sh[k] && !(sh.actors || []).some(a => a.id === sh[k])) err(`${at}: ${k} "${sh[k]}" is not in this shot's actors`);
  });
  return s;
}

// shortcut: word times are spread by letter count, not measured; use ElevenLabs /with-timestamps or Whisper if captions drift.
export function buildTimeline(shots, durations) {
  let start = 0;
  return shots.map((sh, i) => {
    const dur = durations[i], ws = words(sh.text);
    const total = ws.reduce((n, w) => n + w.length + 1, 0);
    let c = 0;
    const timed = ws.map(w => {
      const a = start + dur * c / total;
      c += w.length + 1;
      return { w, start: a, end: start + dur * c / total };
    });
    const seg = { start, dur, words: timed };
    start += dur;
    return seg;
  });
}
