// Timeline anchored to the narration words (stories/guci-terkutuk/voice/words.json): re-making words.json re-times the film.
import WORDS from "../../stories/guci-terkutuk/voice/words.json";
export const FPS = 30;
type Word = { w: string; s: number; e: number; beat: number };
const words = WORDS as Word[];
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
/** frame where `text` (k-th occurrence) starts inside script line `beat` */
export const B = (beat: number, text: string, k = 1) => {
  let c = 0;
  for (const w of words) if (w.beat === beat && norm(w.w) === norm(text) && ++c === k) return Math.round(w.s * FPS);
  throw new Error(`story.ts: "${text}" #${k} not in line ${beat}`);
};
export const LEAD = 2;
const beatStart = (b: number) => Math.round(words.find((w) => w.beat === b)!.s * FPS);
export const VOICE_END = Math.round(words[words.length - 1].e * FPS);
export const TOTAL = VOICE_END + 10;
/** shot i (1..14) = script line i */
export const SHOTS = Array.from({ length: 14 }, (_, i) => {
  const from = i === 0 ? 0 : beatStart(i + 1) - LEAD;
  const to = i === 13 ? TOTAL : beatStart(i + 2) - LEAD;
  return { n: i + 1, from, dur: to - from };
});
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** 0..1 ramp over `len` frames starting at frame `at` (global) */
export const ramp = (f: number, at: number, len = 8) => smooth((f - at) / len);
