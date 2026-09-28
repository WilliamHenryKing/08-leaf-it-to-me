// Macro bankside detail: towering grass, pebbles, clover canopies, reeds and mushrooms.
// At a beetle's scale these are trees and boulders; the canopies are the wind shadows.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Course } from "../game/course";
import { centreX, halfWidth } from "../game/course";
import type { Assets } from "./assets";
import { bankHeight, outside } from "./banks";
import { createFlora } from "./flora";
import { translucent } from "./skins";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tapered, curving blade of grass, 1 unit tall. */
function bladeGeometry() {
  // A folded blade: left edge, raised midrib, right edge; darker at the base, paler at the tip.
  const segs = 7;
  const pts: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.09 * (1 - t) ** 0.8;
    const bend = t * t * 0.35;
    const fold = 0.022 * (1 - t);
    pts.push(-w, t, bend, 0, t, bend - fold, w, t, bend);
    const shade = 0.55 + 0.55 * t;
    col.push(
      shade * 0.92,
      shade,
      shade * 0.85,
      shade * 1.05,
      shade * 1.05,
      shade,
      shade * 0.92,
      shade,
      shade * 0.85,
    );
    if (i < segs) {
      const k = i * 3;
      idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A clover leaf: three heart-shaped leaflets on a flat plane, radius about 1. */
function cloverGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.45, 0.15, 0.7, 0.7, 0.35, 0.95);
  shape.bezierCurveTo(0.2, 1.02, 0.05, 0.95, 0, 0.82);
  shape.bezierCurveTo(-0.05, 0.95, -0.2, 1.02, -0.35, 0.95);
  shape.bezierCurveTo(-0.7, 0.7, -0.45, 0.15, 0, 0);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.ShapeGeometry(shape, 8);
    g.rotateZ((i * Math.PI * 2) / 3);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  merged.rotateX(-Math.PI / 2);
  return merged;
}

export function createBankside(course: Course, assets: Assets) {
  const group = new THREE.Group();
  const rand = rng(8);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();

  // Grass: dense near the water, towering over the leaf.
  const blades = new THREE.InstancedMesh(
    bladeGeometry(),
    translucent(
      new THREE.MeshStandardMaterial({
        roughness: 0.62,
        side: THREE.DoubleSide,
        vertexColors: true,
      }),
      0.55,
    ),
    1400,
  );
  let n = 0;
  while (n < blades.count) {
    const y = -8 + rand() * 116;
    const side = rand() < 0.5 ? -1 : 1;
    const x = centreX(y) + side * (halfWidth(y) + 0.3 + rand() ** 1.6 * 9);
    if (outside(x, y) < 0.25) continue;
    const h = 1.6 + rand() * 3.2;
    p.set(x, bankHeight(x, y) - 0.1, -y);
    e.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, -side * rand() * 0.35);
    q.setFromEuler(e);
    s.set(0.8 + rand() * 0.8, h, 1);
    blades.setMatrixAt(n, m.compose(p, q, s));
    col.setHSL(0.2 + rand() * 0.07, 0.45 + rand() * 0.2, 0.2 + rand() * 0.14);
    blades.setColorAt(n, col);
    n++;
  }
  blades.castShadow = true;
  blades.receiveShadow = true;
  group.add(blades);

  // Procedural pebbles, only if the scanned stones (stones.ts) failed to load.
  if (!assets.pebbles) {
    const pebbleGeo = new THREE.IcosahedronGeometry(1, 2);
    const pp = pebbleGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      // Smooth, position-based lumps keep neighbouring vertices together: river-worn, not crumpled.
      const x = pp.getX(i);
      const y = pp.getY(i);
      const z = pp.getZ(i);
      const f = 1 + 0.1 * Math.sin(x * 2.1 + z * 1.3) + 0.06 * Math.sin(y * 3.1 - x * 1.7);
      pp.setXYZ(i, x * f, y * f * 0.62, z * f);
    }
    pebbleGeo.computeVertexNormals();
    const pebbles = new THREE.InstancedMesh(
      pebbleGeo,
      new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      560,
    );
    n = 0;
    while (n < pebbles.count) {
      const y = -6 + rand() * 110;
      const side = rand() < 0.5 ? -1 : 1;
      // Every other pebble lies on the bed, seen through the clear shallows.
      const under = n % 2 === 0;
      const off = under ? -(0.35 + rand() ** 1.5 * 2.4) : -0.15 + rand() * 2.2;
      const x = centreX(y) + side * (halfWidth(y) + off);
      const r = under ? 0.12 + rand() ** 2 * 0.3 : 0.18 + rand() ** 2 * 0.6;
      p.set(x, bankHeight(x, y) + r * 0.2, -y);
      e.set(rand() * 0.5, rand() * 6, rand() * 0.5);
      q.setFromEuler(e);
      s.setScalar(r);
      pebbles.setMatrixAt(n, m.compose(p, q, s));
      col.setHSL(0.07 + rand() * 0.06, 0.1 + rand() * 0.14, (under ? 0.26 : 0.2) + rand() * 0.18);
      pebbles.setColorAt(n, col);
      n++;
    }
    pebbles.castShadow = true;
    pebbles.receiveShadow = true;
    group.add(pebbles);
  }

  group.add(createFlora(course, rand, cloverGeometry()));
  return group;
}

export function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, tapered = true) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 16, radius, 7, false);
  if (tapered) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const rings = 17;
    const perRing = pos.count / rings;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.floor(i / perRing) / (rings - 1);
      const c = curve.getPoint(t);
      const k = 1 - t * 0.55;
      pos.setXYZ(
        i,
        c.x + (pos.getX(i) - c.x) * k,
        c.y + (pos.getY(i) - c.y) * k,
        c.z + (pos.getZ(i) - c.z) * k,
      );
    }
    geo.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
