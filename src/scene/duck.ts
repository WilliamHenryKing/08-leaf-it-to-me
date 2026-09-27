// The rescuing duck: enormous at this scale, brief and a little smug.
import * as THREE from "three";

export function createDuck() {
  const g = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: "#8a6a48", roughness: 0.8 });
  const wing = new THREE.MeshStandardMaterial({ color: "#5d4630", roughness: 0.85 });
  const head = new THREE.MeshStandardMaterial({
    color: "#1f5a3a",
    roughness: 0.35,
    metalness: 0.2,
  });
  const beak = new THREE.MeshStandardMaterial({ color: "#e0a02a", roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: "#f3efe4", roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), feather);
  body.scale.set(1.1, 0.75, 1.6);
  body.position.y = 0.35;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 12), wing);
  tail.rotation.x = -Math.PI / 2 - 0.5;
  tail.position.set(0, 0.8, 1.55);
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 10), wing);
    w.scale.set(0.35, 0.5, 1.2);
    w.position.set(s * 0.95, 0.6, 0.2);
    return w;
  });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.45, 0.9, 14), head);
  neck.position.set(0, 1.1, -1.1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 20), white);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.8, -1.1);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), head);
  skull.position.set(0, 1.75, -1.25);
  const bill = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 8), beak);
  bill.scale.set(0.75, 0.3, 1.2);
  bill.position.set(0, 1.62, -1.85);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), black);
    e.position.set(s * 0.42, 1.88, -1.45);
    return e;
  });
  g.add(body, tail, ...wings, neck, ring, skull, bill, ...eyes);
  g.traverse((o) => {
    o.castShadow = true;
  });
  g.visible = false;
  return { group: g };
}
