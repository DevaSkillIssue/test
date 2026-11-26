// "Dokter yang Diejek karena Cuci Tangan" timeline (stories/cuci-tangan/voice/words.json).
import WORDS from "../../../stories/cuci-tangan/voice/words.json";
import { makeTimeline, Word } from "../timeline";
export { FPS, clamp01, smooth, ramp } from "../timeline";
export const { B, VOICE_END, TOTAL, SHOTS } = makeTimeline(WORDS as Word[], 14);
