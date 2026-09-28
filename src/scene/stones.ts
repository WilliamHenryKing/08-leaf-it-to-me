// Stones at a beetle's scale: pebbles on the bed and the waterline, boulders on the banks, all from
// Poly Haven scans (rock_moss_set_01/02), instanced per scanned piece with scale, rotation and
// slight hue jitter so no two read as clones, and wet where the water touches them.
import * as THREE from "three";
import { centreX, halfWidth } from "../game/course";
import type { Assets, RockSet } from "./assets";
import { bankHeight } from "./banks";
import { rng } from "./bankside";
import { wetLine } from "./wet";

interface Placement {
  x: number;
  y: number;
  r: number;
  under: boolean;
}

function scatter(count: number, pick: (n: number) => Placement | null) {
  const out: Placement[] = [];
  for (let guard = 0; out.length < count && guard < count * 4; guard++) {
    const p = pick(out.length);
    if (p) out.push(p);
  }
  return out;
}

function instanced(set: RockSet, places: Placement[], rand: () => number, sink: number) {
  const group = new THREE.Group();
  const material = wetLine(set.material.clone());
  const buckets: Placement[][] = set.pieces.map(() => []);
  places.forEach((p, i) => {
    buckets[i % buckets.length]?.push(p);
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  set.pieces.forEach((geo, k) => {
    const list = buckets[k] ?? [];
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((p, i) => {
      const jitter = 0.8 + rand() * 0.45;
      const r = p.r * jitter;
      pos.set(p.x, bankHeight(p.x, p.y) - r * sink, -p.y);
      e.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
      q.setFromEuler(e);
      s.set(r, r * (0.75 + rand() * 0.4), r);
      mesh.setMatrixAt(i, m.compose(pos, q, s));
      // Slight hue and value jitter over the scanned albedo.
      col.setHSL(0.08 + (rand() - 0.5) * 0.05, 0.12 + rand() * 0.1, 0.46 + rand() * 0.12);
      col.multiplyScalar(1.9);
      mesh.setColorAt(i, col);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

export function createStones(assets: Assets) {
  const group = new THREE.Group();
  const rand = rng(12);
  if (assets.pebbles) {
    // Every other pebble lies on the bed, seen through the clear shallows.
    const pebbles = scatter(440, (n) => {
      const y = -6 + rand() * 110;
      const side = rand() < 0.5 ? -1 : 1;
      const under = n % 2 === 0;
      const off = under ? -(0.35 + rand() ** 1.5 * 2.4) : -0.2 + rand() * 1.6;
      return {
        x: centreX(y) + side * (halfWidth(y) + off),
        y,
        r: under ? 0.12 + rand() ** 2 * 0.28 : 0.16 + rand() ** 2 * 0.38,
        under,
      };
    });
    group.add(instanced(assets.pebbles, pebbles, rand, 0.25));
  }
  if (assets.boulders) {
    // A few boulders along the banks, half-bedded in the earth.
    const boulders = scatter(70, () => {
      const y = -6 + rand() * 110;
      const side = rand() < 0.5 ? -1 : 1;
      return {
        x: centreX(y) + side * (halfWidth(y) + 0.3 + rand() ** 1.4 * 5),
        y,
        r: 0.45 + rand() ** 2 * 0.9,
        under: false,
      };
    });
    group.add(instanced(assets.boulders, boulders, rand, 0.3));
  }
  if (assets.stump) {
    // Three mossy stumps on the banks: trees felled long ago, towering at this scale.
    for (const [u, y, h, spin] of [
      [-8.5, 14, 3.4, 0.4],
      [8.2, 57, 4.2, 2.1],
      [-10.5, 90, 3.8, 4.4],
    ] as [number, number, number, number][]) {
      const stump = assets.stump.clone(true);
      const box = new THREE.Box3().setFromObject(stump);
      const k = h / Math.max(0.001, box.max.y - box.min.y);
      const x = centreX(y) + u;
      stump.scale.setScalar(k);
      stump.position.set(x, bankHeight(x, y) - box.min.y * k - 0.2, -y);
      stump.rotation.y = spin;
      stump.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      group.add(stump);
    }
  }
  return group;
}

/** One scanned rock for an obstacle of radius r, sitting in the water. */
export function scannedRock(set: RockSet, r: number, seed: number) {
  const rand = rng(seed);
  const geo = set.pieces[Math.floor(rand() * set.pieces.length)] ?? set.pieces[0];
  const mesh = new THREE.Mesh(geo, wetLine(set.material.clone()));
  mesh.scale.set(r * 1.12, r * (0.8 + rand() * 0.3), r * 1.12);
  mesh.position.y = -0.3 * r;
  mesh.rotation.y = rand() * Math.PI * 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
