// Building blocks: toon character cards (drawn with toon.ts on a canvas every frame), simple toon props, camera rig.
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Pen, bodyFront, FrontOpts, Outfit, INK, townsfolk } from "./toon";
import { smooth } from "./story";

export type V3 = [number, number, number];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------- cast ----------------
export const CARTER: Outfit = { jacket: "#c9a56c", pants: "#6b5232", boots: INK, hat: "bowler", moustache: "#3a2a1a", build: "adult" };
export const CARTER_OLD: Outfit = { ...CARTER, moustache: "#e8e4dc", hat: "straw", jacket: "#d8c8a0" };
export const CARN: Outfit = { jacket: "#3d4a6b", pants: "#2b2f3a", boots: INK, moustache: "#5a3b2a", build: "tall", scarf: "#f1efe6" };
export const REPORTER: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "straw", bowtie: "#e2453c" };
export const DOCTOR: Outfit = { jacket: "#f4f4f0", pants: "#4a5060", boots: INK, glasses: true, stetho: true };
export const OLDMAN = (v: number): Outfit => ({ ...townsfolk(v), moustache: "#e8e4dc", hat: v % 2 ? "bowler" : "cap", cap: "#6b5a48", dress: undefined });
export const CROWD = (v: number): Outfit => townsfolk(v);

// ---------------- character card ----------------
const CW = 360, CH = 600; // canvas px (design space 600 x 1000)
type CardP = { o: Outfit; f: number; pos: V3; h?: number; seed?: number; rotZ?: number; opts?: FrontOpts; flipX?: boolean };
/** a flat 2D character standing in the 3D world; idles (breath + blink) on every frame, so nobody is ever frozen */
export const Card: React.FC<CardP> = ({ o, f, pos, h = 1.8, seed = 1, rotZ = 0, opts = {}, flipX }) => {
  const { cv, tex } = useMemo(() => {
    const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return { cv, tex };
  }, []);
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
  const blink = (f + seed * 41) % 97 < 3;
  bodyFront(new Pen(g), o, { mode: "stand", seed, blink, look: Math.sin(f * 0.03 + seed) * 0.15, headTilt: Math.sin(f * 0.05 + seed) * 2, ...opts });
  tex.needsUpdate = true;
  const breath = 1 + 0.012 * Math.sin(f * 0.13 + seed);
  return (
    <group position={pos} rotation={[0, 0, rotZ]}>
      <mesh position={[0, (h * breath) / 2 - h * 0.025, 0]} scale={[flipX ? -1 : 1, breath, 1]}>
        <planeGeometry args={[h * 0.6, h]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.4} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[1, 0.45, 1]}>
        <circleGeometry args={[h * 0.18, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
};

// ---------------- props ----------------
export const Toon: React.FC<{ c: string; e?: string; ei?: number }> = ({ c, e, ei = 0 }) =>
  <meshToonMaterial color={c} emissive={e ?? "#000"} emissiveIntensity={ei} />;
export const Box: React.FC<{ p: V3; s: V3; c: string; r?: V3; e?: string; ei?: number }> = ({ p, s, c, r = [0, 0, 0], e, ei }) => (
  <mesh position={p} rotation={r}><boxGeometry args={s} /><Toon c={c} e={e} ei={ei} /></mesh>
);
/** canopic jar: white calcite body, a gold king's head lid with a striped headdress */
export const Jar: React.FC<{ p: V3; s?: number; lidUp?: number }> = ({ p, s = 1, lidUp = 0 }) => (
  <group position={p} scale={s}>
    <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.16, 0.12, 0.5, 20]} /><Toon c="#f1ece0" /></mesh>
    <group position={[0, 0.58 + lidUp, 0]}>
      <mesh><cylinderGeometry args={[0.2, 0.17, 0.2, 20]} /><Toon c="#2f5aa8" /></mesh>
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.21, 0.21, 0.04, 20]} /><Toon c="#e0b84a" /></mesh>
      <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.13, 20, 16]} /><Toon c="#e7c78f" /></mesh>
      <mesh position={[0, 0.25, -0.01]}><sphereGeometry args={[0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><Toon c="#e0b84a" /></mesh>
      <mesh position={[-0.05, 0.17, 0.12]}><sphereGeometry args={[0.018, 8, 8]} /><Toon c={INK} /></mesh>
      <mesh position={[0.05, 0.17, 0.12]}><sphereGeometry args={[0.018, 8, 8]} /><Toon c={INK} /></mesh>
    </group>
  </group>
);
/** mosquito: dark body, thin legs, two flapping wings; `fly` 0..1 lifts it along +y/+x */
export const Mosquito: React.FC<{ p: V3; f: number; s?: number; land?: number }> = ({ p, f, s = 1, land = 1 }) => {
  const flap = Math.sin(f * 2.6) * 0.6 * (1 - 0.6 * land);
  return (
    <group position={p} scale={s}>
      <mesh rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.025, 0.12, 4, 8]} /><Toon c="#2a2226" /></mesh>
      <mesh position={[0.09, 0.01, 0]}><sphereGeometry args={[0.03, 10, 8]} /><Toon c="#2a2226" /></mesh>
      <mesh position={[0.15, -0.005, 0]} rotation={[0, 0, -1.4]}><cylinderGeometry args={[0.003, 0.003, 0.09, 4]} /><Toon c="#2a2226" /></mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0.01, 0.04, 0.04 * k]} rotation={[k * (0.4 + flap), 0, 0.3]}>
          <planeGeometry args={[0.11, 0.05]} />
          <meshBasicMaterial color="#dfe8f2" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[-0.05, 0, 0.05].map((x) => [-1, 1].map((k) => (
        <mesh key={`${x}${k}`} position={[x, -0.04, 0.025 * k]} rotation={[k * 0.5, 0, 0]}><cylinderGeometry args={[0.003, 0.003, 0.08, 4]} /><Toon c="#2a2226" /></mesh>
      )))}
    </group>
  );
};
/** newspaper sheet with grey text stripes (no readable words on screen) */
export const Paper: React.FC<{ p: V3; r?: V3; s?: number }> = ({ p, r = [0, 0, 0], s = 1 }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 170; const g = cv.getContext("2d")!;
    g.fillStyle = "#f3ecd9"; g.fillRect(0, 0, 128, 170); g.fillStyle = "#2a2226"; g.fillRect(10, 10, 108, 22);
    g.fillStyle = "#8a8070"; for (let i = 0; i < 11; i++) { g.fillRect(10, 44 + i * 11, 50, 5); g.fillRect(68, 44 + i * 11, 50, 5); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={p} rotation={r} scale={s}><planeGeometry args={[0.45, 0.6]} /><meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} /></mesh>;
};

// ---------------- light + camera ----------------
export const Light: React.FC<{ sky: string; sun: string; ground?: string; k?: number; dir?: V3; bg: string; fog?: [number, number] }> =
  ({ sky, sun, ground = "#3a2a20", k = 1, dir = [3, 6, 4], bg, fog }) => (
    <>
      <color attach="background" args={[bg]} />
      {fog && <fog attach="fog" args={[bg, fog[0], fog[1]]} />}
      <hemisphereLight args={[sky, ground, 0.9 * k]} />
      <directionalLight position={dir} intensity={2.2 * k} color={sun} />
    </>
  );
/** eased camera move from a to b over the shot (t 0..1), with a tiny handheld drift so the frame is never dead */
export const Cam: React.FC<{ t: number; from: V3; to: V3; look: V3; lookTo?: V3; fov?: number; f: number }> = ({ t, from, to, look, lookTo, fov = 40, f }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const u = smooth(t), p = lerp(from, to, u), l = lerp(look, lookTo ?? look, u);
    cam.position.set(p[0] + Math.sin(f * 0.021) * 0.01, p[1] + Math.sin(f * 0.017) * 0.01, p[2]);
    cam.fov = fov; cam.near = 0.01; cam.far = 200; cam.updateProjectionMatrix();
    cam.lookAt(...l);
  });
  return null;
};
