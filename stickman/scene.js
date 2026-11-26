// Runs inside headless Chromium (driven by render.mjs). 3D world in three.js, characters as 2D canvas billboards.
import * as THREE from 'three';

const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = u => u * u * (3 - 2 * u);
const PALETTE = ['#d9774b', '#e8c170', '#b5654a', '#8fb0c9', '#c98f9a', '#9bbf85', '#e0a96d'];

// Index of the 0.3–0.8 s segment that time t falls into (drives eye darts and face changes).
function beat(t, seed) {
  let s = 0, i = 0;
  while (s + 0.3 + 0.5 * hash(seed + i) <= t) s += 0.3 + 0.5 * hash(seed + i++);
  return i;
}

// ---------- 2D character ----------
const FACE = {
  neutral: { tilt: 0, raise: 0, mouth: 'line', eye: 'dot' },
  happy: { tilt: 0, raise: 4, mouth: 'smile', eye: 'dot' },
  sad: { tilt: -1, raise: 2, mouth: 'frown', eye: 'dot' },
  angry: { tilt: 1, raise: 0, mouth: 'grit', eye: 'dot' },
  shock: { tilt: 0, raise: 14, mouth: 'o', eye: 'big' },
  scared: { tilt: -1, raise: 10, mouth: 'wave', eye: 'big' },
  smirk: { tilt: 0.4, raise: 2, mouth: 'smirk', eye: 'dot' },
};

function limb(ctx, x, y, a1, l1, a2, l2) {
  const x1 = x + Math.sin(a1) * l1, y1 = y + Math.cos(a1) * l1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + Math.sin(a2) * l2, y1 + Math.cos(a2) * l2); ctx.stroke();
}

function armPose(action, t, talking) {
  const sw = Math.sin(t * 2) * 0.05;
  const k = action === 'walk' ? [7, 0.4] : action === 'run' ? [12, 0.7] : null;
  if (k) { const s = Math.sin(t * k[0]) * k[1]; return [[-0.2 + s, -0.4 + s * 1.3], [0.2 + s, 0.4 + s * 1.3]]; }
  const idleL = [-0.25 + sw, -0.15 + sw];
  switch (action) {
    case 'point': return [idleL, [1.57, 1.57]];
    case 'wave': return [idleL, [2.6, 2.7 + Math.sin(t * 10) * 0.5]];
    case 'shrug': return [[-0.9, -2.4], [0.9, 2.4]];
    case 'cheer': case 'jump': { const w = Math.sin(t * 9) * 0.2; return [[-2.6 + w, -2.8 + w], [2.6 - w, 2.8 - w]]; }
    case 'think': return [idleL, [0.3, -2.6]];
  }
  if (talking) { const g = Math.sin(t * 5); return [idleL, [0.5 + g * 0.3, 1.3 + g * 0.4]]; }
  return [idleL, [0.25 - sw, 0.15 - sw]];
}

function drawStickman(ctx, o) {
  const { color = '#3b6fb6', hat, action = 'idle', t, talking, look, blink } = o;
  const f = FACE[o.face] || FACE.neutral;
  ctx.clearRect(0, 0, 256, 512);
  ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  const k = action === 'walk' ? [7, 0.5] : action === 'run' ? [12, 0.8] : null;
  const bob = k ? Math.abs(Math.sin(t * k[0])) * 8 : Math.sin(t * 2) * 2;
  const cx = 128, hipY = 380 - bob, shY = 236 - bob, cy = 118 - bob, r = 92;
  // legs
  let lA = 0.12, rA = -0.12;
  if (k) { lA = Math.sin(t * k[0]) * k[1]; rA = -lA; }
  if (action === 'jump') { lA = 0.5; rA = -0.5; }
  ctx.lineWidth = 11;
  limb(ctx, cx - 12, hipY, lA, 62, lA * 0.6, 62);
  limb(ctx, cx + 12, hipY, rA, 62, rA * 0.6, 62);
  // shirt
  ctx.fillStyle = color; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(cx - 38, shY - 18, 76, hipY - shY + 30, 22); ctx.fill(); ctx.stroke();
  // arms
  const [L, R] = armPose(action, t, talking);
  ctx.lineWidth = 11;
  limb(ctx, cx - 30, shY, L[0], 66, L[1], 60);
  limb(ctx, cx + 30, shY, R[0], 66, R[1], 60);
  // head: pure white, never lit
  ctx.fillStyle = '#fff'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (hat === 'crown') {
    ctx.fillStyle = '#f2c230'; ctx.lineWidth = 5; ctx.beginPath();
    ctx.moveTo(cx - 55, cy - r + 14); ctx.lineTo(cx - 60, cy - r - 40); ctx.lineTo(cx - 30, cy - r - 12); ctx.lineTo(cx, cy - r - 48);
    ctx.lineTo(cx + 30, cy - r - 12); ctx.lineTo(cx + 60, cy - r - 40); ctx.lineTo(cx + 55, cy - r + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (hat === 'cap') {
    ctx.fillStyle = color; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy - 30, r - 8, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - 10, cy - 52, 110, 16, 8); ctx.fill(); ctx.stroke();
  } else if (hat === 'hair') {
    ctx.lineWidth = 9;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 20, cy - r + 6); ctx.lineTo(cx + i * 26, cy - r - 26 + Math.abs(i) * 6); ctx.stroke(); }
  }
  // eyes
  const [lx, ly] = look;
  for (const s of [-1, 1]) {
    const ex = cx + s * 32, ey = cy - 4;
    ctx.fillStyle = '#111'; ctx.lineWidth = 6;
    if (blink) { ctx.beginPath(); ctx.moveTo(ex - 12, ey); ctx.lineTo(ex + 12, ey); ctx.stroke(); }
    else if (f.eye === 'big') {
      ctx.beginPath(); ctx.arc(ex, ey, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex + lx * 7, ey + ly * 7, 6, 0, Math.PI * 2); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(ex + lx * 8, ey + ly * 6, 10, 0, Math.PI * 2); ctx.fill(); }
    // brow: inner end drops when tilt > 0 (angry), rises when tilt < 0 (sad)
    const by = ey - 32 - f.raise;
    ctx.lineWidth = 7; ctx.beginPath();
    ctx.moveTo(ex + s * 16, by - f.tilt * 2); ctx.lineTo(ex - s * 14, by + f.tilt * 9); ctx.stroke();
  }
  // mouth
  const my = cy + 42; ctx.lineWidth = 6; ctx.fillStyle = '#111';
  ctx.beginPath();
  if (talking && Math.sin(t * 22) > -0.2) ctx.ellipse(cx, my, 15, 5 + 9 * hash(Math.floor(t * 9)), 0, 0, Math.PI * 2), ctx.fill();
  else switch (f.mouth) {
    case 'smile': ctx.arc(cx, my - 14, 24, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); break;
    case 'frown': ctx.arc(cx, my + 18, 20, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); break;
    case 'o': ctx.ellipse(cx, my + 4, 12, 17, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'grit': ctx.fillStyle = '#fff'; ctx.roundRect(cx - 22, my - 7, 44, 15, 4); ctx.fill(); ctx.stroke(); ctx.moveTo(cx - 22, my); ctx.lineTo(cx + 22, my); ctx.stroke(); break;
    case 'wave': for (let i = 0; i <= 6; i++) ctx.lineTo(cx - 21 + i * 7, my + (i % 2 ? -4 : 4)); ctx.stroke(); break;
    case 'smirk': ctx.moveTo(cx - 18, my + 2); ctx.quadraticCurveTo(cx + 6, my + 6, cx + 22, my - 8); ctx.stroke(); break;
    default: ctx.moveTo(cx - 14, my); ctx.lineTo(cx + 14, my); ctx.stroke();
  }
}

function makeActor(spec, seed) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 512 });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const h = spec.height || 3.2;
  const geo = new THREE.PlaneGeometry(h / 2, h).translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, fog: false }));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(h * 0.18, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.position.y = 0.02;
  const group = new THREE.Group(); group.add(mesh, shadow);
  return {
    group, mesh,
    update(t, opts) {
      const faces = [].concat(spec.face || 'neutral');
      const b = beat(t, seed);
      const look = opts.look || [hash(seed + b * 3.1) * 2 - 1, (hash(seed + b * 7.7) * 2 - 1) * 0.5];
      drawStickman(canvas.getContext('2d'), {
        ...spec, t, look, talking: opts.talking,
        face: faces[b % faces.length],
        blink: (t + hash(seed) * 3) % 3.1 < 0.12,
      });
      tex.needsUpdate = true;
    },
  };
}

// ---------- 3D world ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });

function softDot() {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function labelTexture(text) {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 128 });
  const g = c.getContext('2d');
  g.fillStyle = '#f4e3c1'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#222'; g.font = 'bold 40px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.toUpperCase().slice(0, 12), 128, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

function buildWorld(scene, setName, crowdSeed) {
  const upd = [];
  const add = o => (scene.add(o), o);
  const dot = softDot();
  const sky = { village: '#a8d8f0', room: '#2e2420', field: '#9fd0ee' }[setName];
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 18, 55);
  add(new THREE.HemisphereLight('#ffffff', '#7a6a50', setName === 'room' ? 0.9 : 1.6));
  const sun = add(new THREE.DirectionalLight('#fff3dd', 1.8)); sun.position.set(5, 10, 6);

  const ground = color => { const g = add(new THREE.Mesh(new THREE.PlaneGeometry(120, 120), std(color))); g.rotation.x = -Math.PI / 2; };
  const birds = n => {
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group(), m = std('#222');
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), m), w2 = w1.clone();
      w1.geometry.translate(0.25, 0, 0); w2.geometry = w1.geometry.clone().translate(-0.5, 0, 0);
      m.side = THREE.DoubleSide; b.add(w1, w2); add(b);
      upd.push(T => {
        b.position.set(((T * 1.6 + i * 6.3) % 36) - 18, 6 + i % 3 + Math.sin(T + i) * 0.4, -12 - (i % 4) * 3);
        const f = Math.sin(T * 12 + i) * 0.7; w1.rotation.y = f; w2.rotation.y = -f;
      });
    }
  };
  const clouds = n => {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1 + hash(i * 9 + j), 12, 8), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 }));
        s.position.set(j * 1.3, hash(i + j * 3) * 0.6, 0); c.add(s);
      }
      add(c);
      upd.push(T => c.position.set(((T * 0.3 + i * 13) % 50) - 25, 11 + (i % 3) * 1.5, -30 - i * 3));
    }
  };
  const smoke = (x, y, z, n = 8) => {
    for (let i = 0; i < n; i++) {
      const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#dddddd', transparent: true, depthWrite: false })));
      upd.push(T => {
        const life = (T * 0.35 + i / n) % 1;
        s.position.set(x + Math.sin(T + i) * 0.3 + life * 0.8, y + life * 4, z);
        s.scale.setScalar(0.5 + life * 1.8); s.material.opacity = 0.7 * (1 - life);
      });
    }
  };
  const motes = (n, color) => {
    for (let i = 0; i < n; i++) {
      const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: 0.6, depthWrite: false })));
      s.scale.setScalar(0.08);
      upd.push(T => s.position.set(hash(i) * 12 - 6 + Math.sin(T * 0.3 + i) * 0.5, ((hash(i + 5) * 6 + T * 0.15) % 6), hash(i + 9) * -6 + 1));
    }
  };
  const crowd = (n, z) => {
    for (let i = 0; i < n; i++) {
      const a = makeActor({ color: PALETTE[(crowdSeed + i) % PALETTE.length], face: ['neutral', 'happy'][i % 2], hat: hash(i + crowdSeed) > 0.6 ? 'cap' : undefined, height: 2.6, action: i % 3 ? 'idle' : 'walk' }, crowdSeed * 31 + i);
      add(a.group);
      const x0 = (i - n / 2) * 2.6 + hash(i) * 1.5;
      upd.push((T, cam) => {
        const walk = i % 3 === 0;
        a.group.position.set(walk ? ((x0 + T * 0.8 + 20) % 24) - 12 : x0, 0, z - (i % 2) * 1.5);
        a.mesh.rotation.y = Math.atan2(cam.position.x - a.group.position.x, cam.position.z - a.group.position.z);
        a.update(T + i, {});
      });
    }
  };
  const house = (x, z, color) => {
    const h = new THREE.Group(), w = 3 + hash(x) * 1.5, ht = 2.5 + hash(x + 1) * 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, ht, 3), std(color)); body.position.y = ht / 2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 1.6, 4), std('#7a3b2e')); roof.position.y = ht + 0.8; roof.rotation.y = Math.PI / 4;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), std('#ffe9a8', { emissive: '#ffcf6b', emissiveIntensity: 0.6 })); win.position.set(0, ht * 0.6, 1.51);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), std('#5a3a26')); door.position.set(w * 0.25, 0.7, 1.51);
    h.add(body, roof, win, door); h.position.set(x, 0, z); add(h);
    if (hash(x * 3) > 0.5) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), std('#6b5b53')); ch.position.set(-w * 0.25, ht + 1, 0); h.add(ch);
      smoke(x - w * 0.25, ht + 1.5, z);
    }
  };
  const tree = (x, z, s = 1) => {
    const tr = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.6 * s), std('#6b4a2f')); trunk.position.y = 0.8 * s;
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), std('#4f8a3c', { flatShading: true })); top.position.y = 2.2 * s;
    tr.add(trunk, top); tr.position.set(x, 0, z); add(tr);
    upd.push(T => { top.rotation.z = Math.sin(T * 1.3 + x) * 0.04; });
  };

  if (setName === 'village') {
    ground('#cdb68c');
    for (const [row, off] of [[-9, 0], [-16, 2.5]]) for (let i = -4; i <= 4; i++) house(i * 5 + off + hash(i + row) * 1.2, row, PALETTE[(i + 9 + row) % PALETTE.length]);
    for (const x of [-4.5, 4.5]) {
      const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2), std('#333'))); pole.position.set(x, 1.6, -2.5);
      const lamp = add(new THREE.Mesh(new THREE.SphereGeometry(0.25), std('#fff3c4', { emissive: '#ffd36b', emissiveIntensity: 1 }))); lamp.position.set(x, 3.3, -2.5);
    }
    birds(5); clouds(4); crowd(6, -5);
  } else if (setName === 'room') {
    ground('#8a5a3b');
    const wall = add(new THREE.Mesh(new THREE.PlaneGeometry(30, 12), std('#d8c7a8'))); wall.position.set(0, 6, -4);
    const side = add(new THREE.Mesh(new THREE.PlaneGeometry(20, 12), std('#cbb894'))); side.position.set(-7, 6, 4); side.rotation.y = Math.PI / 2;
    const win = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2), std('#bfe6ff', { emissive: '#bfe6ff', emissiveIntensity: 0.8 }))); win.position.set(-3, 4, -3.98);
    const frame = add(new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.3), std('#5a3a26'))); frame.position.set(-3, 4, -3.99);
    const table = add(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.4), std('#6b4329'))); table.position.set(3.5, 0.5, -2.5);
    const shelf = add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 0.6), std('#5a3a26'))); shelf.position.set(3, 4.2, -3.7);
    for (let i = 0; i < 4; i++) { const book = add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.45), std(PALETTE[i]))); book.position.set(2.2 + i * 0.32, 4.6, -3.7); }
    const lampG = add(new THREE.Group()); lampG.position.set(0, 8, -1);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5), std('#222')); cord.position.y = -1.25;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3), std('#fff3c4', { emissive: '#ffd36b', emissiveIntensity: 1.2 })); bulb.position.y = -2.6;
    lampG.add(cord, bulb);
    const pl = add(new THREE.PointLight('#ffcf80', 30, 20)); pl.position.set(0, 5.4, -1);
    upd.push(T => { lampG.rotation.z = Math.sin(T * 1.4) * 0.12; });
    motes(30, '#fff1c1');
  } else {
    ground('#8fbf5a');
    const water = add(new THREE.Mesh(new THREE.PlaneGeometry(80, 5, 60, 6), std('#4a9bd1', { roughness: 0.3, metalness: 0.1 })));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.05, -8);
    const pos = water.geometry.attributes.position;
    upd.push(T => {
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.8 + T * 2) * 0.08 + Math.cos(pos.getY(i) * 2 + T * 1.5) * 0.05);
      pos.needsUpdate = true; water.geometry.computeVertexNormals();
    });
    for (let i = 0; i < 4; i++) { const m = add(new THREE.Mesh(new THREE.ConeGeometry(8 + hash(i) * 4, 9 + hash(i + 1) * 5, 5), std('#7d93a8', { flatShading: true }))); m.position.set(-24 + i * 16, 4, -40); }
    for (let i = 0; i < 9; i++) tree(-16 + i * 4 + hash(i) * 2, -13 - hash(i + 2) * 4, 0.9 + hash(i + 4) * 0.6);
    tree(-5.5, -2.5); tree(6, -3, 1.2);
    birds(6); clouds(5); crowd(3, -4.5);
  }
  return upd;
}

function makeProp(spec) {
  const name = (spec.name || spec).toLowerCase();
  const g = new THREE.Group();
  const spin = [];
  if (/jar|guci|vase|pot|kendi/.test(name)) {
    const pts = [[0, 0], [0.35, 0.05], [0.55, 0.4], [0.5, 0.8], [0.25, 1.05], [0.25, 1.2], [0.35, 1.25]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 24), std('#b5653d', { side: THREE.DoubleSide })));
  } else if (/coin|koin|gold|emas/.test(name)) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 32), std('#ffd23f', { metalness: 0.2, roughness: 0.35, emissive: '#d99a00', emissiveIntensity: 0.6 }));
    c.rotation.x = Math.PI / 2; c.position.y = 1.2; g.add(c); spin.push(c);
  } else if (/chest|peti/.test(name)) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), std('#7a4a26')); b.position.y = 0.35;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16, 1, false, 0, Math.PI), std('#8a5a30')); lid.rotation.z = Math.PI / 2; lid.position.y = 0.7;
    g.add(b, lid);
  } else if (/rock|batu|stone/.test(name)) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), std('#888', { flatShading: true })); r.position.y = 0.4; g.add(r);
  } else if (/box|kotak|kardus/.test(name)) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), std('#c49a62')); b.position.y = 0.45; g.add(b);
  } else {
    // Unknown noun: a signboard with the word, so every noun still gets a visual.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), std('#5a3a26')); post.position.y = 0.6;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: labelTexture(name) })); board.position.y = 1.4;
    g.add(post, board);
  }
  return { group: g, spin };
}

// ---------- camera ----------
function placeCamera(cam, move, u, T, focusX) {
  const e = ease(Math.min(1, Math.max(0, u)));
  const tgt = new THREE.Vector3(focusX, 1.7, 0);
  let p;
  switch (move) {
    case 'pull_out': p = [focusX, 2.2, 6 + 4 * e]; break;
    case 'pan_left': p = [focusX + 2.5 - 5 * e, 2.2, 8.5]; tgt.x += 2.5 - 5 * e; break;
    case 'pan_right': p = [focusX - 2.5 + 5 * e, 2.2, 8.5]; tgt.x += -2.5 + 5 * e; break;
    case 'orbit': { const a = -0.5 + e; p = [focusX + Math.sin(a) * 9, 2.4, Math.cos(a) * 9]; break; }
    case 'crane_up': p = [focusX, 1 + 4 * e, 9 - e]; break;
    case 'low_angle': p = [focusX, 0.5, 7.5 - 1.5 * e]; tgt.y = 2.4; break;
    case 'shake': p = [focusX + (hash(T * 60) - 0.5) * 0.25, 2.2 + (hash(T * 60 + 7) - 0.5) * 0.25, 7 - e]; break;
    default: p = [focusX, 2.2, 10 - 4 * e]; // push_in
  }
  // gentle handheld drift so the camera is never dead still
  cam.position.set(p[0] + Math.sin(T * 0.7) * 0.06, p[1] + Math.sin(T * 0.9) * 0.04, p[2]);
  cam.lookAt(tgt);
}

// ---------- frame driver ----------
let renderer, camera, story, timeline, W, H, out, octx;
let cur = { idx: -1 };

function buildShot(i) {
  const sh = story.shots[i];
  const set = sh.set || [...story.shots.slice(0, i)].reverse().find(s => s.set)?.set || 'village';
  // shortcut: old shot scenes are not disposed; fine for short videos, dispose geometries/textures if long ones run out of GPU memory.
  const scene = new THREE.Scene();
  const upd = buildWorld(scene, set, i);
  const actors = (sh.actors || []).map((a, j) => {
    const act = makeActor({ ...story.cast[a.id], ...a }, i * 100 + j * 17 + 1);
    scene.add(act.group);
    return { a, act };
  });
  const props = (sh.props || []).map((p, j, all) => {
    const pr = makeProp(p);
    pr.group.position.set(p.x ?? (j - (all.length - 1) / 2) * 1.6, 0, 1);
    scene.add(pr.group);
    return pr;
  });
  return { idx: i, sh, scene, upd, actors, props };
}

function renderAt(T) {
  let i = timeline.findIndex(s => T < s.start + s.dur);
  if (i < 0) i = timeline.length - 1;
  if (cur.idx !== i) cur = buildShot(i);
  const { sh, scene, upd, actors, props } = cur, seg = timeline[i], t = T - seg.start;
  const u = t / seg.dur;
  const focus = actors.find(x => x.a.id === sh.focus);
  const fx = (a, uu) => a.to !== undefined ? a.x + (a.to - a.x) * ease(Math.min(1, uu)) : (a.x ?? 0);
  placeCamera(camera, sh.camera || 'push_in', u, T, focus ? fx(focus.a, u) * 0.6 : 0);
  for (const f of upd) f(T, camera);
  for (const { a, act } of actors) {
    const x = fx(a, u);
    const jump = a.action === 'jump' ? Math.abs(Math.sin(t * 4)) * 0.8 : 0;
    act.group.position.set(x, jump, a.z ?? 0);
    act.mesh.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - (a.z ?? 0));
    // Mirror the sprite when walking left or told to face left.
    const left = a.facing === 'left' || (a.to !== undefined && a.to < a.x);
    act.mesh.scale.x = left ? -1 : 1;
    act.update(t, { talking: sh.speaker === a.id });
  }
  for (const p of props) for (const s of p.spin) { s.rotation.z = T * 3; s.position.y = 1.2 + Math.sin(T * 3) * 0.1; }
  renderer.render(scene, camera);
  return { seg, i };
}

function drawCaption(ctx, seg, T, w, h) {
  const words = seg.words;
  let k = words.findIndex(x => T < x.end);
  if (k < 0) k = words.length - 1;
  const c = Math.floor(k / 2) * 2;
  const text = words.slice(c, c + 2).map(x => x.w).join(' ').replace(/["“”]/g, '').toUpperCase();
  const pop = 1 + 0.12 * Math.max(0, 1 - (T - words[c].start) / 0.12);
  ctx.save();
  ctx.translate(w / 2, h * 0.82); ctx.scale(pop, pop);
  ctx.font = `900 ${Math.round(w * 0.085)}px "DejaVu Sans", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = w * 0.018; ctx.strokeStyle = '#000'; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillText(text, 0, 0);
  ctx.restore();
}

window.setup = (s, tl) => {
  story = s; timeline = tl; W = s.width || 720; H = s.height || 1280;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
  out = Object.assign(document.createElement('canvas'), { width: W, height: H });
  octx = out.getContext('2d');
};

window.frame = T => {
  const { seg } = renderAt(T);
  octx.drawImage(renderer.domElement, 0, 0);
  drawCaption(octx, seg, T, W, H);
  return out.toDataURL('image/jpeg', 0.9);
};

window.contactSheet = () => {
  const cols = 4, tw = W / 4, th = H / 4, rows = Math.ceil(timeline.length / cols);
  const c = Object.assign(document.createElement('canvas'), { width: cols * tw, height: rows * (th + 40) });
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  timeline.forEach((seg, i) => {
    renderAt(seg.start + seg.dur / 2);
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 40);
    g.drawImage(renderer.domElement, x + 2, y + 2, tw - 4, th - 4);
    const label = `${i + 1}. ${story.shots[i].text}`;
    g.fillStyle = '#fff'; g.font = '12px "DejaVu Sans", sans-serif';
    g.fillText(label.length > 26 ? label.slice(0, 25) + '…' : label, x + 6, y + th + 20);
  });
  return c.toDataURL('image/jpeg', 0.85);
};
