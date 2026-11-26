// Hero shot (3): the Treasury of the tomb. The canopic shrine (gilded canopy over the white calcite chest with four
// king's-head lids), Anubis on his gilded shrine in the foreground, stacked boxes and guardians, ochre painted walls,
// two practical lamps (bloom + shadows), dust in the light. Carter lifts a lid on "guci" and recoils on "organ".
import React from "react";
import { Box, Card, Jar, Toon, Cam, Post, Shadows, CARTER, V3 } from "./kit";
import { B, ramp, smooth, clamp01 } from "./story";
import { INK } from "./toon";

const GOLD = "#e3b648", GOLD_D = "#a87a24", CALCITE = "#efe6d2", OCHRE = "#b98a4a", STONE = "#5e4630";
/** overshoot curve for acting keys (gold card: hit(n, d=4, os=0.28)) */
const hit = (f: number, at: number, d = 6, os = 0.28) => {
  const u = clamp01((f - at) / d);
  if (u < 1) return smooth(u) * (1 + os);
  const v = clamp01((f - at - d) / (d * 1.5));
  return 1 + os * (1 - smooth(v));
};

const Lamp: React.FC<{ p: V3; f: number; k?: number }> = ({ p, f, k = 1 }) => {
  const flick = 1 + 0.04 * Math.sin(f * 0.9) + 0.03 * Math.sin(f * 2.3);
  return (
    <group position={p}>
      <mesh position={[0, -0.12, 0]}><cylinderGeometry args={[0.05, 0.07, 0.1, 10]} /><Toon c="#3a2a1a" /></mesh>
      <mesh><sphereGeometry args={[0.07, 14, 10]} /><meshBasicMaterial color={[3.0 * flick, 2.3 * flick, 1.2 * flick]} toneMapped={false} /></mesh>
      <pointLight color="#ffb45a" intensity={4.5 * k * flick} distance={6} decay={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.002} />
    </group>
  );
};
const Anubis: React.FC<{ p: V3; s?: number }> = ({ p, s = 1 }) => (
  <group position={p} scale={s} rotation={[0, 0.35, 0]}>
    {/* gilded shrine with carrying poles */}
    <Box p={[0, 0.35, 0]} s={[1.1, 0.7, 0.55]} c={GOLD} />
    <Box p={[0, 0.72, 0]} s={[1.15, 0.05, 0.6]} c={GOLD_D} />
    {[-0.3, 0.3].map((z) => <mesh key={z} position={[0, 0.12, z * 0.75]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 1.6, 8]} /><Toon c={GOLD_D} /></mesh>)}
    {/* the black jackal lying down */}
    <Box p={[0.05, 0.86, 0]} s={[0.6, 0.22, 0.22]} c="#1c1820" />
    <Box p={[0.32, 0.98, 0]} s={[0.16, 0.3, 0.18]} c="#1c1820" />
    <Box p={[0.44, 1.12, 0]} s={[0.22, 0.12, 0.12]} c="#1c1820" />
    {[-0.04, 0.04].map((z) => <mesh key={z} position={[0.36, 1.26, z]}><coneGeometry args={[0.035, 0.16, 6]} /><Toon c="#1c1820" /></mesh>)}
    <Box p={[0.32, 1.06, 0]} s={[0.17, 0.05, 0.2]} c={GOLD} />
    <Box p={[0.42, 0.79, 0]} s={[0.28, 0.06, 0.08]} c="#1c1820" />
    <mesh position={[0.5, 1.15, 0.065]}><sphereGeometry args={[0.012, 6, 6]} /><meshBasicMaterial color="#f6e7a0" /></mesh>
  </group>
);
const Guardian: React.FC<{ p: V3; r?: number }> = ({ p, r = 0 }) => (
  <group position={p} rotation={[0, r, 0]}>
    <Box p={[0, 0.05, 0]} s={[0.35, 0.1, 0.35]} c="#1c1820" />
    <Box p={[0, 0.45, 0]} s={[0.2, 0.7, 0.16]} c="#1c1820" />
    <Box p={[0, 0.52, 0.01]} s={[0.24, 0.22, 0.17]} c={GOLD} />
    <mesh position={[0, 0.95, 0]}><sphereGeometry args={[0.1, 12, 10]} /><Toon c="#1c1820" /></mesh>
    <Box p={[0, 1.0, -0.02]} s={[0.22, 0.14, 0.14]} c={GOLD} />
  </group>
);
const OvalBox: React.FC<{ p: V3; c?: string; s?: number }> = ({ p, c = "#f2ece0", s = 1 }) => (
  <group position={p} scale={[s, s, s]}>
    <mesh scale={[1, 0.6, 0.65]}><cylinderGeometry args={[0.2, 0.2, 0.32, 18]} /><Toon c={c} /></mesh>
    <mesh position={[0, 0.11, 0]} scale={[1, 0.25, 0.65]}><sphereGeometry args={[0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><Toon c={c} /></mesh>
  </group>
);

export const Treasury: React.FC<{ f: number; t: number }> = ({ f, t }) => {
  const lid = hit(f, B(3, "guci") - 2, 8, 0.2), yuck = hit(f, B(3, "organ") - 2, 5, 0.3), look = ramp(f, B(3, "kepala"), 8);
  // the lid rises straight up on "guci" (clear of Carter's head), drops back shut with a small bounce on "organ"
  const drop = ramp(f, B(3, "organ"), 4), bounce = Math.max(0, Math.sin(clamp01((f - B(3, "organ") - 4) / 8) * Math.PI)) * 0.05;
  const lidY = 0.36 * Math.min(1, lid) * (1 - drop) + bounce, lidWob = Math.sin(f * 0.35) * 0.04 * (1 - drop);
  return (<>
    <color attach="background" args={["#1a0f08"]} />
    <fog attach="fog" args={["#2a170a", 5, 11]} />
    <hemisphereLight args={["#c8a070", "#20140c", 0.22]} />
    <directionalLight position={[3, 3, 5]} intensity={0.8} color="#7f90e0" />
    <Lamp p={[-1.1, 1.85, 0.6]} f={f} />
    <Lamp p={[1.6, 0.42, -0.3]} f={f + 17} k={0.7} />
    <Shadows />
    {/* room */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[12, 12]} /><Toon c={STONE} /></mesh>
    <Box p={[0, 1.6, -1.6]} s={[8, 3.2, 0.2]} c={OCHRE} />
    <Box p={[-2.6, 1.6, 0]} s={[0.2, 3.2, 6]} c={OCHRE} />
    <Box p={[2.6, 1.6, 0]} s={[0.2, 3.2, 6]} c={OCHRE} />
    <Box p={[0, 3.2, 0]} s={[8, 0.1, 6]} c="#2a1a10" />
    {/* painted frieze: figures in a band on the back wall */}
    <Box p={[0, 2.35, -1.49]} s={[6, 0.06, 0.02]} c="#6a2a1a" />
    <Box p={[0, 1.65, -1.49]} s={[6, 0.06, 0.02]} c="#6a2a1a" />
    {Array.from({ length: 11 }, (_, i) => (
      <group key={i} position={[-2.5 + i * 0.5, 2.0, -1.48]}>
        <Box p={[0, 0, 0]} s={[0.08, 0.36, 0.01]} c={i % 3 ? "#7a3020" : "#2a3a6a"} />
        <mesh position={[0, 0.24, 0]}><circleGeometry args={[0.06, 10]} /><Toon c={INK} /></mesh>
      </group>
    ))}
    {/* the canopic shrine: gilded canopy on four posts over the calcite chest */}
    <group position={[0.3, 0, -0.3]}>
      <Box p={[0, 0.06, 0]} s={[1.5, 0.12, 1.0]} c={GOLD_D} />
      <Box p={[0, 0.45, 0]} s={[1.15, 0.66, 0.75]} c={CALCITE} />
      <Box p={[0, 0.8, 0]} s={[1.2, 0.04, 0.8]} c="#e4d9c0" />
      {[-0.66, 0.66].map((x) => [-0.42, 0.42].map((z) => <Box key={`${x}${z}`} p={[x, 1.1, z]} s={[0.07, 2.1, 0.07]} c={GOLD} />))}
      <Box p={[0, 2.18, 0]} s={[1.55, 0.14, 1.05]} c={GOLD} />
      <Box p={[0, 2.3, 0]} s={[1.6, 0.1, 1.1]} c={GOLD_D} />
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-0.64 + i * 0.16, 2.44, 0.5]}><coneGeometry args={[0.05, 0.14, 4]} /><Toon c={GOLD} /></mesh>)}
      {[-0.39, -0.13, 0.13, 0.39].map((x, i) => <Jar key={i} p={[x, 0.82, 0.05]} s={0.62} lidUp={i === 0 ? lidY : 0} lidX={i === 0 ? lidWob : 0} />)}
    </group>
    {/* stacked treasure */}
    <OvalBox p={[-1.7, 0.12, -1.0]} /><OvalBox p={[-1.35, 0.12, -1.2]} /><OvalBox p={[-1.55, 0.34, -1.1]} s={0.9} />
    <Box p={[1.75, 0.25, -1.0]} s={[0.7, 0.5, 0.45]} c={GOLD} /><Box p={[1.75, 0.6, -1.0]} s={[0.55, 0.2, 0.4]} c="#3a5aa0" />
    <Box p={[2.0, 0.15, -0.3]} s={[0.4, 0.3, 0.35]} c="#7a4a2a" />
    {[[-2.0, -0.4], [2.2, 0.5]].map(([x, z], i) => <mesh key={i} position={[x, 0.3, z]}><cylinderGeometry args={[0.12, 0.18, 0.6, 14]} /><Toon c={i ? "#c8b89a" : "#a8784a"} /></mesh>)}
    <mesh position={[-2.2, 0.55, -0.9]} rotation={[0, 0.4, 0]}><torusGeometry args={[0.4, 0.04, 8, 24]} /><Toon c={GOLD} /></mesh>
    <Guardian p={[-2.2, 0, -1.2]} r={0.4} /><Guardian p={[2.25, 0, -1.25]} r={-0.4} />
    {/* Anubis in the foreground (framing + near blur) */}
    <Anubis p={[-1.5, 0, 1.75]} s={0.9} />
    {/* dust floating in the lamp light */}
    {Array.from({ length: 40 }, (_, i) => {
      const x = -1.6 + ((i * 0.37) % 3.2), y = 0.4 + ((i * 0.53 + f * 0.002 * (1 + (i % 3))) % 2.2), z = -0.8 + ((i * 0.71) % 2.2);
      return <mesh key={i} position={[x + Math.sin(f * 0.02 + i) * 0.05, y, z]}><sphereGeometry args={[0.006, 4, 4]} /><meshBasicMaterial color={[1.6, 1.3, 0.8]} toneMapped={false} transparent opacity={0.6} /></mesh>;
    })}
    {/* Carter: looks at the heads, reaches, lifts a lid, recoils on "organ" */}
    <Card o={CARTER} f={f} pos={[-0.72 - yuck * 0.06, 0, 0.35]} seed={2}
      opts={{ arm: "reach", armK: Math.min(1, lid), armRaw: true, expr: yuck > 0.4 ? "disgust" : look > 0.5 ? "awe" : "neutral", lean: -18 * yuck + 8 * lid * (1 - yuck), look: 0.6 * look }} />
    <Cam f={f} t={t} from={[-0.3, 1.6, 5.6]} to={[-0.25, 1.45, 4.6]} look={[-0.28, 1.1, -0.2]} fov={48} />
    <Post light="golden" cInf={11} focus={[-0.3, 1.3, 0.1]} grade={0.6} />
  </>);
};
