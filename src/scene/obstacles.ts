// Meshes for every collider in the course: branch, flowerpot, rocks, roots and lily pads.
import * as THREE from "three";
import { type Course, centreX, type Obstacle } from "../game/course";
import { rng, tube } from "./bankside";

const bark = new THREE.MeshStandardMaterial({ color: "#5b4330", roughness: 0.9 });
const root = new THREE.MeshStandardMaterial({ color: "#4a3324", roughness: 0.85 });
const stone = new THREE.MeshStandardMaterial({
  color: "#7d766a",
  roughness: 0.6,
  flatShading: true,
});
const moss = new THREE.MeshStandardMaterial({ color: "#5d7a2c", roughness: 0.9 });
const terracotta = new THREE.MeshStandardMaterial({ color: "#b8653a", roughness: 0.75 });
const lilyMat = new THREE.MeshStandardMaterial({ color: "#3f6e2a", roughness: 0.45 });
const petal = new THREE.MeshStandardMaterial({ color: "#f2c6d0", roughness: 0.6 });
const leafMat = new THREE.MeshStandardMaterial({
  color: "#8a7a2a",
  roughness: 0.7,
  side: THREE.DoubleSide,
});
const potWater = new THREE.MeshStandardMaterial({ color: "#1c2a20", roughness: 0.08 });

const rand = rng(21);
const W = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

function lumpy(r: number, squash: number, detail = 2) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const f = 1 + 0.12 * Math.sin(x * 5.1 + z * 3.3) + 0.08 * Math.sin(y * 7 + x * 2);
    p.setXYZ(i, x * f, y * f * squash, z * f);
  }
  g.computeVertexNormals();
  return g;
}

function shadowed<T extends THREE.Object3D>(o: T) {
  o.traverse((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  return o;
}

function branch(o: Extract<Obstacle, { shape: "capsule" }>) {
  const g = new THREE.Group();
  const a = W(o.a.x - 0.2, o.a.y, 0.05);
  const b = W(o.b.x + 0.2, o.b.y, 0.05);
  const mid = a
    .clone()
    .lerp(b, 0.5)
    .add(new THREE.Vector3(0, 0.08, -0.12));
  g.add(tube([a, mid, b], o.r, bark, false));
  // Twigs and a dried leaf make the silhouette read as a fallen branch.
  const twig = (t: number, dir: THREE.Vector3) => {
    const base = a
      .clone()
      .lerp(b, t)
      .add(new THREE.Vector3(0, 0.15, 0));
    const tip = base.clone().add(dir);
    g.add(
      tube(
        [
          base,
          base
            .clone()
            .lerp(tip, 0.5)
            .add(new THREE.Vector3(0, 0.1, 0)),
          tip,
        ],
        0.08,
        bark,
      ),
    );
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), leafMat);
    leaf.scale.set(0.5, 1, 1);
    leaf.position.copy(tip);
    leaf.rotation.set(-0.8, t * 4, 0.4);
    g.add(leaf);
  };
  twig(0.25, new THREE.Vector3(-0.3, 0.9, 0.4));
  twig(0.62, new THREE.Vector3(0.4, 1.1, -0.3));
  twig(0.85, new THREE.Vector3(0.2, 0.6, 0.5));
  return g;
}

function pot(o: Extract<Obstacle, { shape: "circle" }>) {
  const r = o.r;
  const profile = [
    new THREE.Vector2(r * 0.62, -1.4),
    new THREE.Vector2(r * 0.9, 0.35),
    new THREE.Vector2(r * 1.0, 0.36),
    new THREE.Vector2(r * 1.0, 0.72),
    new THREE.Vector2(r * 0.9, 0.72),
    new THREE.Vector2(r * 0.86, 0.4),
    new THREE.Vector2(r * 0.6, -1.2),
  ];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), terracotta);
  const surface = new THREE.Mesh(new THREE.CircleGeometry(r * 0.87, 32), potWater);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.28;
  g.add(body, surface);
  // A drowned seedling leaning out of the pot.
  const s0 = new THREE.Vector3(0.2, 0.2, 0.1);
  const s1 = new THREE.Vector3(-0.3, 1.4, 0.5);
  const s2 = new THREE.Vector3(-0.9, 2, 1.1);
  g.add(tube([s0, s1, s2], 0.07, moss));
  for (const [t, rot] of [
    [0.6, 0.7],
    [1, -0.5],
  ] as [number, number][]) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), moss);
    leaf.scale.set(0.55, 1, 1);
    leaf.position.copy(s1.clone().lerp(s2, t));
    leaf.rotation.set(-1, rot, 0.3);
    g.add(leaf);
  }
  g.position.copy(W(o.c.x, o.c.y));
  g.rotation.set(0.08, 0.4, -0.06);
  return g;
}

function rock(o: Extract<Obstacle, { shape: "circle" }>) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(lumpy(o.r * 1.05, 0.75, 1), stone);
  const cap = new THREE.Mesh(lumpy(o.r * 0.75, 0.35, 1), moss);
  cap.position.set(-o.r * 0.1, o.r * 0.5, 0);
  g.add(body, cap);
  g.position.copy(W(o.c.x, o.c.y, 0.05));
  g.rotation.y = rand() * 6;
  return g;
}

function lily(o: Extract<Obstacle, { shape: "circle" }>) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(o.r, o.r, 0.06, 36, 1, false, 0.25, Math.PI * 2 - 0.5),
    lilyMat,
  );
  pad.position.y = 0.04;
  g.add(pad);
  if (rand() < 0.6) {
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), petal);
      p.position.set(Math.cos(i) * 0.12, 0.28, Math.sin(i) * 0.12);
      p.rotation.set(Math.sin(i) * 0.6, 0, -Math.cos(i) * 0.6);
      g.add(p);
    }
  }
  g.position.copy(W(o.c.x, o.c.y));
  g.rotation.y = rand() * 6;
  return g;
}

/** The great root: a knuckle in the current and arches over the tunnel lane. */
function rootArch(course: Course) {
  const g = new THREE.Group();
  const knuckle = course.obstacles.find((o) => o.kind === "knuckle");
  if (knuckle?.shape !== "circle") return g;
  const k = knuckle.c;
  const lump = new THREE.Mesh(lumpy(knuckle.r * 1.05, 0.8), root);
  lump.position.copy(W(k.x, k.y, 0.15));
  g.add(lump);
  for (const [y, h] of [
    [46.4, 2.1],
    [49.6, 2.5],
    [52.6, 1.9],
  ] as [number, number][]) {
    const c = centreX(y);
    const pts = [
      W(c - 7.5, y + 0.3, 1.6),
      W(c - 5, y, h + 0.2),
      W(c - 2.7, y - 0.2, h + 0.3),
      W(c - 1.2, y, h - 0.4),
      W(c - 0.9 + (y < 47 ? 1.2 : 0), y < 47 ? k.y : y, 0.3),
    ];
    g.add(tube(pts, 0.34, root, false));
    // Rootlets hang from the arch but stay clear of the water.
    for (let i = 0; i < 4; i++) {
      const x = c - 4 + i * 0.9 + rand() * 0.3;
      const top = W(x, y, h + 0.1);
      g.add(
        tube(
          [
            top,
            top.clone().add(new THREE.Vector3(0.05, -0.5, 0.02)),
            top.clone().add(new THREE.Vector3(0.1, -0.9 - rand() * 0.3, 0)),
          ],
          0.05,
          root,
        ),
      );
    }
  }
  return g;
}

export function createObstacles(course: Course) {
  const group = new THREE.Group();
  for (const o of course.obstacles) {
    if (o.shape === "capsule") {
      if (o.kind === "branch") group.add(branch(o));
      else {
        const mid = W((o.a.x + o.b.x) / 2 + 0.05, (o.a.y + o.b.y) / 2, 0.2);
        group.add(tube([W(o.a.x, o.a.y, 0.1), mid, W(o.b.x, o.b.y, 0.1)], o.r * 1.05, root, false));
      }
    } else if (o.kind === "pot") group.add(pot(o));
    else if (o.kind === "lily") group.add(lily(o));
    else if (o.kind === "rock" || o.kind === "pebble") group.add(rock(o));
  }
  group.add(rootArch(course));
  return shadowed(group);
}
