// Sets for the Semmelweis short (pbr look): basin room, maternity ward, hospital facade, autopsy room, corridor, study.
import React from "react";
import * as THREE from "three";
import { Card, V3, CROWD } from "../kit";
import { PBox, PCyl, Std, Candle, Practical, Shaft, Dust } from "../pbr";
import { Outfit, INK } from "../toon";

// ---------------- cast ----------------
export const SEMMEL: Outfit = { jacket: "#2a2d38", pants: "#22242c", boots: INK, moustache: "#6a4a2e", chops: "#6a4a2e", build: "stout", scarf: "#f4f1ea" };
export const DOC = (v: number): Outfit => ({ jacket: ["#4a3b2a", "#2f3d4a", "#47333f", "#3c4632"][v % 4], pants: "#2a2a30", boots: INK,
  moustache: ["#3a2a1a", "#8a6a4a", undefined, "#2a2020"][v % 4], build: v % 3 === 1 ? "stout" : "adult", scarf: "#efe9dc" });
export const OLDDOC: Outfit = { jacket: "#5a2a2a", pants: "#2a2a30", boots: INK, moustache: "#e8e4dc", chops: "#e8e4dc", monocle: true, build: "stout", scarf: "#efe9dc" };
export const KOLL: Outfit = { jacket: "#3a4a3a", pants: "#2a2a30", boots: INK, glasses: true, moustache: "#4a3020", scarf: "#efe9dc" };
export const MIDWIFE: Outfit = { jacket: "#5a7a9a", pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", cap: "#f4f1ea", dress: "#5a7a9a", gloves: "#f6efe6" };
export const MOTHER = (v: number): Outfit => ({ ...CROWD(v * 2 + 1), hat: "bonnet", cap: "#f4f1ea", dress: ["#c9b8a8", "#b8c4cc", "#d6c2b0"][v % 3] });
export const DIRTY = "#5f6a3e"; // hand dots after the autopsy (no science word on screen; the hands just look wrong)

// ---------------- props ----------------
/** washstand: wooden cabinet, white porcelain basin with chlorine water, jug and towel */
export const Washstand: React.FC<{ p: V3; f: number }> = ({ p, f }) => (
  <group position={p}>
    <PBox p={[0, 0.4, 0]} s={[0.9, 0.8, 0.5]} c="#7a5236" t="wood" rep={[1, 1]} />
    <PBox p={[0, 0.81, 0]} s={[0.96, 0.03, 0.56]} c="#e8e2d6" r={0.3} />
    <mesh position={[0, 0.9, 0]} castShadow receiveShadow><cylinderGeometry args={[0.27, 0.18, 0.16, 32, 1, true]} /><meshStandardMaterial color="#f6f4ee" roughness={0.15} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0.94 + Math.sin(f * 0.15) * 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.25, 32]} /><meshStandardMaterial color="#a9cbd2" roughness={0.05} metalness={0.1} transparent opacity={0.8} /></mesh>
    <PCyl p={[0.36, 0.96, -0.05]} r={[0.06, 0.09]} h={0.28} c="#e8ece8" rough={0.2} />
    <PBox p={[-0.47, 0.6, 0.1]} s={[0.04, 0.45, 0.22]} c="#efe9dc" r={1} />
  </group>
);
export const Bed: React.FC<{ p: V3; blanket: string; f: number; who?: Outfit; seed: number; flip?: boolean; dead?: boolean; candle?: number }> = ({ p, blanket, f, who, seed, flip, dead, candle = 1 }) => (
  <group position={p}>
    {/* iron bedstead: corner posts and top rails (open, so the ward reads through it) */}
    {[-0.95, 0.95].map((x) => (<group key={x}>
      {[-0.37, 0.37].map((z) => <PCyl key={z} p={[x, 0.38, z]} r={[0.018, 0.018]} h={0.76} c="#2c2c30" rough={0.35} m={0.8} />)}
      <PCyl p={[x, 0.74, 0]} r={[0.014, 0.014]} h={0.74} c="#2c2c30" rough={0.35} m={0.8} rot={[Math.PI / 2, 0, 0]} />
      <PCyl p={[x, 0.58, 0]} r={[0.01, 0.01]} h={0.74} c="#2c2c30" rough={0.35} m={0.8} rot={[Math.PI / 2, 0, 0]} />
    </group>))}
    <PBox p={[0, 0.42, 0]} s={[1.9, 0.18, 0.78]} c="#e9e4da" r={0.95} />
    <PBox p={[flip ? 0.25 : -0.25, 0.53, 0]} s={[1.35, 0.07, 0.8]} c={blanket} r={1} />
    <PBox p={[flip ? -0.75 : 0.75, 0.56, 0]} s={[0.32, 0.1, 0.55]} c="#f4f1ea" r={1} />
    {who && <Card lit o={who} f={f} seed={seed} h={1.5} pos={[flip ? 0.55 : -0.55, 0.62, 0.05]} rotZ={flip ? Math.PI / 2 : -Math.PI / 2}
      opts={{ expr: dead ? "dead" : seed % 3 ? "tired" : "sleepy", blink: dead ? 1 : undefined }} />}
    <PBox p={[flip ? -1.2 : 1.2, 0.3, 0.1]} s={[0.35, 0.6, 0.35]} c="#6a4a32" t="wood" />
    <Candle p={[flip ? -1.2 : 1.2, 0.6, 0.1]} f={f + seed * 13} k={candle} i={0.6} />
  </group>
);

// ---------------- rooms ----------------
/** a hospital room box: wood floor, plaster walls with a dado, ceiling, tall windows in the left wall with sun shafts */
export const Room: React.FC<{ w: number; d: number; h?: number; wall: string; floor?: "wood" | "tiles"; f: number; win?: number[]; sun?: string; shaftK?: number }> =
  ({ w, d, h = 3.6, wall, floor = "wood", f, win = [], sun = "#ffe2b0", shaftK = 0.3 }) => (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -d / 2 + 2]} receiveShadow><planeGeometry args={[w, d]} /><Std c={floor === "wood" ? "#a07850" : "#d8d0c0"} t={floor} rep={floor === "wood" ? [w / 2, d / 2] : [w / 1.2, d / 1.2]} r={0.7} /></mesh>
    <PBox p={[0, h / 2, -d + 2]} s={[w, h, 0.2]} c={wall} t="plaster" rep={[w / 3, 1]} />
    <PBox p={[w / 2, h / 2, -d / 2 + 2]} s={[0.2, h, d]} c={wall} t="plaster" rep={[d / 3, 1]} />
    <PBox p={[0, h, -d / 2 + 2]} s={[w, 0.15, d]} c="#d8d2c4" t="plaster" />
    {/* left wall in pieces around the windows; each window throws a sun shaft onto the floor */}
    {(() => {
      const zs = [...win].sort((a, b) => b - a), parts: React.ReactElement[] = [];
      let z0 = 2;
      zs.forEach((z, i) => {
        parts.push(<PBox key={`w${i}`} p={[-w / 2, h / 2, (z0 + z + 0.6) / 2]} s={[0.2, h, Math.max(0.01, z0 - (z + 0.6))]} c={wall} t="plaster" />);
        parts.push(<PBox key={`b${i}`} p={[-w / 2, 0.55, z]} s={[0.2, 1.1, 1.2]} c={wall} t="plaster" />);
        parts.push(<PBox key={`t${i}`} p={[-w / 2, h - 0.35, z]} s={[0.2, 0.7, 1.2]} c={wall} t="plaster" />);
        parts.push(<mesh key={`g${i}`} position={[-w / 2 - 0.05, 1.8, z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.2, 1.4]} /><meshBasicMaterial color={[1.7, 1.6, 1.4]} toneMapped={false} /></mesh>);
        parts.push(<PBox key={`m${i}`} p={[-w / 2 + 0.02, 1.8, z]} s={[0.06, 1.4, 0.05]} c="#5a4632" />);
        parts.push(<Shaft key={`s${i}`} f={f} from={[-w / 2, 2.2, z]} to={[-w / 2 + 2.2, 0.0, z + 0.5]} r={[0.45, 0.8]} col={sun} k={shaftK} />);
        z0 = z - 0.6;
      });
      parts.push(<PBox key="wl" p={[-w / 2, h / 2, (z0 + (-d + 2)) / 2]} s={[0.2, h, Math.max(0.01, z0 - (-d + 2))]} c={wall} t="plaster" />);
      return parts;
    })()}
    <PBox p={[0, 0.5, -d + 2.11]} s={[w, 1.0, 0.02]} c="#7a8a7a" r={0.6} />
    {/* wall dressing: framed pictures and a wall lamp, so the upper half of the frame is not bare plaster */}
    {[-w / 4, w / 4].map((x, i) => (<group key={x} position={[x, 2.15, -d + 2.12]}>
      <PBox p={[0, 0, 0]} s={[0.55, 0.7, 0.04]} c="#5a3a22" r={0.5} />
      <PBox p={[0, 0, 0.022]} s={[0.45, 0.6, 0.01]} c={["#8a7a5a", "#6a7a8a"][i]} r={0.9} />
    </group>))}
    <Practical p={[0, 2.6, -d + 2.25]} f={f + 5} i={1.6} />
    <Dust f={f} box={[[-w / 2 + 0.3, 0.2, -3], [w / 2 - 0.3, 2.8, 1.5]]} n={70} />
  </>);

/** the long maternity ward: two rows of beds down an aisle */
export const Ward: React.FC<{ f: number; warm: boolean; deadBed?: number; candleOut?: number; patients?: boolean }> = ({ f, warm, deadBed = -1, candleOut = 1, patients = true }) => (<>
  <Room w={6} d={14} wall={warm ? "#e8d6b8" : "#c8ccc4"} f={f} win={[-1, -4, -7]} sun={warm ? "#ffd49a" : "#cfe0ff"} shaftK={warm ? 0.35 : 0.22} />
  {Array.from({ length: 10 }, (_, i) => {
    const row = i % 2, k = Math.floor(i / 2), dead = i === deadBed;
    return <Bed key={i} f={f} seed={50 + i} p={[row ? 1.75 : -1.75, 0, -0.8 - k * 2.2]} flip={!row} blanket={warm ? ["#b8553a", "#c8a060"][i % 2] : ["#7a8694", "#8a8f86"][i % 2]}
      who={patients ? MOTHER(i) : undefined} dead={dead && candleOut < 0.5} candle={dead ? candleOut : 1} />;
  })}
</>);

/** the hospital front: a long baroque facade, two doors (doctors' clinic left, cold lamp; midwives' clinic right, warm) */
export const Facade: React.FC<{ f: number; rain?: number }> = ({ f, rain = 0 }) => (<>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow><planeGeometry args={[40, 30]} /><Std c="#b0aa9e" t="cobble" rep={[36, 27]} r={rain > 0 ? 0.25 : 0.9} /></mesh>
  <PBox p={[0, 3.2, -4]} s={[16, 6.4, 1.2]} c="#c9b896" t="plaster" rep={[5, 2]} />
  <PBox p={[0, 6.55, -3.9]} s={[16.4, 0.3, 1.5]} c="#c8b896" />
  <PBox p={[0, 0.2, -3.3]} s={[16, 0.4, 0.3]} c="#b8a888" />
  {Array.from({ length: 8 }, (_, i) => [1.6, 4.4].map((y) => (
    <group key={`${i}${y}`} position={[-7 + i * 2, y, -3.38]}>
      <PBox p={[0, 0, -0.02]} s={[0.9, 1.4, 0.08]} c="#5a4632" />
      <mesh><planeGeometry args={[0.75, 1.25]} /><meshStandardMaterial color={y < 3 && i > 3 ? "#ffcf8a" : "#26303e"} emissive={y < 3 && i > 3 ? "#ffb060" : "#000"} emissiveIntensity={y < 3 && i > 3 ? 1.6 : 0} roughness={0.2} metalness={0.3} /></mesh>
    </group>
  )))}
  {[-1.6, 1.6].map((x, i) => (
    <group key={x} position={[x, 0, -3.36]}>
      <PBox p={[0, 1.2, 0]} s={[1.3, 2.4, 0.1]} c={i ? "#6a4228" : "#3a3430"} t="wood" />
      <PBox p={[0, 2.55, 0.05]} s={[1.7, 0.3, 0.2]} c="#c8b896" />
      <Practical p={[0, 2.85, 0.35]} f={f + i * 20} col={i ? "#ffb25c" : "#bcd0ff"} i={i ? 3.2 : 2.2} />
    </group>
  ))}
  {rain > 0 && Array.from({ length: 160 }, (_, i) => {
    const r = (x: number) => { const s = Math.sin(x * 127.1 + i * 3.7) * 43758.5; return s - Math.floor(s); };
    const y = 6 - ((r(1) * 6 + f * 0.35) % 6);
    return <mesh key={i} position={[-4 + r(2) * 8, y, -2 + r(3) * 6]}><boxGeometry args={[0.006, 0.28, 0.006]} /><meshBasicMaterial color={[0.7, 0.8, 1.0]} transparent opacity={0.35 * rain} depthWrite={false} /></mesh>;
  })}
</>);

/** autopsy room: stone walls, tiled floor, one hanging lamp over a table with a sheet-covered body */
export const Autopsy: React.FC<{ f: number; lamp: number }> = ({ f, lamp }) => (<>
  <Room w={5} d={6} wall="#a8aca0" floor="tiles" f={f} win={[]} />
  <PBox p={[0, 0.45, -0.6]} s={[2.0, 0.08, 0.8]} c="#c8ccc8" r={0.3} m={0.5} />
  {[-0.85, 0.85].map((x) => <PBox key={x} p={[x, 0.22, -0.6]} s={[0.08, 0.44, 0.7]} c="#3a3a3e" m={0.6} r={0.4} />)}
  <mesh position={[0, 0.6, -0.6]} scale={[1.7, 0.22, 0.6]} castShadow receiveShadow><sphereGeometry args={[0.5, 24, 12]} /><Std c="#ece8de" r={1} /></mesh>
  <PBox p={[1.5, 0.45, -0.9]} s={[0.6, 0.9, 0.4]} c="#6a5a4a" t="wood" />
  {[0, 1, 2].map((i) => <PCyl key={i} p={[1.35 + i * 0.13, 0.98, -0.9]} r={[0.04, 0.04]} h={0.16} c={["#7a9a8a", "#a8b4c8", "#c8a87a"][i]} rough={0.15} />)}
  <group position={[0, 2.4 + Math.sin(f * 0.04) * 0.02, -0.6]} rotation={[0, 0, Math.sin(f * 0.04) * 0.03]}>
    <PCyl p={[0, 0.6, 0]} r={[0.01, 0.01]} h={1.2} c="#2a2a2a" />
    <mesh position={[0, 0.05, 0]} castShadow><coneGeometry args={[0.3, 0.2, 20, 1, true]} /><meshStandardMaterial color="#2f3a36" roughness={0.5} metalness={0.5} side={THREE.DoubleSide} /></mesh>
    <Practical p={[0, -0.02, 0]} f={f} k={lamp} col="#ffe2b8" i={5} />
  </group>
</>);
