// Realistic look (bible/modes/pbr.md): image-based light from a procedural room environment, one soft-shadowing key,
// PBR materials with procedural textures (plaster, wood, tiles), lit character cards that take the scene light and cast
// shadows, light shafts with dust, and a filmic post chain: lens -> N8AO -> bloom -> AgX -> saturation / contrast ->
// split-tone grade -> vignette -> grain. No world ink (edges come from shadow, AO and depth of field).
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode, HueSaturationEffect, BrightnessContrastEffect, VignetteEffect } from "postprocessing";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GradeParams } from "./grade";
import { V3 } from "./kit";

// ---------------- environment + key light ----------------
/** IBL from a procedural room (no HDRI download needed), a soft-shadowing key light, background and fog */
export const Env: React.FC<{ bg: string; ibl?: number; key?: string; keyI?: number; dir?: V3; fog?: [number, number]; area?: number }> =
  ({ bg, ibl = 0.6, key = "#fff1dc", keyI = 2.4, dir = [-4, 6, 4], fog, area = 7 }) => {
    const { gl, scene } = useThree();
    const env = useMemo(() => { const p = new THREE.PMREMGenerator(gl); const t = p.fromScene(new RoomEnvironment(), 0.04).texture; p.dispose(); return t; }, [gl]);
    scene.environment = env;
    scene.environmentIntensity = ibl;
    return (<>
      <color attach="background" args={[bg]} />
      {fog && <fog attach="fog" args={[bg, fog[0], fog[1]]} />}
      <directionalLight position={dir} intensity={keyI} color={key} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
        shadow-normalBias={0.03} shadow-camera-left={-area} shadow-camera-right={area} shadow-camera-top={area} shadow-camera-bottom={-area} shadow-camera-far={40} />
    </>);
  };

// ---------------- procedural textures ----------------
const texCache = new Map<string, THREE.CanvasTexture>();
const rnd = (s: number) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rep: [number, number]) => {
  const k = `${key}:${rep}`;
  if (!texCache.has(k)) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8;
    texCache.set(k, t);
  }
  return texCache.get(k)!;
};
/** mottled lime plaster */
const plaster = (g: CanvasRenderingContext2D) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 215 + rnd(i) * 40; g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.18)`; g.beginPath(); g.arc(rnd(i + 1) * 256, rnd(i + 2) * 256, 2 + rnd(i + 3) * 14, 0, 7); g.fill(); }
};
/** wooden floor planks with grain */
const wood = (g: CanvasRenderingContext2D) => {
  for (let p = 0; p < 8; p++) {
    const v = 0.86 + rnd(p) * 0.22; g.fillStyle = `rgb(${255 * v},${236 * v},${210 * v})`; g.fillRect(0, p * 32, 256, 32);
    for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(90,60,30,${0.08 + rnd(p * 30 + i) * 0.12})`; g.lineWidth = 1; g.beginPath(); const y = p * 32 + rnd(p * 50 + i) * 32; g.moveTo(0, y); g.bezierCurveTo(80, y + 3, 170, y - 3, 256, y + 1); g.stroke(); }
    g.fillStyle = "rgba(40,25,10,0.55)"; g.fillRect(0, p * 32, 256, 2); g.fillRect(rnd(p + 9) * 256, p * 32, 2, 32);
  }
};
/** worn floor tiles */
const tiles = (g: CanvasRenderingContext2D) => {
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { const v = 0.9 + rnd(x * 7 + y) * 0.1, d = (x + y) % 2 ? 1 : 0.82; g.fillStyle = `rgb(${250 * v * d},${246 * v * d},${236 * v * d})`; g.fillRect(x * 64, y * 64, 64, 64); }
  g.strokeStyle = "rgba(60,50,40,0.5)"; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
};
/** cobblestones */
const cobble = (g: CanvasRenderingContext2D) => {
  g.fillStyle = "#6a6258"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { const v = 0.8 + rnd(x * 13 + y * 7) * 0.25; g.fillStyle = `rgb(${150 * v},${142 * v},${130 * v})`; g.beginPath(); g.ellipse(x * 44 + (y % 2) * 22 + 20 + rnd(x + y * 9) * 4, y * 32 + 16, 20 + rnd(y * 3 + x) * 3, 14, rnd(x * 5 + y) * 0.6, 0, 7); g.fill(); }
};
const DRAW = { plaster, wood, tiles, cobble };
export type TexName = keyof typeof DRAW;

// ---------------- materials + meshes ----------------
/** PBR material: albedo colour x procedural texture, roughness, metalness */
export const Std: React.FC<{ c: string; t?: TexName; rep?: [number, number]; r?: number; m?: number; e?: string; ei?: number }> = ({ c, t, rep = [1, 1], r = 0.85, m = 0, e, ei = 0 }) =>
  <meshStandardMaterial color={c} map={t ? canvasTex(t, 256, 256, DRAW[t], rep) : null} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={ei} />;
export const PBox: React.FC<{ p: V3; s: V3; c: string; t?: TexName; rep?: [number, number]; r?: number; m?: number; rot?: V3 }> = ({ p, s, rot = [0, 0, 0], ...mat }) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow><boxGeometry args={s} /><Std {...mat} /></mesh>
);
export const PCyl: React.FC<{ p: V3; r: [number, number]; h: number; c: string; rough?: number; m?: number; rot?: V3; seg?: number }> = ({ p, r, h, c, rough = 0.6, m = 0, rot = [0, 0, 0], seg = 20 }) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow><cylinderGeometry args={[r[0], r[1], h, seg]} /><Std c={c} r={rough} m={m} /></mesh>
);

/** practical light: hot bulb or flame (blooms) + a warm shadowing point light; k dims it to 0 */
export const Practical: React.FC<{ p: V3; f: number; k?: number; col?: string; i?: number; flame?: boolean }> = ({ p, f, k = 1, col = "#ffb25c", i = 3, flame }) => {
  const fl = flame ? 1 + 0.08 * Math.sin(f * 1.3) + 0.05 * Math.sin(f * 3.1) : 1, b = Math.max(0, k) * fl;
  return (
    <group position={p}>
      {flame
        ? <mesh scale={[1, 1.6 + 0.2 * Math.sin(f * 2.2), 1]} visible={k > 0.05}><sphereGeometry args={[0.025, 10, 8]} /><meshBasicMaterial color={[4 * b, 2.6 * b, 1.0 * b]} toneMapped={false} /></mesh>
        : <mesh><sphereGeometry args={[0.06, 14, 10]} /><meshBasicMaterial color={[3.2 * b, 2.4 * b, 1.3 * b]} toneMapped={false} /></mesh>}
      <pointLight color={col} intensity={i * b} distance={7} decay={1.7} castShadow={k > 0.05} shadow-mapSize={[512, 512]} shadow-bias={-0.003} />
    </group>
  );
};
/** candle on a holder */
export const Candle: React.FC<{ p: V3; f: number; k?: number; i?: number }> = ({ p, f, k = 1, i = 1.2 }) => (
  <group position={p}>
    <PCyl p={[0, 0.01, 0]} r={[0.05, 0.06]} h={0.02} c="#8a6a3a" m={0.6} rough={0.4} />
    <PCyl p={[0, 0.08, 0]} r={[0.02, 0.02]} h={0.13} c="#f4ecd8" rough={0.7} />
    <Practical p={[0, 0.17, 0]} f={f} k={k} i={i} flame />
  </group>
);

const shaftVert = /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const shaftFrag = /* glsl */ `uniform vec3 uCol; uniform float uK; uniform float uT; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
float h(float x){ return fract(sin(x*91.3)*47453.5); }
void main(){ float core = pow(abs(dot(vN, vV)), 2.0);
  float s = floor(vUv.x * 60.0); float n = 0.2 + 0.8 * pow(mix(h(s), h(s+1.0), fract(vUv.x*60.0)), 2.0);
  float len = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  gl_FragColor = vec4(uCol * uK * core * n * len * (0.9 + 0.1 * sin(uT * 0.05 + vUv.x * 20.0)), 1.0); }`;
/** narrow additive light shaft (a window's sun beam) from `from` to `to` (pbr.md trap: keep it narrow and streaked) */
export const Shaft: React.FC<{ from: V3; to: V3; r?: [number, number]; col?: string; k?: number; f: number }> = ({ from, to, r = [0.35, 0.7], col = "#ffd9a0", k = 0.35, f }) => {
  const { mid, q, len } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
    return { mid: a.clone().add(b).multiplyScalar(0.5), len: d.length(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()) };
  }, [from, to]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: shaftVert, fragmentShader: shaftFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(col) }, uK: { value: k }, uT: { value: 0 } } }), [col, k]);
  mat.uniforms.uT.value = f;
  return <mesh position={mid} quaternion={q} material={mat} renderOrder={5}><cylinderGeometry args={[r[0], r[1], len, 24, 1, true]} /></mesh>;
};
/** dust motes drifting through the light */
export const Dust: React.FC<{ f: number; box: [V3, V3]; n?: number }> = ({ f, box, n = 50 }) => (<>
  {Array.from({ length: n }, (_, i) => {
    const [a, b] = box, x = a[0] + rnd(i) * (b[0] - a[0]), z = a[2] + rnd(i + 7) * (b[2] - a[2]), y = a[1] + ((rnd(i + 3) + f * 0.0015 * (1 + rnd(i + 5))) % 1) * (b[1] - a[1]);
    return <mesh key={i} position={[x + Math.sin(f * 0.02 + i) * 0.04, y, z]}><sphereGeometry args={[0.005, 4, 4]} /><meshBasicMaterial color={[1.4, 1.25, 1.0]} toneMapped={false} transparent opacity={0.55} depthWrite={false} /></mesh>;
  })}
</>);

// ---------------- post ----------------
/** split-tone film grades (teal shadows / warm highlights), per mood */
export const GRADE: Record<"warm" | "cold" | "night" | "neutral", GradeParams> = {
  warm: { ky: [0, 0.08, 0.23, 0.52, 0.8, 0.93, 1], sat: [1.0, 1.12, 1.1], tintS: [0.025, -0.012], tintM: [-0.004, 0.006], tintH: [-0.02, 0.014], vig: [0.22, 0.42] },
  cold: { ky: [0, 0.08, 0.22, 0.5, 0.78, 0.92, 0.99], sat: [0.95, 0.98, 1.0], tintS: [0.03, -0.018], tintM: [0.012, -0.008], tintH: [-0.004, 0.004], vig: [0.3, 0.38] },
  night: { ky: [0.01, 0.07, 0.19, 0.46, 0.76, 0.91, 0.98], sat: [0.95, 1.05, 1.1], tintS: [0.04, -0.015], tintM: [0.015, -0.004], tintH: [-0.025, 0.02], vig: [0.38, 0.34] },
  neutral: { ky: [0, 0.08, 0.23, 0.51, 0.79, 0.93, 1], sat: [1.0, 1.1, 1.05], tintS: [0.018, -0.008], tintM: [0, 0], tintH: [-0.01, 0.008], vig: [0.24, 0.42] },
};
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.6, luminanceThreshold: 1.0, luminanceSmoothing: 0.25, mipmapBlur: true, levels: 6, radius: 0.65 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
/** lens BEFORE N8AO (pbr.md trap: after it, alpha-tested cards read as background depth and blur) */
export const PostPBR: React.FC<{ mood: keyof typeof GRADE; cInf: number; focus: V3; sat?: number; contrast?: number; f: number }> = ({ mood, cInf, focus, sat = 0, contrast = 0.12, f }) => {
  const { camera } = useThree();
  const fx = useMemo(() => ({
    lens: new LensBlur({ maxCoC: 20, nearScale: 1.2 }), bloom: makeBloom(), tone: new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
    sat: new HueSaturationEffect({ saturation: sat }), con: new BrightnessContrastEffect({ contrast }), grade: new GradeEffect(GRADE[mood], 1),
    vig: new VignetteEffect({ offset: 0.3, darkness: 0.45 }), grain: new GrainEffect({ amount: 0.018, cellPx: 1.5 }),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { // after <Cam> (earlier in the tree), so focus uses this frame's camera
    const cam = camera as THREE.PerspectiveCamera, fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    fx.lens.focus = Math.max(0.3, new THREE.Vector3(...focus).sub(cam.position).dot(fwd)); fx.lens.cInf = cInf;
    fx.grain.seed = f;
  });
  return (
    <EffectComposer multisampling={4}>
      <primitive object={fx.lens.pre} dispose={null} />
      <primitive object={fx.lens.main} dispose={null} />
      <N8AO aoRadius={0.6} distanceFalloff={0.6} intensity={2.0} aoSamples={16} denoiseSamples={8} denoiseRadius={8} halfRes={false} />
      <primitive object={fx.bloom} dispose={null} />
      <primitive object={fx.tone} dispose={null} />
      <primitive object={fx.sat} dispose={null} />
      <primitive object={fx.con} dispose={null} />
      <primitive object={fx.grade} dispose={null} />
      <primitive object={fx.vig} dispose={null} />
      <primitive object={fx.grain} dispose={null} />
    </EffectComposer>
  );
};
