// "Banjir Bir London 1814" timeline (stories/banjir-bir/voice/words.json).
import WORDS from "../../../stories/banjir-bir/voice/words.json";
import { makeTimeline, Word } from "../timeline";
export { FPS, clamp01, smooth, ramp } from "../timeline";
export const { B, VOICE_END, TOTAL, SHOTS } = makeTimeline(WORDS as Word[], 14);
