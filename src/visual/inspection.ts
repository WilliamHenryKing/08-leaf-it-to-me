// window.__VISUAL_TEST__: a capture hook for visual review (dev builds and ?e2e only). It jumps to
// a bookmark, freezes time and reports what the renderer is actually doing. Adapted from the
// inspection hook in ODD TIDE.
import { Mesh, REVISION, type Scene, type WebGLRenderer } from "three";
import { BOOKMARKS } from "./bookmarks";

export interface VisualAdapter {
  renderer: WebGLRenderer;
  scene: Scene;
  apply(id: string): void;
  freeze(): void;
  render(): void;
}

export interface VisualTest {
  ready: Promise<void>;
  bookmarks: { id: string; purpose: string; hero: boolean; size: [number, number, number] }[];
  setBookmark(id: string): Promise<{ bookmark: string }>;
  freeze(): void;
  settle(frames?: number): Promise<void>;
  info(): Record<string, unknown>;
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
  return {
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
  };
  window.__VISUAL_TEST__ = api;
}
