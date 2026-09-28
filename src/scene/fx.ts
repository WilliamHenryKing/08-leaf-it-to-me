// Gust and aim effects: the aim arrow, the dotted route preview, gust rings, wind streaks,
// the splash crown of a spill and droplets shaken off the beetle's coat.
import * as THREE from "three";
import { rng } from "./bankside";
import { createRingAlpha } from "./textures";

const DOTS = 31;
const DROPS = 90;
const WINDS = 14;

export function createFx() {
  const group = new THREE.Group();
  const rand = rng(5);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  // Wind streaks: thin bright lines that blow in along the gust and past the sail.
  const windGeo = new THREE.PlaneGeometry(1, 1);
  windGeo.rotateX(-Math.PI / 2);
  const winds = Array.from({ length: WINDS }, () => {
    const w = new THREE.Mesh(
      windGeo,
      new THREE.MeshBasicMaterial({
        color: "#fffaf0",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    w.userData = { age: 99, life: 0.6, vx: 0, vz: 0 };
    w.renderOrder = 3;
    group.add(w);
    return w;
  });

  // The crown of a big splash.
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.2, 0.3, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#f2f6f2",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  crown.userData.age = 99;
  group.add(crown);

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

  // Gust rings: a feathered ripple, not a hard band.
  const ringAlpha = createRingAlpha();
  const rings = Array.from({ length: 4 }, () => {
    const r = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3),
      new THREE.MeshBasicMaterial({
        color: "#fff8e8",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        alphaMap: ringAlpha,
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
    update(dt: number) {
      for (const w of winds) {
        const u = w.userData as { age: number; life: number; vx: number; vz: number };
        u.age += dt;
        const t = u.age / u.life;
        (w.material as THREE.MeshBasicMaterial).opacity = t < 1 ? 0.75 * Math.sin(Math.PI * t) : 0;
        w.position.x += u.vx * dt;
        w.position.z += u.vz * dt;
      }
      {
        crown.userData.age += dt;
        const a = crown.userData.age as number;
        (crown.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.42 * (1 - a / 0.55));
        crown.scale.set(
          1 + a * 3.4,
          0.2 + Math.sin(Math.min(1, a / 0.55) * Math.PI) * 1.1,
          1 + a * 3.4,
        );
      }

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
    /** Streaks of air blowing in along the gust (angle 0 = downstream) and past the boat. */
    wind(at: THREE.Vector3, angle: number, strength: number) {
      const dx = Math.sin(angle);
      const dz = -Math.cos(angle);
      const n = Math.round(4 + strength * 9);
      let k = 0;
      for (const w of winds) {
        if (k >= n) break;
        const u = w.userData as { age: number; life: number; vx: number; vz: number };
        if (u.age < u.life) continue;
        const side = (rand() - 0.5) * 1.6;
        const back = 2 + rand() * 1.8;
        w.position.set(
          at.x - dx * back - dz * side,
          0.15 + rand() * 0.7,
          at.z - dz * back + dx * side,
        );
        w.rotation.y = Math.atan2(dx, dz);
        w.scale.set(0.025, 1, 0.5 + strength * 0.9 + rand() * 0.3);
        const speed = 5 + strength * 5;
        u.vx = dx * speed;
        u.vz = dz * speed;
        u.life = 0.45 + rand() * 0.25;
        u.age = -k * 0.03;
        k++;
      }
    },
    /** A proper splash: a crown of water and a burst of drops. */
    bigSplash(at: THREE.Vector3) {
      crown.userData.age = 0;
      crown.position.set(at.x, 0.12, at.z);
      this.splash(at.clone().setY(0.15), 34, 1.5);
      this.ring(at);
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
