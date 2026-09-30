// window.__VISUAL_TEST__: a capture hook for visual review (dev builds and ?e2e only). It jumps to
// a bookmark, freezes time and reports what the renderer is actually doing. Adapted from the
// inspection hook in ODD TIDE.
import {
  type Camera,
  Mesh,
  Raycaster,
  REVISION,
  type Scene,
  Vector2,
  type WebGLRenderer,
} from "three";
import { BOOKMARKS } from "./bookmarks";

export interface VisualAdapter {
  renderer: WebGLRenderer;
  /** Resolves when textures and environments have loaded. */
  loaded: Promise<unknown>;
  scene: Scene;
  camera: Camera;
  apply(id: string): void;
  freeze(): void;
  render(): void;
  quality(): Record<string, unknown>;
  degrade(): boolean;
}

export interface VisualTest {
  ready: Promise<void>;
  bookmarks: { id: string; purpose: string; hero: boolean; size: [number, number, number] }[];
  setBookmark(id: string): Promise<{ bookmark: string }>;
  freeze(): void;
  settle(frames?: number): Promise<void>;
  info(): Record<string, unknown>;
  /** The frame-time governor's state, and one step down as a slow run would take. */
  quality(): Record<string, unknown>;
  degrade(): boolean;
  /** What lies under a screen point (0..1, from top-left): for tracking down artefacts. */
  pick(x: number, y: number): { type: string; name: string; material: string; parent: string }[];
}

declare global {
  interface Window {
    __VISUAL_TEST__?: VisualTest;
  }
}

export const visualTestEnabled = () =>
  import.meta.env.DEV || new URLSearchParams(location.search).has("e2e");

function inspect(renderer: WebGLRenderer, scene: Scene) {
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String(
    debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  );
  let meshes = 0;
  let instances = 0;
  let triangles = 0;
  const lights: { type: string; intensity: number }[] = [];
  const materials = new Set<string>();
  scene.traverse((o) => {
    if ("isLight" in o && o.isLight) {
      const l = o as unknown as { type: string; intensity: number };
      lights.push({ type: l.type, intensity: l.intensity });
    }
    if (!(o instanceof Mesh)) return;
    meshes++;
    const n =
      "isInstancedMesh" in o && o.isInstancedMesh ? (o as unknown as { count: number }).count : 1;
    instances += n;
    const g = o.geometry;
    triangles += ((g.index?.count ?? g.getAttribute("position")?.count ?? 0) / 3) * n;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m.type);
  });
  let groundEdge: number[] | null = null;
  scene.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && (m.material as { name?: string }).name === "ground") {
      const a = m.geometry.getAttribute("aEdge");
      if (a) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < a.count; i++) {
          lo = Math.min(lo, a.getX(i));
          hi = Math.max(hi, a.getX(i));
        }
        groundEdge = [lo, hi];
      }
    }
  });
  return {
    groundEdge,
    gpu,
    softwareRenderer: /swiftshader|llvmpipe|software/i.test(gpu),
    three: REVISION,
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    environment: Boolean(scene.environment),
    pixelRatio: renderer.getPixelRatio(),
    drawCalls: renderer.info.render.calls,
    rendererTriangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    meshes,
    instances,
    sceneTriangles: Math.round(triangles),
    lights,
    materialTypes: [...materials],
    assetBytes: performance
      .getEntriesByType("resource")
      .reduce((a, e) => a + ((e as PerformanceResourceTiming).decodedBodySize || 0), 0),
  };
}

export function installVisualTest(adapter: VisualAdapter) {
  let bookmark = "unselected";
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const api: VisualTest = {
    ready: (async () => {
      await document.fonts.ready;
      await adapter.loaded;
      for (let i = 0; i < 3; i++) await frame();
    })(),
    bookmarks: BOOKMARKS.map(({ id, purpose, hero, size }) => ({ id, purpose, hero, size })),
    async setBookmark(id) {
      if (!BOOKMARKS.some((b) => b.id === id)) throw new Error(`Unknown bookmark: ${id}`);
      adapter.apply(id);
      bookmark = id;
      return { bookmark };
    },
    freeze: adapter.freeze,
    async settle(frames = 20) {
      for (let i = 0; i < frames; i++) {
        await frame();
        adapter.render();
      }
    },
    info: () => ({ bookmark, ...inspect(adapter.renderer, adapter.scene) }),
    quality: () => adapter.quality(),
    degrade: () => adapter.degrade(),
    pick(x, y) {
      const ray = new Raycaster();
      ray.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), adapter.camera);
      const seen = (o: unknown) => {
        const m = (o as Mesh).material as { opacity?: number; visible?: boolean } | undefined;
        return !m || ((m.opacity ?? 1) > 0.01 && m.visible !== false);
      };
      return ray
        .intersectObject(adapter.scene, true)
        .filter((h) => h.object.visible && seen(h.object))
        .slice(0, 4)
        .map((h) => {
          const m = (h.object as Mesh).material as { type?: string; name?: string } | undefined;
          const g = (h.object as Mesh).geometry as { type?: string } | undefined;
          return {
            type: `${h.object.type}/${g?.type ?? ""}`,
            name: h.object.name,
            material: `${m?.type ?? ""}${m?.name ? ` ${m.name}` : ""}`,
            parent: `${h.object.parent?.type ?? ""} at ${h.point
              .toArray()
              .map((v) => v.toFixed(2))
              .join(",")}`,
          };
        });
    },
  };
  window.__VISUAL_TEST__ = api;
}
