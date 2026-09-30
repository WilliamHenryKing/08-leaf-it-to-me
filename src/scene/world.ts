// Assembles the brook and animates it from the game state each frame.
import gsap from "gsap";
import * as THREE from "three";
import { type Course, centreX } from "../game/course";
import { type GameEvent, type GameState, predict, SPILL_AT } from "../game/sim";
import type { Assets } from "./assets";
import { createBanks } from "./banks";
import { createBankside } from "./bankside";
import { createBoat } from "./boat";
import { createDuck } from "./duck";
import { createFlowFx } from "./flowfx";
import { createFx } from "./fx";
import { createGroundMaterial } from "./ground";
import { createCarriedLantern, createLanterns } from "./lanterns";
import { createMoodLight, moodAt } from "./mood";
import { createObstacles } from "./obstacles";
import { updateOcclusion } from "./occlude";
import { createPlaces } from "./places";
import { playRescue } from "./rescue";
import { sunUniforms } from "./skins";
import { createStage, toWorld } from "./stage";
import { createStones } from "./stones";
import { createWater } from "./water";

export interface Aim {
  angle: number;
  strength: number;
}

/** A fixed camera for visual captures: position and target in world units. */
export interface View {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export function createWorld(
  canvas: HTMLCanvasElement,
  course: Course,
  reducedMotion: boolean,
  assets: Assets,
) {
  const stage = createStage(canvas);
  const { scene, camera } = stage;
  const water = createWater(course);
  const lanterns = createLanterns(course, assets.bark);
  const boat = createBoat();
  const carried = createCarriedLantern();
  boat.mastTop.add(carried.group);
  const duck = createDuck();
  const fx = createFx();
  const flow = createFlowFx(course);
  const groundUniforms = { uTime: { value: 0 }, uSun: { value: new THREE.Color() } };
  const ground = createGroundMaterial(assets, groundUniforms);
  scene.add(
    water.mesh,
    createBanks(ground),
    createBankside(course, assets),
    createStones(assets),
    createObstacles(course, assets),
  );
  const places = createPlaces(course, assets);
  const mood = createMoodLight(stage);
  // Transparent surfaces and effects stay out of the ambient-occlusion depth pass.
  for (const o of [water.mesh, fx.group, flow.group]) stage.pipeline.hideFromAO(o);
  scene.add(lanterns.group, boat.group, duck.group, fx.group, flow.group, places.group);

  const focus = new THREE.Vector3(course.start.x, 0, -course.start.y);
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let first = true;
  /** While the duck carries the boat, the scene owns the boat's position. */
  let carrying = false;
  let clock = 0;
  /** How full the sail is after a gust; decays back to slack. */
  let billow = 0;
  let view: View | null = null;
  const drawSize = new THREE.Vector2();
  // Captures and tests need a fixed quality; everyone else gets the adaptive step.
  const search = new URLSearchParams(location.search);
  const adaptive = !search.has("e2e") && !search.has("capture");
  const tmp = new THREE.Vector3();
  const dur = (s: number) => (reducedMotion ? s * 0.45 : s);

  // The opening, as a film. While the title card is up the camera starts low beside the beetle
  // in its leaf, then cranes up and back until the brook opens out ahead toward the Root
  // Tunnel, and drifts there. "Set sail" glides it down into the chase view behind the boat.
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const CRANE = 8.5;
  const GLIDE = 2.6;
  let titleClock = 0;
  let wasIntro = true;
  let glide = -1;
  const glideEye = new THREE.Vector3();
  const glideLook = new THREE.Vector3();
  const titleEye = new THREE.Vector3();
  const titleLook = new THREE.Vector3();
  const low = new THREE.Vector3(1.15, 0.42, 1.65);
  const high = new THREE.Vector3(-3.4, 8.4, 9.8);
  function titleShot(t: number) {
    const s = boat.group.position;
    const ahead = course.start.y + 24;
    const k = reducedMotion ? 1 : smooth(Math.min(1, t / CRANE));
    titleEye.copy(low).lerp(high, k);
    // A crane's arc: up first, then back.
    titleEye.y += Math.sin(k * Math.PI) * 1.4;
    if (!reducedMotion && t > CRANE) {
      titleEye.applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.sin((t - CRANE) * 0.11) * 0.22);
    }
    titleEye.add(s);
    titleLook.set(s.x, 0.16, s.z).lerp(toWorld(centreX(ahead), ahead), k);
  }
  /** Frame the subject clear of the title card: right of centre, or above it on a phone. */
  function titleFraming(k: number) {
    if (k <= 0.001) {
      if (camera.view?.enabled) camera.clearViewOffset();
      return;
    }
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const portrait = stage.portrait();
    camera.setViewOffset(w, h, portrait ? 0 : -w * 0.17 * k, portrait ? h * 0.16 * k : 0, w, h);
  }

  function placeCamera(state: GameState, dt: number) {
    if (view) {
      titleFraming(0);
      camera.position.set(...view.position);
      camera.lookAt(...view.target);
      if (view.fov && camera.fov !== view.fov) {
        camera.fov = view.fov;
        camera.updateProjectionMatrix();
      }
      stage.follow(tmp.set(...view.target));
      return;
    }
    if (state.status === "intro") {
      titleFraming(1);
      titleShot(titleClock);
      camera.position.copy(titleEye);
      camera.lookAt(titleLook);
      camPos.copy(titleEye);
      look.copy(titleLook);
      focus.copy(boat.group.position);
      stage.follow(focus);
      wasIntro = true;
      first = false;
      return;
    }
    if (wasIntro) {
      // Set sail: glide from wherever the title shot had got to.
      wasIntro = false;
      glide = reducedMotion ? -1 : 0;
      glideEye.copy(camPos);
      glideLook.copy(look);
    }
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
    }
    tmp.copy(focus).add(off);
    const gliding = glide >= 0;
    camPos.lerp(tmp, first || gliding ? 1 : 1 - Math.exp(-dt * 2.2));
    tmp.set(focus.x, 0, focus.z + ahead);
    look.lerp(tmp, first || gliding ? 1 : 1 - Math.exp(-dt * 3));
    if (gliding) {
      glide += dt;
      const k = smooth(Math.min(1, glide / GLIDE));
      titleFraming(1 - k);
      camera.position.copy(glideEye).lerp(camPos, k);
      // Swing wide on the way down, so the glide reads as a move rather than a zoom.
      camera.position.y += Math.sin(k * Math.PI) * 0.8;
      camera.lookAt(tmp.copy(glideLook).lerp(look, k));
      if (glide >= GLIDE) glide = -1;
    } else {
      titleFraming(0);
      camera.position.copy(camPos);
      camera.lookAt(look);
    }
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
    boat.sail.scale.z = 1 + Math.abs(state.heel) * 1.6 + billow * 3.2;
    boat.sail.scale.x = 1 + billow * 0.15;
    const b = boat.beetle;
    const shiver = reducedMotion ? 0 : state.wet * Math.sin(clock * 38) * 0.18;
    b.rotation.set(0, shiver, state.heel * 0.3);
    if (state.wet > 0.2 && Math.random() < state.wet * 0.25) {
      b.getWorldPosition(tmp);
      fx.splash(tmp.setY(tmp.y + 0.15), 1, 0.6);
    }
  }

  function onEvents(events: GameEvent[], state: GameState, rescueDone: () => void) {
    for (const e of events) {
      if (e.type === "gust") {
        fx.ring(boat.group.position);
        fx.wind(boat.group.position, e.angle, e.strength);
        billow = Math.max(billow, 0.4 + e.strength * 0.6);
        if (e.spilled) fx.bigSplash(boat.group.position);
        boat.beetle.getWorldPosition(tmp);
        fx.splash(tmp.setY(tmp.y + 0.15), Math.round(4 + e.strength * 14), 0.6 + e.strength * 0.7);
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
        carrying = true;
        playRescue({ course, state, duck: duck.group, boat: boat.group, fx, dur }, () => {
          carrying = false;
          rescueDone();
        });
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
    frame(state: GameState, aim: Aim | null, dt: number, flowing: boolean, frameSeconds = 0) {
      clock += dt;
      if (state.status === "intro") titleClock += dt;
      if (adaptive) stage.pipeline.adapt(frameSeconds);
      placeBoat(state);
      const here = state.status === "finished" ? { gloom: 0, warmth: 1 } : moodAt(state.x, state.y);
      mood.update(here, dt, first);
      water.update(reducedMotion ? clock * 0.5 : clock, mood.current.gloom, mood.current.warmth);
      places.update(clock, mood.current, reducedMotion);
      groundUniforms.uTime.value = reducedMotion ? 0 : clock;
      groundUniforms.uSun.value.copy(stage.sun.color).multiplyScalar(stage.sun.intensity);
      sunUniforms.uSunColor.value.copy(groundUniforms.uSun.value);
      stage.renderer.getDrawingBufferSize(drawSize);
      updateOcclusion(camera, boat.group.position, drawSize.x, drawSize.y);
      lanterns.updateLights(boat.group.position);
      sunUniforms.uSunDir.value
        .subVectors(stage.sun.position, stage.sun.target.position)
        .normalize()
        .transformDirection(camera.matrixWorldInverse);
      placeCamera(state, dt);
      preview(state, aim);
      billow *= Math.exp(-dt * 2.5);
      fx.update(dt);
      flow.update(dt, { x: state.x, y: state.y }, flowing, {
        x: boat.group.position.x,
        y: -boat.group.position.z,
        visible: !carrying,
      });
      lanterns.floating.forEach((l, i) => {
        if (l.visible && !reducedMotion && !gsap.isTweening(l.position))
          l.position.y = 0.02 + Math.sin(clock * 1.6 + i) * 0.03;
      });
      stage.render();
    },
    /** Visual captures: pin the camera (null returns it to the boat), the clock and the effects. */
    setView(v: View | null) {
      view = v;
      stage.resize();
    },
    setClock(t: number) {
      clock = t;
    },
    prime(state: GameState) {
      flow.reseed();
      for (let i = 0; i < 90; i++)
        flow.update(1 / 30, { x: state.x, y: state.y }, true, {
          x: state.x,
          y: state.y,
          visible: true,
        });
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
