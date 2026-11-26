// Renders one still per shot (at the shot's key moment) into out/stills/, then a contact sheet.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const BX = "/opt/pw-browsers/chromium_headless_shell";
const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "GuciShort", chromiumOptions: { gl: "angle" }, browserExecutable: BX });
for (const f of frames) {
  await renderStill({ serveUrl, composition, frame: f, output: `out/stills/${process.env.COMP ?? "GuciShort"}_f${String(f).padStart(4, "0")}.png`, scale: 0.5, chromiumOptions: { gl: "angle" }, browserExecutable: BX });
  console.log("still", f);
}
