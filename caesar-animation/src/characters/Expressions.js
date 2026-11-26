/**
 * Procedural facial expressions drawn with Canvas 2D.
 * A face is drawn inside the head circle in head-local coordinates
 * (origin = head centre, +x = facing direction, +y = up, units = head radius).
 */

export const EXPRESSIONS = [
  'neutral', 'happy', 'sad', 'surprised', 'angry', 'scared', 'thinking', 'smug', 'dizzy', 'sleepy',
];

/**
 * @param ctx      CanvasRenderingContext2D already transformed to head-local space (y up).
 * @param name     expression name
 * @param opts     { color, lookX (-1..1), mouth (0..1 talking), time (s), frontal (bool) }
 */
export function drawFace(ctx, name, opts) {
  if (!EXPRESSIONS.includes(name)) throw new Error(`Unknown expression "${name}"`);
  const { color, lookX = 0, mouth = 0, time = 0, frontal = false } = opts;
  // Side-facing characters show their face shifted toward the facing direction.
  const fx = frontal ? 0 : 0.28;
  const gaze = lookX * 0.12;
  const eyeY = 0.18;
  const eyeL = [fx - 0.3 + gaze, eyeY];
  const eyeR = [fx + 0.3 + gaze, eyeY];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.11;

  const dot = (p, r = 0.11) => { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); };
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  const arcStroke = (cx, cy, r, a0, a1) => { ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); };
  const mx = fx + gaze * 0.5, my = -0.35;

  const talkingMouth = (w = 0.26) => {
    if (mouth > 0.05) {
      ctx.beginPath();
      ctx.ellipse(mx, my, w * 0.8, 0.06 + mouth * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }
    return false;
  };

  switch (name) {
    case 'neutral':
      dot(eyeL); dot(eyeR);
      if (!talkingMouth()) line([mx - 0.2, my], [mx + 0.2, my]);
      break;
    case 'happy':
      // Closed happy eyes (upward arcs) + big grin.
      arcStroke(eyeL[0], eyeL[1] - 0.06, 0.12, Math.PI * 0.15, Math.PI * 0.85);
      arcStroke(eyeR[0], eyeR[1] - 0.06, 0.12, Math.PI * 0.15, Math.PI * 0.85);
      if (!talkingMouth(0.3)) arcStroke(mx, my + 0.18, 0.3, Math.PI * 1.15, Math.PI * 1.85);
      break;
    case 'sad':
      dot(eyeL, 0.09); dot(eyeR, 0.09);
      line([eyeL[0] - 0.16, eyeL[1] + 0.12], [eyeL[0] + 0.1, eyeL[1] + 0.2]);
      line([eyeR[0] + 0.16, eyeR[1] + 0.12], [eyeR[0] - 0.1, eyeR[1] + 0.2]);
      if (!talkingMouth()) arcStroke(mx, my - 0.22, 0.22, Math.PI * 0.2, Math.PI * 0.8);
      break;
    case 'surprised':
      ctx.lineWidth = 0.08;
      arcStroke(eyeL[0], eyeL[1], 0.16, 0, Math.PI * 2);
      arcStroke(eyeR[0], eyeR[1], 0.16, 0, Math.PI * 2);
      dot(eyeL, 0.06); dot(eyeR, 0.06);
      ctx.beginPath(); ctx.ellipse(mx, my - 0.05, 0.13, 0.17 + mouth * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'angry':
      dot(eyeL, 0.1); dot(eyeR, 0.1);
      ctx.lineWidth = 0.12;
      line([eyeL[0] - 0.2, eyeL[1] + 0.26], [eyeL[0] + 0.16, eyeL[1] + 0.1]);
      line([eyeR[0] + 0.2, eyeR[1] + 0.26], [eyeR[0] - 0.16, eyeR[1] + 0.1]);
      if (!talkingMouth()) {
        // Gritted teeth zigzag.
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.moveTo(mx - 0.24, my);
        for (let i = 1; i <= 6; i++) ctx.lineTo(mx - 0.24 + i * 0.08, my + (i % 2 ? 0.07 : -0.07));
        ctx.stroke();
      }
      break;
    case 'scared':
      ctx.lineWidth = 0.07;
      arcStroke(eyeL[0], eyeL[1], 0.15, 0, Math.PI * 2);
      arcStroke(eyeR[0], eyeR[1], 0.15, 0, Math.PI * 2);
      dot([eyeL[0], eyeL[1] - 0.03], 0.05); dot([eyeR[0], eyeR[1] - 0.03], 0.05);
      // Wobbly mouth.
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(mx - 0.25, my);
      for (let i = 1; i <= 8; i++) ctx.lineTo(mx - 0.25 + i * 0.0625, my + Math.sin(i * 1.6 + time * 30) * 0.05);
      ctx.stroke();
      // Sweat drop.
      ctx.beginPath(); ctx.ellipse(fx + 0.75, 0.4, 0.07, 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#5bc0ff'; ctx.fill();
      break;
    case 'thinking':
      dot([eyeL[0] + 0.05, eyeL[1] + 0.07], 0.1); dot([eyeR[0] + 0.05, eyeR[1] + 0.07], 0.1);
      line([eyeR[0] - 0.12, eyeR[1] + 0.28], [eyeR[0] + 0.16, eyeR[1] + 0.32]);
      if (!talkingMouth()) line([mx - 0.15, my - 0.03], [mx + 0.18, my + 0.05]);
      break;
    case 'smug':
      line([eyeL[0] - 0.12, eyeL[1]], [eyeL[0] + 0.12, eyeL[1]]);
      line([eyeR[0] - 0.12, eyeR[1]], [eyeR[0] + 0.12, eyeR[1]]);
      if (!talkingMouth()) arcStroke(mx + 0.08, my + 0.12, 0.22, Math.PI * 1.25, Math.PI * 1.85);
      break;
    case 'dizzy': {
      ctx.lineWidth = 0.06;
      for (const e of [eyeL, eyeR]) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = i * 0.55 + time * 8, r = 0.015 + i * 0.006;
          const x = e[0] + Math.cos(a) * r, y = e[1] + Math.sin(a) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 0.08;
      line([mx - 0.2, my], [mx + 0.2, my - 0.06]);
      break;
    }
    case 'sleepy':
      line([eyeL[0] - 0.12, eyeL[1] - 0.02], [eyeL[0] + 0.12, eyeL[1] - 0.02]);
      line([eyeR[0] - 0.12, eyeR[1] - 0.02], [eyeR[0] + 0.12, eyeR[1] - 0.02]);
      ctx.beginPath(); ctx.ellipse(mx, my, 0.1, 0.08, 0, 0, Math.PI * 2); ctx.fill();
      break;
  }
}
