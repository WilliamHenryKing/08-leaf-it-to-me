import type { Recipes } from "./kit/build";
import {
  bend,
  blend,
  box,
  capsule,
  carve,
  chain,
  cone,
  cylinder,
  displace,
  ellipsoid,
  extrude,
  fbm,
  lathe,
  type Mat,
  mat,
  mirrorX,
  mottle,
  move,
  type Node,
  paint,
  polygon2,
  radial,
  rng,
  rotate,
  scale,
  sphere,
  subtract,
  torus,
  union,
  type Vec3,
} from "./kit/sdf";

const pick = <T>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)] as T;
const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
void [bend, blend, box, capsule, carve, chain, cone, cylinder, displace, ellipsoid, extrude, fbm, lathe, mirrorX, mottle, move, paint, polygon2, radial, rotate, scale, sphere, subtract, torus, union];
type Build = (seed: number, index: number) => Node;
void (0 as unknown as Mat | Vec3 | Build);

// LEAF IT TO ME — the macro river world: leaves of many species (the boat and the river's
// litter), pebbles, twigs, droplets and beetle studies for the tiny passenger. Metres at 1:1.
const GREENS = [0x5f8a3a, 0x7a9a42, 0x4a7a3a, 0x8aa84a];
const AUTUMN = [0xc86a2a, 0xd9a441, 0xa8452a, 0xe0b45a, 0x8a5a2a];
function leafShape(kind: number, L: number, W: number) {
  return (x: number, y: number) => {
    // y along the midrib from -L/2 (stem) to L/2 (tip); x across.
    const t = Math.min(1, Math.max(0, y / L + 0.5));
    let half = W / 2;
    if (kind === 0) half *= Math.sin(Math.PI * t) ** 0.8; // ovate
    else if (kind === 1) half *= Math.sin(Math.PI * t) ** 1.6 * 0.6; // lanceolate
    else if (kind === 2) half *= Math.sin(Math.PI * t ** 0.8) * (1 + 0.25 * Math.cos(t * Math.PI)); // cordate
    else if (kind === 3) half *= Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.abs(Math.sin(t * Math.PI * 5))); // oak lobes
    else half *= Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.abs(Math.cos(Math.atan2(x, y) * 5))); // maple-like
    const inside = Math.abs(x) - half;
    const ends = Math.abs(y) - L / 2;
    return Math.max(inside, ends) * 0.7;
  };
}
const leaf: Build = (seed, index) => {
  const r = rng(seed);
  const kind = index % 5;
  const L = range(r, 0.05, 0.16);
  const W = L * range(r, 0.4, 0.8);
  const colour = mat(pick(r, r() < 0.5 ? GREENS : AUTUMN), 0.55);
  const vein = mat(0xd9c98a, 0.6);
  let blade: Node = extrude(leafShape(kind, L, W), [-W, -L / 2, W, L / 2], L * 0.012, L * 0.004, colour);
  for (let i = 0; i < 6; i++) {
    const y = -L * 0.35 + (i * L * 0.7) / 6;
    blade = carve(L * 0.004, blade, capsule([0, y, L * 0.006], [W * 0.45, y + L * 0.12, L * 0.006], L * 0.004, L * 0.002));
    blade = carve(L * 0.004, blade, capsule([0, y, L * 0.006], [-W * 0.45, y + L * 0.12, L * 0.006], L * 0.004, L * 0.002));
  }
  const rib = capsule([0, -L * 0.62, 0], [0, L * 0.45, 0], L * 0.012, L * 0.004, vein);
  const curled = bend(rotate(union(blade, rib), [Math.PI / 2, 0, 0]), Math.min(range(r, 2, 14) * 0.05 / L, 12));
  return mottle(curled, 0.12, 60 / L, seed);
};
const pebble: Build = (seed) => {
  const r = rng(seed);
  const s = range(r, 0.01, 0.05);
  const stone = mat(pick(r, [0x5a5f63, 0x7a6a5a, 0x3f4a4f, 0x8a8278, 0x6a4f3f]), 0.25);
  return mottle(displace(ellipsoid(s, s * range(r, 0.3, 0.6), s * range(r, 0.6, 1), stone), s * 0.06, 3 / s, 4, seed), 0.2, 8 / s, seed);
};
const twig: Build = (seed) => {
  const r = rng(seed);
  const bark = mat(pick(r, [0x5a4636, 0x6a5242, 0x4a3a2e]), 0.9);
  const len = range(r, 0.08, 0.25);
  const pts: Vec3[] = [];
  for (let i = 0; i <= 5; i++) pts.push([(i / 5) * len, Math.sin(i * 1.7 + r() * 2) * len * 0.05, Math.cos(i * 1.3) * len * 0.04]);
  const parts: Node[] = [chain(pts, len * 0.03, len * 0.012, bark, len * 0.01)];
  for (let i = 0; i < 2; i++) {
    const at = pts[1 + Math.floor(r() * 3)] as Vec3;
    parts.push(chain([at, [at[0] + len * 0.2, at[1] + len * 0.15 * (r() < 0.5 ? 1 : -1), at[2] + len * 0.1]], len * 0.015, len * 0.006, bark));
  }
  return displace(union(...parts), len * 0.002, 200 / len, 2, seed);
};
const droplet: Build = (seed) => {
  const r = rng(seed);
  const s = range(r, 0.002, 0.008);
  return subtract(ellipsoid(s, s * 0.7, s, mat(0xcfe3e6, 0.02)), move(box(1, 1, 1), [0, -0.5 - s * 0.35, 0]));
};
const beetle: Build = (seed) => {
  const r = rng(seed);
  const shell = mat(pick(r, [0x2a5a3a, 0x7a1f1f, 0x1f3a6a, 0x3a2a1a, 0xc8a02a]), 0.25, 0.3);
  const dark = mat(0x1a1a1a, 0.5);
  const s = range(r, 0.008, 0.014);
  const body = move(ellipsoid(s * 0.8, s * 0.55, s, shell), [0, s * 0.6, 0]);
  const seam = move(box(s * 0.02, s * 0.2, s * 2, 0, dark), [0, s * 1.1, 0]);
  const head = move(ellipsoid(s * 0.4, s * 0.3, s * 0.35, dark), [0, s * 0.5, s * 1.05]);
  const legs = mirrorX(union(...[-0.5, 0, 0.5].map((t) => chain([[s * 0.5, s * 0.4, t * s], [s * 1.1, s * 0.5, t * s * 1.2], [s * 1.35, 0, t * s * 1.4]], s * 0.06, s * 0.04, dark))));
  const antennae = mirrorX(chain([[s * 0.15, s * 0.6, s * 1.3], [s * 0.4, s * 0.9, s * 1.8], [s * 0.6, s * 1.0, s * 2.1]], s * 0.03, s * 0.02, dark));
  return union(body, seam, head, legs, antennae);
};

export const project = { id: "08-leaf-it-to-me", name: "LEAF IT TO ME", background: 0x26352f };
export const families: Recipes["families"] = [
  { id: "leaf", count: 60, voxel: 0.0005, keep: 0.25, elevation: 62, build: leaf },
  { id: "pebble", count: 80, voxel: 0.0008, keep: 0.25, build: pebble },
  { id: "twig", count: 40, voxel: 0.0008, keep: 0.3, build: twig },
  { id: "droplet", count: 8, voxel: 0.0002, keep: 0.4, build: droplet },
  { id: "beetle-study", count: 12, voxel: 0.0002, keep: 0.3, hero: true, build: beetle },
];
export const textures: Recipes["textures"] = [
  { id: "leaf-lamina", ramp: [0x3f6a2a, 0x5f8a3a, 0x7aa84a], layers: [{ kind: "cells", count: 24, crack: true }, { kind: "fbm", scale: 16, weight: 0.5 }], roughness: [0.4, 0.6], normal: 1.2 },
  { id: "autumn-leaf", ramp: [0x8a3a1a, 0xc86a2a, 0xe0b45a], layers: [{ kind: "cells", count: 20, crack: true }, { kind: "fbm", scale: 8, weight: 0.8 }], roughness: [0.5, 0.7], normal: 1.2 },
  { id: "wet-pebble", ramp: [0x2f3438, 0x5a5f63, 0x7a7f83], layers: [{ kind: "fbm", scale: 12, octaves: 6 }, { kind: "cells", count: 50, weight: 0.3 }], roughness: [0.1, 0.35], normal: 1 },
  { id: "river-bark", ramp: [0x3a2e24, 0x5a4636, 0x7a6252], layers: [{ kind: "fibres", scale: 12, stretch: 8 }, { kind: "cells", count: 16, crack: true, weight: 0.5 }], roughness: [0.8, 0.95], normal: 2.5 },
];
