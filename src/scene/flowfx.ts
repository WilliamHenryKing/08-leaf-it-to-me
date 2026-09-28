// Making the current readable: foam streaks that ride the authored field (long and bright where
// it runs fast, faint where it is slack), petals turning on the surface, and ripples round the boat.
import * as THREE from "three";
import type { Course } from "../game/course";
import { currentAt } from "../game/field";
import { outside } from "./banks";
import { rng } from "./bankside";

const STREAKS = 460;
const PETALS = 40;
const WAKES = 7;

interface Floater {
  x: number;
  y: number;
  life: number;
  max: number;
  spin: number;
  yaw: number;
}

export function createFlowFx(course: Course) {
  const group = new THREE.Group();
  const rand = rng(17);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const slow = new THREE.Color("#2f4a3e");
  const quick = new THREE.Color("#f6f2e2");

  const flat = new THREE.PlaneGeometry(1, 1);
  flat.rotateX(-Math.PI / 2);
  const streaks = new THREE.InstancedMesh(
    flat,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
    STREAKS,
  );
  streaks.renderOrder = 1;
  const petalGeo = new THREE.CircleGeometry(0.07, 9);
  petalGeo.scale(0.6, 1, 1);
  petalGeo.rotateX(-Math.PI / 2);
  const petals = new THREE.InstancedMesh(
    petalGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }),
    PETALS,
  );
  const petalTint = ["#f4c9d4", "#fbeed8", "#f1b8c6", "#fff6ea"];
  for (let i = 0; i < PETALS; i++) {
    petals.setColorAt(i, col.set(petalTint[i % petalTint.length] ?? "#fff"));
  }
  group.add(streaks, petals);

  const make = (): Floater => ({ x: 0, y: -100, life: 0, max: 1, spin: 0, yaw: 0 });
  const sp = Array.from({ length: STREAKS }, make);
  const pp = Array.from({ length: PETALS }, make);
  const spawn = (f: Floater, fx: number, fy: number, span: number) => {
    for (let tries = 0; tries < 8; tries++) {
      f.x = fx + (rand() - 0.5) * 22;
      f.y = fy - 6 + rand() * span;
      if (outside(f.x, f.y) < -0.25) break;
    }
    f.max = 3 + rand() * 5;
    f.life = f.max;
    f.spin = (rand() - 0.5) * 1.5;
    f.yaw = rand() * 6.3;
  };
  const advance = (f: Floater, dt: number, flow: boolean) => {
    const c = currentAt(course, f);
    if (flow) {
      f.x += c.x * dt;
      f.y += c.y * dt;
    }
    f.life -= dt;
    return c;
  };
  const gone = (f: Floater, fx: number, fy: number) =>
    f.life <= 0 ||
    Math.abs(f.x - fx) > 12 ||
    f.y < fy - 8 ||
    f.y > fy + 24 ||
    outside(f.x, f.y) > -0.12;

  // Ripples spreading from the leaf.
  const wakeMat = () =>
    new THREE.MeshBasicMaterial({
      color: "#eef2e6",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  const wakes = Array.from({ length: WAKES }, () => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.44, 36), wakeMat());
    r.rotation.x = -Math.PI / 2;
    r.userData.age = 99;
    r.renderOrder = 1;
    group.add(r);
    return r;
  });
  let wakeTimer = 0;
  let nextWake = 0;

  return {
    group,
    update(
      dt: number,
      focus: { x: number; y: number },
      flow: boolean,
      boat: { x: number; y: number; visible: boolean },
    ) {
      for (let i = 0; i < STREAKS; i++) {
        const f = sp[i] as Floater;
        const c = advance(f, dt, flow);
        if (gone(f, focus.x, focus.y)) spawn(f, focus.x, focus.y, 30);
        const speed = Math.hypot(c.x, c.y);
        const k = Math.min(1, speed / 2.2);
        const fade = Math.min(1, f.life / 1, (f.max - f.life) / 0.6);
        q.setFromAxisAngle(up, Math.atan2(c.x, -c.y));
        p.set(f.x, 0.02, -f.y);
        s.set((0.012 + k * 0.022) * fade, 1, 0.05 + speed * 0.34);
        streaks.setMatrixAt(i, m.compose(p, q, s));
        streaks.setColorAt(i, col.copy(slow).lerp(quick, k ** 1.4));
      }
      streaks.instanceMatrix.needsUpdate = true;
      if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true;

      for (let i = 0; i < PETALS; i++) {
        const f = pp[i] as Floater;
        advance(f, dt, flow);
        if (gone(f, focus.x, focus.y)) {
          spawn(f, focus.x, focus.y, 30);
          f.max = f.life = 10 + rand() * 8;
        }
        f.yaw += f.spin * dt;
        const fade = Math.min(1, f.life / 1.5, (f.max - f.life) / 1);
        q.setFromAxisAngle(up, f.yaw);
        p.set(f.x, 0.025, -f.y);
        s.setScalar(fade);
        petals.setMatrixAt(i, m.compose(p, q, s));
      }
      petals.instanceMatrix.needsUpdate = true;

      wakeTimer += dt;
      if (boat.visible && wakeTimer > 0.55) {
        wakeTimer = 0;
        const r = wakes[nextWake++ % WAKES];
        if (r) {
          r.userData.age = 0;
          r.position.set(boat.x, 0.025, -boat.y);
        }
      }
      for (const r of wakes) {
        r.userData.age += dt;
        const a = r.userData.age as number;
        (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.32 * (1 - a / 1.6));
        r.scale.setScalar(0.9 + a * 1.1);
      }
    },
  };
}
