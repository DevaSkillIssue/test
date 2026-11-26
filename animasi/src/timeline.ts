// Timeline anchored to narration words: re-making a short's words.json re-times its film.
export const FPS = 30;
export type Word = { w: string; s: number; e: number; beat: number };
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** 0..1 ramp over `len` frames starting at frame `at` (global) */
export const ramp = (f: number, at: number, len = 8) => smooth((f - at) / len);
export const LEAD = 2;
/** one shot per script line (beat); B(beat, word) = frame the word starts */
export const makeTimeline = (words: Word[], nShots: number) => {
  const B = (beat: number, text: string, k = 1) => {
    let c = 0;
    for (const w of words) if (w.beat === beat && norm(w.w) === norm(text) && ++c === k) return Math.round(w.s * FPS);
    throw new Error(`timeline: "${text}" #${k} not in line ${beat}`);
  };
  const beatStart = (b: number) => Math.round(words.find((w) => w.beat === b)!.s * FPS);
  const VOICE_END = Math.round(words[words.length - 1].e * FPS), TOTAL = VOICE_END + 10;
  const SHOTS = Array.from({ length: nShots }, (_, i) => {
    const from = i === 0 ? 0 : beatStart(i + 1) - LEAD, to = i === nShots - 1 ? TOTAL : beatStart(i + 2) - LEAD;
    return { n: i + 1, from, dur: to - from };
  });
  return { B, VOICE_END, TOTAL, SHOTS };
};
