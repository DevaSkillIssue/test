/**
 * WebGL frame renderer (replaces Blender EEVEE).
 *
 * renderAt(t) draws the frame for an explicit timestamp. It never reads the wall clock, so
 * frames can be rendered in any order, by any number of browser pages, at any speed, and the
 * same t always produces the same pixels.
 */
import * as THREE from 'three';
import { compileTimeline, sceneIndexAt, transitionState } from '../animation/Timeline.js';
import { SceneAnimator } from '../animation/Animator.js';
import { evaluateCamera, applyCamera, rightVector } from '../camera/CameraController.js';
import { buildScene } from '../scene/SceneBuilder.js';
import { resolveCharacter } from '../characters/Character.js';
import { CharacterRenderer } from '../characters/CharacterRenderer.js';

const OVERLAY_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// final = mix(dst * (1 - vignette), fadeColor, fade), expressed as one premultiplied-alpha blend.
const OVERLAY_FRAG = `
varying vec2 vUv;
uniform vec3 fadeColor; uniform float fade; uniform float vignette;
void main(){
  vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
  float v = smoothstep(0.32, 0.78, length(d)) * vignette;
  float a = 1.0 - (1.0 - v) * (1.0 - fade);
  vec3 c = a > 0.0 ? fadeColor * fade / a : vec3(0.0);
  gl_FragColor = vec4(c, a);
}`;

export class FrameRenderer {
  /**
   * @param opts { canvas, width, height, story, templates, timing?, words?, fps?, settings? }
   */
  constructor({ canvas, width, height, story, templates, timing = null, words = null, fps = 30, settings = {} }) {
    this.width = width;
    this.height = height;
    this.settings = settings;
    this.timeline = compileTimeline(story, { timing, words, fps });
    const shadows = settings.shadows !== false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 400);

    this.characters = new Map();
    for (const c of story.cast) {
      const ch = resolveCharacter(c, templates);
      this.characters.set(c.id, new CharacterRenderer(ch, { textureSize: settings.characterTextureSize || 768 }));
    }

    this.scenes = this.timeline.scenes.map((sc) => ({
      tl: sc,
      animator: new SceneAnimator(sc),
      built: buildScene(sc, { seed: this.timeline.seed, shadows, shadowMapSize: settings.shadowMapSize || 2048 }),
    }));
    for (const s of this.scenes) {
      for (const c of s.tl.data.characters) {
        if (!this.characters.has(c.id)) throw new Error(`scene ${s.tl.id}: character "${c.id}" is not in the cast`);
      }
    }

    this.overlayScene = new THREE.Scene();
    this.overlayUniforms = { fadeColor: { value: new THREE.Color(0, 0, 0) }, fade: { value: 0 }, vignette: { value: settings.vignette ?? 0.45 } };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: OVERLAY_VERT, fragmentShader: OVERLAY_FRAG, uniforms: this.overlayUniforms,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    quad.frustumCulled = false;
    this.overlayScene.add(quad);
    this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.activeIndex = -1;
  }

  get info() {
    const tl = this.timeline;
    return { duration: tl.duration, videoDuration: tl.videoDuration, frameCount: tl.frameCount, fps: tl.fps, width: this.width, height: this.height, scenes: tl.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })), warnings: tl.warnings };
  }

  activate(index) {
    if (index === this.activeIndex) return;
    if (this.activeIndex >= 0) {
      for (const r of this.characters.values()) r.group.removeFromParent();
    }
    const s = this.scenes[index];
    for (const c of s.tl.data.characters) s.built.scene.add(this.characters.get(c.id).group);
    this.renderer.toneMappingExposure = s.built.exposure;
    this.activeIndex = index;
  }

  renderAt(t) {
    const tl = this.timeline;
    const time = Math.min(Math.max(t, 0), tl.duration);
    const index = sceneIndexAt(tl, time);
    this.activate(index);
    const s = this.scenes[index];
    s.built.update(time);

    const ids = s.tl.data.characters.map((c) => c.id);
    const subjectPos = (target, at) => {
      if (ids.includes(target)) return s.animator.positionAt(target, at).pos;
      const all = ids.map((id) => s.animator.positionAt(id, at).pos);
      if (!all.length) return [0, 0, 0];
      return all.reduce((a, p) => a.map((v, k) => v + p[k] / all.length), [0, 0, 0]);
    };
    const fx = transitionState(tl, time);
    const cam = evaluateCamera(s.tl, time, subjectPos, fx, { handheld: this.settings.handheld, seed: tl.seed, maxHeight: s.built.ceiling });
    applyCamera(this.camera, cam);
    const right = rightVector(cam.position, cam.lookAt);

    for (const id of ids) {
      const r = this.characters.get(id);
      const st = s.animator.stateAt(id, time);
      r.group.position.set(...st.position);
      // Cylindrical billboard: always face the camera, stay upright.
      r.group.rotation.set(0, Math.atan2(cam.position[0] - st.position[0], cam.position[2] - st.position[2]), 0);
      // Story facing is world +x/-x; convert to screen left/right for this camera.
      const screenFacing = st.facing === 0 ? 0 : st.facing * (right[0] >= 0 ? 1 : -1);
      r.draw(st, screenFacing, time);
    }

    this.overlayUniforms.fade.value = fx.fade;
    this.overlayUniforms.fadeColor.value.set(fx.color === 'white' ? 0xffffff : 0x000000);

    this.renderer.clear();
    this.renderer.render(s.built.scene, this.camera);
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }

  dispose() {
    for (const s of this.scenes) s.built.dispose();
    for (const r of this.characters.values()) r.dispose();
    this.renderer.dispose();
  }
}
