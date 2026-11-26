// "Dokter yang Diejek karena Cuci Tangan" — 14 shots, one per script line (stories/cuci-tangan/SCRIPT.md), pbr look.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { SHOTS, B, ramp, clamp01 } from "./story";
import { Card, Cam, V3, toCard } from "../kit";
import { Env, PBox, PCyl, Std, Candle, Practical, PostPBR } from "../pbr";
import { Room, Ward, Facade, Autopsy, Washstand, SEMMEL, DOC, OLDDOC, KOLL, MIDWIFE, MOTHER, DIRTY } from "./sets";

type SP = { f: number; t: number };
const hit = (f: number, at: number, d = 6, os = 0.25) => { const u = clamp01((f - at) / d); return u < 1 ? (u * u * (3 - 2 * u)) * (1 + os) : 1 + os * (1 - clamp01((f - at - d) / (d * 1.5))); };

/** the basin room (shots 1, 8, 9, 14): washstand at the back wall, a window on the left */
const BasinRoom: React.FC<{ f: number; warm?: boolean; chart?: number }> = ({ f, warm, chart = -1 }) => (<>
  <Room w={5} d={6} wall={warm ? "#eadcc0" : "#d4d6cc"} f={f} win={[-0.6]} sun={warm ? "#ffd49a" : "#dfe8ff"} shaftK={warm ? 0.4 : 0.3} />
  <Washstand p={[0.2, 0, -3.6]} f={f} />
  <PBox p={[1.6, 1.7, -3.85]} s={[0.9, 0.04, 0.25]} c="#6a4a32" t="wood" />
  {[0, 1, 2].map((i) => <PCyl key={i} p={[1.3 + i * 0.28, 1.84, -3.85]} r={[0.05, 0.06]} h={0.24} c={["#5a7a6a", "#8a6a4a", "#a8b8c8"][i]} rough={0.2} />)}
  {chart >= 0 && (
    <group position={[-1.0, 1.75, -3.88]}>
      <PBox p={[0, 0, 0]} s={[1.1, 0.9, 0.03]} c="#efe8d6" r={1} />
      {Array.from({ length: 6 }, (_, i) => {
        // monthly deaths: tall before the rule, they collapse after it (bars only, no numbers on screen)
        const hBefore = [0.62, 0.7, 0.58, 0.66, 0.6, 0.64][i], hAfter = [0.62, 0.7, 0.08, 0.06, 0.05, 0.04][i], h = i < 2 ? hBefore : hBefore + (hAfter - hBefore) * clamp01(chart * 1.6 - (i - 2) * 0.15);
        return <PBox key={i} p={[-0.4 + i * 0.16, -0.35 + h / 2, 0.025]} s={[0.1, h, 0.02]} c={i < 2 ? "#8a2a2a" : "#3a6a4a"} r={0.9} />;
      })}
    </group>
  )}
</>);

// ---------------- the 14 shots ----------------
const S: React.FC<SP>[] = [
  // 1 hook: Semmelweis dips his hands in the chlorine basin; his colleagues recoil, furious, on "marah"
  ({ f, t }) => {
    const dip = ramp(f, B(1, "merendam") - 6, 10), mad = hit(f, B(1, "marah") - 2, 5, 0.3);
    const sPos: V3 = [-0.4, 0, -3.15], grip = toCard([0.05, 0.98], sPos, f, 7);
    return (<>
      <Env bg="#1a1c22" ibl={0.45} key="#e8eeff" keyI={2.2} dir={[-6, 5, 1]} />
      <BasinRoom f={f} />
      <Card lit o={SEMMEL} f={f} pos={sPos} seed={7} opts={{ handR: dip > 0.02 ? [455 + (grip[0] - 455) * dip, 640 + (grip[1] - 640) * dip] : undefined, expr: "determined", look: 0.5 }} />
      {[0, 1, 2].map((i) => <Card lit key={i} o={DOC(i)} f={f} seed={20 + i} pos={[0.72 + i * 0.36 + mad * 0.1, 0, -2.75 - (i % 2) * 0.35]}
        opts={{ expr: mad > 0.5 ? (i === 1 ? "furious" : "angry") : "skeptic", lean: -16 * mad, arm: mad > 0.5 ? (i === 0 ? "fold" : i === 1 ? "fist" : "hips") : undefined, look: -0.6 }} />)}
      <Cam f={f} t={t} from={[0.45, 1.75, 2.3]} to={[0.45, 1.6, 1.6]} look={[0.45, 1.15, -3.2]} fov={50} />
      <PostPBR f={f} mood="neutral" cInf={7} focus={[0.3, 1.4, -3.1]} />
    </>);
  },
  // 2 the hospital in Vienna: two maternity doors
  ({ f, t }) => (<>
    <Env bg="#8a96a8" ibl={0.45} key="#f4f0e8" keyI={1.8} dir={[5, 7, 6]} fog={[10, 40]} area={10} />
    <Facade f={f} />
    {[0, 1, 2].map((i) => <Card lit key={i} o={MOTHER(i)} f={f} seed={60 + i} h={1.65} pos={[0.9 + i * 0.5, 0, -1.6 + i * 0.3]} opts={{ expr: "worried", mode: "stroll", phase: f / 20 + i * 0.3 }} />)}
    <Card lit o={DOC(3)} f={f} seed={64} pos={[-2.2, 0, -1.8]} opts={{ expr: "neutral" }} />
    <Cam f={f} t={t} from={[0, 3.6, 7.5]} to={[0, 2.2, 6.2]} look={[0, 2.2, -3]} fov={50} />
    <PostPBR f={f} mood="cold" cInf={3} focus={[0, 1.5, -2]} />
  </>),
  // 3 the doctors' ward, cold: ten beds, one candle goes out on "meninggal"
  ({ f, t }) => {
    const out = 1 - ramp(f, B(3, "meninggal"), 10);
    return (<>
      <Env bg="#2e343c" ibl={0.35} key="#cfdcff" keyI={1.4} dir={[-8, 5, -2]} fog={[7, 20]} area={9} />
      <Ward f={f} warm={false} deadBed={2} candleOut={out} />
      <Cam f={f} t={t} from={[0, 1.7, 2.6]} to={[0, 1.5, 0.8]} look={[0, 0.7, -6]} fov={50} />
      <PostPBR f={f} mood="cold" cInf={6} focus={[-1.5, 0.7, -3]} sat={-0.08} />
    </>);
  },
  // 4 the midwives' ward is warm and alive; outside, a mother turns from the doctors' door to give birth in the street
  ({ f, t }) => {
    const turn = ramp(f, B(4, "memilih"), 12);
    return (<>
      <Env bg="#7a6a5a" ibl={0.6} key="#ffd9a8" keyI={2.0} dir={[6, 4, 5]} fog={[10, 40]} area={10} />
      <Facade f={f} />
      <Card lit o={MIDWIFE} f={f} seed={70} pos={[1.6, 0, -2.6]} opts={{ expr: "content", wave: (f * 0.08) % 1 }} />
      <Card lit o={MOTHER(1)} f={f} seed={71} h={1.65} pos={[-0.9 + turn * 1.3, 0, -1.2 + turn * 0.6]} flipX={turn > 0.3}
        opts={{ expr: turn > 0.3 ? "determined" : "fear", mode: turn > 0.05 && turn < 0.95 ? "stroll" : "stand", phase: f / 18 }} />
      <PBox p={[0.9, 0.22, 0.3]} s={[1.2, 0.44, 0.5]} c="#8a7a64" t="cobble" />
      <Cam f={f} t={t} from={[0.2, 2.0, 4.8]} to={[0.5, 1.6, 3.8]} look={[0.1, 1.2, -2]} fov={50} />
      <PostPBR f={f} mood="warm" cInf={6} focus={[0.3, 1.3, -1]} />
    </>);
  },
  // 5 his friend nicks a finger with the autopsy knife on "tergores"; the lamp dies on "meninggal"
  ({ f, t }) => {
    const cut = ramp(f, B(5, "tergores"), 4), die = ramp(f, B(5, "meninggal"), 14);
    const kPos: V3 = [-0.55, 0, -0.1], hand = toCard([-0.2, 0.82], kPos, f, 8);
    return (<>
      <Env bg="#0e1012" ibl={0.25} key="#c8d4e8" keyI={0.5} dir={[-3, 6, 2]} area={5} />
      <Autopsy f={f} lamp={1 - 0.85 * die} />
      <Card lit o={KOLL} f={f} seed={8} pos={kPos} opts={{ handR: hand, expr: die > 0.4 ? "gloom" : cut > 0.5 ? "pained" : "thinking", flush: cut * 0.6 }} />
      <Card lit o={DOC(1)} f={f} seed={9} pos={[0.6, 0, -1.2]} opts={{ expr: cut > 0.5 ? "alarmed" : "neutral", arm: "reach", armK: 1 }} />
      {/* the knife, and a drop of blood on the friend's finger */}
      <mesh position={[0.15, 0.85, -0.9]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.16, 0.012, 0.02]} /><meshStandardMaterial color="#d8dce0" metalness={0.9} roughness={0.2} /></mesh>
      {cut > 0 && <mesh position={[-0.2, 0.82, 0.0]} scale={cut}><sphereGeometry args={[0.018, 10, 8]} /><meshStandardMaterial color="#a01818" roughness={0.2} /></mesh>}
      <Cam f={f} t={t} from={[0, 1.5, 3.0]} to={[-0.15, 1.3, 2.1]} look={[-0.1, 1.0, -0.5]} fov={48} />
      <PostPBR f={f} mood="night" cInf={9} focus={[-0.3, 1.2, -0.1]} sat={-0.1} />
    </>);
  },
  // 6 the realisation: a doctor walks from the autopsy door straight to a mother's bed, hands not washed
  ({ f, t }) => {
    const walk = ramp(f, B(6, "membedah"), B(6, "persalinan") - B(6, "membedah") + 10), idea = ramp(f, B(6, "sadar"), 6);
    return (<>
      <Env bg="#3a3e44" ibl={0.4} key="#e8e0d0" keyI={1.4} dir={[-6, 5, 2]} fog={[7, 20]} area={9} />
      <Ward f={f} warm={false} />
      <PBox p={[-2.2, 1.1, 1.0]} s={[1.1, 2.2, 0.1]} c="#3a3430" t="wood" />
      <Card lit o={{ ...DOC(2), gloves: DIRTY }} f={f} seed={30} pos={[-1.6 + walk * 2.3, 0, 0.9 - walk * 1.6]}
        opts={{ mode: walk > 0.02 && walk < 0.98 ? "stroll" : "stand", phase: f / 16, expr: "neutral", arm: walk > 0.95 ? "reach" : undefined, armK: 1 }} />
      <Card lit o={SEMMEL} f={f} seed={7} pos={[1.2, 0, 1.6]} opts={{ expr: idea > 0.5 ? "idea" : "thinking", look: -0.6 }} />
      <Cam f={f} t={t} from={[0.2, 1.6, 4.8]} to={[0.4, 1.5, 4.2]} look={[0, 1.0, 0]} fov={50} />
      <PostPBR f={f} mood="cold" cInf={6} focus={[0, 1.2, 0.8]} sat={-0.05} />
    </>);
  },
  // 7 the midwives never touch the dead: clean hands, a warm ward
  ({ f, t }) => (<>
    <Env bg="#2a2018" ibl={0.55} key="#ffd49a" keyI={2.0} dir={[-8, 5, 0]} fog={[7, 18]} area={9} />
    <Ward f={f} warm />
    <Card lit o={MIDWIFE} f={f} seed={70} pos={[-0.3, 0, 0.2]} opts={{ expr: "content", arm: "chest", armK: 1 }} />
    <Cam f={f} t={t} from={[0.3, 1.5, 2.6]} to={[0.1, 1.45, 2.0]} look={[-0.3, 1.25, 0]} fov={46} />
    <PostPBR f={f} mood="warm" cInf={11} focus={[-0.3, 1.45, 0.2]} />
  </>),
  // 8 the rule: doctors wash in the basin; the chart of deaths collapses on "anjlok"
  ({ f, t }) => {
    const drop = ramp(f, B(8, "anjlok") - 4, 22), dip = 0.5 + 0.5 * Math.sin(f * 0.18);
    const dPos: V3 = [0.75, 0, -3.15], grip = toCard([0.35, 0.95 + 0.05 * dip], dPos, f, 21, 1.8);
    return (<>
      <Env bg="#1e2026" ibl={0.55} key="#f2f0ff" keyI={2.2} dir={[-6, 5, 1]} />
      <BasinRoom f={f} chart={drop} />
      <Card lit o={DOC(1)} f={f} seed={21} pos={dPos} opts={{ handR: grip, expr: "unamused" }} />
      {[0, 1].map((i) => <Card lit key={i} o={DOC(i * 2 + 2)} f={f} seed={22 + i} pos={[1.25 + i * 0.4, 0, -2.7 + i * 0.3]} opts={{ expr: "bored", arm: "fold", armK: 1 }} />)}
      <Card lit o={SEMMEL} f={f} seed={7} pos={[-0.35, 0, -2.6]} opts={{ arm: "point", armK: 1, expr: drop > 0.5 ? "joy" : "determined", look: -0.4 }} />
      <Cam f={f} t={t} from={[0.1, 1.7, 2.2]} to={[0.05, 1.6, 1.6]} look={[0.05, 1.3, -3.2]} fov={50} />
      <PostPBR f={f} mood="neutral" cInf={6} focus={[0, 1.4, -3.1]} />
    </>);
  },
  // 9 the doctors take offence: arms folded, faces sour
  ({ f, t }) => {
    const sour = hit(f, B(9, "tersinggung") - 2, 6, 0.3);
    return (<>
      <Env bg="#1e2026" ibl={0.5} key="#f2f0ff" keyI={2.0} dir={[-6, 5, 1]} />
      <BasinRoom f={f} />
      {[0, 1, 2].map((i) => <Card lit key={i} o={DOC(i)} f={f} seed={20 + i} pos={[-0.7 + i * 0.7, 0, -2.4 - (i % 2) * 0.3]}
        opts={{ arm: "fold", armK: 1, expr: sour > 0.5 ? (i === 1 ? "vexed" : "annoyed") : "unimpressed", lean: (i - 1) * 6 * sour, look: i === 1 ? 0.3 : -0.3 }} />)}
      <Cam f={f} t={t} from={[0, 1.55, 1.2]} to={[0, 1.5, 0.6]} look={[0, 1.3, -2.5]} fov={48} />
      <PostPBR f={f} mood="neutral" cInf={9} focus={[0, 1.5, -2.5]} />
    </>);
  },
  // 10 the pompous doctor writes "gentlemen's hands are clean"; he slams the book on "terhormat" and shows his hands
  ({ f, t }) => {
    const slam = hit(f, B(10, "terhormat") - 2, 4, 0.2), show = ramp(f, B(10, "bersih") - 6, 8);
    return (<>
      <Env bg="#120e0c" ibl={0.3} key="#ffcf9a" keyI={0.6} dir={[3, 5, 3]} area={5} />
      <Room w={5} d={5} wall="#5a3a2a" f={f} win={[]} />
      {Array.from({ length: 4 }, (_, r) => Array.from({ length: 9 }, (_, i) => (
        <PBox key={`${r}${i}`} p={[-1.6 + i * 0.13 + (r % 2) * 0.05, 0.75 + r * 0.55, -2.85]} s={[0.1, 0.42, 0.28]} c={["#6a2a22", "#2a3a5a", "#3a5a3a", "#8a6a3a"][(i + r) % 4]} r={0.8} />
      )))}
      <PBox p={[0.3, 0.42, -1.4]} s={[1.6, 0.84, 0.8]} c="#5a3a26" t="wood" />
      <PBox p={[0.55, 0.88 + 0.08 * (1 - clamp01(slam)), -1.35]} s={[0.4, 0.06, 0.3]} c="#7a2a22" rot={[0, 0, -0.9 * (1 - clamp01(slam))]} />
      <PBox p={[0.55, 0.86, -1.35]} s={[0.4, 0.04, 0.3]} c="#efe6d2" />
      <Candle p={[-0.3, 0.84, -1.5]} f={f} i={2.2} />
      <Card lit o={OLDDOC} f={f} seed={11} pos={[0.2, 0, -2.0]} opts={{ expr: show > 0.5 ? "smug" : slam > 0.5 ? "smug_content" : "plotting", arm: show > 0.3 ? "up" : "chest", armK: 1, lean: 4 * slam }} />
      <Cam f={f} t={t} from={[0.3, 1.5, 1.4]} to={[0.25, 1.45, 0.8]} look={[0.2, 1.2, -2.0]} fov={46} />
      <PostPBR f={f} mood="night" cInf={10} focus={[0.2, 1.4, -2.0]} />
    </>);
  },
  // 11 Ignaz Semmelweis: his contract ends, he leaves Vienna with his suitcase in the rain
  ({ f, t }) => {
    const go = ramp(f, B(11, "pergi") - 4, 40);
    const sPos: V3 = [0.3 - go * 1.6, 0, -1.0 + go * 0.3];
    return (<>
      <Env bg="#1a2230" ibl={0.35} key="#9fb4d8" keyI={1.0} dir={[4, 6, 4]} fog={[6, 26]} area={10} />
      <Facade f={f} rain={1} />
      <Card lit o={SEMMEL} f={f} seed={7} pos={sPos} flipX opts={{ mode: go > 0.02 && go < 0.98 ? "stroll" : "stand", phase: f / 20, expr: "sad", handR: [470, 610] }} />
      <PBox p={[sPos[0] - 0.12, 0.3, sPos[2] + 0.03]} s={[0.34, 0.26, 0.1]} c="#5a3a22" r={0.6} />
      <Cam f={f} t={t} from={[0.2, 1.6, 4.2]} to={[-0.3, 1.5, 3.6]} look={[-0.2, 1.2, -1.2]} fov={48} />
      <PostPBR f={f} mood="night" cInf={7} focus={[sPos[0], 1.3, sPos[2]]} sat={-0.12} />
    </>);
  },
  // 12 years later: under the microscope, tiny living things wriggle (the science word is left unsaid)
  ({ f, t }) => {
    const look = ramp(f, B(12, "makhluk") - 8, 14);
    return (<>
      <Env bg="#0e0d0c" ibl={0.25} key="#ffe2b8" keyI={0.4} dir={[2, 5, 3]} area={4} />
      <PBox p={[0, 0.4, 0]} s={[1.8, 0.8, 1.0]} c="#4a3220" t="wood" />
      <group position={[0, 0.8, 0]}>
        <PBox p={[0, 0.03, 0]} s={[0.28, 0.06, 0.22]} c="#2a2a2a" m={0.6} r={0.4} />
        <PCyl p={[0, 0.2, -0.06]} r={[0.025, 0.025]} h={0.3} c="#b08a3a" m={0.9} rough={0.25} />
        <PCyl p={[0, 0.3, 0.02]} r={[0.03, 0.035]} h={0.28} c="#c89a40" m={0.9} rough={0.2} rot={[0.35, 0, 0]} />
        <PBox p={[0, 0.12, 0.02]} s={[0.18, 0.015, 0.14]} c="#3a3a3a" m={0.5} />
      </group>
      <Practical p={[0.55, 1.35, 0.1]} f={f} i={2.4} />
      {/* the view through the lens: a bright disc with wriggling rods, filling the frame as we look in */}
      {look > 0 && (
        <group position={[0, 1.25, 0.95]} scale={look}>
          <mesh><circleGeometry args={[0.34, 48]} /><meshBasicMaterial color={[1.3, 1.25, 1.1]} toneMapped={false} /></mesh>
          {Array.from({ length: 16 }, (_, i) => {
            const a = i * 2.39996, r = 0.06 + (i % 5) * 0.05;
            return <mesh key={i} position={[Math.cos(a + f * 0.01) * r, Math.sin(a + f * 0.01) * r, 0.002]} rotation={[0, 0, a + Math.sin(f * 0.2 + i) * 0.5]}>
              <capsuleGeometry args={[0.008, 0.035, 4, 8]} /><meshBasicMaterial color={i % 3 ? "#5a8a3a" : "#7a4a8a"} /></mesh>;
          })}
        </group>
      )}
      <Cam f={f} t={t} from={[0.2, 1.4, 2.4]} to={[0, 1.27, 1.6]} look={[0, 1.15, 0]} fov={44} />
      <PostPBR f={f} mood="warm" cInf={look > 0.5 ? 2 : 10} focus={look > 0.5 ? [0, 1.25, 0.95] : [0, 1.0, 0]} />
    </>);
  },
  // 13 he never saw himself proven right: his empty chair, coat and suitcase; the candle dies on "infeksi"
  ({ f, t }) => {
    const out = 1 - ramp(f, B(13, "infeksi"), 16);
    return (<>
      <Env bg="#0a0a0c" ibl={0.15} key="#9fb0d0" keyI={0.35} dir={[-3, 5, 3]} area={4} />
      <Room w={4} d={4} wall="#4a4a52" f={f} win={[]} />
      <group position={[-0.2, 0, -0.8]} rotation={[0, 0.4, 0]}>
        <PBox p={[0, 0.45, 0]} s={[0.5, 0.06, 0.5]} c="#4a3220" t="wood" />
        <PBox p={[0, 0.95, -0.23]} s={[0.5, 0.9, 0.05]} c="#4a3220" t="wood" />
        {[-0.21, 0.21].map((x) => [-0.21, 0.21].map((z) => <PBox key={`${x}${z}`} p={[x, 0.22, z]} s={[0.04, 0.44, 0.04]} c="#3a2618" />))}
        <PBox p={[0, 0.98, -0.18]} s={[0.46, 0.7, 0.04]} c="#2a2d38" r={1} />
      </group>
      <PBox p={[0.55, 0.15, -0.5]} s={[0.5, 0.3, 0.16]} c="#5a3a22" r={0.6} />
      <PBox p={[0.9, 0.35, -1.0]} s={[0.5, 0.7, 0.4]} c="#3a2618" t="wood" />
      <Candle p={[0.9, 0.7, -1.0]} f={f} k={out} i={1.6} />
      <Cam f={f} t={t} from={[0.2, 1.3, 2.2]} to={[0.2, 1.15, 1.8]} look={[0.2, 0.7, -0.8]} fov={48} />
      <PostPBR f={f} mood="night" cInf={8} focus={[0.2, 0.7, -0.7]} sat={-0.15} />
    </>);
  },
  // 14 today: handwashing is every doctor's first lesson — the same basin, warm morning, a queue of young doctors (loops to 1)
  ({ f, t }) => {
    const dip = 0.5 + 0.5 * Math.sin(f * 0.16), dPos: V3 = [-0.4, 0, -3.15], grip = toCard([0.05, 0.96 + 0.04 * dip], dPos, f, 40);
    return (<>
      <Env bg="#2a2418" ibl={0.6} key="#ffe0b0" keyI={2.6} dir={[-6, 5, 1]} />
      <BasinRoom f={f} warm />
      <Card lit o={{ ...DOC(1), jacket: "#f2f0ea" }} f={f} seed={40} pos={dPos} opts={{ handR: grip, expr: "content" }} />
      {[0, 1, 2].map((i) => <Card lit key={i} o={{ ...DOC(i + 2), jacket: "#f2f0ea" }} f={f} seed={41 + i} pos={[0.72 + i * 0.36, 0, -2.75 - (i % 2) * 0.35]} opts={{ expr: "smile", look: -0.5 }} />)}
      <Cam f={f} t={t} from={[0.45, 1.6, 1.6]} to={[0.45, 1.75, 2.3]} look={[0.45, 1.15, -3.2]} fov={50} />
      <PostPBR f={f} mood="warm" cInf={7} focus={[0.3, 1.4, -3.1]} />
    </>);
  },
];

const ShotView: React.FC<{ i: number; from: number; dur: number }> = ({ i, from, dur }) => {
  const lf = useCurrentFrame(), { width, height } = useVideoConfig();
  const Scene = S[i];
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: false, stencil: false }} shadows="soft">
      <Scene f={from + lf} t={lf / Math.max(1, dur - 1)} />
    </ThreeCanvas>
  );
};

export const Cuci: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {SHOTS.map((s, i) => (
      <Sequence key={s.n} from={s.from} durationInFrames={s.dur} name={`shot ${s.n}`}>
        <ShotView i={i} from={s.from} dur={s.dur} />
      </Sequence>
    ))}
    <Audio src={staticFile("cuci/voice.wav")} />
  </AbsoluteFill>
);
