/**
 * Draws a stickman procedurally onto a Canvas 2D every frame and shows it in the 3D scene
 * as a camera-facing billboard (the "2.5D" look: flat characters in a 3D world).
 *
 * No static pose images: every pose is solved from joint angles (Character.solveSkeleton)
 * and drawn with vector strokes, so any action/expression combination is possible.
 */
import * as THREE from 'three';
import { solveSkeleton } from './Character.js';
import { drawFace } from './Expressions.js';

const PLANE = 3.2; // world units covered by the character canvas (square)
const GROUND_PAD = 0.15; // canvas space below the feet (for toes / lying poses)

let blobTexture = null;
function getBlobTexture() {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}

export class CharacterRenderer {
  /**
   * @param character resolved character (Character.resolveCharacter)
   * @param opts { textureSize }
   */
  constructor(character, { textureSize = 768 } = {}) {
    this.character = character;
    this.size = textureSize;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = textureSize;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const geo = new THREE.PlaneGeometry(PLANE, PLANE);
    geo.translate(0, PLANE / 2 - GROUND_PAD, 0);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    // Shadow maps must respect the canvas alpha, otherwise the whole plane casts a square shadow.
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking, map: this.texture, alphaTest: 0.5,
    });
    this.mesh.renderOrder = 2;

    const blobGeo = new THREE.PlaneGeometry(1.3, 0.55);
    blobGeo.rotateX(-Math.PI / 2);
    this.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({
      map: getBlobTexture(), transparent: true, depthWrite: false,
    }));
    this.blob.position.y = 0.012;
    this.blob.renderOrder = 1;

    this.group = new THREE.Group();
    this.group.name = `character:${character.id}`;
    this.group.add(this.mesh, this.blob);
    this.group.scale.setScalar(character.scale);
  }

  /**
   * Redraw the character for a frame.
   * @param state  Animator state: { pose, expression, item }
   * @param facing +1 (screen right), -1 (screen left) or 0 (toward camera)
   * @param time   absolute time in seconds (for small procedural wiggles)
   */
  draw(state, facing, time) {
    const { ctx, size, character: ch } = this;
    const P = ch.proportions;
    const ppu = size / PLANE;
    const flip = facing < 0 ? -1 : 1;
    const pts = solveSkeleton(state.pose, P);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Character space: y up, origin on the ground under the pelvis, mirrored when facing left.
    ctx.setTransform(ppu * flip, 0, 0, -ppu, size / 2, size - GROUND_PAD * ppu);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lw = P.lineWidth;
    const outline = ch.outline || 'rgba(255,255,255,0.9)';
    const poly = (points, width, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
    };
    const circle = (p, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); };

    const backColor = shade(ch.color, 0.35);
    const limbs = {
      backArm: [pts.shoulder, pts.elbowR, pts.handR],
      backLeg: [pts.pelvis, pts.kneeR, pts.footR, pts.toeR],
      frontLeg: [pts.pelvis, pts.kneeL, pts.footL, pts.toeL],
      frontArm: [pts.shoulder, pts.elbowL, pts.handL],
      torso: [pts.pelvis, pts.neckBase],
    };
    // Pass 1: light outline halo so dark characters read on dark/night backgrounds.
    for (const pl of Object.values(limbs)) poly(pl, lw + 0.05, outline);
    circle(pts.head, P.headR + 0.025 + lw / 2, outline);
    for (const h of [pts.handL, pts.handR]) circle(h, lw * 0.95 + 0.025, outline);

    // Pass 2: body, back limbs darker for depth.
    poly(limbs.backArm, lw, backColor);
    circle(pts.handR, lw * 0.95, backColor);
    poly(limbs.backLeg, lw, backColor);
    poly(limbs.torso, lw * 1.15, ch.color);
    if (ch.accessory === 'tie') this.drawTie(pts, P);
    poly(limbs.frontLeg, lw, ch.color);
    if (state.item === 'phone') this.drawPhone(pts.handL, pts);
    poly(limbs.frontArm, lw, ch.color);
    circle(pts.handL, lw * 0.95, ch.color);

    // Head: filled circle + outline, then the face in head-local coordinates.
    circle(pts.head, P.headR + lw / 2, ch.color);
    circle(pts.head, P.headR - lw / 2, ch.headFill);
    ctx.save();
    ctx.translate(pts.head[0], pts.head[1]);
    ctx.rotate(-pts.headAngle);
    ctx.scale(P.headR, P.headR);
    drawFace(ctx, state.expression, {
      color: '#1b1b1b', lookX: state.pose.lookX, mouth: state.pose.mouth, time, frontal: facing === 0,
    });
    this.drawAccessory(ch.accessory, ch.accent, time);
    ctx.restore();

    this.texture.needsUpdate = true;

    // Jump height moves the billboard; the contact shadow stays on the ground and fades.
    this.mesh.position.y = state.pose.rootY;
    const lift = Math.max(0, state.pose.rootY);
    const s = 1 / (1 + lift * 0.9);
    const lying = Math.abs(Math.sin(state.pose.rot));
    this.blob.scale.set(s * (1 + lying * 0.9), 1, s);
    this.blob.material.opacity = s;
  }

  drawTie(pts, P) {
    const { ctx } = this;
    const n = pts.neckBase, p = pts.pelvis;
    const along = (f) => [n[0] + (p[0] - n[0]) * f, n[1] + (p[1] - n[1]) * f];
    const a = along(0.12), b = along(0.55);
    ctx.fillStyle = this.character.accent;
    ctx.beginPath();
    ctx.moveTo(a[0] - 0.035, a[1]);
    ctx.lineTo(a[0] + 0.035, a[1]);
    ctx.lineTo(b[0] + 0.055, b[1]);
    ctx.lineTo(b[0], b[1] - 0.06);
    ctx.lineTo(b[0] - 0.055, b[1]);
    ctx.closePath();
    ctx.fill();
  }

  drawPhone(hand) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(hand[0] + 0.02, hand[1] + 0.06);
    ctx.rotate(0.25);
    ctx.fillStyle = '#222';
    ctx.fillRect(-0.05, -0.09, 0.1, 0.18);
    ctx.fillStyle = '#7fd3ff';
    ctx.fillRect(-0.038, -0.075, 0.076, 0.14);
    ctx.restore();
  }

  /** Accessories in head-local units (head radius = 1, +x = facing). */
  drawAccessory(kind, accent, time) {
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (kind) {
      case 'nightcap': {
        // Floppy cone flopping backwards with a pompom; sways a little.
        const sway = Math.sin(time * 3) * 0.08;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(-0.95, 0.45);
        ctx.quadraticCurveTo(-0.2, 1.9, -1.3 + sway, 1.25);
        ctx.quadraticCurveTo(-0.6, 1.15, 0.95, 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.0, 0.36, 2.0, 0.24);
        ctx.beginPath(); ctx.arc(-1.32 + sway, 1.2, 0.2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'cap':
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(0, 0.35, 0.95, 0, Math.PI); ctx.fill();
        ctx.fillRect(0.1, 0.3, 1.25, 0.18);
        break;
      case 'tophat':
        ctx.fillStyle = '#151515';
        ctx.fillRect(-1.15, 0.75, 2.3, 0.18);
        ctx.fillRect(-0.7, 0.85, 1.4, 1.1);
        ctx.fillStyle = accent;
        ctx.fillRect(-0.7, 0.95, 1.4, 0.2);
        break;
      case 'spiky_hair':
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(-0.95, 0.35);
        for (let i = 0; i <= 5; i++) {
          const a = Math.PI * (0.9 - i * 0.16);
          ctx.lineTo(Math.cos(a) * 1.45, Math.sin(a) * 1.45);
          const b = Math.PI * (0.82 - i * 0.16);
          if (i < 5) ctx.lineTo(Math.cos(b) * 0.95, Math.sin(b) * 0.95);
        }
        ctx.lineTo(0.95, 0.35);
        ctx.closePath();
        ctx.fill();
        break;
      case 'bow':
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(-0.3, 1.0); ctx.lineTo(-0.85, 1.35); ctx.lineTo(-0.85, 0.75); ctx.closePath();
        ctx.moveTo(-0.3, 1.0); ctx.lineTo(0.25, 1.35); ctx.lineTo(0.25, 0.75); ctx.closePath();
        ctx.fill();
        break;
      case 'glasses':
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.arc(-0.02, 0.18, 0.22, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0.58, 0.18, 0.22, 0, Math.PI * 2); ctx.stroke();
        break;
      default:
        break; // 'none' and 'tie' (tie is drawn on the torso)
    }
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.mesh.customDepthMaterial.dispose();
    this.blob.geometry.dispose();
    this.blob.material.dispose();
  }
}

/** Darken a #rrggbb colour by `amount` (0..1) toward black. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c * (1 - amount) + 40 * amount);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
