// "Guci Terkutuk" — 14 shots, one per script line (stories/guci-terkutuk/storyboard/THUMBS.md).
// Every shot: key light with shadows, practicals in interiors / night, painted post (Post) focused on its subject.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { SHOTS, B, ramp, clamp01 } from "./story";
import { Treasury } from "./Treasury";
import { Card, Box, Jar, Mosquito, Paper, Light, Cam, Toon, Lamp, Win, House, Post, Shadows, V3, CARTER, CARTER_OLD, CARN, REPORTER, DOCTOR, OLDMAN, CROWD } from "./kit";

type SP = { f: number; t: number };
const Floor: React.FC<{ c: string; s?: number }> = ({ c, s = 30 }) => <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[s, s]} /><Toon c={c} /></mesh>;

// ---- shared sets ----
/** shots 1 and 14: the jar on a table at night, one candle, the mosquito lands on the lid on the word */
const JarCU: React.FC<SP & { landAt: number }> = ({ f, t, landAt }) => {
  const k = ramp(f, landAt - 20, 20);
  const mp: V3 = [0.04 + (1 - k) * 0.9, 0.98 + (1 - k) * 0.5 + Math.sin(f * 0.4) * 0.02 * (1 - k), 0.05];
  return (<>
    <Light bg="#0e1530" sky="#4a64b0" sun="#8fa6ff" ground="#0a0e1c" k={0.6} hemi={0.35} dir={[-3, 4, 3]} fog={[3, 9]} />
    <Shadows />
    <Box p={[0, -0.1, 0]} s={[2.2, 0.2, 1.4]} c="#5b3d2a" />
    <Box p={[0, 1.0, -1.4]} s={[5, 2.6, 0.1]} c="#24305a" />
    {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[-1.25 + i * 0.5, 1.5, -1.33]} s={[0.12, 0.3, 0.02]} c={i % 2 ? "#3a4a8a" : "#6a3a3a"} />)}
    <Jar p={[0, 0, 0]} s={1.25} />
    <Lamp p={[-0.65, 0.2, 0.2]} f={f} k={0.8} />
    <Box p={[0.7, 0.08, -0.2]} s={[0.35, 0.16, 0.25]} c="#c9a56c" />
    <Paper p={[0.6, 0.01, 0.35]} r={[-Math.PI / 2, 0, 0.4]} s={0.6} />
    <Mosquito p={mp} f={f} s={1.3} land={k} />
    <Cam f={f} t={t} from={[0.2, 1.6, 2.6]} to={[0.08, 1.2, 2.1]} look={[0, 0.8, 0]} lookTo={[0, 0.85, 0]} fov={38} />
    <Post light="night" cInf={15} focus={[0, 1.0, 0]} />
  </>);
};
const Door: React.FC<{ glyph: number; red: boolean }> = ({ glyph, red }) => (<>
  <Box p={[0, 1.5, -0.2]} s={[4, 3.4, 0.3]} c="#8a6a45" />
  <Box p={[0, 1.2, -0.03]} s={[1.5, 2.4, 0.1]} c="#4a3622" />
  <Box p={[0, 2.5, 0.0]} s={[1.9, 0.25, 0.2]} c="#a8865a" />
  {[-1.15, 1.15].map((x) => <Box key={x} p={[x, 1.25, 0.05]} s={[0.35, 2.5, 0.25]} c="#9a7a50" />)}
  <Floor c="#6a4e30" s={12} />
  {/* the door seals (rope + clay) Carter found intact */}
  <mesh position={[0, 1.2, 0.05]}><circleGeometry args={[0.12, 16]} /><Toon c="#8a3a2a" /></mesh>
  {Array.from({ length: 8 }, (_, i) => {
    const on = clamp01(glyph * 8 - i), x = -0.45 + (i % 4) * 0.3, y = 2.0 - Math.floor(i / 4) * 0.5;
    const mat = <meshBasicMaterial color={red ? [2.4, 0.35, 0.25] : "#ff3a2a"} toneMapped={false} />;
    return on > 0 && (i % 2
      ? <mesh key={i} position={[x, y, 0.03]} scale={on}><circleGeometry args={[0.09, 16]} />{mat}</mesh>
      : <mesh key={i} position={[x, y, 0.03]} scale={on}><planeGeometry args={[0.12, 0.22]} />{mat}</mesh>);
  })}
</>);
const Desert: React.FC = () => (<>
  <Floor c="#d9a865" s={80} />
  <Box p={[-6, 2.5, -12]} s={[10, 5, 4]} c="#c48a52" /><Box p={[7, 3.5, -14]} s={[10, 7, 4]} c="#b97d48" />
  <Box p={[-3.5, 1.2, -5]} s={[3, 2.4, 2]} c="#c99358" r={[0, 0.3, 0]} />
  {[[-1.6, 0.4], [2.4, 0.9], [-2.4, 1.8], [1.8, -0.4]].map(([x, z], i) => <mesh key={i} position={[x, 0.12, z]} scale={[1, 0.6, 1]}><dodecahedronGeometry args={[0.22 + (i % 2) * 0.1]} /><Toon c="#b98a52" /></mesh>)}
  {/* the tomb entrance cut into the rock, steps going down */}
  <Box p={[0.9, 1.3, -1.6]} s={[2.4, 2.6, 0.6]} c="#a77b4a" />
  {[0, 1, 2].map((i) => <Box key={i} p={[0.9, 0.05 + i * 0.1, -0.9 - i * 0.2]} s={[1.0, 0.1, 0.25]} c="#b88a55" />)}
  {/* excavation baskets */}
  {[[-1.1, -0.6], [-1.4, -0.2]].map(([x, z], i) => <mesh key={i} position={[x, 0.15, z]}><cylinderGeometry args={[0.2, 0.15, 0.3, 12]} /><Toon c="#8a6a3a" /></mesh>)}
</>);
const Street: React.FC = () => (<>
  <Floor c="#c9b38a" />
  <House p={[-2.6, 0, -2]} c="#e0c89a" awn="#2e7d5b" /><House p={[-0.2, 0, -2.2]} w={2.4} h={3.6} c="#d9b98a" />
  <House p={[2.3, 0, -2]} c="#e8d2a8" awn="#3a5aa0" />
  <mesh position={[3.0, 1.5, -0.6]}><cylinderGeometry args={[0.04, 0.05, 3, 8]} /><Toon c="#2a2a30" /></mesh>
  <mesh position={[3.0, 3.05, -0.6]}><boxGeometry args={[0.2, 0.25, 0.2]} /><Toon c="#2a2a30" /></mesh>
</>);

// ---- the 14 shots ----
const S: React.FC<SP>[] = [
  // 1 hook: mosquito lands on the jar
  ({ f, t }) => <JarCU f={f} t={t} landAt={B(1, "nyamuk")} />,
  // 2 Carter opens the tomb with a lantern
  ({ f, t }) => {
    const k = ramp(f, B(2, "membuka"), 20);
    return (<>
      <Light bg="#f0c27a" sky="#ffe0a0" sun="#ffd9a0" k={1.0} hemi={0.45} dir={[-5, 4, 3]} fog={[12, 40]} />
      <Shadows />
      <Desert />
      <Box p={[0.9, 1.0, -1.28]} s={[0.9, 1.8, 0.05]} c={k > 0.5 ? "#1c1410" : "#7c5a38"} />
      <Card o={CARTER} f={f} pos={[-0.2 + k * 0.25, 0, -0.4]} seed={2} opts={{ prop: "lantern", expr: k > 0.6 ? "awe" : "determined", lean: 6 * k }} />
      <Cam f={f} t={t} from={[-2.5, 3.2, 5.5]} to={[-0.3, 1.5, 4]} look={[0.2, 1, -0.6]} />
      <Post light="golden" cInf={6} focus={[0, 1.4, -0.4]} grade={0.7} />
    </>);
  },
  // 3 hero: the Treasury (Treasury.tsx)
  ({ f, t }) => <Treasury f={f} t={t} />,
  // 4 Carnarvon shaving in Cairo; the razor nicks the bite on "menggores", the mosquito flies off
  ({ f, t }) => {
    const nick = ramp(f, B(4, "menggores"), 4), fly = ramp(f, B(4, "nyamuk"), 24);
    return (<>
      <Light bg="#f6d29a" sky="#fff0d0" sun="#ffe2b0" k={0.9} hemi={0.5} dir={[-3, 3, 4]} />
      <Shadows />
      <Floor c="#b89a78" s={10} />
      <Box p={[0, 1.5, -0.6]} s={[5, 3, 0.1]} c="#e8c890" />
      {/* tiles, window with the morning sun, basin, jug, towel, shelf */}
      {Array.from({ length: 10 }, (_, i) => <Box key={i} p={[-2.25 + i * 0.5, 0.6, -0.54]} s={[0.46, 1.2, 0.02]} c={i % 2 ? "#dfe8e4" : "#cfdcd6"} />)}
      <Win p={[-1.3, 1.9, -0.54]} s={[0.7, 0.9]} c={[1.8, 1.6, 1.2]} />
      <Box p={[0.55, 1.55, -0.5]} s={[0.6, 0.8, 0.05]} c="#a8cde0" e="#a8cde0" ei={0.2} />
      <Box p={[0.55, 0.9, -0.35]} s={[0.9, 0.08, 0.4]} c="#f4f1ea" />
      <mesh position={[0.35, 1.05, -0.35]}><cylinderGeometry args={[0.07, 0.09, 0.22, 12]} /><Toon c="#3a7ab0" /></mesh>
      <Box p={[1.2, 1.2, -0.5]} s={[0.25, 0.6, 0.05]} c="#e8e0d0" />
      <Box p={[0.55, 2.1, -0.45]} s={[0.9, 0.04, 0.2]} c="#8a6a4a" />
      <Card o={CARN} f={f} pos={[-0.2, 0, 0]} seed={3} opts={{ handR: [370, 300], expr: nick > 0.5 ? "pained" : "content" }} />
      {nick > 0 && <mesh position={[-0.12, 1.46, 0.03]} scale={nick}><sphereGeometry args={[0.022, 10, 8]} /><meshBasicMaterial color="#c0392b" /></mesh>}
      <Mosquito p={[-0.05 + fly * 0.9, 1.5 + fly * 0.5, 0.1]} f={f} s={0.8} land={1 - fly} />
      <Cam f={f} t={t} from={[0, 1.3, 3.2]} to={[-0.1, 1.45, 1.6]} look={[-0.05, 1.3, 0]} lookTo={[-0.12, 1.45, 0]} />
      <Post light="day" cInf={12} focus={[-0.1, 1.45, 0]} grade={0.6} />
    </>);
  },
  // 5 fever in bed; the bedside lamp dies on "meninggal"
  ({ f, t }) => {
    const die = ramp(f, B(5, "meninggal"), 14), fever = ramp(f, B(5, "infeksi"), 30);
    return (<>
      <Light bg="#140f1e" sky="#6a5890" sun="#8090d0" k={0.5 * (1 - 0.6 * die)} hemi={0.4} dir={[3, 4, 2]} />
      <Shadows />
      <Floor c="#3a2e40" s={10} />
      <Box p={[0, 1.5, -1]} s={[5, 3, 0.1]} c="#4a3c5c" />
      <Win p={[1.3, 1.8, -0.94]} s={[0.6, 0.8]} c={[0.4, 0.5, 0.9]} />
      <Box p={[0, 0.3, 0]} s={[2.2, 0.6, 1]} c="#d8d4e0" />
      <Box p={[1.05, 0.65, 0]} s={[0.1, 0.9, 1]} c="#6a4a3a" />
      <Box p={[1.55, 0.3, 0]} s={[0.5, 0.6, 0.5]} c="#6a4a3a" />
      {[0, 1].map((i) => <mesh key={i} position={[1.5 + i * 0.15, 0.7, 0.1]}><cylinderGeometry args={[0.035, 0.035, 0.16, 8]} /><Toon c={i ? "#8a5a2a" : "#3a6a4a"} /></mesh>)}
      <Lamp p={[1.7, 0.85, -0.1]} f={f} k={1 - die} />
      <Card o={CARN} f={f} pos={[-0.85, 0.74, 0.1]} rotZ={-Math.PI / 2} seed={3} h={1.7} opts={{ expr: die > 0.5 ? "dead" : "pained", flush: fever, blink: die > 0.5 ? 1 : undefined }} />
      <Box p={[-1.4, 0.9, 0.2]} s={[0.12, 1.2, 0.05]} c="#f4f1ea" />
      <Box p={[-1.4, 0.4 + 0.45 * fever, 0.24]} s={[0.06, 0.1 + 0.9 * fever, 0.02]} c="#e0302a" e="#e0302a" ei={0.6} />
      <Cam f={f} t={t} from={[0.1, 2.0, 4.2]} to={[0.1, 1.9, 3.7]} look={[0.1, 0.8, 0]} />
      <Post light="night" cInf={10} focus={[0.6, 0.8, 0.5]} />
    </>);
  },
  // 6 the presses roll, papers fly on "kutukan"
  ({ f, t }) => {
    const go = ramp(f, B(6, "kutukan"), 10);
    return (<>
      <Light bg="#1e1c10" sky="#c0a870" sun="#ffcf60" k={0.8} hemi={0.6} fog={[9, 22]} />
      <Shadows />
      <Floor c="#3a3524" />
      <Box p={[0, 1.8, -2.2]} s={[8, 3.6, 0.2]} c="#4a4232" />
      {/* the rotary press: iron frame, three rolling cylinders on top, a feed table, paper reels at the side */}
      <Box p={[0, 0.5, -0.5]} s={[1.8, 1.0, 1.0]} c="#5a5a64" />
      <Box p={[0, 0.04, -0.5]} s={[2.2, 0.08, 1.3]} c="#2a2a30" />
      {[-0.6, 0, 0.6].map((x) => <mesh key={x} position={[0, 1.16 + (x === 0 ? 0.12 : 0), -0.5 + x * 0.55]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.16, 0.16, 1.7, 16]} /><Toon c="#9a9aa4" /></mesh>)}
      {[-0.95, 0.95].map((x) => <Box key={x} p={[x, 1.1, -0.5]} s={[0.08, 0.5, 1.0]} c="#3a3a42" />)}
      {[-1.4, 1.4].map((x) => <mesh key={x} position={[x, 0.45, -0.4]} rotation={[0, 0, f * 0.1]}><torusGeometry args={[0.3, 0.05, 8, 20]} /><Toon c="#6a6a70" /></mesh>)}
      <Box p={[0, 0.95, 0.15]} s={[1.2, 0.05, 0.5]} c="#d8cfb8" />
      <Box p={[-1.8, 0.35, -1.3]} s={[0.6, 0.7, 0.5]} c="#d8cfb8" /><Box p={[1.8, 0.3, -1.2]} s={[0.6, 0.6, 0.5]} c="#d8cfb8" />
      <Lamp p={[-0.9, 2.2, 0.3]} f={f} /><Lamp p={[1.0, 2.2, 0.1]} f={f + 9} />
      {Array.from({ length: 9 }, (_, i) => {
        // papers shoot out of the press (hidden inside it until "kutukan"), never pop in
        const u = clamp01(go * 1.4 - i * 0.05), y = 0.6 + u * (1.8 + (i % 3) * 0.4);
        return <Paper key={i} p={[(-1.4 + i * 0.35) * (0.3 + 0.7 * u), y, -0.5 + u * (0.8 + (i % 2) * 0.2)]} r={[0.4 * u, f * 0.05 * u + i, 0.3 * i * u]} s={0.8 + 0.9 * u} />;
      })}
      <Cam f={f} t={t} from={[-0.7, 2.1, 4.4]} to={[0.6, 2.0, 4.0]} look={[0, 1.2, -0.3]} fov={50} />
      <Post light="night" cInf={8} focus={[0, 1.8, 0.3]} />
    </>);
  },
  // 7 the papers' version: red glyphs light up on the door, word by word
  ({ f, t }) => (<>
    <Light bg="#2a0606" sky="#ff6050" sun="#ff8070" ground="#200505" k={0.45} hemi={0.4} />
    <Shadows />
    <Door glyph={clamp01((f - B(7, "maut")) / (B(7, "raja") - B(7, "maut")))} red />
    <Cam f={f} t={t} from={[0, 1.4, 6.5]} to={[0, 1.5, 5.2]} look={[0, 1.5, 0]} />
    <Post light="night" cInf={10} focus={[0, 1.5, 0]} />
  </>),
  // 8 the real door: plain stone (match cut on the same framing as shot 7's end)
  ({ f, t }) => (<>
    <Light bg="#7a5a32" sky="#ffd8a0" sun="#ffe6c0" k={0.8} hemi={0.5} dir={[-4, 5, 4]} />
    <Shadows />
    <Door glyph={0} red={false} />
    <Lamp p={[-1.6, 2.0, 0.6]} f={f} k={0.6} />
    <Cam f={f} t={t} from={[0, 1.5, 5.2]} to={[0, 1.5, 5.0]} look={[0, 1.5, 0]} />
    <Post light="golden" cInf={10} focus={[0, 1.5, 0]} grade={0.6} />
  </>),
  // 9 ...but the papers are in everyone's hands
  ({ f, t }) => {
    const up = (i: number) => ramp(f, B(9, "semua") - 12 + i * 4, 6);
    return (<>
      <Light bg="#a9c8e8" sky="#fff6e0" sun="#fff0d0" k={1.0} hemi={0.5} dir={[4, 6, 3]} fog={[10, 30]} />
      <Shadows />
      <Street />
      {[0, 1, 2, 3, 4].map((i) => <Card key={i} o={CROWD(i)} f={f} pos={[-2 + i, 0, -0.2 * (i % 2)]} seed={10 + i} h={1.7}
        opts={{ prop: up(i) > 0.5 ? "newspaper" : null, expr: up(i) > 0.5 ? "shock" : "neutral" }} />)}
      <Cam f={f} t={t} from={[-1.6, 1.4, 4.4]} to={[1.6, 1.4, 4.4]} look={[0, 1.1, 0]} lookTo={[0.3, 1.1, 0]} fov={50} />
      <Post light="day" cInf={8} focus={[0, 1.4, 0]} grade={0.6} />
    </>);
  },
  // 10 one paper gets in (exclusive); the rest are stuck behind the rope
  ({ f, t }) => {
    const walk = ramp(f, B(10, "eksklusif") - 6, 30);
    return (<>
      <Light bg="#f0c27a" sky="#ffe0a0" sun="#ffd9a0" k={1.0} hemi={0.45} dir={[-5, 4, 3]} fog={[12, 40]} />
      <Shadows />
      <Desert />
      <Box p={[0.9, 1.0, -1.28]} s={[0.9, 1.8, 0.05]} c="#1c1410" />
      <Card o={REPORTER} f={f} pos={[0.2 + walk * 0.7, 0, -0.6 - walk * 0.6]} seed={5} h={1.7} opts={{ mode: walk > 0 && walk < 1 ? "stroll" : "stand", phase: f / 18, expr: "smug" }} />
      {[-1.7, 0.5].map((x) => <mesh key={x} position={[x, 0.45, 0.6]}><cylinderGeometry args={[0.04, 0.05, 0.9, 8]} /><Toon c="#5a4030" /></mesh>)}
      <mesh position={[-0.6, 0.8, 0.6]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 2.2, 8]} /><Toon c="#c0392b" /></mesh>
      {[0, 1, 2].map((i) => <Card key={i} o={{ ...REPORTER, jacket: ["#4a7bd1", "#2e8b57", "#b5651d"][i], hat: "bowler" }} f={f} seed={20 + i} h={1.6}
        pos={[-1.4 + i * 0.6, Math.abs(Math.sin(f * 0.25 + i * 1.3)) * 0.18, 1.1]} opts={{ expr: "annoyed", arm: "up", armK: 1 }} />)}
      <Cam f={f} t={t} from={[-1, 3, 5.8]} to={[-0.4, 1.7, 4.6]} look={[0, 1, -0.4]} fov={45} />
      <Post light="golden" cInf={6} focus={[0, 1.2, 0.3]} grade={0.7} />
    </>);
  },
  // 11 the chain whisper: each "!!" bubble bigger than the last
  ({ f, t }) => {
    const ws = ["pesan", "berantai", "grup", "keluarga"].map((w) => B(11, w));
    return (<>
      <Light bg="#a9c8e8" sky="#fff6e0" sun="#ffe8c0" k={1.0} hemi={0.5} dir={[4, 6, 3]} fog={[10, 30]} />
      <Shadows />
      <Street />
      {[0, 1, 2, 3].map((i) => {
        const on = ramp(f, ws[i], 6);
        return (<group key={i}>
          <Card o={CROWD(i + 5)} f={f} pos={[-1.8 + i * 1.2, 0, 0]} seed={30 + i} h={1.7} opts={{ expr: on > 0.5 ? (i === 3 ? "terror" : "alarmed") : "neutral", lean: on * 8 }} />
          {on > 0 && <mesh position={[-1.4 + i * 1.2, 2.05 + i * 0.1, 0.1]} scale={on * (1 + i * 0.35)}><circleGeometry args={[0.28, 24]} /><meshBasicMaterial color="#ffffff" /></mesh>}
          {on > 0 && [-0.06, 0.06].map((dx) => <mesh key={dx} position={[-1.4 + i * 1.2 + dx * on * (1 + i * 0.35), 2.05 + i * 0.1, 0.11]} scale={on * (1 + i * 0.35)}><planeGeometry args={[0.05, 0.24]} /><meshBasicMaterial color="#e74c3c" /></mesh>)}
        </group>);
      })}
      <Cam f={f} t={t} from={[-1.8, 1.5, 4.2]} to={[1.8, 1.6, 4.2]} look={[-1.2, 1.3, 0]} lookTo={[1.4, 1.5, 0]} fov={48} />
      <Post light="day" cInf={8} focus={[0, 1.5, 0]} grade={0.6} />
    </>);
  },
  // 12 2002: the doctor's count — the old diggers wave on "tujuh"
  ({ f, t }) => {
    const wave = ramp(f, B(12, "tujuh"), 8);
    return (<>
      <Light bg="#f7f3ea" sky="#ffffff" sun="#fff6e8" k={0.9} hemi={0.55} dir={[-4, 5, 4]} />
      <Shadows />
      <Floor c="#b8a88a" />
      <Box p={[0, 1.6, -1.1]} s={[6, 3.2, 0.1]} c="#e8e0cc" />
      <Box p={[0, 1.6, -1]} s={[3.2, 1.4, 0.08]} c="#2d4a3a" />
      {[-0.9, -0.3, 0.3, 0.9].map((x) => <Box key={x} p={[x, 1.6 + Math.sin(x * 5) * 0.2, -0.95]} s={[0.25, 0.04, 0.01]} c="#f0f0e8" />)}
      <Box p={[-2.3, 1.0, -0.8]} s={[0.9, 2.0, 0.35]} c="#7a5a3a" />
      {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[-2.6 + (i % 6) * 0.12, 0.55 + Math.floor(i / 6) * 0.6, -0.6]} s={[0.09, 0.4, 0.25]} c={["#a03a2a", "#2a5a8a", "#3a7a4a", "#c8a040"][i % 4]} />)}
      <Box p={[1.9, 0.4, 0.2]} s={[1.2, 0.06, 0.6]} c="#8a6a4a" />
      <Win p={[2.4, 1.9, -1.04]} s={[0.7, 0.9]} c={[1.7, 1.6, 1.4]} />
      <Card o={DOCTOR} f={f} pos={[-0.65, 0, -0.3]} seed={6} opts={{ arm: "point", armK: 1, expr: "thinking" }} />
      {[0, 1].map((i) => <Card key={i} o={OLDMAN(i)} f={f} pos={[0.35 + i * 0.6, 0, 0.2]} seed={40 + i} h={1.6}
        opts={{ wave: wave > 0 ? (f * 0.12 + i) % 1 : undefined, expr: wave > 0.5 ? "joy" : "content" }} />)}
      <Cam f={f} t={t} from={[0, 1.4, 5.6]} to={[0.05, 1.35, 4.6]} look={[0, 1.2, 0]} />
      <Post light="day" cInf={10} focus={[0, 1.4, 0]} grade={0.6} />
    </>);
  },
  // 13 old Carter, sixteen more years, watering his garden
  ({ f, t }) => (<>
    <Light bg="#f2b968" sky="#ffd890" sun="#ffb070" k={1.0} hemi={0.45} dir={[-4, 3, 3]} fog={[8, 25]} />
    <Shadows />
    <Floor c="#5a9a4a" />
    <Box p={[0, 1.4, -2.2]} s={[8, 2.8, 0.3]} c="#c89a6a" />
    <Win p={[1.6, 1.6, -2.04]} s={[0.6, 0.8]} c={[1.6, 1.2, 0.7]} />
    {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[-3 + i * 0.55, 0.4, -1.2]} s={[0.08, 0.8, 0.06]} c="#f4f1ea" />)}
    <Box p={[0, 0.6, -1.2]} s={[6.6, 0.06, 0.06]} c="#f4f1ea" />
    {[-1.6, -1, 1.1, 1.7].map((x, i) => <mesh key={x} position={[x, 0.3, -0.8]}><sphereGeometry args={[0.35 + (i % 2) * 0.1, 16, 12]} /><Toon c={i % 2 ? "#3f7a3a" : "#4f8a42"} /></mesh>)}
    {[-0.5, 0.6, 1.3, -1.3, 0.2].map((x, i) => <mesh key={x} position={[x, 0.45, -0.5 + (i % 2) * 0.2]}><sphereGeometry args={[0.08, 10, 8]} /><Toon c={["#e74c3c", "#f1c40f", "#e67e22", "#d64a8a", "#f4f1ea"][i]} /></mesh>)}
    <Card o={CARTER_OLD} f={f} pos={[0, 0, 0]} seed={2} opts={{ expr: "whistle", arm: "reach", armK: 1, mode: "stand" }} />
    <group position={[0.5, 0.95, 0.1]} rotation={[0, 0, -0.5 + Math.sin(f * 0.1) * 0.08]}>
      <mesh><cylinderGeometry args={[0.12, 0.14, 0.25, 14]} /><Toon c="#3b82c4" /></mesh>
      <mesh position={[0.2, 0.02, 0]} rotation={[0, 0, -1]}><cylinderGeometry args={[0.02, 0.03, 0.3, 8]} /><Toon c="#3b82c4" /></mesh>
    </group>
    {Array.from({ length: 6 }, (_, i) => { const u = ((f * 0.06 + i / 6) % 1); return (
      <mesh key={i} position={[0.78 + u * 0.15, 0.85 - u * 0.5, 0.1]}><sphereGeometry args={[0.018, 6, 6]} /><meshBasicMaterial color="#9fd3ff" /></mesh>); })}
    <Cam f={f} t={t} from={[0, 2.4, 3.6]} to={[0, 1.4, 3.2]} look={[0.1, 1.3, 0]} lookTo={[0.1, 1.0, 0]} />
    <Post light="golden" cInf={10} focus={[0, 1.3, 0]} grade={0.7} />
  </>),
  // 14 the payoff: the mosquito lands again (same frame as shot 1, so the short loops)
  ({ f, t }) => <JarCU f={f} t={0.9 + t * 0.1} landAt={B(14, "nyamuk")} />,
];

const ShotView: React.FC<{ i: number; from: number; dur: number }> = ({ i, from, dur }) => {
  const lf = useCurrentFrame(), { width, height } = useVideoConfig();
  const Scene = S[i];
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true }} shadows>
      <Scene f={from + lf} t={lf / Math.max(1, dur - 1)} />
    </ThreeCanvas>
  );
};

export const Guci: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {SHOTS.map((s, i) => (
      <Sequence key={s.n} from={s.from} durationInFrames={s.dur} name={`shot ${s.n}`}>
        <ShotView i={i} from={s.from} dur={s.dur} />
      </Sequence>
    ))}
    <Audio src={staticFile("voice.wav")} />
  </AbsoluteFill>
);
