// Bank flora at a beetle's scale: clover canopies (the wind shadow), instanced reed beds and the
// toadstools overhead. Every repeated plant is instanced with its own height, lean and tint.
import * as THREE from "three";
import { type Course, centreX, type Shelter } from "../game/course";
import { bankHeight } from "./banks";
import { tube } from "./bankside";
import { capSkin, translucent } from "./skins";

type Rand = () => number;

/** A reed stem of unit height with a slight taper and bow, standing on its base. */
function reedGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04, 0.5, 0),
    new THREE.Vector3(0.12, 1, 0),
  ]);
  const geo = new THREE.TubeGeometry(curve, 10, 0.02, 6, false);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i);
    const c = curve.getPoint(Math.min(1, Math.max(0, t)));
    const k = 1 - t * 0.7;
    p.setX(i, c.x + (p.getX(i) - c.x) * k);
    p.setZ(i, c.z + (p.getZ(i) - c.z) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function reeds(sh: Shelter, rand: Rand) {
  const group = new THREE.Group();
  const count = 44;
  const stems = new THREE.InstancedMesh(
    reedGeometry(),
    new THREE.MeshStandardMaterial({ roughness: 0.62 }),
    count,
  );
  const heads = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.12, 0.48, 4, 10),
    new THREE.MeshStandardMaterial({ color: "#5a3a1e", roughness: 0.95 }),
    count,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const col = new THREE.Color();
  let headCount = 0;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * sh.r;
    const x = sh.c.x + Math.cos(a) * r - 1.4;
    const y = sh.c.y + Math.sin(a) * r;
    const h = 2.8 + rand() * 3.4;
    const thick = 2.4 + rand() * 1.4;
    p.set(x, -0.3, -y);
    e.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    q.setFromEuler(e);
    s.set(thick, h, thick);
    m.compose(p, q, s);
    stems.setMatrixAt(i, m);
    col.setHSL(0.17 + rand() * 0.06, 0.35 + rand() * 0.2, 0.3 + rand() * 0.14);
    stems.setColorAt(i, col);
    if (rand() < 0.45) {
      tip.set(0.12, 1, 0).applyMatrix4(m);
      s.setScalar(0.8 + rand() * 0.5);
      heads.setMatrixAt(headCount++, new THREE.Matrix4().compose(tip, q, s));
    }
  }
  heads.count = headCount;
  for (const o of [stems, heads]) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
  group.add(stems, heads);
  return group;
}

function clover(sh: Shelter, rand: Rand, geometry: THREE.BufferGeometry) {
  const group = new THREE.Group();
  const leafMat = translucent(
    new THREE.MeshStandardMaterial({ color: "#4f7a2a", roughness: 0.55, side: THREE.DoubleSide }),
    0.7,
  );
  const stemMat = new THREE.MeshStandardMaterial({ color: "#6b7f36", roughness: 0.8 });
  // Clover leaves arch over the lane from the bank: the wind shadow you can see.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand();
    const cx = sh.c.x + Math.cos(a) * sh.r * 0.45 + 1.2;
    const cy = sh.c.y + Math.sin(a) * sh.r * 0.55;
    const top = 2.1 + rand() * 1;
    const leaf = new THREE.Mesh(geometry, leafMat);
    leaf.position.set(cx, top, -cy);
    leaf.rotation.set((rand() - 0.5) * 0.35, rand() * 6, (rand() - 0.5) * 0.35);
    leaf.scale.setScalar(1.2 + rand() * 0.6);
    leaf.castShadow = true;
    const baseX = sh.c.x + sh.r + 1.5;
    group.add(
      leaf,
      tube(
        [
          new THREE.Vector3(baseX, 0.3, -cy),
          new THREE.Vector3(cx + 1, top + 0.4, -cy),
          new THREE.Vector3(cx, top, -cy),
        ],
        0.07,
        stemMat,
      ),
    );
  }
  return group;
}

/** A toadstool: domed, flecked cap with a rolled lip, gills beneath, a skirt and a swollen base. */
function toadstool(capMat: THREE.Material, stalkMat: THREE.Material, gillMat: THREE.Material) {
  const g = new THREE.Group();
  const capProfile = [
    [0.001, 0.62],
    [0.35, 0.58],
    [0.66, 0.44],
    [0.86, 0.22],
    [0.95, 0.04],
    [0.9, -0.02],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile, 36), capMat);
  cap.position.y = 1.5;
  const gills = new THREE.Mesh(new THREE.CircleGeometry(0.9, 36), gillMat);
  gills.rotation.x = Math.PI / 2;
  gills.position.y = 1.49;
  const stalkProfile = [
    [0.001, 0],
    [0.3, 0],
    [0.32, 0.15],
    [0.22, 0.5],
    [0.17, 1.1],
    [0.15, 1.52],
    [0.001, 1.52],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stalk = new THREE.Mesh(new THREE.LatheGeometry(stalkProfile, 18), stalkMat);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.12, 20, 1, true), gillMat);
  skirt.position.y = 1.18;
  g.add(cap, gills, stalk, skirt);
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

export function createFlora(course: Course, rand: Rand, cloverGeometry: THREE.BufferGeometry) {
  const group = new THREE.Group();
  for (const sh of course.shelters) {
    if (sh.kind === "clover") group.add(clover(sh, rand, cloverGeometry));
    else if (sh.kind === "reeds") group.add(reeds(sh, rand));
  }
  const skin = capSkin();
  const capMat = new THREE.MeshStandardMaterial({
    map: skin.map,
    normalMap: skin.normalMap,
    roughness: 0.55,
  });
  const stalkMat = new THREE.MeshStandardMaterial({ color: "#e6dbc2", roughness: 0.85 });
  const gillMat = new THREE.MeshStandardMaterial({
    color: "#d9c9a6",
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  for (const [x, y, sc, lean] of [
    [-6, 8, 1, 0.08],
    [6.5, 40, 1.3, -0.1],
    [-7.8, 60, 0.9, 0.12],
    [9.5, 95, 1.2, -0.06],
  ] as [number, number, number, number][]) {
    const gx = centreX(y) + x;
    const t = toadstool(capMat, stalkMat, gillMat);
    t.position.set(gx, bankHeight(gx, y) - 0.1, -y);
    t.rotation.set(0, rand() * 6, lean);
    t.scale.set(sc, sc * (0.9 + rand() * 0.25), sc);
    group.add(t);
  }
  return group;
}
