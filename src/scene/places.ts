// What makes each reach a place: garden wreckage round the Flooded Flowerpot, an earthen roof
// and shafts of light in the Root Tunnel, and a warm, firefly-lit evening at the Lantern Pond.
import * as THREE from "three";
import { type Course, centreX } from "../game/course";
import type { Assets } from "./assets";
import { bankHeight } from "./banks";
import { rng, tube } from "./bankside";
import { glow } from "./lanterns";
import { fadeWhenOccluding } from "./occlude";

const rand = rng(33);
const W = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

function lump(r: number, squash: number) {
  const g = new THREE.IcosahedronGeometry(r, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const f = 1 + 0.14 * Math.sin(x * 2.3 + z * 1.9) + 0.08 * Math.sin(y * 4 + x);
    p.setXYZ(i, x * f, y * f * squash, z * f);
  }
  g.computeVertexNormals();
  return g;
}

function flowerpotGarden(course: Course) {
  const g = new THREE.Group();
  const clay = new THREE.MeshStandardMaterial({ color: "#b0603a", roughness: 0.8 });
  const pot = course.obstacles.find((o) => o.kind === "pot");
  const py = pot?.shape === "circle" ? pot.c.y : 23.5;
  // A small pot tipped over on the left bank, spilling soil.
  const small = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 1.3, 20, 1, true), clay);
  small.material.side = THREE.DoubleSide;
  const sx = centreX(py - 8) - 6.6;
  small.position.set(sx, bankHeight(sx, py - 8) + 0.55, -(py - 8));
  small.rotation.set(0.2, 0.7, Math.PI / 2 - 0.15);
  const soil = new THREE.Mesh(
    lump(0.8, 0.3),
    new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 1 }),
  );
  soil.position.set(sx + 0.9, bankHeight(sx + 0.9, py - 8) + 0.05, -(py - 8) + 0.3);
  g.add(small, soil);
  // Shards of a broken pot on the right bank.
  for (let i = 0; i < 4; i++) {
    const y = py + 1 + i * 1.3;
    const x = centreX(y) + 6 + rand() * 1.5;
    const shard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.8, 0.5, 12, 1, true, rand() * 6, 0.9 + rand() * 0.6),
      clay,
    );
    shard.position.set(x, bankHeight(x, y) + 0.15, -y);
    shard.rotation.set(rand() * 1.2, rand() * 6, rand() * 0.8);
    g.add(shard);
  }
  // A plant label leaning where the pot once stood.
  const lx = centreX(py) + 6.2;
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 2.2, 0.06),
    new THREE.MeshStandardMaterial({ color: "#efe7d2", roughness: 0.7 }),
  );
  label.position.set(lx, bankHeight(lx, py - 3) + 1, -(py - 3));
  label.rotation.set(0, 0.4, -0.25);
  g.add(label);
  return g;
}

function rootTunnel(assets: Assets) {
  const g = new THREE.Group();
  // The overhanging bank: the same wet forest mud as the waterline (Poly Haven mud_forest).
  const earth = fadeWhenOccluding(
    new THREE.MeshStandardMaterial({
      color: assets.mud ? "#ffffff" : "#3b2a1c",
      map: assets.mud?.map ?? null,
      normalMap: assets.mud?.normalMap ?? null,
      roughnessMap: assets.mud?.arm ?? null,
      roughness: 1,
    }),
  );
  // The earthen bank overhangs the tunnel from the left; the arches carry the rest of the roof,
  // so the camera always sees the boat and the light falls in between.
  for (const [y, len] of [
    [46.2, 1.6],
    [48.1, 1.2],
    [50.6, 1.5],
    [52.9, 1.3],
  ] as [number, number][]) {
    const c = centreX(y);
    const roof = new THREE.Mesh(lump(1, 0.35), earth);
    roof.scale.set(1.9, 1.1, len);
    roof.position.set(c - 6.4, 2.1, -y);
    g.add(roof);
  }
  // Shafts of light between the arches: soft additive cones, brightest where you look through
  // their full depth and fading to nothing at their edges and at the water.
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { uIntensity: { value: 0 }, uColor: { value: new THREE.Color("#ffe6b8") } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
void main() {
  vY = (position.y + 1.6) / 3.2;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uIntensity; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
void main() {
  float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
  float a = facing * smoothstep(0.02, 0.7, vY) * (1.0 - smoothstep(0.9, 1.0, vY)) * uIntensity;
  gl_FragColor = vec4(uColor, a);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const shafts: THREE.Mesh[] = [];
  for (const y of [47.2, 49.4, 51.8]) {
    const c = centreX(y);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.55, 3.2, 28, 1, true),
      shaftMat,
    );
    shaft.position.set(c - 2.6, 1.3, -y);
    shaft.rotation.set(0.12, 0, 0.35);
    shafts.push(shaft);
    g.add(shaft);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material === earth) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group: g, shafts, shaftMat };
}

function lanternPond(course: Course) {
  const g = new THREE.Group();
  const reed = new THREE.MeshStandardMaterial({ color: "#6f7d38", roughness: 0.8 });
  const paper = new THREE.MeshStandardMaterial({
    color: "#ffb45a",
    emissive: "#ff8a2a",
    emissiveIntensity: 1.4,
    roughness: 0.6,
  });
  const halos: THREE.Sprite[] = [];
  // Strings of lanterns hung between reeds round the pond's rim.
  for (const [u0, y0, u1, y1] of [
    [-9.6, 78, -9.4, 84],
    [-9.4, 88, -7.8, 94],
    [9.4, 78, 9.6, 82.5],
    [5.5, 95.5, 1, 97],
  ] as [number, number, number, number][]) {
    const a = W(centreX(y0) + u0, y0, 0);
    const b = W(centreX(y1) + u1, y1, 0);
    for (const e of [a, b])
      g.add(
        tube(
          [
            e,
            e.clone().add(new THREE.Vector3(0.1, 1.5, 0)),
            e.clone().add(new THREE.Vector3(0, 3, 0.1)),
          ],
          0.06,
          reed,
        ),
      );
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const pos = a
        .clone()
        .lerp(b, t)
        .setY(2.8 - Math.sin(t * Math.PI) * 0.6);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), paper);
      lamp.scale.y = 1.25;
      lamp.position.copy(pos);
      const halo = glow(0.9, 0);
      halo.position.copy(pos);
      halos.push(halo);
      g.add(lamp, halo);
    }
  }
  // Ladybirds waiting on the bank beside the raft.
  const red = new THREE.MeshStandardMaterial({ color: "#c0281c", roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: "#141210", roughness: 0.4 });
  const f = course.finish.c;
  for (let i = 0; i < 3; i++) {
    const lb = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      red,
    );
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), black);
    head.position.set(0, 0.03, -0.13);
    lb.add(shell, head);
    for (let k = 0; k < 4; k++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), black);
      spot.position.set((k % 2 ? 1 : -1) * 0.06, 0.1, (k < 2 ? -1 : 1) * 0.04);
      lb.add(spot);
    }
    const x = f.x + 2.6 + i * 0.4;
    const y = f.y - 1 + i * 0.9;
    lb.position.set(x, bankHeight(x, y) + 0.02, -y);
    lb.rotation.y = Math.PI / 2;
    g.add(lb);
  }
  // Fireflies drifting over the pond.
  const flies = Array.from({ length: 26 }, () => {
    const s = glow(0.35, 0);
    const y = 72 + rand() * 26;
    s.userData = {
      x: centreX(y) + (rand() - 0.5) * 16,
      y,
      h: 0.6 + rand() * 2.2,
      ph: rand() * 6.3,
    };
    g.add(s);
    return s;
  });
  return { group: g, halos, flies };
}

export function createPlaces(course: Course, assets: Assets) {
  const group = new THREE.Group();
  const tunnel = rootTunnel(assets);
  const pond = lanternPond(course);
  group.add(flowerpotGarden(course), tunnel.group, pond.group);
  return {
    group,
    update(clock: number, mood: { gloom: number; warmth: number }, still: boolean) {
      const flicker = still ? 1 : 0.9 + 0.1 * Math.sin(clock * 0.7);
      const intensity = tunnel.shaftMat.uniforms.uIntensity;
      if (intensity) intensity.value = (0.06 + mood.gloom * 0.3) * flicker;
      for (const h of pond.halos)
        (h.material as THREE.SpriteMaterial).opacity = 0.25 + mood.warmth * 0.65;
      for (const f of pond.flies) {
        const u = f.userData as { x: number; y: number; h: number; ph: number };
        const t = still ? 0 : clock * 0.4 + u.ph;
        f.position.set(
          u.x + Math.sin(t) * 0.8,
          u.h + Math.sin(t * 1.7) * 0.3,
          -(u.y + Math.cos(t * 0.8) * 0.8),
        );
        (f.material as THREE.SpriteMaterial).opacity = mood.warmth * (0.5 + 0.5 * Math.sin(t * 3));
      }
    },
  };
}
