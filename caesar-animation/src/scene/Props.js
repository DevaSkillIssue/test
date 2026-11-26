/**
 * Procedural low-poly prop library. Every prop is built from primitives (no model files),
 * sized in metres, with its origin on the floor at its footprint centre, facing +z.
 * Randomness (book colours, tree shapes, lit windows) comes from the seeded rng passed in.
 */
import * as THREE from 'three';
import { seededRandom, hashString } from '../util/random.js';

const matCache = new Map();
export function mat(color, { roughness = 0.82, metalness = 0, emissive = null, emissiveIntensity = 1, transparent = false, opacity = 1 } = {}) {
  const key = [color, roughness, metalness, emissive, emissiveIntensity, transparent, opacity].join('|');
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness, metalness, flatShading: true, transparent, opacity,
      emissive: emissive ?? 0x000000, emissiveIntensity,
    }));
  }
  return matCache.get(key);
}

function addMesh(group, geo, material, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  group.add(m);
  return m;
}
/** Box whose bottom sits at y. */
export const box = (g, [w, h, d], [x, y, z], material, o) => addMesh(g, new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z, o);
/** Cylinder whose bottom sits at y. */
export const cyl = (g, rt, rb, h, [x, y, z], material, seg = 12, o) => addMesh(g, new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y + h / 2, z, o);
export const ball = (g, r, [x, y, z], material, detail = 1, o) => addMesh(g, new THREE.IcosahedronGeometry(r, detail), material, x, y, z, o);

function canvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
  tex.anisotropy = 4;
  return tex;
}

/** Facade texture with a grid of windows; returns colour map + emissive map (lit windows). */
export function windowTexture(rng, cols, rows, wallColor, litChance) {
  const W = 256, H = Math.round(256 * rows / cols);
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(rng() < litChance);
  const draw = (emissive) => (g) => {
    g.fillStyle = emissive ? '#000' : wallColor;
    g.fillRect(0, 0, W, H);
    const cw = W / cols, ch = H / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = lit[r * cols + c];
      g.fillStyle = emissive ? (on ? '#ffd98a' : '#000') : (on ? '#ffe7a8' : '#2c3e56');
      g.fillRect(c * cw + cw * 0.2, r * ch + ch * 0.18, cw * 0.6, ch * 0.62);
    }
  };
  return { map: canvasTexture(W, H, draw(false)), emissiveMap: canvasTexture(W, H, draw(true)) };
}

const FACTORIES = {
  bed: (g, c, rng, o) => {
    const wood = mat('#8a5a3b');
    box(g, [2.1, 0.28, 1.5], [0, 0.04, 0], wood);
    for (const [x, z] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) box(g, [0.08, 0.06, 0.08], [x, 0, z], wood);
    box(g, [2.0, 0.17, 1.42], [0, 0.32, 0], mat('#f4f1ea'));
    box(g, [1.35, 0.06, 1.46], [0.32, 0.47, 0], mat(c || '#4f7be0'));
    box(g, [0.45, 0.12, 0.95], [-0.72, 0.48, 0], mat('#ffffff'));
    box(g, [0.1, 1.05, 1.5], [-1.07, 0.04, 0], wood);
  },
  desk: (g, c) => {
    const m = mat(c || '#b98a5e');
    box(g, [1.4, 0.06, 0.7], [0, 0.7, 0], m);
    for (const [x, z] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]]) box(g, [0.06, 0.7, 0.06], [x, 0, z], m);
    box(g, [0.45, 0.45, 0.6], [0.42, 0.25, 0], mat('#9c7350'));
  },
  table: (g, c) => {
    const m = mat(c || '#c49a6c');
    box(g, [1.2, 0.06, 1.2], [0, 0.72, 0], m);
    cyl(g, 0.06, 0.06, 0.72, [0, 0, 0], m);
    cyl(g, 0.35, 0.35, 0.04, [0, 0, 0], m, 16);
  },
  chair: (g, c) => {
    const m = mat(c || '#a0522d');
    box(g, [0.5, 0.06, 0.5], [0, 0.42, 0], m);
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) box(g, [0.05, 0.42, 0.05], [x, 0, z], m);
    box(g, [0.5, 0.55, 0.05], [0, 0.48, -0.23], m);
  },
  office_chair: (g, c) => {
    const m = mat(c || '#2f3640');
    cyl(g, 0.32, 0.32, 0.05, [0, 0.03, 0], mat('#555'), 5);
    cyl(g, 0.03, 0.03, 0.38, [0, 0.06, 0], mat('#888'));
    box(g, [0.52, 0.08, 0.5], [0, 0.42, 0], m);
    box(g, [0.5, 0.6, 0.07], [0, 0.55, -0.24], m);
  },
  couch: (g, c) => {
    const m = mat(c || '#7a4fa0');
    box(g, [2.0, 0.42, 0.9], [0, 0.05, 0], m);
    box(g, [2.0, 0.55, 0.22], [0, 0.4, -0.34], m);
    box(g, [0.2, 0.3, 0.9], [-0.95, 0.42, 0], m);
    box(g, [0.2, 0.3, 0.9], [0.95, 0.42, 0], m);
  },
  lamp: (g, c) => {
    cyl(g, 0.18, 0.2, 0.04, [0, 0, 0], mat('#333'));
    cyl(g, 0.02, 0.02, 1.5, [0, 0.04, 0], mat('#444'));
    cyl(g, 0.16, 0.28, 0.32, [0, 1.42, 0], mat(c || '#ffe3a3', { emissive: '#ffcf70', emissiveIntensity: 0.9 }), 16, { cast: false });
  },
  desk_lamp: (g, c) => {
    cyl(g, 0.08, 0.1, 0.03, [0, 0, 0], mat('#333'));
    box(g, [0.025, 0.35, 0.025], [0, 0.03, 0], mat('#444'));
    cyl(g, 0.05, 0.11, 0.12, [0.05, 0.34, 0], mat(c || '#e05b4a', { emissive: '#ffcf70', emissiveIntensity: 0.4 }));
  },
  laptop: (g) => {
    box(g, [0.36, 0.02, 0.25], [0, 0, 0], mat('#b0b6bf', { metalness: 0.3 }));
    const s = box(g, [0.36, 0.24, 0.015], [0, 0.02, -0.12], mat('#222'));
    s.rotation.x = -0.25;
    const scr = box(g, [0.32, 0.2, 0.005], [0, 0.04, -0.105], mat('#7fd3ff', { emissive: '#4fb6ff', emissiveIntensity: 0.8 }), { cast: false });
    scr.rotation.x = -0.25;
  },
  monitor: (g) => {
    box(g, [0.2, 0.02, 0.15], [0, 0, 0], mat('#333'));
    box(g, [0.04, 0.28, 0.04], [0, 0.02, -0.02], mat('#333'));
    box(g, [0.62, 0.38, 0.04], [0, 0.26, 0], mat('#1e1e1e'));
    box(g, [0.56, 0.32, 0.01], [0, 0.29, 0.02], mat('#86c5ff', { emissive: '#5aa9ff', emissiveIntensity: 0.7 }), { cast: false });
  },
  tv: (g) => {
    box(g, [1.6, 0.5, 0.45], [0, 0, 0], mat('#5d4037'));
    box(g, [1.4, 0.82, 0.06], [0, 0.6, 0], mat('#111'));
    box(g, [1.3, 0.72, 0.01], [0, 0.65, 0.035], mat('#2a3b5c', { emissive: '#2a3b5c', emissiveIntensity: 0.6 }), { cast: false });
  },
  plant: (g, c, rng) => {
    cyl(g, 0.2, 0.15, 0.35, [0, 0, 0], mat('#c0674a'));
    const leaf = mat(c || '#3f9b4f');
    for (let i = 0; i < 4; i++) ball(g, 0.2 + rng() * 0.1, [(rng() - 0.5) * 0.3, 0.55 + i * 0.13, (rng() - 0.5) * 0.3], leaf, 0);
  },
  bookshelf: (g, c, rng) => {
    const wood = mat(c || '#7b5236');
    box(g, [1.0, 1.8, 0.05], [0, 0, -0.16], wood);
    box(g, [0.05, 1.8, 0.35], [-0.48, 0, 0], wood);
    box(g, [0.05, 1.8, 0.35], [0.48, 0, 0], wood);
    const colors = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#ef6c00', '#00838f'];
    for (let s = 0; s < 4; s++) {
      box(g, [1.0, 0.04, 0.35], [0, s * 0.45, 0], wood);
      let x = -0.42;
      while (x < 0.38) {
        const w = 0.05 + rng() * 0.05, h = 0.25 + rng() * 0.12;
        box(g, [w, h, 0.25], [x + w / 2, s * 0.45 + 0.04, 0], mat(colors[Math.floor(rng() * colors.length)]), { cast: false });
        x += w + 0.01;
      }
    }
  },
  window: (g, c, rng, o) => {
    const frame = mat('#f5f5f5');
    box(g, [1.6, 0.08, 0.1], [0, 0, 0], frame);
    box(g, [1.6, 0.08, 0.1], [0, 1.32, 0], frame);
    box(g, [0.08, 1.4, 0.1], [-0.76, 0, 0], frame);
    box(g, [0.08, 1.4, 0.1], [0.76, 0, 0], frame);
    box(g, [0.05, 1.4, 0.08], [0, 0, 0], frame);
    box(g, [1.5, 1.3, 0.02], [0, 0.05, -0.02], mat(o.glass || '#bfe3ff', { emissive: o.glass || '#bfe3ff', emissiveIntensity: 0.65 }), { cast: false });
  },
  poster: (g, c, rng) => {
    const hue = Math.floor(rng() * 360);
    const tex = canvasTexture(128, 180, (x, w, h) => {
      x.fillStyle = `hsl(${hue},70%,55%)`; x.fillRect(0, 0, w, h);
      x.fillStyle = `hsl(${(hue + 160) % 360},80%,65%)`;
      x.beginPath(); x.arc(w / 2, h * 0.42, 38, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.fillRect(16, h - 40, w - 32, 10); x.fillRect(28, h - 24, w - 56, 8);
    });
    addMesh(g, new THREE.PlaneGeometry(0.7, 1.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, 0.5, 0.01, { cast: false });
  },
  rug: (g, c) => {
    const r = addMesh(g, new THREE.CylinderGeometry(1, 1, 0.02, 32), mat(c || '#b5485d'), 0, 0.011, 0, { cast: false });
    r.scale.set(1.3, 1, 0.8);
  },
  alarm_clock: (g, c) => {
    const red = mat(c || '#d32f2f');
    box(g, [0.22, 0.2, 0.1], [0, 0.02, 0], red);
    ball(g, 0.05, [-0.08, 0.25, 0], red, 0);
    ball(g, 0.05, [0.08, 0.25, 0], red, 0);
    const face = addMesh(g, new THREE.CylinderGeometry(0.075, 0.075, 0.01, 16), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 }), 0, 0.12, 0.055, { cast: false });
    face.rotation.x = Math.PI / 2;
  },
  coffee_cup: (g, c) => {
    cyl(g, 0.05, 0.04, 0.11, [0, 0, 0], mat(c || '#ffffff'));
    const h = addMesh(g, new THREE.TorusGeometry(0.03, 0.01, 6, 12), mat(c || '#ffffff'), 0.055, 0.055, 0);
    h.rotation.y = Math.PI / 2;
  },
  whiteboard: (g, c, rng) => {
    const tex = canvasTexture(256, 140, (x, w, h) => {
      x.fillStyle = '#fbfbfb'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#1e88e5'; x.lineWidth = 5; x.beginPath(); x.moveTo(20, 110);
      for (let i = 1; i <= 6; i++) x.lineTo(20 + i * 35, 110 - rng() * 60 - i * 8);
      x.stroke();
      x.strokeStyle = '#e53935'; x.lineWidth = 4; x.strokeRect(150, 20, 80, 30);
    });
    box(g, [2.0, 1.15, 0.05], [0, 0.85, 0], mat('#9e9e9e'));
    addMesh(g, new THREE.PlaneGeometry(1.9, 1.05), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }), 0, 1.425, 0.03, { cast: false });
    box(g, [0.05, 0.85, 0.05], [-0.9, 0, 0], mat('#757575'));
    box(g, [0.05, 0.85, 0.05], [0.9, 0, 0], mat('#757575'));
  },
  water_cooler: (g) => {
    box(g, [0.4, 1.0, 0.4], [0, 0, 0], mat('#eceff1'));
    cyl(g, 0.16, 0.16, 0.45, [0, 1.0, 0], mat('#64b5f6', { transparent: true, opacity: 0.75, roughness: 0.2 }));
  },
  door: (g, c) => {
    const frame = mat('#efe6d8');
    box(g, [0.1, 2.2, 0.12], [-0.5, 0, 0], frame);
    box(g, [0.1, 2.2, 0.12], [0.5, 0, 0], frame);
    box(g, [1.1, 0.1, 0.12], [0, 2.15, 0], frame);
    box(g, [0.9, 2.1, 0.05], [0, 0.02, 0], mat(c || '#8d6e63'));
    ball(g, 0.04, [0.33, 1.05, 0.05], mat('#ffd54f', { metalness: 0.6 }), 0);
  },
  tree: (g, c, rng) => {
    const h = 1.4 + rng() * 0.8;
    cyl(g, 0.1, 0.16, h, [0, 0, 0], mat('#6d4c41'), 7);
    const leaf = mat(c || ['#3e8e41', '#4caf50', '#2e7d32'][Math.floor(rng() * 3)]);
    for (let i = 0; i < 3; i++) ball(g, 0.75 - i * 0.12 + rng() * 0.15, [(rng() - 0.5) * 0.5, h + 0.3 + i * 0.5, (rng() - 0.5) * 0.5], leaf, 0);
  },
  rock: (g, c, rng) => {
    const r = ball(g, 0.4, [0, 0.2, 0], mat(c || '#8d8f94'), 0);
    r.scale.set(1 + rng() * 0.5, 0.6 + rng() * 0.3, 1 + rng() * 0.4);
  },
  bench: (g, c) => {
    const wood = mat(c || '#a1673a'), iron = mat('#37474f');
    for (let i = 0; i < 3; i++) box(g, [1.8, 0.04, 0.12], [0, 0.45, -0.15 + i * 0.15], wood);
    for (let i = 0; i < 2; i++) box(g, [1.8, 0.1, 0.04], [0, 0.6 + i * 0.16, -0.24], wood);
    for (const x of [-0.8, 0.8]) { box(g, [0.06, 0.45, 0.45], [x, 0, 0], iron); box(g, [0.06, 0.4, 0.05], [x, 0.45, -0.24], iron); }
  },
  car: (g, c) => {
    const body = mat(c || '#e53935', { roughness: 0.4, metalness: 0.2 });
    box(g, [3.8, 0.65, 1.7], [0, 0.28, 0], body);
    box(g, [2.0, 0.55, 1.5], [-0.2, 0.93, 0], body);
    box(g, [2.02, 0.38, 1.52], [-0.2, 1.0, 0], mat('#24323f', { roughness: 0.2 }), { cast: false });
    for (const [x, z] of [[-1.2, 0.8], [1.2, 0.8], [-1.2, -0.8], [1.2, -0.8]]) {
      const w = addMesh(g, new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14), mat('#1b1b1b'), x, 0.33, z);
      w.rotation.x = Math.PI / 2;
    }
    box(g, [0.05, 0.14, 0.3], [1.9, 0.6, 0.55], mat('#fffde7', { emissive: '#fff59d', emissiveIntensity: 0.7 }), { cast: false });
    box(g, [0.05, 0.14, 0.3], [1.9, 0.6, -0.55], mat('#fffde7', { emissive: '#fff59d', emissiveIntensity: 0.7 }), { cast: false });
  },
  bus: (g, c) => {
    const body = mat(c || '#f2b632', { roughness: 0.5 });
    box(g, [9, 2.5, 2.5], [0, 0.35, 0], body);
    box(g, [8.4, 0.85, 2.52], [0.1, 1.45, 0], mat('#253445', { roughness: 0.2 }), { cast: false });
    box(g, [9.02, 0.12, 2.52], [0, 0.85, 0], mat('#c0392b'), { cast: false });
    box(g, [0.9, 1.9, 2.53], [3.2, 0.4, 0], mat('#37474f'), { cast: false });
    for (const [x, z] of [[-3, 1.2], [3, 1.2], [-3, -1.2], [3, -1.2]]) {
      const w = addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), mat('#1b1b1b'), x, 0.5, z);
      w.rotation.x = Math.PI / 2;
    }
  },
  streetlight: (g, c) => {
    const iron = mat('#37474f');
    cyl(g, 0.07, 0.1, 4.4, [0, 0, 0], iron, 8);
    box(g, [1.1, 0.07, 0.07], [0.5, 4.3, 0], iron);
    box(g, [0.45, 0.12, 0.28], [1.0, 4.2, 0], mat('#fff3c4', { emissive: '#ffe08a', emissiveIntensity: 1.2 }), { cast: false });
    g.userData.lightPos = [1.0, 4.05, 0];
  },
  trash_can: (g, c) => {
    cyl(g, 0.3, 0.26, 0.85, [0, 0, 0], mat(c || '#455a64'), 12);
    cyl(g, 0.33, 0.33, 0.06, [0, 0.85, 0], mat('#37474f'), 12);
  },
  sign: (g, c) => {
    cyl(g, 0.04, 0.04, 2.2, [0, 0, 0], mat('#9e9e9e'), 6);
    box(g, [0.8, 0.5, 0.05], [0, 1.8, 0.04], mat(c || '#1976d2'));
    box(g, [0.5, 0.08, 0.02], [0, 2.03, 0.075], mat('#ffffff'), { cast: false });
  },
  fence: (g, c) => {
    const m = mat(c || '#e0d2b4');
    for (let i = 0; i <= 4; i++) box(g, [0.1, 1.0, 0.1], [-2 + i, 0, 0], m);
    box(g, [4.1, 0.08, 0.05], [0, 0.35, 0], m);
    box(g, [4.1, 0.08, 0.05], [0, 0.75, 0], m);
  },
  building: (g, c, rng, o) => {
    const w = o.w || 6, h = o.h || 12, d = o.d || 6;
    const color = c || ['#90a4ae', '#bcaaa4', '#a1887f', '#b0bec5', '#cfd8dc', '#8d6e63'][Math.floor(rng() * 6)];
    const cols = Math.max(2, Math.round(w / 1.4)), rows = Math.max(2, Math.round(h / 1.5));
    const t = windowTexture(rng, cols, rows, color, o.night ? 0.45 : 0.12);
    const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: o.night ? '#ffffff' : '#000000', emissiveIntensity: o.night ? 1.1 : 0, roughness: 0.9 });
    const side = mat(color);
    const mesh = addMesh(g, new THREE.BoxGeometry(w, h, d), [side, side, mat('#78909c'), side, m, side], 0, h / 2, 0);
    mesh.castShadow = true;
    box(g, [w + 0.2, 0.3, d + 0.2], [0, h, 0], mat('#607d8b'));
  },
  cloud: (g, c, rng) => {
    const m = mat(c || '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 });
    for (let i = 0; i < 5; i++) ball(g, 0.8 + rng() * 0.6, [(i - 2) * 0.9, (rng() - 0.3) * 0.4, (rng() - 0.5) * 0.6], m, 1, { cast: false, receive: false });
  },
  box: (g, c) => box(g, [0.6, 0.5, 0.6], [0, 0, 0], mat(c || '#c8a26b')),
  bus_stop: (g, c) => {
    const iron = mat('#455a64');
    box(g, [3.0, 0.08, 1.4], [0, 2.4, 0], mat(c || '#1565c0'));
    for (const x of [-1.4, 1.4]) box(g, [0.08, 2.4, 0.08], [x, 0, -0.6], iron);
    box(g, [2.8, 1.7, 0.03], [0, 0.6, -0.62], mat('#b3e5fc', { transparent: true, opacity: 0.45, roughness: 0.1 }), { cast: false });
    box(g, [2.0, 0.06, 0.4], [0, 0.45, -0.35], mat('#8d6e63'));
    box(g, [0.06, 0.45, 0.06], [-0.9, 0, -0.35], iron);
    box(g, [0.06, 0.45, 0.06], [0.9, 0, -0.35], iron);
  },
};

export const PROP_TYPES = Object.keys(FACTORIES);

/**
 * @param type  prop type (see PROP_TYPES)
 * @param opts  { color?, glass?, w/h/d? (building), night? }
 * @param rng   seeded random function
 */
export function createProp(type, opts = {}, rng = seededRandom(hashString(type))) {
  const factory = FACTORIES[type];
  if (!factory) throw new Error(`Unknown prop type "${type}"`);
  const g = new THREE.Group();
  g.name = `prop:${type}`;
  factory(g, opts.color, rng, opts);
  return g;
}

export { canvasTexture };
