// Post-processing: scene → ground-contact ambient occlusion → bloom from genuinely bright light
// only → SMAA → OutputPass (AgX tone mapping and the sRGB transfer, applied exactly once).
// Adapted from ODD TIDE's pipeline; the low tier (phones) skips AO and halves the bloom buffers.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Tier } from "./stage";

type VisibilityPatched = { _overrideVisibility(): void; _visibilityCache: THREE.Object3D[] };

/**
 * Zeroes NaN and infinity (all exponent bits set: immune to fast-math) and caps HDR values
 * before bloom. Some GPUs (Apple's) make NaN where others quietly don't, and bloom's blur
 * would spread one bad pixel over the whole frame.
 */
const FiniteShader = {
  name: "FiniteShader",
  uniforms: { tDiffuse: { value: null } },
  vertexShader:
    "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
float finite(float x) {
  return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u ? 0.0 : clamp(x, 0.0, 16384.0);
}
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(finite(c.r), finite(c.g), finite(c.b), 1.0);
}`,
};

export interface Pipeline {
  composer: EffectComposer;
  /** Transparent or effect-only objects the AO G-buffer must not see (water, streaks, glows). */
  hideFromAO: (o: THREE.Object3D) => void;
  setSize: (w: number, h: number, pixelRatio: number) => void;
  render: () => void;
  /**
   * Adaptive quality: fed the real frame time; whenever frames stay slower than ~52 fps for
   * about two seconds, take one step lighter (see step). Never steps up, so it cannot
   * oscillate. Returns how many steps have been taken (0 = full quality).
   */
  adapt: (frameSeconds: number) => number;
  /** One step lighter: GTAO, then resolution in tenths to 60 %, then bloom (false when spent). */
  step: () => boolean;
  /** Resolution scale the governor has reached (1 … 0.6); the stage applies it on resize. */
  scale: () => number;
  /** Called when the scale changes (the stage resizes). */
  onScale: (fn: () => void) => void;
  /** Where the governor has got to, for evidence and tests. */
  state: () => Record<string, unknown>;
}

export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  tier: Tier,
  /** Start without GTAO (integrated graphics). */
  light = false,
): Pipeline {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const aoHidden: THREE.Object3D[] = [];
  let ao: GTAOPass | null = null;
  if (tier === "high") {
    ao = new GTAOPass(scene, camera, 1, 1);
    ao.blendIntensity = 0.8;
    ao.updateGtaoMaterial({
      radius: 0.35,
      distanceExponent: 1.4,
      thickness: 0.6,
      scale: 1,
      samples: 12,
    });
    ao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 5,
      rings: 2,
      samples: 12,
    });
    // The AO pre-pass re-renders the scene; the shadow maps are already current this frame.
    const aoPass = ao;
    const aoRender = aoPass.render.bind(aoPass);
    aoPass.render = ((...args: Parameters<GTAOPass["render"]>) => {
      const auto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      try {
        aoRender(...args);
      } finally {
        renderer.shadowMap.autoUpdate = auto;
      }
    }) as GTAOPass["render"];
    const patched = aoPass as unknown as VisibilityPatched;
    const original = patched._overrideVisibility.bind(aoPass);
    const hide = (o: THREE.Object3D) => {
      if (!o.visible) return;
      o.visible = false;
      patched._visibilityCache.push(o);
    };
    patched._overrideVisibility = () => {
      original();
      for (const o of aoHidden) hide(o);
      // Anything see-through (sprites, glows, foam, rings) would stamp opaque quads into the AO.
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if ((o as THREE.Sprite).isSprite || (m && !Array.isArray(m) && m.transparent)) hide(o);
      });
    };
    composer.addPass(aoPass);
    aoPass.enabled = !light;
  }
  composer.addPass(new ShaderPass(FiniteShader));

  // Bloom models lens glare: only energy above the threshold contributes (lantern paper, sun glints).
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.35, 2.2);
  const high = bloom.materialHighPassFilter;
  high.fragmentShader = high.fragmentShader.replace(
    "gl_FragColor = mix( outputColor, texel, alpha );",
    `vec3 above = texel.rgb * (max(v - luminosityThreshold, 0.0) / max(v, 1e-4));
      above *= min(1.0, 8.0 / max(luminance(above), 1e-4));
      gl_FragColor = vec4(above, 1.0);`,
  );
  high.needsUpdate = true;
  composer.addPass(bloom);
  // A restrained linear grade before tone mapping: AgX is faithful but desaturates, so colour is
  // given back here (saturation about luminance), keeping the warm key and green world vivid.
  composer.addPass(
    new ShaderPass({
      name: "LeafGrade",
      uniforms: { tDiffuse: { value: null }, saturation: { value: 1.22 } },
      vertexShader:
        "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float saturation; varying vec2 vUv;
void main() {
  vec4 t = texture2D(tDiffuse, vUv);
  float y = dot(t.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(max(mix(vec3(y), t.rgb, saturation), 0.0), t.a);
}`,
    }),
  );
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  let steps = 0;
  let spent = false;
  let slowFor = 0;
  let average = 1 / 60;
  let scale = 1;
  let rescale = () => {};
  const step = () => {
    if (ao?.enabled) {
      ao.enabled = false;
      return true;
    }
    if (scale > 0.65) {
      scale = Math.max(0.6, scale - 0.1);
      rescale();
      return true;
    }
    if (bloom.enabled) {
      bloom.enabled = false;
      return true;
    }
    return false;
  };
  const adapt = (frameSeconds: number) => {
    if (frameSeconds <= 0 || spent) return steps;
    average += (Math.min(frameSeconds, 0.25) - average) * 0.1;
    // 19 ms, not 1/60 s: on a 60 Hz display the average hovers at 16.7 ms and jitter alone
    // would read as slow.
    slowFor = average > 0.019 ? slowFor + frameSeconds : 0;
    if (slowFor < 2) return steps;
    slowFor = 0;
    average = 1 / 60;
    if (step()) steps++;
    else spent = true;
    return steps;
  };

  return {
    adapt,
    step,
    scale: () => scale,
    onScale(fn) {
      rescale = fn;
    },
    state: () => ({
      tier,
      ao: ao?.enabled ?? false,
      bloom: bloom.enabled,
      pixelRatio: +renderer.getPixelRatio().toFixed(3),
      scale: +scale.toFixed(2),
    }),
    composer,
    hideFromAO: (o) => aoHidden.push(o),
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      ao?.setSize(w * pixelRatio, h * pixelRatio);
      const bloomScale = tier === "high" ? 1 : 0.5;
      bloom.setSize(w * pixelRatio * bloomScale, h * pixelRatio * bloomScale);
    },
    render: () => composer.render(),
  };
}
