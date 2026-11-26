import { Composition } from "remotion";
import { Guci } from "./Guci";
import { TOTAL, FPS } from "./story";
export const Root = () => <Composition id="GuciShort" component={Guci} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />;
