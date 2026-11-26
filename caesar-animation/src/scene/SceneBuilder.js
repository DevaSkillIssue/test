/**
 * Builds one THREE.Scene per story scene from story.json data: environment + lighting
 * (Environment.js), story props (Props.js) and prop motions (e.g. a bus driving away).
 * Characters are shared across scenes and attached by FrameRenderer when a scene is active.
 */
import * as THREE from 'three';
import { buildEnvironment } from './Environment.js';
import { createProp } from './Props.js';
import { seededRandom, hashString } from '../util/random.js';
import { clamp, ease } from '../animation/Keyframes.js';

export function buildScene(sceneTl, { seed = 1, shadows = true, shadowMapSize = 2048 } = {}) {
  const data = sceneTl.data;
  const rng = seededRandom(hashString(`${seed}:${sceneTl.id}:${data.environment}`));
  const scene = new THREE.Scene();
  scene.name = `scene:${sceneTl.id}`;
  const env = buildEnvironment(data.environment, data.lighting, rng, { shadows, shadowMapSize });
  scene.add(env.group);
  scene.background = env.background;
  scene.fog = env.fog;

  const props = data.props.map((p, i) => {
    const obj = createProp(p.type, { color: p.color }, rng);
    obj.position.set(...p.position);
    obj.rotation.y = p.rotation_y || 0;
    obj.scale.setScalar(p.scale || 1);
    scene.add(obj);
    return { obj, base: p.position, motion: sceneTl.propMotions[i], ease: p.motion?.ease || 'easeInOutQuad' };
  });

  return {
    scene,
    exposure: env.exposure,
    ceiling: env.ceiling,
    update(t) {
      for (const p of props) {
        if (!p.motion) continue;
        const k = ease(p.ease, clamp((t - p.motion.start) / p.motion.duration));
        p.obj.position.set(...p.base.map((v, i) => v + (p.motion.to[i] - v) * k));
      }
    },
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { m.map?.dispose(); m.emissiveMap?.dispose(); }
      });
      scene.background?.dispose();
    },
  };
}
