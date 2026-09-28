// The earth around the brook: a carved heightfield with wet mud, moss and leaf litter colours.
import * as THREE from "three";
import { centreX, halfWidth } from "../game/course";
import { smoothstep } from "../game/vec";

const Y0 = -10;
const Y1 = 112;
const X = 20;

/** Cheap layered sine noise; deterministic and smooth enough for banks. */
export function groundNoise(x: number, y: number) {
  return (
    Math.sin(x * 0.9 + y * 0.31) * 0.5 +
    Math.sin(x * 0.37 - y * 0.83 + 1.7) * 0.35 +
    Math.sin(x * 2.3 + y * 1.9) * 0.15
  );
}

/** Distance outside the water's edge (negative in the water). */
export const outside = (x: number, y: number) => Math.abs(x - centreX(y)) - halfWidth(y);

export function bankHeight(x: number, y: number) {
  const d = outside(x, y);
  const n = groundNoise(x, y);
  let h = -0.7 + smoothstep(-0.9, 1.3, d) * 1.25 + Math.max(0, d - 1.3) * 0.22;
  h += n * 0.25 * smoothstep(0, 2.5, d);
  // Upstream a rocky lip; downstream the weir.
  h += smoothstep(-2, -5, y) * 1.6;
  h += smoothstep(100.5, 104, y) * 0.9 * smoothstep(0, 3, 6 - Math.abs(x - centreX(y)));
  return h;
}

/** The carved earth; with sourced textures it uses the ground splat, else vertex colours. */
export function createBanks(ground: THREE.Material | null = null) {
  const geo = new THREE.PlaneGeometry(X * 2, Y1 - Y0, 110, 330);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const edge = new Float32Array(pos.count);
  const bed = new THREE.Color("#2a2418");
  const gravel = new THREE.Color("#9a8158");
  const mud = new THREE.Color("#3b2c1c");
  const wet = new THREE.Color("#5a4630");
  const moss = new THREE.Color("#51612b");
  const litter = new THREE.Color("#7a5a2c");
  const c = new THREE.Color();
  const midZ = -(Y0 + Y1) / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const gy = -(pos.getZ(i) + midZ);
    const h = bankHeight(x, gy);
    pos.setY(i, h);
    const d = outside(x, gy);
    edge[i] = d;
    const n = groundNoise(x * 1.7, gy * 1.3);
    // The bed: sandy gravel in the clear shallows, dark silt in the channel.
    c.copy(bed).lerp(gravel, smoothstep(-2.4, -0.6, d) * (0.75 + n * 0.25));
    c.lerp(mud, smoothstep(-0.4, 0, d));
    c.lerp(wet, smoothstep(-0.2, 0.3, d));
    c.lerp(moss, smoothstep(0.4, 1.6, d) * (0.65 + n * 0.35));
    c.lerp(litter, smoothstep(0.2, 0.9, n) * smoothstep(1.5, 3, d) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    ground ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  mesh.position.z = midZ;
  mesh.receiveShadow = true;
  return mesh;
}
