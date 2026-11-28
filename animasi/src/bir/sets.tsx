// Sets and props for the London Beer Flood (painted + ink look): the giant porter vat built from staves and iron hoops
// (it bursts stave by stave), beer (level, gush, flood), the brewery hall, the St Giles lane, the cellar, the court.
import React from "react";
import * as THREE from "three";
import { Box, Toon, House, Win, Lamp, V3 } from "../kit";
import { Outfit, INK, townsfolk } from "../toon";

// ---------------- cast ----------------
export const CLERK: Outfit = { jacket: "#6a5a3a", pants: "#3a3228", boots: INK, hat: "cap", cap: "#4a3a2a", scarf: "#e8e0cc" };
export const BOSS: Outfit = { jacket: "#2a3a5a", pants: "#2a2a30", boots: INK, hat: "tophat", moustache: "#3a2a1a", build: "stout" };
export const WORKER = (v: number): Outfit => ({ jacket: ["#7a4a2a", "#4a5a3a", "#5a4a6a"][v % 3], pants: "#3a3228", boots: INK, hat: "cap", cap: ["#3a2a1a", "#5a4a3a", "#2a2a3a"][v % 3] });
export const MOTHER: Outfit = { ...townsfolk(1), hat: "bonnet", cap: "#e8e0cc", dress: "#8a6a5a" };
export const CHILD: Outfit = { jacket: "#c9884a", pants: "#4a5a7a", boots: INK, build: "kid" };
export const EATER: Outfit = { jacket: "#c9a86a", pants: "#3a4a6a", boots: INK, build: "stout", moustache: "#3a2a1a" };
export const JUDGE: Outfit = { jacket: "#7a1f22", pants: "#2a2a30", boots: INK, chops: "#efeae0", moustache: "#efeae0", build: "stout", scarf: "#f4f1ea" };
export const MEUX: Outfit = { jacket: "#3a2a4a", pants: "#2a2a30", boots: INK, hat: "tophat", moustache: "#8a6a4a", monocle: true, build: "stout" };
export const CLERK_GOV: Outfit = { jacket: "#2a3020", pants: "#2a2a30", boots: INK, hat: "bowler", glasses: true };

export const BEER = "#3a1f0e", FOAM = "#eadbb4", OAK = "#8a5a32", OAK_D = "#5e3a1e", IRON = "#2e2e34";

// ---------------- the vat ----------------
const STAVES = 28;
/** porter vat: oak staves in a ring + iron hoops; `slip` drops hoop `slipHoop` down the side, `burst` 0..1 throws the
 *  staves outward, `shake` rattles it, `level` is the beer seen from above */
export const Vat: React.FC<{ p: V3; r?: number; h?: number; f: number; slip?: number; slipHoop?: number; burst?: number; shake?: number; hoopsOff?: number }> =
  ({ p, r = 1.8, h = 6, f, slip = 0, slipHoop = 1, burst = 0, shake = 0, hoopsOff = 0 }) => {
    const sw = (2 * Math.PI * r) / STAVES, j = shake * Math.sin(f * 2.1) * 0.03;
    const hoops = 7;
    return (
      <group position={[p[0] + j, p[1], p[2]]}>
        {Array.from({ length: STAVES }, (_, i) => {
          const a = (i / STAVES) * Math.PI * 2, b = Math.max(0, burst - ((i * 7) % 5) * 0.04), out = b * (2.2 + ((i * 13) % 7) * 0.4);
          const fall = b * b * 5, spin = b * (((i * 11) % 9) - 4) * 0.5;
          return (
            <group key={i} position={[Math.cos(a) * (r + out), h / 2 - Math.min(h / 2 - 0.3, fall), Math.sin(a) * (r + out)]} rotation={[spin * 0.3, -a, spin * 0.8 * b]}>
              <mesh><boxGeometry args={[0.12, h, sw * 1.02]} /><Toon c={i % 3 ? OAK : OAK_D} /></mesh>
            </group>
          );
        })}
        {Array.from({ length: hoops }, (_, k) => {
          const y = 0.35 + (k * (h - 0.7)) / (hoops - 1) - (k === slipHoop ? slip * 0.55 : 0);
          const off = clampN(hoopsOff * hoops - (hoops - 1 - k)), fly = off * 3, gone = burst > 0.05;
          return !gone && (
            <mesh key={k} position={[fly * 0.6, y + fly * 1.5, fly]} rotation={[Math.PI / 2 + off * 1.2, 0, 0]}>
              <torusGeometry args={[r + 0.08 + off * 0.3, 0.07, 8, 48]} /><Toon c={IRON} />
            </mesh>
          );
        })}
        {burst < 0.05 && <mesh position={[0, h - 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[r, 40]} /><Toon c={FOAM} /></mesh>}
      </group>
    );
  };
const clampN = (x: number) => Math.max(0, Math.min(1, x));

/** gush of porter from a burst vat: a widening dome of beer topped with foam */
export const Gush: React.FC<{ p: V3; k: number; r0?: number }> = ({ p, k, r0 = 1.8 }) => k <= 0 ? null : (
  <group position={p}>
    <mesh position={[0, 1.4 * (1 - k) + 0.3, 0]} scale={[r0 + k * 7, 2.6 * (1 - k * 0.8) + 0.25, r0 + k * 7]}><sphereGeometry args={[1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><Toon c={BEER} /></mesh>
    <mesh position={[0, 0.02 + 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={r0 + k * 7.4}><ringGeometry args={[0.92, 1.0, 48]} /><Toon c={FOAM} /></mesh>
  </group>
);
/** beer flood: a flat sheet of porter at height `y` with a foamy front line at z = `front` */
export const Flood: React.FC<{ y: number; front?: number; w?: number; d?: number; z0?: number }> = ({ y, front = 99, w = 30, d = 40, z0 = 10 }) => y <= 0.01 ? null : (
  <group>
    {/* glossy porter with drifting foam streaks, so the flood reads against dark floors */}
    <mesh position={[0, y, Math.min(front, z0) - d / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color="#6a3814" roughness={0.15} metalness={0.1} /></mesh>
    {Array.from({ length: 18 }, (_, i) => <mesh key={i} position={[((i * 0.618) % 1 - 0.5) * w * 0.7, y + 0.01, Math.min(front, z0) - 0.5 - ((i * 0.381) % 1) * d * 0.6]} rotation={[-Math.PI / 2, 0, i]}>
      <planeGeometry args={[(0.9 + (i % 3) * 0.5) * Math.min(1, w / 20), 0.12 * Math.min(1, w / 12)]} /><meshBasicMaterial color={FOAM} /></mesh>)}
    {front < z0 && <mesh position={[0, y / 2, front]}><boxGeometry args={[w, y, 0.4]} /><Toon c={FOAM} /></mesh>}
  </group>
);
/** floating things on the beer (caps, a bonnet, planks) bobbing at height y */
export const Flotsam: React.FC<{ y: number; f: number; n?: number; spread?: [number, number] }> = ({ y, f, n = 8, spread = [3, 4] }) => y <= 0.05 ? null : (<>
  {Array.from({ length: n }, (_, i) => {
    const x = ((i * 0.618) % 1 - 0.5) * spread[0] * 2, z = ((i * 0.377) % 1 - 0.5) * spread[1] * 2, bob = Math.sin(f * 0.12 + i) * 0.03;
    return i % 3 === 0
      ? <Box key={i} p={[x, y + 0.04 + bob, z]} s={[0.9, 0.06, 0.18]} c={OAK} r={[0, i, 0]} />
      : <mesh key={i} position={[x, y + 0.06 + bob, z]} rotation={[0.2 * Math.sin(f * 0.1 + i), i, 0]}><cylinderGeometry args={[0.14, 0.18, 0.1, 14]} /><Toon c={i % 3 === 1 ? "#e8e0cc" : "#3a2a1a"} /></mesh>;
  })}
</>);

// ---------------- places ----------------
/** brewery hall: brick walls, wooden floor, beams, two hanging lamps */
export const Hall: React.FC<{ f: number; dark?: number }> = ({ f, dark = 0 }) => (<>
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 30]} /><Toon c="#6a4a30" /></mesh>
  <Box p={[0, 5, -6]} s={[30, 10, 0.4]} c="#8a4a3a" />
  {Array.from({ length: 9 }, (_, i) => <Box key={i} p={[-12 + i * 3, 9, -2]} s={[0.4, 0.5, 9]} c={OAK_D} />)}
  {[-3, 4].map((x, i) => <Win key={x} p={[x, 6, -5.78]} s={[1.4, 2.2]} c={[1.5 - dark, 1.2 - dark * 0.8, 0.8 - dark * 0.5]} />)}
  <Lamp p={[-2.2, 7, 1.5]} f={f} k={1 - dark * 0.7} /><Lamp p={[3.5, 7, 1.0]} f={f + 9} k={1 - dark * 0.7} />
  {/* sacks and barrels by the wall */}
  {[-7, -6.2, 6.6, 7.4].map((x, i) => <mesh key={x} position={[x, 0.5, -4.6 + (i % 2) * 0.6]}><cylinderGeometry args={[0.45, 0.45, 1, 16]} /><Toon c={i % 2 ? OAK : "#c9b48a"} /></mesh>)}
</>);
/** the St Giles lane: brick terraces both sides, cobbles; `fall` tips two houses over */
export const Lane: React.FC<{ f: number; fall?: number; dusk?: boolean }> = ({ f, fall = 0, dusk }) => (<>
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 60]} /><Toon c="#7a7064" /></mesh>
  {[-1, 1].map((side) => Array.from({ length: 5 }, (_, i) => {
    const z = -2 - i * 2.4, tip = side > 0 && i < 2 ? fall * (0.9 + i * 0.3) : 0, sink = tip * 1.2;
    return (
      <group key={`${side}${i}`} position={[side * 3.2, -sink, z]} rotation={[0, -side * Math.PI / 2, -side * tip * 0.9]}>
        <House p={[0, 0, 0]} w={2.3} h={4.2 + (i % 2) * 0.9} c={["#8a4a3a", "#9a6a4a", "#7a5a4a", "#a8845a", "#6a4a3a"][(i + (side > 0 ? 2 : 0)) % 5]} awn={["#3a5a3a", "#5a2a2a", "#2a3a5a"][i % 3]} />
      </group>
    );
  }))}
  {dusk && <Lamp p={[-2.2, 2.8, -1.5]} f={f} col="#ffcf8a" />}
</>);
/** cellar: low stone room, stairs down from the street, a table, a candle */
export const Cellar: React.FC<{ f: number }> = ({ f }) => (<>
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[8, 8]} /><Toon c="#5a5048" /></mesh>
  <Box p={[0, 1.4, -2.2]} s={[6, 2.8, 0.3]} c="#7a6e60" />
  <Box p={[-2.6, 1.4, 0]} s={[0.3, 2.8, 5]} c="#6e6256" /><Box p={[2.6, 1.4, 0]} s={[0.3, 2.8, 5]} c="#6e6256" />
  <Box p={[0, 2.85, 0]} s={[6, 0.15, 5]} c="#3a2e26" />
  {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[1.6, 0.2 + i * 0.4, -1.9 + i * 0.05]} s={[1.2, 0.12, 0.45]} c={OAK} r={[0, 0, 0]} />)}
  <Win p={[-1.2, 2.3, -2.04]} s={[0.9, 0.4]} c={[0.9, 0.8, 0.7]} />
  <Box p={[-0.6, 0.4, -0.8]} s={[1.3, 0.08, 0.7]} c={OAK_D} />
  {[-1.1, -0.1].map((x) => [-1.05, -0.55].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.07, 0.4, 0.07]} c={OAK_D} />))}
  <Lamp p={[-0.3, 0.6, -0.8]} f={f} k={0.8} />
</>);
/** courtroom: panelled wall, the judge's high bench, a gavel */
export const Court: React.FC<{ f: number; gavel: number }> = ({ f, gavel }) => (<>
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[20, 20]} /><Toon c="#5a3a26" /></mesh>
  <Box p={[0, 3, -3]} s={[12, 6, 0.3]} c="#7a5236" />
  {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[-5 + i * 2, 2.2, -2.83]} s={[1.6, 2.6, 0.05]} c="#6a4428" />)}
  <Box p={[0, 0.7, -1.6]} s={[3.4, 1.4, 0.9]} c={OAK_D} />
  <Box p={[0, 1.42, -1.6]} s={[3.6, 0.06, 1.0]} c={OAK} />
  <group position={[0.7, 1.5 + 0.35 * (1 - gavel), -1.3]} rotation={[0, 0, -0.9 * (1 - gavel)]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.25, 12]} /><Toon c={OAK_D} /></mesh>
    <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.02, 0.02, 0.4, 8]} /><Toon c={OAK} /></mesh>
  </group>
  <Lamp p={[-2.5, 3.6, -1.0]} f={f} />
</>);
/** grey concrete tank (the replacement) */
export const Tank: React.FC<{ p: V3; y?: number }> = ({ p, y = 0 }) => (
  <group position={[p[0], p[1] + y, p[2]]}>
    <mesh position={[0, 2.8, 0]}><cylinderGeometry args={[1.9, 1.9, 5.6, 36]} /><Toon c="#a8a8a2" /></mesh>
    {[0.8, 2.8, 4.8].map((h) => <mesh key={h} position={[0, h, 0]}><cylinderGeometry args={[1.92, 1.92, 0.06, 36]} /><Toon c="#8a8a84" /></mesh>)}
  </group>
);
/** stack of gold coins */
export const Coins: React.FC<{ p: V3; n: number }> = ({ p, n }) => (<group position={p}>
  {Array.from({ length: n }, (_, i) => <mesh key={i} position={[(i % 3) * 0.13 - 0.13, 0.015 + Math.floor(i / 3) * 0.03, ((i * 5) % 3) * 0.05]}><cylinderGeometry args={[0.06, 0.06, 0.025, 16]} /><meshStandardMaterial color="#e8c04a" metalness={0.8} roughness={0.3} emissive="#6a4a10" /></mesh>)}
</group>);
export const Sack: React.FC<{ p: V3; s?: number }> = ({ p, s = 1 }) => (
  <group position={p} scale={s}>
    <mesh position={[0, 0.18, 0]} scale={[1, 0.9, 1]}><sphereGeometry args={[0.2, 16, 12]} /><Toon c="#b8945a" /></mesh>
    <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.04, 0.08, 0.1, 10]} /><Toon c="#8a6a3a" /></mesh>
  </group>
);
