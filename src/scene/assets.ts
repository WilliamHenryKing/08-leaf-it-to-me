// Sourced CC0 assets (see assets.manifest.json): Poly Haven scans and PBR texture sets, loaded
// behind the arrival veil. Everything is optional: if a file fails, the procedural stand-in stays.
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SceneLifetime } from "./lifetime";

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** Ambient occlusion (R), roughness (G), metalness (B): linear. */
  arm: THREE.Texture;
}

export interface RockSet {
  /** Each rock of a scanned set, centred on its base, unit radius in the ground plane. */
  pieces: THREE.BufferGeometry[];
  material: THREE.MeshStandardMaterial;
}

export interface Assets {
  bed: PbrSet | null;
  mud: PbrSet | null;
  leaves: PbrSet | null;
  bark: PbrSet | null;
  /** Full-resolution scans for the few rocks in the water. */
  rocks: RockSet | null;
  /** Simplified scans (about a tenth of the triangles) for bank boulders. */
  boulders: RockSet | null;
  pebbles: RockSet | null;
  pot: THREE.Object3D | null;
  stump: THREE.Object3D | null;
}

const base = `${import.meta.env.BASE_URL}`;
const owners = new WeakMap<Assets, SceneLifetime>();

export function assetsOwner(assets: Assets) {
  let owner = owners.get(assets);
  if (!owner) {
    owner = new SceneLifetime();
    owners.set(assets, owner);
  }
  return owner;
}
export function disposeAssets(assets: Assets) {
  assetsOwner(assets).dispose();
}

/** Split a merged scan into its separate rocks (connected components of the index buffer). */
/** Quantized glTF attributes (int16/int8, normalized) become plain floats before any editing. */
function dequantize(src: THREE.BufferGeometry) {
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as THREE.BufferAttribute;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) geo.setIndex(Array.from(src.index.array as ArrayLike<number>));
  return geo;
}

export function splitPieces(source: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const geo = dequantize(source);
  const index = geo.index;
  const pos = geo.getAttribute("position");
  if (!index || !pos) return [geo];
  const parent = new Int32Array(pos.count).map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    while (parent[i] !== r) {
      const next = parent[i] as number;
      parent[i] = r;
      i = next;
    }
    return r;
  };
  // Scans often duplicate vertices along UV seams: join those by position too.
  const byPos = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const seen = byPos.get(key);
    if (seen === undefined) byPos.set(key, i);
    else parent[find(i)] = find(seen);
  }
  for (let t = 0; t < index.count; t += 3) {
    const a = find(index.getX(t));
    parent[find(index.getX(t + 1))] = a;
    parent[find(index.getX(t + 2))] = a;
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < index.count; t += 3) {
    const root = find(index.getX(t));
    let list = groups.get(root);
    if (!list) {
      list = [];
      groups.set(root, list);
    }
    list.push(index.getX(t), index.getX(t + 1), index.getX(t + 2));
  }
  const pieces: THREE.BufferGeometry[] = [];
  for (const tris of groups.values()) {
    if (tris.length < 60) continue;
    const g = geo.clone();
    g.setIndex(tris);
    const compact = g.toNonIndexed();
    compact.computeBoundingBox();
    const box = compact.boundingBox as THREE.Box3;
    const c = box.getCenter(new THREE.Vector3());
    compact.translate(-c.x, -box.min.y, -c.z);
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z) / 2 || 1;
    compact.scale(1 / r, 1 / r, 1 / r);
    // Scanned normals are kept (smooth); only the bounds are recomputed.
    compact.computeBoundingSphere();
    pieces.push(compact);
    g.dispose();
  }
  if (!pieces.length) return [geo];
  geo.dispose();
  return pieces;
}

async function loadSet(owner: SceneLifetime, name: string, repeat = 1): Promise<PbrSet | null> {
  const loader = new THREE.TextureLoader();
  const url = (kind: string) => `${base}textures/${name}/${name}_${kind}_1k.webp`;
  try {
    const loaded = await Promise.allSettled(
      ["diff", "nor_gl", "arm"].map((k) =>
        loader.loadAsync(url(k)).then((texture) => owner.resources.own(texture)),
      ),
    );
    owner.assertAlive();
    if (loaded.some((result) => result.status === "rejected")) {
      for (const result of loaded)
        if (result.status === "fulfilled") owner.resources.release(result.value);
      return null;
    }
    const [map, normalMap, arm] = loaded.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    );
    if (!map || !normalMap || !arm) return null;
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, arm]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.repeat.setScalar(repeat);
      t.name = name;
    }
    return { map, normalMap, arm };
  } catch {
    owner.assertAlive();
    return null;
  }
}

async function loadModel(owner: SceneLifetime, file: string): Promise<THREE.Object3D | null> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  try {
    const url = `${base}models/${file}`;
    const response = await fetch(url, { signal: owner.signal });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    owner.assertAlive();
    const gltf = await loader.parseAsync(bytes, url.slice(0, url.lastIndexOf("/") + 1));
    owner.resources.tree(gltf.scene);
    owner.assertAlive();
    return gltf.scene;
  } catch {
    owner.assertAlive();
    return null;
  }
}

function firstMesh(root: THREE.Object3D | null) {
  let found: THREE.Mesh | null = null;
  root?.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  return found as THREE.Mesh | null;
}

function rockSet(owner: SceneLifetime, root: THREE.Object3D | null): RockSet | null {
  const mesh = firstMesh(root);
  if (!mesh) return null;
  const material = (mesh.material as THREE.MeshStandardMaterial).clone();
  owner.resources.material(material);
  material.side = THREE.FrontSide;
  const pieces = splitPieces(mesh.geometry);
  for (const piece of pieces) owner.resources.own(piece);
  return { pieces, material };
}

export async function loadAssets(signal?: AbortSignal): Promise<Assets> {
  const owner = new SceneLifetime(signal);
  owner.assertAlive();
  try {
    const [bed, mud, leaves, bark, rocks, boulders, pebbles, pot, stump] = await owner.wait(
      Promise.all([
        loadSet(owner, "clean_pebbles"),
        loadSet(owner, "mud_forest"),
        loadSet(owner, "brown_mud_leaves_01"),
        loadSet(owner, "bark_brown_02"),
        loadModel(owner, "rock_moss_set_01.glb"),
        loadModel(owner, "rock_moss_set_01_lod.glb"),
        loadModel(owner, "rock_moss_set_02_lod.glb"),
        loadModel(owner, "planter_pot_clay.glb"),
        loadModel(owner, "tree_stump_01.glb"),
      ]),
    );
    const assets: Assets = {
      bed,
      mud,
      leaves,
      bark,
      rocks: rockSet(owner, rocks),
      boulders: rockSet(owner, boulders),
      pebbles: rockSet(owner, pebbles),
      pot,
      stump,
    };
    owners.set(assets, owner);
    return assets;
  } catch (error) {
    owner.dispose();
    throw error;
  }
}
