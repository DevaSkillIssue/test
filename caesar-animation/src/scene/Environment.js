/**
 * Environment builder: ground, sets, sky, fog and lighting for each location.
 *
 * Layout convention shared by every environment (so stories can be written without
 * knowing the set): characters act on a clear stage around x -3..3, z -1..1.5;
 * the default camera looks from +z toward -z. Outdoor sets put a road behind the
 * stage (z -7.5..-1.8) and buildings beyond it; indoor sets have a back wall at
 * z = -3.2 and side walls at x = +-5.5.
 */
import * as THREE from 'three';
import { createProp, mat, box, canvasTexture } from './Props.js';

export const LIGHTING = {
  day: { skyTop: '#5fa8ff', skyBottom: '#d8efff', glass: '#bfe3ff', hemi: ['#d7ebff', '#8a7d6b', 1.1], sun: ['#fff4e0', 2.6, [6, 11, 7]], fog: [28, 90], exposure: 1.0 },
  sunset: { skyTop: '#ff7a59', skyBottom: '#ffd59e', glass: '#ffb27a', hemi: ['#ffd3a8', '#5a4a6a', 0.8], sun: ['#ffb070', 2.4, [-9, 4.5, 6]], fog: [22, 80], exposure: 1.05 },
  night: { skyTop: '#060b1f', skyBottom: '#243259', glass: '#1d2a52', hemi: ['#4a5c99', '#14141c', 0.55], sun: ['#9fb4ff', 0.7, [-5, 10, 6]], fog: [16, 60], exposure: 1.1, night: true },
  indoor_warm: { skyTop: '#8cc8ff', skyBottom: '#e6f4ff', glass: '#cfeaff', hemi: ['#fff1dc', '#6d5a48', 0.9], sun: ['#ffe2b8', 1.8, [4, 8, 6]], fog: [30, 90], exposure: 1.0, warm: true },
  indoor_cool: { skyTop: '#9fc9ef', skyBottom: '#eef6ff', glass: '#d6ecff', hemi: ['#eef6ff', '#5f6b75', 1.2], sun: ['#ffffff', 1.6, [3, 9, 7]], fog: [30, 90], exposure: 1.0 },
  dramatic: { skyTop: '#000000', skyBottom: '#1c1c28', glass: '#1c1c28', hemi: ['#3a3a55', '#000000', 0.25], sun: ['#ffffff', 0.4, [2, 10, 4]], fog: [12, 45], exposure: 1.15, spot: true },
};

function skyTexture(top, bottom) {
  return canvasTexture(2, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function patternTexture(kind, rng) {
  switch (kind) {
    case 'wood':
      return canvasTexture(256, 256, (g, w, h) => {
        for (let i = 0; i < 8; i++) {
          const l = 48 + Math.floor(rng() * 10);
          g.fillStyle = `hsl(28, 45%, ${l}%)`;
          g.fillRect(0, i * 32, w, 32);
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(0, i * 32, w, 2);
          g.fillRect(Math.floor(rng() * w), i * 32, 2, 32);
        }
      }, [4, 3]);
    case 'asphalt':
      return canvasTexture(256, 256, (g, w, h) => {
        g.fillStyle = '#4a4d52'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rng() * 0.06})`; g.fillRect(rng() * w, rng() * h, 2, 2); }
        g.fillStyle = '#f2f2f2';
        g.fillRect(0, h / 2 - 3, w * 0.5, 6); // dashed centre line
      }, [8, 1]);
    case 'tiles':
      return canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#c9c5bd'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2;
        g.strokeRect(1, 1, w / 2 - 2, h / 2 - 2); g.strokeRect(w / 2 + 1, 1, w / 2 - 2, h / 2 - 2);
        g.strokeRect(1, h / 2 + 1, w / 2 - 2, h / 2 - 2); g.strokeRect(w / 2 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2);
      }, [20, 3]);
    case 'grass':
      return canvasTexture(256, 256, (g, w, h) => {
        g.fillStyle = '#6aa84f'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1500; i++) { g.fillStyle = `hsla(${95 + rng() * 25}, 50%, ${35 + rng() * 20}%, 0.6)`; g.fillRect(rng() * w, rng() * h, 2, 4); }
      }, [30, 30]);
    case 'carpet':
      return canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#5d6f86'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.08})`; g.fillRect(rng() * w, rng() * h, 2, 2); }
      }, [8, 6]);
    default:
      throw new Error(`unknown texture ${kind}`);
  }
}

function plane(group, w, d, material, [x, y, z]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function place(group, type, pos, opts, rng, rotY = 0) {
  const p = createProp(type, opts, rng);
  p.position.set(...pos);
  p.rotation.y = rotY;
  group.add(p);
  return p;
}

function streetBase(g, rng, L) {
  plane(g, 120, 4.5, new THREE.MeshStandardMaterial({ map: patternTexture('tiles', rng), roughness: 0.95 }), [0, 0, 0.45]);
  plane(g, 120, 5.7, new THREE.MeshStandardMaterial({ map: patternTexture('asphalt', rng), roughness: 0.9 }), [0, 0.002, -4.65]);
  plane(g, 120, 4, new THREE.MeshStandardMaterial({ map: patternTexture('tiles', rng), roughness: 0.95 }), [0, 0, -9.5]);
  plane(g, 200, 120, mat('#5b5f63'), [0, -0.01, -20]);
  box(g, [120, 0.15, 0.3], [0, 0, -1.8], mat('#b0aca4'));
  box(g, [120, 0.15, 0.3], [0, 0, -7.5], mat('#b0aca4'));
  const lights = [];
  for (let x = -18; x <= 18; x += 9) {
    const sl = place(g, 'streetlight', [x + 2, 0, -1.4], {}, rng, Math.PI);
    if (L.night) lights.push(new THREE.Vector3(x + 2 - 1.0, 4.05, -1.4));
  }
  return lights;
}

const BUILDERS = {
  city(g, rng, L) {
    const lights = streetBase(g, rng, L);
    for (let x = -26; x < 26;) {
      const w = 5 + rng() * 4, h = 10 + rng() * 16, d = 6;
      place(g, 'building', [x + w / 2, 0, -14.5], { w, h, d, night: L.night }, rng);
      x += w + 0.4;
    }
    for (let x = -60; x < 60;) { // far skyline, fogged
      const w = 6 + rng() * 6, h = 20 + rng() * 35;
      place(g, 'building', [x + w / 2, 0, -38 - rng() * 10], { w, h, d: 8, night: L.night }, rng);
      x += w + 1;
    }
    for (let x = -14; x <= 14; x += 7) place(g, 'tree', [x + 3.5, 0, -9.2], {}, rng);
    place(g, 'car', [-7, 0, -6.2], { color: '#1e88e5' }, rng);
    place(g, 'car', [9, 0, -3.3], { color: '#43a047' }, rng, Math.PI);
    if (!L.night) for (let i = 0; i < 4; i++) place(g, 'cloud', [-24 + i * 16 + rng() * 6, 22 + rng() * 6, -45], {}, rng);
    return lights;
  },
  street(g, rng, L) {
    const lights = streetBase(g, rng, L);
    const awnings = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa'];
    for (let i = -4; i <= 4; i++) {
      const x = i * 5.2, h = 6 + rng() * 3, color = ['#f2d7b6', '#d7ccc8', '#ffccbc', '#c5e1a5', '#b3e5fc'][(i + 10) % 5];
      place(g, 'building', [x, 0, -14], { w: 5, h, d: 6, color, night: L.night }, rng);
      box(g, [2.6, 2.2, 0.2], [x - 0.8, 0, -10.95], mat('#2b3a4a', { emissive: L.night ? '#ffcc80' : '#000000', emissiveIntensity: L.night ? 0.6 : 0 }));
      const aw = box(g, [3.4, 0.12, 1.4], [x - 0.8, 2.6, -10.4], mat(awnings[(i + 10) % awnings.length]));
      aw.rotation.x = 0.25;
      place(g, 'door', [x + 1.4, 0, -10.95], { color: '#5d4037' }, rng);
    }
    place(g, 'bus_stop', [-6.5, 0, -0.9], {}, rng);
    place(g, 'trash_can', [4.5, 0, -1.1], {}, rng);
    place(g, 'sign', [-4.2, 0, -1.2], { color: '#1976d2' }, rng);
    place(g, 'car', [12, 0, -6.4], { color: '#fdd835' }, rng);
    for (let k = 0; k < 6; k++) box(g, [0.5, 0.01, 2.2], [-11 + k * 0.9, 0.004, -4.65], mat('#f5f5f5'), { cast: false });
    if (!L.night) for (let i = 0; i < 3; i++) place(g, 'cloud', [-20 + i * 18, 18 + rng() * 5, -40], {}, rng);
    return lights;
  },
  bedroom(g, rng, L) {
    room(g, rng, L, { floor: 'wood', wall: '#c9dff2', accent: '#a7c7e7' });
    place(g, 'window', [1.6, 1.0, -3.15], { glass: L.glass }, rng);
    place(g, 'poster', [-1.6, 1.3, -3.18], {}, rng);
    place(g, 'rug', [0, 0, 0.5], { color: '#b5485d' }, rng);
    place(g, 'bookshelf', [-4.6, 0, -2.5], {}, rng, Math.PI / 4);
    place(g, 'plant', [4.8, 0, -2.6], {}, rng);
    return [new THREE.Vector3(0, 2.9, 0)];
  },
  office(g, rng, L) {
    room(g, rng, L, { floor: 'carpet', wall: '#d6e2ee', accent: '#3d5a80' });
    for (const x of [-3.2, 0, 3.2]) place(g, 'window', [x, 1.0, -3.15], { glass: L.glass }, rng);
    for (const x of [-3.6, 3.6]) {
      place(g, 'desk', [x, 0, -1.9], {}, rng);
      place(g, 'monitor', [x - 0.2, 0.76, -2.0], {}, rng);
      place(g, 'office_chair', [x, 0, -1.2], {}, rng, Math.PI);
    }
    place(g, 'whiteboard', [-4.9, 0, 0.5], {}, rng, Math.PI / 2);
    place(g, 'water_cooler', [4.9, 0, 0.8], {}, rng);
    place(g, 'plant', [4.9, 0, -2.6], {}, rng);
    for (let x = -4; x <= 4; x += 2.6) box(g, [1.6, 0.04, 0.5], [x, 3.38, 0], mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1 }), { cast: false });
    return [new THREE.Vector3(-2, 3.0, 0.5), new THREE.Vector3(2, 3.0, 0.5)];
  },
  outdoor(g, rng, L) {
    plane(g, 220, 160, new THREE.MeshStandardMaterial({ map: patternTexture('grass', rng), roughness: 1 }), [0, 0, -30]);
    const path = plane(g, 120, 2.4, mat('#c8ad7f'), [0, 0.003, 0.3]);
    path.receiveShadow = true;
    for (let i = 0; i < 6; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + rng() * 10, 20, 10), mat(['#5e9c45', '#4f8a3a', '#6aa84f'][i % 3]));
      hill.scale.y = 0.35;
      hill.position.set(-60 + i * 24 + rng() * 8, -3, -55 - rng() * 15);
      hill.receiveShadow = true;
      g.add(hill);
    }
    for (let i = 0; i < 22; i++) {
      const x = -24 + rng() * 48, z = -6 - rng() * 22;
      place(g, 'tree', [x, 0, z], {}, rng);
    }
    for (const x of [-5.5, 6.2]) place(g, 'tree', [x, 0, -2.6], {}, rng);
    for (let i = 0; i < 6; i++) place(g, 'rock', [-10 + rng() * 20, 0, -2 - rng() * 6], {}, rng);
    place(g, 'fence', [-8, 0, -1.6], {}, rng);
    place(g, 'fence', [8, 0, -1.6], {}, rng);
    place(g, 'bench', [3.6, 0, -1.2], {}, rng);
    if (!L.night) for (let i = 0; i < 5; i++) place(g, 'cloud', [-30 + i * 15 + rng() * 5, 16 + rng() * 6, -40], {}, rng);
    return [];
  },
};

function room(g, rng, L, { floor, wall, accent }) {
  // Deep room (back wall z=-3.3, open toward +z up to z=13) so wide shots never see outside it.
  const depth = 16.4, cz = -3.4 + depth / 2;
  const floorTex = patternTexture(floor, rng);
  floorTex.repeat.set(4, 12);
  plane(g, 11.2, depth, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }), [0, 0, cz]);
  const w = mat(wall, { roughness: 0.95 });
  box(g, [11.4, 3.5, 0.2], [0, 0, -3.4], w);
  box(g, [0.2, 3.5, depth], [-5.6, 0, cz], w);
  box(g, [0.2, 3.5, depth], [5.6, 0, cz], w);
  box(g, [11, 0.14, 0.06], [0, 0, -3.28], mat(accent));
  box(g, [11.4, 0.1, depth], [0, 3.5, cz], mat('#f7f7f7', { emissive: '#f2efe8', emissiveIntensity: 0.35 }), { cast: false });
}

/**
 * @returns { group, background, fog, exposure }
 */
export function buildEnvironment(name, lightingName, rng, { shadows = true, shadowMapSize = 2048 } = {}) {
  const builder = BUILDERS[name];
  if (!builder) throw new Error(`Unknown environment "${name}"`);
  const L = LIGHTING[lightingName];
  if (!L) throw new Error(`Unknown lighting preset "${lightingName}"`);
  const group = new THREE.Group();
  group.name = `env:${name}`;
  const pointLights = builder(group, rng, L) || [];
  const indoor = name === 'bedroom' || name === 'office';

  group.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
  const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]);
  sun.position.set(...L.sun[2]);
  sun.target.position.set(0, 0, 0);
  group.add(sun, sun.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const s = sun.shadow.camera;
    s.left = -12; s.right = 12; s.top = 12; s.bottom = -12; s.near = 0.5; s.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
  }

  // Practical lights: streetlights at night, ceiling lights indoors (no shadows, keeps it cheap).
  const usePractical = L.night || indoor;
  if (usePractical) {
    const color = indoor ? (L.warm ? '#ffd9a0' : '#f4f8ff') : '#ffd27a';
    const power = indoor ? (L.night ? 14 : 8) : 26;
    for (const p of pointLights.slice(0, 4)) {
      const pl = new THREE.PointLight(color, power, indoor ? 12 : 14, 2);
      pl.position.copy(p);
      group.add(pl);
    }
  }
  if (L.spot) {
    const spot = new THREE.SpotLight('#fff6e0', 120, 30, 0.5, 0.5, 2);
    spot.position.set(0, 9, 3);
    spot.target.position.set(0, 0, 0);
    if (shadows) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); }
    group.add(spot, spot.target);
  }

  return {
    group,
    background: skyTexture(L.skyTop, L.skyBottom),
    fog: new THREE.Fog(new THREE.Color(L.skyBottom), L.fog[0], L.fog[1]),
    exposure: L.exposure,
    ceiling: indoor ? 3.25 : undefined,
  };
}
