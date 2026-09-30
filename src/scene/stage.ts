// Renderer, camera, light and atmosphere. One lighting model: a sun, a CC0 river HDRI as the
// environment (image-based light and reflections), and AgX tone mapping applied once, at the end
// of the post-processing chain (see pipeline.ts). Exposure is the only brightness control.
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { SceneLifetime } from "./lifetime";
import { createPipeline, type Pipeline } from "./pipeline";

export const PALETTE = {
  sun: new THREE.Color("#ffe2bd"),
};

/** Game (x across, y downstream) to world: downstream runs away from the camera (-Z). */
export const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

export type Tier = "high" | "low";

/**
 * Integrated or software graphics (from the GPU's name): the high tier then starts without
 * GTAO, which the governor would otherwise drop within seconds.
 */
function modestGpu(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = String(
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/nvidia|geforce|rtx|gtx|radeon (rx|pro)|amd radeon rx|apple m[2-9]/i.test(gpu);
  } catch {
    return true;
  }
}

/** Phones and ?tier=low skip ambient occlusion and use smaller shadow and bloom buffers. */
export function pickTier(): Tier {
  const asked = new URLSearchParams(location.search).get("tier");
  if (asked === "high" || asked === "low") return asked;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return coarse || Math.min(screen.width, screen.height) < 600 ? "low" : "high";
}

export interface Sky {
  env: THREE.Texture;
  background: THREE.Texture;
  /** Average horizon radiance of the HDRI (linear), for fog that matches the sky. */
  horizon: THREE.Color;
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  tier: Tier;
  pipeline: Pipeline;
  /** Resolves when both environments are loaded (captures wait for it). */
  ready: Promise<void>;
  skies: { day: Sky | null; dusk: Sky | null };
  resize: () => void;
  /** Fractions reserved by the gameplay HUD; title/capture composition remains independent. */
  insets: { top: number; bottom: number; left: number; right: number };
  prepareFrame: () => void;
  dispose: () => void;
  /** Keep the shadow frustum centred on what the camera sees, snapped to whole texels. */
  follow: (target: THREE.Vector3) => void;
  portrait: () => boolean;
  render: () => void;
  /**
   * Compile every shader before the first frame, once the day sky is in (an environment map
   * changes every standard program): in parallel where the browser allows, for the HDR target
   * the scene pass draws into (whose programs differ from on-screen ones); then draw everything
   * once with culling off so the driver finishes each program for the layouts and passes it
   * will meet (ANGLE builds its D3D shaders at the first draw). All behind the arrival veil.
   */
  precompile: () => Promise<void>;
}

const SHADOW_HALF = 12;

function horizonColour(tex: THREE.DataTexture) {
  const { width, height, data } = tex.image as { width: number; height: number; data: Uint16Array };
  const c = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let y = Math.floor(height * 0.47); y < height * 0.53; y++) {
    for (let x = 0; x < width; x += 4) {
      const k = (y * width + x) * 4;
      c.r += THREE.DataUtils.fromHalfFloat(data[k] ?? 0);
      c.g += THREE.DataUtils.fromHalfFloat(data[k + 1] ?? 0);
      c.b += THREE.DataUtils.fromHalfFloat(data[k + 2] ?? 0);
      n++;
    }
  }
  return c.multiplyScalar(1 / Math.max(1, n));
}

export function createStage(canvas: HTMLCanvasElement, owner = new SceneLifetime()): Stage {
  owner.assertAlive();
  let disposed = false;
  let warmed = false;
  let pendingSize = true;
  let width = 1;
  let height = 1;
  const tier = pickTier();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  // Within a pixel budget per tier (a high-density screen need not draw every device pixel),
  // times the governor's resolution scale; set on every resize.
  const pixelRatio = () =>
    Math.min(
      window.devicePixelRatio || 1,
      tier === "high" ? 2 : 1.5,
      Math.sqrt(
        (tier === "high" ? 3.7e6 : 1.2e6) / Math.max(1, canvas.clientWidth * canvas.clientHeight),
      ),
    ) * pipeline.scale();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fa98a");
  scene.fog = new THREE.Fog(new THREE.Color("#9fa98a"), 18, 52);
  scene.environmentIntensity = 1;
  scene.backgroundBlurriness = 0.35;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 140);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.name = "sun";
  sun.castShadow = true;
  const size = tier === "high" ? 2048 : 1024;
  sun.shadow.mapSize.set(size, size);
  const sc = sun.shadow.camera;
  sc.left = -SHADOW_HALF;
  sc.right = SHADOW_HALF;
  sc.top = SHADOW_HALF;
  sc.bottom = -SHADOW_HALF;
  sc.near = 1;
  sc.far = 60;
  const texel = (2 * SHADOW_HALF) / size;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = texel * 1.2;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  const pipeline = createPipeline(renderer, scene, camera, tier, tier === "high" && modestGpu());

  // The two skies: a green woodland river for the brook, a low forest sun for the pond at dusk.
  const skies: Stage["skies"] = { day: null, dusk: null };
  const loader = new HDRLoader();
  const base = `${import.meta.env.BASE_URL}env/`;
  const load = (file: string) =>
    loader.loadAsync(base + file).then((tex: THREE.DataTexture): Sky => {
      owner.resources.own(tex);
      owner.assertAlive();
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        const target = owner.resources.own(pmrem.fromEquirectangular(tex));
        return { env: target.texture, background: tex, horizon: horizonColour(tex) };
      } finally {
        pmrem.dispose();
      }
    });
  // The day sky comes first; the dusk sky is only needed at the pond, so it follows after.
  const ready = owner.wait(
    (async () => {
      try {
        const day = await load("river_walk_1_1k.hdr");
        skies.day = day;
        scene.environment = day.env;
        scene.background = day.background;
      } catch {
        owner.assertAlive();
      }
      try {
        skies.dusk = await load("sunset_forest_1k.hdr");
      } catch {
        owner.assertAlive();
      }
      owner.assertAlive();
    })(),
  );
  void ready.catch(() => {});

  const portrait = () => canvas.clientWidth / Math.max(1, canvas.clientHeight) < 0.8;

  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);
    width = w;
    height = h;
    pendingSize = true;
    camera.aspect = w / Math.max(1, h);
    camera.fov = portrait() ? 58 : 42;
    camera.updateProjectionMatrix();
  };
  const prepareFrame = () => {
    if (disposed || !pendingSize) return;
    pendingSize = false;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
    pipeline.setSize(width, height, renderer.getPixelRatio());
  };

  // A late-afternoon sun from upstream-left, fixed in direction.
  const toSun = new THREE.Vector3(-9, 14, 7).normalize();
  const right = new THREE.Vector3().crossVectors(toSun, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, toSun).normalize();
  const snapped = new THREE.Vector3();
  const follow = (target: THREE.Vector3) => {
    if (disposed) return;
    // Snap the frustum centre to the shadow texel grid so edges do not crawl as the boat moves.
    const r = Math.round(target.dot(right) / texel) * texel;
    const u = Math.round(target.dot(up) / texel) * texel;
    const d = target.dot(toSun);
    snapped.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(toSun, d);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).addScaledVector(toSun, 30);
  };

  pipeline.onScale(resize);

  let preparing: Promise<void> | null = null;
  const precompile = () => {
    if (preparing) return preparing;
    preparing = owner.wait(
      (async () => {
        await ready;
        owner.assertAlive();
        prepareFrame();
        const previous = renderer.getRenderTarget();
        let compiling: Promise<unknown>;
        try {
          renderer.setRenderTarget(pipeline.composer.readBuffer);
          compiling = renderer.compileAsync(scene, camera);
        } finally {
          renderer.setRenderTarget(previous);
        }
        await owner.wait(compiling);
        owner.assertAlive();
        const culled: THREE.Object3D[] = [];
        try {
          scene.traverse((o) => {
            if (o.frustumCulled) {
              o.frustumCulled = false;
              culled.push(o);
            }
          });
          pipeline.render();
          warmed = true;
        } finally {
          for (const o of culled) o.frustumCulled = true;
        }
      })(),
    );
    void preparing.catch(() => {});
    return preparing;
  };

  resize();

  return {
    renderer,
    scene,
    camera,
    sun,
    tier,
    pipeline,
    ready,
    skies,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    resize,
    prepareFrame,
    dispose() {
      if (disposed) return;
      disposed = true;
      owner.resources.tree(scene);
      scene.environment = null;
      scene.background = null;
      owner.dispose();
      pipeline.dispose();
      scene.clear();
      skies.day = skies.dusk = null;
      renderer.dispose();
    },
    follow,
    portrait,
    render: () => {
      if (!disposed && warmed) {
        prepareFrame();
        pipeline.render();
      }
    },
    precompile,
  };
}
