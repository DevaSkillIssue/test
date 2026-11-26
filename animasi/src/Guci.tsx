// "Guci Terkutuk" — 14 shots, one per script line (stories/guci-terkutuk/storyboard/THUMBS.md).
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { SHOTS, B, ramp, clamp01 } from "./story";
import { Treasury } from "./Treasury";
import { Card, Box, Jar, Mosquito, Paper, Light, Cam, Toon, V3, CARTER, CARTER_OLD, CARN, REPORTER, DOCTOR, OLDMAN, CROWD } from "./kit";

type SP = { f: number; t: number };

// ---- shared sets ----
const JarCU: React.FC<SP & { landAt: number }> = ({ f, t, landAt }) => {
  const k = ramp(f, landAt - 20, 20); // mosquito glides in and lands on the lid on the word
  const mp: V3 = [0.04 + (1 - k) * 0.9, 0.98 + (1 - k) * 0.5 + Math.sin(f * 0.4) * 0.02 * (1 - k), 0.05];
  return (<>
    <Light bg="#16213f" sky="#5a74c0" sun="#9fb6ff" ground="#10162a" k={0.8} dir={[-3, 4, 3]} fog={[3, 9]} />
    <Box p={[0, -0.1, 0]} s={[1.6, 0.2, 1]} c="#5b3d2a" />
    <Jar p={[0, 0, 0]} s={1.25} />
    <Box p={[0, 0.8, -1.6]} s={[4, 2, 0.1]} c="#22305a" />
    <Mosquito p={mp} f={f} s={1.3} land={k} />
    <Cam f={f} t={t} from={[0.2, 1.6, 2.6]} to={[0.08, 1.2, 2.1]} look={[0, 0.8, 0]} lookTo={[0, 0.85, 0]} fov={38} />
  </>);
};
const Door: React.FC<{ glyph: number }> = ({ glyph }) => (<>
  <Box p={[0, 1.5, -0.2]} s={[4, 3.4, 0.3]} c="#8a6a45" />
  <Box p={[0, 1.2, -0.03]} s={[1.5, 2.4, 0.1]} c="#4a3622" />
  <Box p={[0, 2.5, 0.0]} s={[1.9, 0.25, 0.2]} c="#a8865a" />
  {Array.from({ length: 8 }, (_, i) => {
    const on = clamp01(glyph * 8 - i), x = -0.45 + (i % 4) * 0.3, y = 2.0 - Math.floor(i / 4) * 0.5;
    return on > 0 && (i % 2
      ? <mesh key={i} position={[x, y, 0.03]} scale={on}><circleGeometry args={[0.09, 16]} /><meshBasicMaterial color="#ff3a2a" toneMapped={false} /></mesh>
      : <mesh key={i} position={[x, y, 0.03]} scale={on}><planeGeometry args={[0.12, 0.22]} /><meshBasicMaterial color="#ff3a2a" toneMapped={false} /></mesh>);
  })}
</>);
const Desert: React.FC = () => (<>
  <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[80, 80]} /><Toon c="#d9a865" /></mesh>
  <Box p={[-6, 2.5, -12]} s={[10, 5, 4]} c="#c48a52" /><Box p={[7, 3.5, -14]} s={[10, 7, 4]} c="#b97d48" />
</>);

// ---- the 14 shots ----
const S: React.FC<SP>[] = [
  // 1 hook: mosquito lands on the jar
  ({ f, t }) => <JarCU f={f} t={t} landAt={B(1, "nyamuk")} />,
  // 2 Carter opens the tomb with a lantern
  ({ f, t }) => {
    const k = ramp(f, B(2, "membuka"), 20);
    return (<>
      <Light bg="#f0c27a" sky="#ffe0a0" sun="#fff0c8" k={1.1} fog={[12, 40]} />
      <Desert />
      <Box p={[0.9, 1.3, -1.2]} s={[2.4, 2.6, 0.6]} c="#a77b4a" />
      <Box p={[0.9, 1.0, -0.88]} s={[0.9, 1.8, 0.05]} c={k > 0.5 ? "#1c1410" : "#7c5a38"} />
      <Card o={CARTER} f={f} pos={[-0.2 + k * 0.25, 0, -0.4]} seed={2} opts={{ prop: "lantern", expr: k > 0.6 ? "awe" : "determined", lean: 6 * k }} />
      <Cam f={f} t={t} from={[-2.5, 3.2, 5.5]} to={[-0.3, 1.5, 4]} look={[0.2, 1, -0.6]} />
    </>);
  },
  // 3 hero: the Treasury (Treasury.tsx)
  ({ f, t }) => <Treasury f={f} t={t} />,
  // 4 Carnarvon shaving in Cairo; the razor nicks the bite on "menggores", the mosquito flies off
  ({ f, t }) => {
    const nick = ramp(f, B(4, "menggores"), 4), fly = ramp(f, B(4, "nyamuk"), 24);
    return (<>
      <Light bg="#f6d29a" sky="#fff0d0" sun="#ffe2b0" k={1} />
      <Box p={[0, 1.5, -0.6]} s={[5, 3, 0.1]} c="#e8c890" />
      <Box p={[0.55, 1.55, -0.5]} s={[0.6, 0.8, 0.05]} c="#a8cde0" e="#a8cde0" ei={0.2} />
      <Box p={[0.55, 0.9, -0.35]} s={[0.9, 0.08, 0.4]} c="#f4f1ea" />
      <Card o={CARN} f={f} pos={[-0.2, 0, 0]} seed={3} opts={{ handR: [370, 300], expr: nick > 0.5 ? "pained" : "content" }} />
      {nick > 0 && <mesh position={[-0.12, 1.46, 0.03]} scale={nick}><sphereGeometry args={[0.022, 10, 8]} /><meshBasicMaterial color="#c0392b" /></mesh>}
      <Mosquito p={[-0.05 + fly * 0.9, 1.5 + fly * 0.5, 0.1]} f={f} s={0.8} land={1 - fly} />
      <Cam f={f} t={t} from={[0, 1.3, 3.2]} to={[-0.1, 1.45, 1.1]} look={[-0.05, 1.3, 0]} lookTo={[-0.12, 1.45, 0]} />
    </>);
  },
  // 5 fever in bed; the room light dies on "meninggal"
  ({ f, t }) => {
    const die = ramp(f, B(5, "meninggal"), 14), fever = ramp(f, B(5, "infeksi"), 30);
    return (<>
      <Light bg={die > 0.5 ? "#140f1e" : "#3a2f4a"} sky="#9a88c0" sun="#ffd0a0" k={1 - 0.7 * die} />
      <Box p={[0, 1.5, -1]} s={[5, 3, 0.1]} c="#4a3c5c" />
      <Box p={[0, 0.3, 0]} s={[2.2, 0.6, 1]} c="#d8d4e0" />
      <Card o={CARN} f={f} pos={[-0.85, 0.72, 0.52]} rotZ={-Math.PI / 2} seed={3} h={1.7} opts={{ expr: die > 0.5 ? "dead" : "pained", flush: fever, blink: die > 0.5 ? 1 : undefined }} />
      <Box p={[1.4, 0.9, 0.2]} s={[0.12, 1.2, 0.05]} c="#f4f1ea" />
      <Box p={[1.4, 0.4 + 0.45 * fever, 0.24]} s={[0.06, 0.1 + 0.9 * fever, 0.02]} c="#e0302a" e="#e0302a" ei={0.6} />
      <Cam f={f} t={t} from={[0.1, 2.0, 4.2]} to={[0.1, 1.9, 3.7]} look={[0.1, 0.8, 0]} />
    </>);
  },
  // 6 the presses roll, papers fly on "kutukan"
  ({ f, t }) => {
    const go = ramp(f, B(6, "kutukan"), 10);
    return (<>
      <Light bg="#2b2814" sky="#ffd870" sun="#ffcf60" k={0.9} fog={[4, 14]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /><Toon c="#3a3524" /></mesh>
      <Box p={[0, 0.7, -0.5]} s={[3, 1.4, 1.2]} c="#4a4a52" />
      {[-0.9, 0, 0.9].map((x) => <mesh key={x} position={[x, 1.45, -0.5]} rotation={[f * 0.25, 0, Math.PI / 2]}><cylinderGeometry args={[0.22, 0.22, 1.3, 16]} /><Toon c="#8a8a90" /></mesh>)}
      {Array.from({ length: 9 }, (_, i) => {
        const u = clamp01(go * 1.4 - i * 0.05), y = 1.5 + u * (1.2 + (i % 3) * 0.5);
        return <Paper key={i} p={[-1.4 + i * 0.35, y, 0.3 + (i % 2) * 0.2]} r={[0.4 * u, f * 0.05 * u + i, 0.3 * i * u]} s={0.8 + 0.9 * u} />;
      })}
      <Cam f={f} t={t} from={[-0.8, 1.7, 3.6]} to={[0.8, 1.8, 3.4]} look={[0, 1.7, 0]} fov={50} />
    </>);
  },
  // 7 the papers' version: red glyphs light up on the door, word by word
  ({ f, t }) => (<>
    <Light bg="#3a0a0a" sky="#ff6050" sun="#ff8070" ground="#200505" k={0.7} />
    <Door glyph={clamp01((f - B(7, "maut")) / (B(7, "raja") - B(7, "maut")))} />
    <Cam f={f} t={t} from={[0, 1.4, 6.5]} to={[0, 1.5, 5.2]} look={[0, 1.5, 0]} />
  </>),
  // 8 the real door: plain stone (match cut on the same framing as shot 7's end)
  ({ f, t }) => (<>
    <Light bg="#7a5a32" sky="#ffd8a0" sun="#ffe6c0" k={0.9} />
    <Door glyph={0} />
    <Cam f={f} t={t} from={[0, 1.5, 5.2]} to={[0, 1.5, 5.0]} look={[0, 1.5, 0]} />
  </>),
  // 9 ...but the papers are in everyone's hands
  ({ f, t }) => {
    const up = (i: number) => ramp(f, B(9, "semua") - 12 + i * 4, 6);
    return (<>
      <Light bg="#efe3c4" sky="#fff6e0" sun="#fff0d0" k={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /><Toon c="#c9b38a" /></mesh>
      <Box p={[0, 1.5, -1.5]} s={[12, 3, 0.2]} c="#d8c39a" />
      {[0, 1, 2, 3, 4].map((i) => <Card key={i} o={CROWD(i)} f={f} pos={[-2 + i, 0, -0.2 * (i % 2)]} seed={10 + i} h={1.7}
        opts={{ prop: up(i) > 0.5 ? "newspaper" : null, expr: up(i) > 0.5 ? "shock" : "neutral" }} />)}
      <Cam f={f} t={t} from={[-1.6, 1.4, 4.4]} to={[1.6, 1.4, 4.4]} look={[0, 1.1, 0]} lookTo={[0.3, 1.1, 0]} fov={50} />
    </>);
  },
  // 10 one paper gets in (exclusive); the rest are stuck behind the rope
  ({ f, t }) => {
    const walk = ramp(f, B(10, "eksklusif") - 6, 30);
    return (<>
      <Light bg="#f0c27a" sky="#ffe0a0" sun="#fff0c8" k={1.1} fog={[12, 40]} />
      <Desert />
      <Box p={[0.9, 1.3, -1.6]} s={[2.4, 2.6, 0.6]} c="#a77b4a" />
      <Box p={[0.9, 1.0, -1.28]} s={[0.9, 1.8, 0.05]} c="#1c1410" />
      <Card o={REPORTER} f={f} pos={[0.2 + walk * 0.7, 0, -0.6 - walk * 0.6]} seed={5} h={1.7} opts={{ mode: walk > 0 && walk < 1 ? "stroll" : "stand", phase: f / 18, expr: "smug" }} />
      <mesh position={[-0.6, 0.75, 0.6]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 2.2, 8]} /><Toon c="#c0392b" /></mesh>
      {[0, 1, 2].map((i) => <Card key={i} o={{ ...REPORTER, jacket: ["#4a7bd1", "#2e8b57", "#b5651d"][i], hat: "bowler" }} f={f} seed={20 + i} h={1.6}
        pos={[-1.4 + i * 0.6, Math.abs(Math.sin(f * 0.25 + i * 1.3)) * 0.18, 1.1]} opts={{ expr: "annoyed", arm: "up", armK: 1 }} />)}
      <Cam f={f} t={t} from={[-1, 3, 5.8]} to={[-0.4, 1.7, 4.6]} look={[0, 1, -0.4]} fov={45} />
    </>);
  },
  // 11 the chain whisper: each "!!" bubble bigger than the last
  ({ f, t }) => {
    const ws = ["pesan", "berantai", "grup", "keluarga"].map((w) => B(11, w));
    return (<>
      <Light bg="#f4e6c8" sky="#fff6e0" sun="#ffe8c0" k={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /><Toon c="#cbb48c" /></mesh>
      {[0, 1, 2, 3].map((i) => {
        const on = ramp(f, ws[i], 6);
        return (<group key={i}>
          <Card o={CROWD(i + 5)} f={f} pos={[-1.8 + i * 1.2, 0, 0]} seed={30 + i} h={1.7} opts={{ expr: on > 0.5 ? (i === 3 ? "terror" : "alarmed") : "neutral", lean: on * 8 }} />
          {on > 0 && <mesh position={[-1.4 + i * 1.2, 2.05 + i * 0.1, 0.1]} scale={on * (1 + i * 0.35)}><circleGeometry args={[0.28, 24]} /><meshBasicMaterial color="#ffffff" /></mesh>}
          {on > 0 && <mesh position={[-1.4 + i * 1.2, 2.05 + i * 0.1, 0.11]} scale={on * (1 + i * 0.35)}><planeGeometry args={[0.06, 0.26]} /><meshBasicMaterial color="#e74c3c" /></mesh>}
        </group>);
      })}
      <Cam f={f} t={t} from={[-1.8, 1.5, 4.2]} to={[1.8, 1.6, 4.2]} look={[-1.2, 1.3, 0]} lookTo={[1.4, 1.5, 0]} fov={48} />
    </>);
  },
  // 12 2002: the doctor's count — the old diggers wave on "tujuh"
  ({ f, t }) => {
    const wave = ramp(f, B(12, "tujuh"), 8);
    return (<>
      <Light bg="#f7f3ea" sky="#ffffff" sun="#fff6e8" k={1.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /><Toon c="#d8d0c0" /></mesh>
      <Box p={[0, 1.6, -1]} s={[3.2, 1.4, 0.08]} c="#2d4a3a" />
      {[-0.9, -0.3, 0.3, 0.9].map((x) => <Box key={x} p={[x, 1.6 + Math.sin(x * 5) * 0.2, -0.95]} s={[0.25, 0.04, 0.01]} c="#f0f0e8" />)}
      <Card o={DOCTOR} f={f} pos={[-0.65, 0, -0.3]} seed={6} opts={{ arm: "point", armK: 1, expr: "thinking" }} />
      {[0, 1].map((i) => <Card key={i} o={OLDMAN(i)} f={f} pos={[0.35 + i * 0.6, 0, 0.2]} seed={40 + i} h={1.6}
        opts={{ wave: wave > 0 ? (f * 0.12 + i) % 1 : undefined, expr: wave > 0.5 ? "joy" : "content" }} />)}
      <Cam f={f} t={t} from={[0, 1.4, 5.6]} to={[0.05, 1.35, 4.6]} look={[0, 1.2, 0]} />
    </>);
  },
  // 13 old Carter, sixteen more years, watering his garden
  ({ f, t }) => (<>
    <Light bg="#f2b968" sky="#ffd890" sun="#ffc070" k={1} dir={[-4, 3, 3]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /><Toon c="#5a9a4a" /></mesh>
    {[-1.6, -1, 1.1, 1.7].map((x, i) => <mesh key={x} position={[x, 0.3, -0.8]}><sphereGeometry args={[0.35 + (i % 2) * 0.1, 16, 12]} /><Toon c={i % 2 ? "#3f7a3a" : "#4f8a42"} /></mesh>)}
    {[-0.5, 0.6, 1.3].map((x, i) => <mesh key={x} position={[x, 0.45, -0.5]}><sphereGeometry args={[0.08, 10, 8]} /><Toon c={["#e74c3c", "#f1c40f", "#e67e22"][i]} /></mesh>)}
    <Card o={CARTER_OLD} f={f} pos={[0, 0, 0]} seed={2} opts={{ expr: "whistle", arm: "reach", armK: 1, mode: "stand" }} />
    <group position={[0.5, 0.95, 0.1]} rotation={[0, 0, -0.5 + Math.sin(f * 0.1) * 0.08]}>
      <mesh><cylinderGeometry args={[0.12, 0.14, 0.25, 14]} /><Toon c="#3b82c4" /></mesh>
      <mesh position={[0.2, 0.02, 0]} rotation={[0, 0, -1]}><cylinderGeometry args={[0.02, 0.03, 0.3, 8]} /><Toon c="#3b82c4" /></mesh>
    </group>
    {Array.from({ length: 6 }, (_, i) => { const u = ((f * 0.06 + i / 6) % 1); return (
      <mesh key={i} position={[0.78 + u * 0.15, 0.85 - u * 0.5, 0.1]}><sphereGeometry args={[0.018, 6, 6]} /><meshBasicMaterial color="#9fd3ff" /></mesh>); })}
    <Cam f={f} t={t} from={[0, 2.4, 3.6]} to={[0, 1.4, 3.2]} look={[0.1, 1.3, 0]} lookTo={[0.1, 1.0, 0]} />
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
