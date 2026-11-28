// "Banjir Bir London 1814" — 14 shots, one per script line (stories/banjir-bir/SCRIPT.md); painted + ink look,
// fast cutting (2-3 camera setups per line, cut on the stressed word), a white flash and kick-shake on the burst.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { SHOTS, B, ramp, clamp01 } from "./story";
import { Card, Cuts, Light, Post, Shadows, Box, Toon, Lamp, V3 } from "../kit";
import { Vat, Gush, Flood, Flotsam, Hall, Lane, Cellar, Court, Tank, Coins, Sack, BEER, FOAM, OAK, CLERK, BOSS, WORKER, MOTHER, CHILD, EATER, JUDGE, MEUX, CLERK_GOV } from "./sets";

type SP = { f: number; s: number; end: number };
const hit = (f: number, at: number, d = 6, os = 0.25) => { const u = clamp01((f - at) / d); return u < 1 ? (u * u * (3 - 2 * u)) * (1 + os) : 1 + os * (1 - clamp01((f - at - d) / (d * 1.5))); };
/** impact kick: sign flips every frame, decays over 7 f */
const kick = (f: number, at: number, a = 0.12) => { const d = f - at; return d < 0 || d > 7 ? 0 : a * (1 - d / 7) * (d % 2 ? -1 : 1); };
const VATS: V3[] = [[0, 0, -2], [4.6, 0, -2], [-4.6, 0, -2]];
const DAY = { bg: "#2a1e16", sky: "#ffd8a0", sun: "#ffe2b8", ground: "#3a2a20" };

const S: React.FC<SP>[] = [
  // 1 hook: a London lane at dusk under a sea of beer, things floating
  ({ f, s, end }) => {
    const lvl = 0.35 + 0.65 * ramp(f, s, 50);
    return (<>
      <Light bg="#3a3550" sky="#8a90c0" sun="#ffb070" k={0.9} dir={[-4, 4, 6]} fog={[8, 30]} />
      <Shadows /><Lane f={f} dusk fall={1} />
      <Flood y={lvl} /><Flotsam y={lvl} f={f} spread={[2.2, 5]} />
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 3.5, 8], to: [0, 3.0, 6.5], look: [0, 1, -8], fov: 50 },
        { at: B(1, "tenggelam") - 3, from: [0.4, lvl + 0.6, 2.6], to: [0.3, lvl + 0.55, 2.2], look: [0, lvl, -0.6], fov: 42 },
        { at: B(1, "bir") - 3, from: [0, 6.5, 10], to: [0, 6.2, 9.4], look: [0, 0.5, -6], fov: 50 }]} />
      <Post light="golden" cInf={8} focus={[0, lvl, -1]} grade={0.7} />
    </>);
  },
  // 2 the Meux brewery: a vat two storeys tall, 600 000 litres
  ({ f, s, end }) => (<>
    <Light {...DAY} k={0.9} dir={[-5, 8, 5]} hemi={0.6} />
    <Shadows /><Hall f={f} />
    {VATS.map((p, i) => <Vat key={i} p={p} f={f} />)}
    <Card o={WORKER(0)} f={f} seed={3} pos={[2.2, 0, 0.6]} opts={{ expr: "neutral", look: -0.5 }} />
    <Cuts f={f} end={end} cuts={[
      { at: s, from: [0, 2.2, 11], to: [0, 2.4, 10.2], look: [0, 3, -2], fov: 50 },
      { at: B(2, "setinggi") - 3, from: [0.8, 0.9, 4.6], to: [0.7, 1.0, 4.2], look: [0, 5.5, -2], fov: 56 },
      { at: B(2, "enam") - 3, from: [0.5, 8.6, 1.2], to: [0.4, 8.3, 0.8], look: [0, 6, -2], fov: 46 }]} />
    <Post light="day" cInf={6} focus={[0, 3, -0.2]} grade={0.6} />
  </>),
  // 3 dozens of iron hoops hold it together
  ({ f, s, end }) => (<>
    <Light {...DAY} k={0.9} dir={[-5, 8, 5]} hemi={0.6} />
    <Shadows /><Hall f={f} />
    {VATS.map((p, i) => <Vat key={i} p={p} f={f} />)}
    <Cuts f={f} end={end} cuts={[
      { at: s, from: [1.6, 1.4, 1.8], to: [1.5, 2.6, 1.7], look: [0, 1.8, -0.2], fov: 44 },
      { at: B(3, "mengikat") - 3, from: [-1.3, 3.4, 2.0], to: [-1.2, 4.2, 1.9], look: [0, 3.8, -0.2], fov: 44 }]} />
    <Post light="day" cInf={12} focus={[0, 2.5, -0.2]} grade={0.6} />
  </>),
  // 4 one evening a hoop slips; the clerk points, his boss waves it off ("aman")
  ({ f, s, end }) => {
    const slip = ramp(f, B(4, "merosot") - 4, 10), wave = ramp(f, B(4, "aman") - 6, 6);
    return (<>
      <Light {...DAY} sun="#ffc88a" k={0.85} dir={[-6, 5, 5]} hemi={0.55} />
      <Shadows /><Hall f={f} />
      {VATS.map((p, i) => <Vat key={i} p={p} f={f} slip={i === 0 ? slip : 0} />)}
      <Card o={CLERK} f={f} seed={4} pos={[1.05, 0, 0.6]} opts={{ arm: "point", armK: 1, expr: slip > 0.5 ? "worried" : "thinking", look: -0.6 }} flipX />
      <Card o={BOSS} f={f} seed={5} pos={[-1.3, 0, 0.9]} opts={{ expr: wave > 0.5 ? "unbothered" : "bored", arm: wave > 0.3 ? "shrug" : undefined, armK: wave }} />
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0.5, 1.6, 4.8], to: [0.45, 1.55, 4.4], look: [0.3, 1.3, -0.2], fov: 48 },
        { at: B(4, "merosot") - 3, from: [0.3, 1.1, 1.6], to: [0.25, 1.05, 1.45], look: [0, 0.9, -0.2], fov: 40 },
        { at: B(4, "atasannya") - 3, from: [-0.9, 1.6, 3.6], to: [-0.95, 1.6, 3.3], look: [-1.3, 1.4, 0.9], fov: 42 }]} />
      <Post light="golden" cInf={10} focus={[0, 1.4, 0.6]} grade={0.6} />
    </>);
  },
  // 5 an hour later the vat bursts (white flash + kick in <Bir>)
  ({ f, s, end }) => {
    const at = B(5, "meledak") - 2, burst = clamp01((f - at) / 24), shake = ramp(f, s, 20) * (1 - burst), k = kick(f, at, 0.18);
    return (<>
      <Light {...DAY} sun="#ffb070" k={0.8} dir={[-6, 5, 5]} hemi={0.5} />
      <group position={[k, -k * 0.5, 0]}>
        <Shadows /><Hall f={f} dark={0.3} />
        <Vat p={VATS[0]} f={f} burst={burst} shake={shake} />
        <Vat p={VATS[1]} f={f} /><Vat p={VATS[2]} f={f} />
        <Gush p={VATS[0]} k={burst} />
      </group>
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 2.4, 7.6], to: [0, 2.5, 6.9], look: [0, 3, -2], fov: 48 },
        { at: at - 1, from: [0, 3, 12.5], to: [0, 3.2, 12], look: [0, 2.5, -2], fov: 56 }]} />
      <Post light="golden" cInf={4} focus={[0, 2.5, -2]} grade={0.6} />
    </>);
  },
  // 6 the wave of beer bursts the next vat, then the next
  ({ f, s, end }) => {
    const b1 = clamp01((f - B(6, "memecahkan")) / 22), b2 = clamp01((f - B(6, "berikutnya")) / 22);
    const k = kick(f, B(6, "memecahkan"), 0.12) + kick(f, B(6, "berikutnya"), 0.12);
    return (<>
      <Light {...DAY} sun="#ffb070" k={0.8} dir={[-6, 5, 5]} hemi={0.5} />
      <group position={[k, 0, 0]}>
        <Shadows /><Hall f={f} dark={0.3} />
        <Vat p={VATS[0]} f={f} burst={1} />
        <Vat p={VATS[1]} f={f} burst={b1} shake={1 - b1} /><Vat p={VATS[2]} f={f} burst={b2} shake={1 - b2} />
        <Flood y={0.5 + 0.4 * ramp(f, s, 60)} />
        <Gush p={VATS[1]} k={b1} /><Gush p={VATS[2]} k={b2} />
      </group>
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [2.6, 2.6, 9], to: [3.0, 2.6, 8.4], look: [4.6, 2.5, -2], fov: 50 },
        { at: B(6, "berikutnya") - 3, from: [-2.6, 2.6, 9], to: [-3.0, 2.6, 8.4], look: [-4.6, 2.5, -2], fov: 50 }]} />
      <Post light="golden" cInf={5} focus={[0, 2.5, -2]} grade={0.6} />
    </>);
  },
  // 7 1.5 million litres smash the brewery wall and knock down two houses
  ({ f, s, end }) => {
    const breach = ramp(f, B(7, "menjebol") - 3, 10), fall = ramp(f, B(7, "merobohkan") - 2, 22), front = -13 + 16 * ramp(f, B(7, "menjebol"), 50);
    const k = kick(f, B(7, "menjebol") - 3, 0.1) + kick(f, B(7, "merobohkan"), 0.1);
    return (<>
      <Light bg="#5a5468" sky="#a8a0c0" sun="#ffb070" k={0.9} dir={[-5, 4, 6]} fog={[10, 34]} />
      <group position={[k, 0, 0]}>
        <Shadows /><Lane f={f} fall={fall} />
        {/* brewery wall at the end of the lane, its bricks flying out */}
        {Array.from({ length: 24 }, (_, i) => {
          const x = -3 + (i % 8) * 0.85, y = 0.6 + Math.floor(i / 8) * 1.3, out = breach * (2 + (i % 5)) * (i % 8 > 1 && i % 8 < 6 ? 1 : 0.1);
          return <Box key={i} p={[x * (1 + out * 0.05), y + out * 0.4 - out * out * 0.08, -14 + out]} s={[0.8, 1.2, 0.5]} c={i % 2 ? "#8a4a3a" : "#7a3e30"} r={[out * 0.2, out * 0.3, 0]} />;
        })}
        <Flood y={breach * 1.1} front={front} z0={3} />
      </group>
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 3, 6.5], to: [0, 3, 5.8], look: [0, 2, -12], fov: 50 },
        { at: B(7, "menjebol") - 3, from: [0, 2.2, -5], to: [0, 2.4, -4], look: [0, 2, -14], fov: 50 },
        { at: B(7, "merobohkan") - 3, from: [-1.6, 2.6, 3.2], to: [-1.5, 2.6, 2.8], look: [2.6, 2.2, -4], fov: 52 }]} />
      <Post light="golden" cInf={4} focus={[0, 2, -8]} grade={0.65} />
    </>);
  },
  // 8 the neighbours live in cellars; the beer pours down the stairs and fills the room
  ({ f, s, end }) => {
    const pour = ramp(f, B(8, "membanjiri") - 6, 8), lvl = 1.1 * ramp(f, B(8, "membanjiri"), 40), up = ramp(f, B(8, "membanjiri") + 8, 10);
    return (<>
      <Light bg="#1a1612" sky="#8a7a6a" sun="#ffd0a0" k={0.5} dir={[3, 5, 4]} hemi={0.6} />
      <Shadows /><Cellar f={f} />
      {/* the beer pours in through the street window and down the wall */}
      {pour > 0 && <Box p={[-1.2, 2.3 - 1.15 * pour, -1.95]} s={[0.8, 2.3 * pour, 0.12]} c="#6a3814" />}
      {pour > 0 && <Box p={[-1.2, 0.05 + lvl, -1.75]} s={[1.3, 0.1, 0.5]} c={FOAM} />}
      <Flood y={lvl} w={6} d={5} z0={2.5} />
      <Card o={MOTHER} f={f} seed={6} pos={[-0.9, up * 0.44, -0.6]} opts={{ expr: pour > 0.5 ? "terror" : "content", arm: pour > 0.5 ? "up" : undefined, armK: 1 }} />
      <Card o={CHILD} f={f} seed={7} h={1.3} pos={[-0.3, up * 0.44, -0.5]} opts={{ expr: pour > 0.5 ? "fear" : "joy" }} />
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 1.6, 3.2], to: [0, 1.55, 2.9], look: [-0.4, 1.0, -0.8], fov: 50 },
        { at: B(8, "membanjiri") - 3, from: [0.6, 1.3, 2.4], to: [0.5, 1.25, 2.2], look: [-0.9, 1.0, -1.4], fov: 50 }]} />
      <Post light="night" cInf={9} focus={[-0.6, 1.1, -0.6]} grade={0.7} />
    </>);
  },
  // 9 luckily every brewery worker survived (up on the gantry); unluckily, eight neighbours did not (the dark lane)
  ({ f, s, end }) => {
    const sad = f >= B(9, "Sayangnya") - 2;
    return sad ? (<>
      <Light bg="#141828" sky="#4a5a90" sun="#8fa0e0" k={0.5} dir={[-3, 5, 4]} fog={[6, 22]} />
      <Shadows /><Lane f={f} fall={1} dusk />
      <Flood y={0.45} /><Flotsam y={0.45} f={f} n={8} spread={[2, 4]} />
      <Cuts f={f} end={end} cuts={[{ at: B(9, "Sayangnya") - 2, from: [0, 1.6, 4.5], to: [0, 1.5, 3.8], look: [0, 0.5, -2], fov: 46 }]} />
      <Post light="night" cInf={10} focus={[0, 0.5, -1]} grade={0.8} />
    </>) : (<>
      <Light {...DAY} k={0.85} dir={[-5, 8, 5]} hemi={0.6} />
      <Shadows /><Hall f={f} />
      <Flood y={0.8} /><Flotsam y={0.8} f={f} spread={[4, 3]} />
      <Box p={[0, 2.5, 0.4]} s={[5, 0.15, 1.2]} c={OAK} />
      {[-2.3, 2.3].map((x) => <Box key={x} p={[x, 1.25, 0.4]} s={[0.15, 2.5, 0.15]} c={OAK} />)}
      {[0, 1, 2].map((i) => <Card key={i} o={WORKER(i)} f={f} seed={10 + i} pos={[-1.1 + i * 1.1, 2.58, 0.4]} opts={{ expr: f > B(9, "selamat") - 3 ? "relief" : "alarmed", arm: f > B(9, "selamat") ? "up" : undefined, armK: 1 }} />)}
      <Cuts f={f} end={end} cuts={[{ at: s, from: [0, 2.8, 7.2], to: [0, 2.8, 6.6], look: [0, 2.2, 0.4], fov: 50 }]} />
      <Post light="day" cInf={8} focus={[0, 3.4, 0.4]} grade={0.6} />
    </>);
  },
  // 10 imagine your trousers too tight after a buffet
  ({ f, s, end }) => {
    const tight = ramp(f, B(10, "kesempitan") - 2, 12);
    return (<>
      <Light bg="#3a2a1e" sky="#ffe0b0" sun="#fff0d0" k={1.0} dir={[-4, 6, 5]} hemi={0.6} />
      <Shadows />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, 20]} /><Toon c="#8a6a4a" /></mesh>
      <Box p={[0, 1.6, -2]} s={[10, 3.2, 0.2]} c="#c9a878" />
      <Box p={[0.9, 0.75, -0.9]} s={[2.2, 0.08, 0.9]} c="#f4f1ea" /><Box p={[0.9, 0.37, -0.9]} s={[2.0, 0.74, 0.8]} c="#6a4a32" />
      {Array.from({ length: 7 }, (_, i) => <group key={i} position={[0.1 + i * 0.27, 0.8, -0.9 + (i % 2) * 0.2]}>
        <mesh><cylinderGeometry args={[0.12, 0.1, 0.02, 16]} /><Toon c="#f8f6f0" /></mesh>
        <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.07, 10, 8]} /><Toon c={["#c9582a", "#e8b84a", "#6a8a3a", "#a8442a", "#f0d0a0", "#7a3a2a", "#e89a4a"][i]} /></mesh>
      </group>)}
      <group position={[-0.5, 0, 0]} scale={[1 + 0.18 * tight, 1, 1]}>
        <Card o={EATER} f={f} seed={8} pos={[0, 0, 0]} opts={{ expr: tight > 0.5 ? "awkward" : "delighted", arm: "chest", armK: 1 }} />
      </group>
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 1.5, 3.8], to: [0, 1.45, 3.4], look: [0, 1.1, -0.2], fov: 46 },
        { at: B(10, "prasmanan") - 3, from: [1.3, 1.3, 1.6], to: [1.2, 1.3, 1.45], look: [0.8, 0.85, -0.9], fov: 44 }]} />
      <Post light="golden" cInf={10} focus={[-0.5, 1.2, 0]} grade={0.6} />
    </>);
  },
  // 11 one button pops, the next takes the strain and pops too... the vat's hoops did the same
  ({ f, s, end }) => {
    const p1 = ramp(f, B(11, "lepas") - 2, 10), p2 = ramp(f, B(11, "lepas", 2) - 2, 10), hoops = ramp(f, B(11, "Cincin") + 4, 30);
    const vat = f >= B(11, "Cincin") - 3;
    return vat ? (<>
      <Light {...DAY} k={0.85} dir={[-5, 8, 5]} hemi={0.6} />
      <Shadows /><Hall f={f} />
      <Vat p={VATS[0]} f={f} hoopsOff={hoops} shake={1} />
      <Cuts f={f} end={end} cuts={[{ at: B(11, "Cincin") - 3, from: [0, 3, 8.2], to: [0, 3.1, 7.6], look: [0, 3, -2], fov: 50 }]} />
      <Post light="day" cInf={6} focus={[0, 3, -0.2]} grade={0.6} />
    </>) : (<>
      <Light bg="#3a2a1e" sky="#ffe0b0" sun="#fff0d0" k={1.0} dir={[-4, 6, 5]} hemi={0.6} />
      <Shadows />
      <Box p={[0, 1.6, -2]} s={[10, 3.2, 0.2]} c="#c9a878" />
      <group position={[-0.5, 0, 0]} scale={[1.18, 1, 1]}>
        <Card o={EATER} f={f} seed={8} pos={[0, 0, 0]} opts={{ expr: p2 > 0.5 ? "shock" : p1 > 0.5 ? "cringe" : "awkward", arm: "chest", armK: 1 }} />
      </group>
      {/* trouser buttons: the first flies at the lens on "lepas", the second on the second "lepas" */}
      {[p1, p2, 0].map((p, i) => <mesh key={i} position={[-0.42 + p * (0.3 - i * 0.5), 0.78 + i * 0.09 + p * 0.4 - p * p * 0.5, 0.06 + p * 1.0]} rotation={[p * 9, p * 5, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.015, 14]} /><Toon c="#2a1a12" /></mesh>)}
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [-0.45, 0.95, 1.5], to: [-0.45, 0.93, 1.35], look: [-0.45, 0.85, 0], fov: 40 },
        { at: B(11, "menanggung") - 3, from: [-0.1, 1.0, 1.4], to: [-0.12, 0.98, 1.3], look: [-0.4, 0.88, 0], fov: 38 }]} />
      <Post light="golden" cInf={11} focus={[-0.45, 0.85, 0]} grade={0.6} />
    </>);
  },
  // 12 the judge calls it an act of God; nobody is to blame (gavel)
  ({ f, s, end }) => {
    const g = hit(f, B(12, "tidak") - 2, 4, 0.2), up = ramp(f, B(12, "Tuhan") - 6, 6);
    return (<>
      <Light bg="#1e140e" sky="#ffcf9a" sun="#ffd8a8" k={0.7} dir={[-4, 6, 5]} hemi={0.55} />
      <Shadows /><Court f={f} gavel={clamp01(g)} />
      <Card o={JUDGE} f={f} seed={9} pos={[0, 0.9, -2.0]} opts={{ expr: "deadpan", arm: up > 0.3 ? "up" : undefined, armK: up }} />
      <Card o={MEUX} f={f} seed={12} pos={[1.9, 0, 0.3]} opts={{ expr: "smug", look: -0.5 }} />
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 1.8, 4.6], to: [0, 1.85, 4.2], look: [0, 2.0, -1.8], fov: 48 },
        { at: B(12, "Tuhan") - 4, from: [0, 2.45, 1.0], to: [0, 2.45, 0.85], look: [0, 2.4, -2.0], fov: 42 },
        { at: B(12, "tidak") - 3, from: [1.0, 1.9, 0.3], to: [0.95, 1.88, 0.2], look: [0.7, 1.5, -1.3], fov: 40 }]} />
      <Post light="golden" cInf={11} focus={[0, 2.2, -1.8]} grade={0.65} />
    </>);
  },
  // 13 breweries start swapping giant wooden vats for concrete tanks
  ({ f, s, end }) => {
    const out = ramp(f, B(13, "mengganti"), 24), drop = 1 - ramp(f, B(13, "beton") - 14, 12), k = kick(f, B(13, "beton") - 2, 0.12);
    return (<>
      <Light bg="#2a2420" sky="#e8e4dc" sun="#fff4e4" k={1.0} dir={[-5, 8, 5]} hemi={0.65} />
      <group position={[0, k, 0]}>
        <Shadows /><Hall f={f} />
        <group position={[out * 9, 0, 0]}><Vat p={VATS[0]} f={f} /></group>
        <Tank p={VATS[0]} y={drop * 9} />
        <Tank p={VATS[1]} /><Vat p={VATS[2]} f={f} />
      </group>
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0, 3, 12.5], to: [0, 3.1, 12], look: [0, 3, -2], fov: 56 },
        { at: B(13, "beton") - 3, from: [2.6, 1.8, 6.2], to: [2.5, 1.85, 5.8], look: [0, 2.5, -2], fov: 48 }]} />
      <Post light="day" cInf={4} focus={[0, 2.5, -2]} grade={0.6} />
    </>);
  },
  // 14 the brewery itself got paid: the government refunds the tax on every pint spilled
  ({ f, s, end }) => {
    const bag = ramp(f, B(14, "uang") - 6, 6), more = ramp(f, B(14, "mengembalikan"), 30);
    return (<>
      <Light bg="#1e140e" sky="#ffcf9a" sun="#ffd8a8" k={0.8} dir={[-4, 6, 5]} hemi={0.55} />
      <Shadows />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, 20]} /><Toon c="#5a3a26" /></mesh>
      <Box p={[0, 2, -1.8]} s={[10, 4, 0.2]} c="#6a4a6a" />
      <Box p={[0.1, 0.72, -0.6]} s={[1.8, 0.06, 0.8]} c="#5a3a22" /><Box p={[0.1, 0.36, -0.6]} s={[1.7, 0.7, 0.7]} c="#4a2e1a" />
      <Sack p={[0.3, 0.75 + (1 - bag) * 0.8, -0.55]} s={0.9} />
      <Coins p={[-0.15, 0.75, -0.5]} n={Math.round(3 + 18 * more)} />
      <mesh position={[0.75, 0.86, -0.6]}><cylinderGeometry args={[0.06, 0.05, 0.22, 14]} /><meshStandardMaterial color={BEER} transparent opacity={0.85} roughness={0.2} /></mesh>
      <mesh position={[0.75, 0.98, -0.6]}><cylinderGeometry args={[0.062, 0.062, 0.03, 14]} /><Toon c={FOAM} /></mesh>
      <Lamp p={[-0.8, 1.0, -0.8]} f={f} k={0.8} />
      <Card o={MEUX} f={f} seed={12} pos={[-0.55, 0, -1.1]} opts={{ expr: more > 0.3 ? "smug_content" : "plotting", arm: "chest", armK: 1 }} />
      <Card o={CLERK_GOV} f={f} seed={13} pos={[0.95, 0, -1.0]} opts={{ expr: "bored", arm: "reach", armK: 1 - more * 0.5 }} />
      <Cuts f={f} end={end} cuts={[
        { at: s, from: [0.2, 1.6, 3.6], to: [0.2, 1.55, 3.2], look: [0.1, 1.15, -0.7], fov: 48 },
        { at: B(14, "mengembalikan") - 3, from: [0.2, 1.2, 0.9], to: [0.18, 1.15, 0.75], look: [0.1, 0.82, -0.5], fov: 42 },
        { at: B(14, "tumpah") - 3, from: [-0.35, 1.6, 1.2], to: [-0.4, 1.6, 1.05], look: [-0.55, 1.5, -1.1], fov: 42 }]} />
      <Post light="golden" cInf={10} focus={[-0.2, 1.2, -0.8]} grade={0.65} />
    </>);
  },
];

const ShotView: React.FC<{ i: number; from: number; dur: number }> = ({ i, from, dur }) => {
  const lf = useCurrentFrame(), { width, height } = useVideoConfig();
  const Scene = S[i];
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true }} shadows>
      <Scene f={from + lf} s={from} end={from + dur} />
    </ThreeCanvas>
  );
};

/** white flash on the burst (2 f up, 8 f down) */
const Flash: React.FC = () => {
  const f = useCurrentFrame(), at = B(5, "meledak") - 2, d = f - at;
  const o = d < 0 ? 0 : d < 2 ? d / 2 : Math.max(0, 1 - (d - 2) / 8);
  return o > 0 ? <AbsoluteFill style={{ backgroundColor: "#fff", opacity: o * 0.9 }} /> : null;
};

export const Bir: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {SHOTS.map((s, i) => (
      <Sequence key={s.n} from={s.from} durationInFrames={s.dur} name={`shot ${s.n}`}>
        <ShotView i={i} from={s.from} dur={s.dur} />
      </Sequence>
    ))}
    <Flash />
    <Audio src={staticFile("bir/voice.wav")} />
  </AbsoluteFill>
);
