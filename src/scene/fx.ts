// Readability effects: drifting seed fluff that traces the current, the aim arrow,
// the dotted route preview, gust rings and droplets shaken off the beetle's coat.
import * as THREE from "three";
import type { Course } from "../game/course";
import { currentAt } from "../game/field";
import { outside } from "./banks";
import { rng } from "./bankside";

const MOTES = 260;
const DOTS = 31;
const DROPS = 36;

export function createFx(course: Course) {
  const group = new THREE.Group();
  const rand = rng(5);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  // Seed fluff riding the current.
  const motes = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.035, 6),
    new THREE.MeshBasicMaterial({ color: "#efe6cf", transparent: true, opacity: 0.85 }),
    MOTES,
  );
  const mp = Array.from({ length: MOTES }, () => ({ x: 0, y: -100, life: 0 }));
  group.add(motes);
  const spawn = (mote: { x: number; y: number; life: number }, fx: number, fy: number) => {
    for (let tries = 0; tries < 8; tries++) {
      mote.x = fx + (rand() - 0.5) * 20;
      mote.y = fy - 6 + rand() * 26;
      if (outside(mote.x, mote.y) < -0.2) break;
    }
    mote.life = 4 + rand() * 6;
  };

  // Aim arrow: a flat chevron on the water, unit length along +Z before rotation.
  const shape = new THREE.Shape();
  shape.moveTo(-0.06, 0);
  shape.lineTo(0.06, 0);
  shape.lineTo(0.06, 0.72);
  shape.lineTo(0.17, 0.72);
  shape.lineTo(0, 1);
  shape.lineTo(-0.17, 0.72);
  shape.lineTo(-0.06, 0.72);
  shape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(shape);
  arrowGeo.rotateX(Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({
    color: "#fff4d8",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.renderOrder = 3;
  arrow.visible = false;
  group.add(arrow);

  const dots = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.06, 10),
    new THREE.MeshBasicMaterial({
      color: "#fff4d8",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
    DOTS,
  );
  dots.renderOrder = 2;
  dots.visible = false;
  group.add(dots);

  // Gust rings.
  const rings = Array.from({ length: 4 }, () => {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 40),
      new THREE.MeshBasicMaterial({
        color: "#fff8e8",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    r.rotation.x = -Math.PI / 2;
    r.userData.age = 99;
    group.add(r);
    return r;
  });

  // Droplets.
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.018, 6, 4),
    new THREE.MeshStandardMaterial({
      color: "#cfe6ee",
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    }),
    DROPS,
  );
  const dp = Array.from({ length: DROPS }, () => ({
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    life: 0,
  }));
  group.add(drops);

  return {
    group,
    update(dt: number, focus: { x: number; y: number }, flow: boolean) {
      for (let i = 0; i < MOTES; i++) {
        const mote = mp[i] as { x: number; y: number; life: number };
        if (flow) {
          const c = currentAt(course, mote);
          mote.x += c.x * dt;
          mote.y += c.y * dt;
        }
        mote.life -= dt;
        if (
          mote.life <= 0 ||
          Math.abs(mote.x - focus.x) > 11 ||
          mote.y < focus.y - 8 ||
          mote.y > focus.y + 22 ||
          outside(mote.x, mote.y) > -0.1
        )
          spawn(mote, focus.x, focus.y);
        const fade = Math.min(1, mote.life / 1.5);
        p.set(mote.x, 0.015, -mote.y);
        s.setScalar(0.4 + fade * 0.6);
        motes.setMatrixAt(i, m.compose(p, q, s));
      }
      motes.instanceMatrix.needsUpdate = true;

      for (const r of rings) {
        r.userData.age += dt;
        const a = r.userData.age as number;
        const mat = r.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.6 * (1 - a / 0.8));
        r.scale.setScalar(0.3 + a * 2.2);
      }

      let live = 0;
      for (let i = 0; i < DROPS; i++) {
        const d = dp[i] as (typeof dp)[number];
        if (d.life > 0) {
          d.life -= dt;
          d.v.y -= 4 * dt;
          d.p.addScaledVector(d.v, dt);
          if (d.p.y < 0) d.life = 0;
        }
        s.setScalar(d.life > 0 ? 1 : 0);
        drops.setMatrixAt(i, m.compose(d.p, q, s));
        if (d.life > 0) live++;
      }
      drops.instanceMatrix.needsUpdate = true;
      drops.visible = live > 0;
    },
    showAim(from: THREE.Vector3, angle: number, strength: number, spill: boolean, ready: boolean) {
      arrow.visible = true;
      arrow.position.set(from.x, 0.06, from.z);
      arrow.rotation.y = Math.PI - angle;
      arrow.scale.set(0.8 + strength * 0.6, 1, 0.5 + strength * 2.2);
      arrowMat.color.set(spill ? "#ff9a5a" : "#fff4d8");
      arrowMat.opacity = ready ? 0.92 : 0.4;
    },
    showPreview(points: { x: number; y: number }[]) {
      dots.visible = true;
      for (let i = 0; i < DOTS; i++) {
        const pt = points[Math.min(points.length - 1, i)];
        const on = pt && i < points.length && i > 0;
        p.set(pt?.x ?? 0, 0.04, -(pt?.y ?? 0));
        s.setScalar(on ? 1 - (i / DOTS) * 0.6 : 0);
        dots.setMatrixAt(i, m.compose(p, q, s));
      }
      dots.instanceMatrix.needsUpdate = true;
    },
    hideAim() {
      arrow.visible = false;
      dots.visible = false;
    },
    ring(at: THREE.Vector3) {
      const r = rings.reduce((a, b) =>
        (a.userData.age as number) > (b.userData.age as number) ? a : b,
      );
      r.userData.age = 0;
      r.position.set(at.x, 0.03, at.z);
    },
    splash(at: THREE.Vector3, count: number, power = 1) {
      let n = 0;
      for (const d of dp) {
        if (n >= count) break;
        if (d.life > 0) continue;
        d.p.copy(at);
        const a = rand() * Math.PI * 2;
        d.v.set(Math.cos(a) * 0.5 * power, (0.8 + rand() * 0.8) * power, Math.sin(a) * 0.5 * power);
        d.life = 1.2;
        n++;
      }
    },
  };
}

export type Fx = ReturnType<typeof createFx>;
