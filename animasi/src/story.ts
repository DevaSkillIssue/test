// Guci Terkutuk timeline (stories/guci-terkutuk/voice/words.json).
import WORDS from "../../stories/guci-terkutuk/voice/words.json";
import { makeTimeline, Word } from "./timeline";
export { FPS, LEAD, clamp01, smooth, ramp } from "./timeline";
export const { B, VOICE_END, TOTAL, SHOTS } = makeTimeline(WORDS as Word[], 14);
