// Floating seed lanterns to gather, and the evening gathering at the pond's edge.
import * as THREE from "three";
import type { Course } from "../game/course";
import { createBeetle } from "./boat";
import { createGlowTexture } from "./textures";

const glowTex = createGlowTexture();
const paper = new THREE.MeshStandardMaterial({
  color: "#ffb45a",
  emissive: "#ff8a2a",
  emissiveIntensity: 1.6,
  roughness: 0.6,
});
const unlit = new THREE.MeshStandardMaterial({ color: "#8a6a4a", roughness: 0.8 });
const floatMat = new THREE.MeshStandardMaterial({
  color: "#6f8a2e",
  roughness: 0.6,
  side: THREE.DoubleSide,
});

function lanternMesh(mat: THREE.Material, scale = 1) {
  const pts = [
    new THREE.Vector2(0.001, -0.14),
    new THREE.Vector2(0.06, -0.13),
    new THREE.Vector2(0.11, -0.05),
    new THREE.Vector2(0.12, 0.03),
    new THREE.Vector2(0.08, 0.12),
    new THREE.Vector2(0.03, 0.15),
    new THREE.Vector2(0.001, 0.15),
  ];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), mat);
  m.scale.setScalar(scale);
  return m;
}

export function glow(size: number, opacity = 0.8) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: "#ffcf8a",
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  s.scale.setScalar(size);
  return s;
}

export function createLanterns(course: Course) {
  const group = new THREE.Group();
  const floating = course.lanterns.map((l) => {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), floatMat);
    pad.rotation.x = -Math.PI / 2;
    const lamp = lanternMesh(paper);
    lamp.position.y = 0.17;
    lamp.castShadow = true;
    const halo = glow(1.1);
    halo.position.y = 0.2;
    g.add(pad, lamp, halo);
    g.position.set(l.x, 0.02, -l.y);
    group.add(g);
    return g;
  });

  // The gathering: a bark raft on the bank, beetles in coats and a string of lantern slots.
  const gathering = new THREE.Group();
  const f = course.finish.c;
  gathering.position.set(f.x + 1.2, 0, -f.y);
  const raft = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.18, 3.2),
    new THREE.MeshStandardMaterial({ color: "#6b4a30", roughness: 0.95 }),
  );
  raft.position.y = 0.1;
  raft.rotation.y = 0.2;
  raft.receiveShadow = true;
  raft.castShadow = true;
  gathering.add(raft);
  const coats = ["#8a3a3a", "#3a5a8a", "#6a8a3a", "#8a6a9a", "#b0782a"];
  const guests = coats.map((c, i) => {
    const b = createBeetle(c);
    const a = (i / coats.length) * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.7, 0.19, Math.sin(a) * 0.9);
    b.rotation.y = -a + Math.PI / 2 + Math.PI;
    b.scale.setScalar(1.3);
    gathering.add(b);
    return b;
  });
  // Two reed poles with a string between them; each gathered lantern lights one slot.
  const pole = new THREE.MeshStandardMaterial({ color: "#7c8a3f", roughness: 0.8 });
  const poles = [-1.3, 1.3].map((z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.4, 6), pole);
    p.position.set(0.9, 1.2, z);
    p.castShadow = true;
    gathering.add(p);
    return p;
  });
  void poles;
  const slots = course.lanterns.map((_, i) => {
    const t = (i + 0.5) / course.lanterns.length;
    const z = -1.3 + t * 2.6;
    const sag = 2.25 - Math.sin(t * Math.PI) * 0.45;
    const lamp = lanternMesh(unlit, 0.9);
    lamp.position.set(0.9, sag, z);
    const halo = glow(1.2, 0);
    halo.position.copy(lamp.position);
    gathering.add(lamp, halo);
    return { lamp, halo };
  });
  const light = new THREE.PointLight("#ffb060", 0, 9, 1.6);
  light.position.set(0.5, 1.8, 0);
  gathering.add(light);
  group.add(gathering);

  return {
    group,
    floating,
    guests,
    /** Light the string: one slot per gathered lantern. */
    lightSlots(lit: boolean[]) {
      let k = 0;
      lit.forEach((on, i) => {
        const s = slots[i];
        if (!s) return;
        s.lamp.material = on ? paper : unlit;
        (s.halo.material as THREE.SpriteMaterial).opacity = on ? 0.9 : 0;
        if (on) k++;
      });
      light.intensity = 1.5 + k * 1.2;
    },
    reset() {
      for (const f of floating) {
        f.visible = true;
        f.scale.setScalar(1);
      }
      for (const s of slots) {
        s.lamp.material = unlit;
        (s.halo.material as THREE.SpriteMaterial).opacity = 0;
      }
      light.intensity = 1.5;
    },
  };
}

export type Lanterns = ReturnType<typeof createLanterns>;

/** The little lantern the beetle hangs from its mast as it gathers more. */
export function createCarriedLantern() {
  const g = new THREE.Group();
  const lamp = lanternMesh(paper, 0.45);
  lamp.position.y = -0.08;
  const halo = glow(0.6, 0.7);
  halo.position.y = -0.08;
  g.add(lamp, halo);
  g.visible = false;
  return {
    group: g,
    set(count: number) {
      g.visible = count > 0;
      halo.scale.setScalar(0.5 + count * 0.12);
    },
  };
}
