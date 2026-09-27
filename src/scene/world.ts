// Assembles the brook and animates it from the game state each frame.
import gsap from "gsap";
import * as THREE from "three";
import type { Course } from "../game/course";
import { type GameEvent, type GameState, predict, SPILL_AT } from "../game/sim";
import { createBanks } from "./banks";
import { createBankside } from "./bankside";
import { createBoat } from "./boat";
import { createDuck } from "./duck";
import { createFx } from "./fx";
import { createCarriedLantern, createLanterns } from "./lanterns";
import { createObstacles } from "./obstacles";
import { createStage, toWorld } from "./stage";
import { createWater } from "./water";

export interface Aim {
  angle: number;
  strength: number;
}

export function createWorld(canvas: HTMLCanvasElement, course: Course, reducedMotion: boolean) {
  const stage = createStage(canvas);
  const { scene, camera, renderer } = stage;
  const water = createWater(course);
  const lanterns = createLanterns(course);
  const boat = createBoat();
  const carried = createCarriedLantern();
  boat.mastTop.add(carried.group);
  const duck = createDuck();
  const fx = createFx(course);
  scene.add(water.mesh, createBanks(), createBankside(course), createObstacles(course));
  scene.add(lanterns.group, boat.group, duck.group, fx.group);

  const focus = new THREE.Vector3(course.start.x, 0, -course.start.y);
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let first = true;
  /** While the duck carries the boat, the scene owns the boat's position. */
  let carrying = false;
  let clock = 0;
  const tmp = new THREE.Vector3();
  const dur = (s: number) => (reducedMotion ? s * 0.45 : s);

  function placeCamera(state: GameState, dt: number) {
    const portrait = stage.portrait();
    const target = boat.group.position;
    let off: THREE.Vector3;
    let ahead: number;
    if (state.status === "finished") {
      const f = course.finish.c;
      focus.lerp(toWorld(f.x - 1.5, f.y), 1 - Math.exp(-dt * 1.5));
      off = portrait ? new THREE.Vector3(-3, 10, 9) : new THREE.Vector3(-5, 5.5, 7.5);
      ahead = -1;
    } else {
      focus.lerp(target, first ? 1 : 1 - Math.exp(-dt * 3));
      off = portrait ? new THREE.Vector3(0, 7.2, 6.4) : new THREE.Vector3(0, 4.6, 6);
      ahead = portrait ? -2.6 : -2.2;
      if (state.status === "intro" && !reducedMotion) {
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(clock * 0.25) * 0.35);
      }
    }
    tmp.copy(focus).add(off);
    camPos.lerp(tmp, first ? 1 : 1 - Math.exp(-dt * 2.2));
    tmp.set(focus.x, 0, focus.z + ahead);
    look.lerp(tmp, first ? 1 : 1 - Math.exp(-dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(look);
    stage.follow(focus);
    first = false;
  }

  function placeBoat(state: GameState) {
    if (carrying) return;
    const bob = reducedMotion ? 0 : Math.sin(clock * 2.1) * 0.012;
    boat.group.position.set(state.x, 0.01 + bob, -state.y);
    const h = boat.hull;
    h.rotation.y = -state.heading;
    h.rotation.z = -state.heel * 0.42;
    h.rotation.x = reducedMotion ? 0 : Math.sin(clock * 1.7) * 0.03;
    boat.sail.scale.z = 1 + Math.abs(state.heel) * 2.2;
    const b = boat.beetle;
    const shiver = reducedMotion ? 0 : state.wet * Math.sin(clock * 38) * 0.18;
    b.rotation.set(0, shiver, state.heel * 0.3);
    if (state.wet > 0.2 && Math.random() < state.wet * 0.25) {
      b.getWorldPosition(tmp);
      fx.splash(tmp.setY(tmp.y + 0.15), 1, 0.6);
    }
  }

  function rescueAnimation(state: GameState, onDone: () => void) {
    const pool = course.reaches[state.reach]?.pool ?? course.start;
    const from = toWorld(state.x, state.y);
    const side = state.x > (pool.x ?? 0) ? 1 : -1;
    const d = duck.group;
    d.visible = true;
    d.position.set(from.x + side * 6, 0, from.z - 3);
    d.lookAt(from.x, 0, from.z);
    d.rotateY(Math.PI);
    carrying = true;
    const tl = gsap.timeline({
      onComplete: () => {
        d.visible = false;
        carrying = false;
        onDone();
      },
    });
    const toPool = toWorld(pool.x, pool.y);
    tl.to(d.position, {
      x: from.x + side * 1.7,
      z: from.z - 1.4,
      duration: dur(0.8),
      ease: "power2.out",
    })
      .add(() => fx.splash(boat.group.position.clone().setY(0.2), 10, 1.2))
      .to(boat.group.position, { y: 1.2, duration: dur(0.3), ease: "back.out(2)" })
      .to(
        d.position,
        {
          x: toPool.x + side * 1.7,
          z: toPool.z - 1.4,
          y: 0.6,
          duration: dur(1.1),
          ease: "sine.inOut",
        },
        ">",
      )
      .to(
        boat.group.position,
        { x: toPool.x, z: toPool.z, duration: dur(1.1), ease: "sine.inOut" },
        "<",
      )
      .to(boat.group.position, { y: 0.01, duration: dur(0.3), ease: "bounce.out" })
      .to(d.position, {
        x: toPool.x + side * 9,
        y: 0,
        z: toPool.z + 2,
        duration: dur(0.8),
        ease: "power1.in",
      });
  }

  function onEvents(events: GameEvent[], state: GameState, rescueDone: () => void) {
    for (const e of events) {
      if (e.type === "gust") {
        fx.ring(boat.group.position);
        boat.beetle.getWorldPosition(tmp);
        fx.splash(tmp.setY(tmp.y + 0.15), e.spilled ? 16 : 5, e.spilled ? 1.1 : 0.7);
      } else if (e.type === "bump") {
        fx.splash(boat.group.position.clone().setY(0.1), 8, 0.9);
      } else if (e.type === "lantern") {
        const l = lanterns.floating[e.index];
        if (!l) continue;
        const count = state.lanterns.filter(Boolean).length;
        gsap.to(l.position, {
          x: boat.group.position.x,
          y: 0.7,
          z: boat.group.position.z,
          duration: dur(0.5),
          ease: "power2.in",
        });
        gsap.to(l.scale, {
          x: 0.2,
          y: 0.2,
          z: 0.2,
          duration: dur(0.5),
          onComplete: () => {
            l.visible = false;
            carried.set(count);
          },
        });
      } else if (e.type === "stranded") {
        rescueAnimation(state, rescueDone);
      } else if (e.type === "finished") {
        const lit = [...state.lanterns];
        lit.forEach((on, i) => {
          if (!on) return;
          gsap.delayedCall(dur(0.6 + i * 0.25), () =>
            lanterns.lightSlots(lit.map((v, j) => v && j <= i)),
          );
        });
        lanterns.guests.forEach((g, i) => {
          gsap.to(g.position, {
            y: 0.35,
            yoyo: true,
            repeat: reducedMotion ? 0 : 5,
            duration: 0.25,
            delay: i * 0.1,
          });
        });
      }
    }
  }

  function preview(state: GameState, aim: Aim | null) {
    if (!aim || state.status !== "sailing") {
      fx.hideAim();
      return;
    }
    const path = predict(course, state, aim, 3);
    fx.showAim(
      boat.group.position,
      aim.angle,
      aim.strength,
      aim.strength > SPILL_AT,
      state.cooldown <= 0,
    );
    fx.showPreview(path.points);
  }

  return {
    stage,
    onEvents,
    resize: stage.resize,
    /** Screen point to game coordinates on the water plane. */
    toGame(clientX: number, clientY: number) {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
      return { x: hit.x, y: -hit.z };
    },
    frame(state: GameState, aim: Aim | null, dt: number, flowing: boolean) {
      clock += dt;
      water.update(reducedMotion ? clock * 0.5 : clock);
      placeBoat(state);
      placeCamera(state, dt);
      preview(state, aim);
      fx.update(dt, { x: state.x, y: state.y }, flowing);
      lanterns.floating.forEach((l, i) => {
        if (l.visible && !reducedMotion && !gsap.isTweening(l.position))
          l.position.y = 0.02 + Math.sin(clock * 1.6 + i) * 0.03;
      });
      renderer.render(scene, camera);
    },
    reset(state: GameState) {
      gsap.globalTimeline.clear();
      carrying = false;
      duck.group.visible = false;
      lanterns.reset();
      lanterns.floating.forEach((l, i) => {
        const p = course.lanterns[i];
        if (p) l.position.set(p.x, 0.02, -p.y);
      });
      carried.set(0);
      first = true;
      placeBoat(state);
    },
  };
}

export type World = ReturnType<typeof createWorld>;
