// Macro bankside detail: towering grass, pebbles, clover canopies, reeds and mushrooms.
// At a beetle's scale these are trees and boulders; the canopies are the wind shadows.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Course } from "../game/course";
import { centreX, halfWidth } from "../game/course";
import { bankHeight, outside } from "./banks";

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
  const segs = 5;
  const pts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.09 * (1 - t) ** 0.8;
    const bend = t * t * 0.35;
    pts.push(-w, t, bend, w, t, bend);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
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

export function createBankside(course: Course) {
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
    new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
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

  // Pebbles along the waterline, boulders at this scale.
  const pebbleGeo = new THREE.IcosahedronGeometry(1, 2);
  const pp = pebbleGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) {
    const f = 1 + (Math.sin(i * 12.9898) * 0.5 - 0.25) * 0.25;
    pp.setXYZ(i, pp.getX(i) * f, pp.getY(i) * f * 0.7, pp.getZ(i) * f);
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

  const leafMat = new THREE.MeshStandardMaterial({
    color: "#4f7a2a",
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const stemMat = new THREE.MeshStandardMaterial({ color: "#6b7f36", roughness: 0.8 });
  const reedMat = new THREE.MeshStandardMaterial({ color: "#7c8a3f", roughness: 0.75 });
  const clover = cloverGeometry();
  for (const sh of course.shelters) {
    if (sh.kind === "clover") {
      // Clover leaves arch over the lane from the bank: the wind shadow you can see.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + rand();
        const cx = sh.c.x + Math.cos(a) * sh.r * 0.45 + 1.2;
        const cy = sh.c.y + Math.sin(a) * sh.r * 0.55;
        const top = 2.2 + rand() * 0.9;
        const leaf = new THREE.Mesh(clover, leafMat);
        leaf.position.set(cx, top, -cy);
        leaf.rotation.set((rand() - 0.5) * 0.3, rand() * 6, (rand() - 0.5) * 0.3);
        leaf.scale.setScalar(1.3 + rand() * 0.5);
        leaf.castShadow = true;
        const baseX = sh.c.x + sh.r + 1.5;
        const stem = tube(
          [
            new THREE.Vector3(baseX, 0.3, -cy),
            new THREE.Vector3(cx + 1, top + 0.4, -cy),
            new THREE.Vector3(cx, top, -cy),
          ],
          0.07,
          stemMat,
        );
        group.add(leaf, stem);
      }
    } else if (sh.kind === "reeds") {
      for (let i = 0; i < 26; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * sh.r;
        const x = sh.c.x + Math.cos(a) * r - 1.4;
        const y = sh.c.y + Math.sin(a) * r;
        const h = 3 + rand() * 3;
        const lean = new THREE.Vector3((rand() - 0.3) * 0.8, h, (rand() - 0.5) * 0.6);
        const base = new THREE.Vector3(x, -0.3, -y);
        const reed = tube(
          [base, base.clone().add(lean.clone().multiplyScalar(0.5)), base.clone().add(lean)],
          0.06,
          reedMat,
        );
        group.add(reed);
        if (rand() < 0.35) {
          const head = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.13, 0.5, 4, 8),
            new THREE.MeshStandardMaterial({ color: "#5a3a1e", roughness: 0.9 }),
          );
          head.position
            .copy(base)
            .add(lean)
            .add(new THREE.Vector3(0, 0.1, 0));
          head.castShadow = true;
          group.add(head);
        }
      }
    }
  }

  // Mushrooms on the banks: parasols overhead.
  const capMat = new THREE.MeshStandardMaterial({ color: "#b0532c", roughness: 0.6 });
  const gillMat = new THREE.MeshStandardMaterial({ color: "#e9dcc0", roughness: 0.8 });
  for (const [x, y, sc] of [
    [-6, 8, 1],
    [6.5, 40, 1.3],
    [-7.8, 60, 0.9],
    [9.5, 95, 1.2],
  ] as [number, number, number][]) {
    const gx = centreX(y) + x;
    const g = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.6, 10), gillMat);
    stalk.position.y = 0.8;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      capMat,
    );
    cap.scale.y = 0.55;
    cap.position.y = 1.55;
    stalk.castShadow = cap.castShadow = true;
    g.add(stalk, cap);
    g.position.set(gx, bankHeight(gx, y) - 0.1, -y);
    g.scale.setScalar(sc);
    group.add(g);
  }
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
