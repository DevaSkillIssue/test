// one frame 8 f after every camera cut of CuciShort (reads the cut anchors from Cuci.tsx)
import fs from "node:fs";
const W = JSON.parse(fs.readFileSync("../stories/cuci-tangan/voice/words.json"));
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
const B = (b, t) => Math.round(W.find((w) => w.beat === b && norm(w.w) === norm(t)).s * 30);
const start = (b) => b === 1 ? 0 : Math.round(W.find((w) => w.beat === b).s * 30) - 2;
const src = fs.readFileSync("src/cuci/Cuci.tsx", "utf8");
const out = [];
for (const m of src.matchAll(/<Cuts f=\{f\} end=\{end\} cuts=\{\[(.*?)\]\} \/>/g)) {
  const shot = out.length ? null : null;
  for (const a of m[1].matchAll(/at: (s|B\((\d+), "([^"]+)"\) - (\d+))/g)) out.push(a[1] === "s" ? "S" : B(+a[2], a[3]) - +a[4] + 8);
}
let shotN = 0; const frames = out.map((x) => x === "S" ? start(++shotN) + 8 : x);
console.log(frames.join(" "));
