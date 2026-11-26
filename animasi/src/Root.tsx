import { Composition } from "remotion";
import { Guci } from "./Guci";
import { Cuci } from "./cuci/Cuci";
import { TOTAL, FPS } from "./story";
import { TOTAL as CUCI_TOTAL } from "./cuci/story";
export const Root = () => (<>
  <Composition id="GuciShort" component={Guci} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
  <Composition id="CuciShort" component={Cuci} durationInFrames={CUCI_TOTAL} fps={FPS} width={1080} height={1920} />
</>);
