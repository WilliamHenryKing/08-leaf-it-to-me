// Renderer, camera, light and atmosphere: a warm late-afternoon light over the brook.
import * as THREE from "three";

export const PALETTE = {
  haze: new THREE.Color("#c7b98f"),
  sun: new THREE.Color("#ffd6a0"),
  sky: new THREE.Color("#a9c6cf"),
  ground: new THREE.Color("#4a5a2a"),
};

/** Game (x across, y downstream) to world: downstream runs away from the camera (-Z). */
export const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  resize: () => void;
  /** Keep the shadow frustum centred on what the camera sees. */
  follow: (target: THREE.Vector3) => void;
  portrait: () => boolean;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = PALETTE.haze.clone();
  scene.fog = new THREE.Fog(PALETTE.haze, 16, 46);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 120);

  const hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -14;
  sc.right = 14;
  sc.top = 14;
  sc.bottom = -14;
  sc.near = 1;
  sc.far = 50;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const portrait = () => canvas.clientWidth / Math.max(1, canvas.clientHeight) < 0.8;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.fov = portrait() ? 58 : 42;
    camera.updateProjectionMatrix();
  };

  const follow = (target: THREE.Vector3) => {
    sun.target.position.copy(target);
    sun.position.set(target.x - 9, 14, target.z + 7);
  };

  return { renderer, scene, camera, sun, hemi, resize, follow, portrait };
}
