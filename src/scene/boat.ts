// The curled-leaf boat, its twig mast and petal sail, and the beetle in a coat.
import * as THREE from "three";

const LENGTH = 0.95;
const HALF_WIDTH = 0.27;

/** A leaf blade that curls up at the edges and tips, pointing along -Z. */
function leafGeometry() {
  const nu = 24;
  const nv = 10;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const edge = new THREE.Color("#8a8a24");
  const body = new THREE.Color("#4f7d22");
  const rib = new THREE.Color("#b7c05a");
  const c = new THREE.Color();
  for (let i = 0; i <= nu; i++) {
    const t = i / nu; // 0 stern .. 1 bow
    const s = t * 2 - 1;
    const w = HALF_WIDTH * (1 - s * s) ** 0.75 * (1 - 0.18 * s);
    for (let j = 0; j <= nv; j++) {
      const k = (j / nv) * 2 - 1;
      const x = k * w;
      const curl = 0.9 * (k * k) * w + 0.12 * s ** 4;
      pos.push(x, curl + 0.02, -s * (LENGTH / 2));
      c.copy(body)
        .lerp(edge, Math.abs(k) ** 3)
        .lerp(rib, Math.max(0, 1 - Math.abs(k) * 12) * 0.8);
      col.push(c.r, c.g, c.b);
      if (i < nu && j < nv) {
        const a = i * (nv + 1) + j;
        idx.push(a, a + nv + 1, a + 1, a + 1, a + nv + 1, a + nv + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A petal sail, slightly cupped, facing along the boat. */
function sailGeometry() {
  const g = new THREE.PlaneGeometry(0.34, 0.36, 6, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const nx = x / 0.17;
    const ny = y / 0.18;
    const taper = 1 - 0.35 * (ny + 1) * 0.5;
    p.setXYZ(i, x * taper, y, -0.06 * (1 - nx * nx) * (1 - ny * ny * 0.5));
  }
  g.computeVertexNormals();
  return g;
}

export function createBeetle(coatColor = "#c98a2b") {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({
    color: "#1f3a3a",
    roughness: 0.25,
    metalness: 0.3,
  });
  const coat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: "#161310", roughness: 0.5 });
  const eye = new THREE.MeshStandardMaterial({ color: "#f5efe0", roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), shell);
  body.scale.set(0.9, 0.8, 1.15);
  body.position.y = 0.1;
  // The coat: a short flared cape buttoned at the collar.
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.125, 0.14, 16, 1, true), coat);
  cape.position.set(0, 0.11, 0.01);
  coat.side = THREE.DoubleSide;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.02, 8, 16), coat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.18, -0.01);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), dark);
  head.position.set(0, 0.2, -0.08);
  const eyes = [-1, 1].map((sd) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eye);
    e.position.set(sd * 0.03, 0.225, -0.13);
    return e;
  });
  const antennae = [-1, 1].map((sd) => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sd * 0.02, 0.24, -0.11),
      new THREE.Vector3(sd * 0.06, 0.36, -0.14),
      new THREE.Vector3(sd * 0.1, 0.34, -0.2),
    );
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.006, 4), dark);
  });
  const legs = [-1, 1].flatMap((sd) =>
    [-0.05, 0.02, 0.08].map((z) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.11, 4), dark);
      leg.position.set(sd * 0.09, 0.05, z);
      leg.rotation.z = sd * 0.9;
      return leg;
    }),
  );
  g.add(body, cape, collar, head, ...eyes, ...antennae, ...legs);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

export interface BoatRig {
  group: THREE.Group;
  hull: THREE.Group;
  sail: THREE.Mesh;
  beetle: THREE.Group;
  mastTop: THREE.Object3D;
}

export function createBoat(): BoatRig {
  const group = new THREE.Group();
  const hull = new THREE.Group();
  hull.rotation.order = "YXZ";
  group.add(hull);

  const leaf = new THREE.Mesh(
    leafGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }),
  );
  // Stem trailing behind like a tiller.
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 0.22, 5),
    new THREE.MeshStandardMaterial({ color: "#6d6a24" }),
  );
  stem.rotation.x = Math.PI / 2 - 0.3;
  stem.position.set(0, 0.07, LENGTH / 2 + 0.07);

  const twig = new THREE.MeshStandardMaterial({ color: "#6a4a2e", roughness: 0.9 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.62, 6), twig);
  mast.position.set(0, 0.34, -0.14);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 5), twig);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 0.6, -0.16);
  const sail = new THREE.Mesh(
    sailGeometry(),
    new THREE.MeshStandardMaterial({ color: "#f1e2c6", roughness: 0.7, side: THREE.DoubleSide }),
  );
  sail.position.set(0, 0.41, -0.17);
  const mastTop = new THREE.Object3D();
  mastTop.position.set(0, 0.68, -0.14);

  const beetle = createBeetle();
  beetle.position.set(0, 0.02, 0.14);

  hull.add(leaf, stem, mast, yard, sail, mastTop, beetle);
  hull.traverse((o) => {
    o.castShadow = true;
  });
  return { group, hull, sail, beetle, mastTop };
}
