// Assembles the brook and animates it from the game state each frame.
import gsap from "gsap";
import * as THREE from "three";
import type { Course } from "../game/course";
import { createState, type GameEvent, type GameState, predict, SPILL_AT } from "../game/sim";
import { type Assets, assetsOwner } from "./assets";
import { createBanks } from "./banks";
import { createBankside } from "./bankside";
import { createBoat } from "./boat";
import { createCameraRig, type View } from "./camera";
import { createDuck } from "./duck";
import { createFlowFx } from "./flowfx";
import { createFx } from "./fx";
import { createGroundMaterial } from "./ground";
import { createCarriedLantern, createLanterns } from "./lanterns";
import { createMoodLight, moodAt } from "./mood";
import { SceneMotions } from "./motions";
import { createObstacles } from "./obstacles";
import { updateOcclusion } from "./occlude";
import { createPlaces } from "./places";
import { playRescue, type RescueMotion } from "./rescue";
import { sunUniforms } from "./skins";
import { createStage, type Stage } from "./stage";
import { createStones } from "./stones";
import { createWater } from "./water";

export interface Aim {
  angle: number;
  strength: number;
}

/** A fixed camera for visual captures: position and target in world units. */
export type { View } from "./camera";

export function createWorld(
  canvas: HTMLCanvasElement,
  course: Course,
  reducedMotion: boolean,
  assets: Assets,
) {
  const owner = assetsOwner(assets);
  const stage = createStage(canvas, owner);
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
  owner.resources.tree(scene);

  const rig = createCameraRig(stage, course, boat.group.position, reducedMotion);
  const motions = new SceneMotions();
  let rescueMotion: RescueMotion | null = null;
  let disposed = false;
  let carrying = false;
  let first = true;
  let clock = 0;
  let billow = 0;
  const drawSize = new THREE.Vector2();
  const search = new URLSearchParams(location.search);
  const adaptive = !search.has("e2e") && !search.has("capture");
  const tmp = new THREE.Vector3();

  function placeBoat(state: GameState, dt = 0) {
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
    if (dt > 0 && !reducedMotion && state.wet > 0.2 && Math.random() < state.wet * 0.25) {
      b.getWorldPosition(tmp);
      fx.splash(tmp.setY(tmp.y + 0.15), 1, 0.6);
    }
  }

  function onEvents(events: GameEvent[], state: GameState, rescueDone: () => void) {
    if (disposed) return;
    for (const e of events) {
      if (e.type === "gust") {
        if (reducedMotion) continue;
        fx.ring(boat.group.position);
        fx.wind(boat.group.position, e.angle, e.strength);
        billow = Math.max(billow, 0.4 + e.strength * 0.6);
        if (e.spilled) fx.bigSplash(boat.group.position);
        boat.beetle.getWorldPosition(tmp);
        fx.splash(tmp.setY(tmp.y + 0.15), Math.round(4 + e.strength * 14), 0.6 + e.strength * 0.7);
      } else if (e.type === "bump") {
        if (!reducedMotion) fx.splash(boat.group.position.clone().setY(0.1), 8, 0.9);
      } else if (e.type === "lantern") {
        const l = lanterns.floating[e.index];
        if (!l) continue;
        const count = state.lanterns.filter(Boolean).length;
        if (reducedMotion) {
          l.visible = false;
          carried.set(count);
          continue;
        }
        motions.to(l.position, {
          x: boat.group.position.x,
          y: 0.7,
          z: boat.group.position.z,
          duration: 0.5,
          ease: "power2.in",
        });
        motions.to(l.scale, {
          x: 0.2,
          y: 0.2,
          z: 0.2,
          duration: 0.5,
          onComplete: () => {
            if (disposed) return;
            l.visible = false;
            carried.set(count);
          },
        });
      } else if (e.type === "stranded") {
        rescueMotion?.cancel();
        carrying = true;
        rescueMotion = playRescue(
          {
            course,
            state,
            duck: duck.group,
            boat: boat.group,
            fx,
            dur: (seconds) => seconds,
            still: reducedMotion,
          },
          () => {
            if (disposed) return;
            carrying = false;
            rescueDone();
          },
        );
      } else if (e.type === "finished") {
        const lit = [...state.lanterns];
        if (reducedMotion) {
          lanterns.lightSlots(lit);
          continue;
        }
        lit.forEach((on, i) => {
          if (!on) return;
          motions.later(0.6 + i * 0.25, () => lanterns.lightSlots(lit.map((v, j) => v && j <= i)));
        });
        lanterns.guests.forEach((g, i) => {
          motions.to(g.position, {
            y: 0.35,
            yoyo: true,
            repeat: 5,
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

  const api = {
    stage,
    ready: Promise.resolve(),
    get gliding() {
      return rig.gliding;
    },
    beginPlay(skip: boolean) {
      if (!disposed) rig.beginPlay(skip);
    },
    setMotion(calm: boolean) {
      if (disposed || reducedMotion === calm) return;
      reducedMotion = calm;
      rig.setMotion(calm);
      if (calm) {
        rescueMotion?.finish();
        motions.finish();
        fx.reset();
        billow = 0;
        lanterns.guests.forEach((guest) => {
          guest.position.y = 0.19;
        });
      }
    },
    setInsets(insets: Stage["insets"]) {
      stage.insets = { ...insets };
    },
    onEvents,
    resize: stage.resize,
    /** Screen point to game coordinates on the water plane. */
    toGame(clientX: number, clientY: number) {
      if (disposed) return null;
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      camera.updateMatrixWorld(true);
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
      if (disposed) return;
      stage.prepareFrame();
      clock += dt;
      if (adaptive) stage.pipeline.adapt(frameSeconds);
      placeBoat(state, dt);
      const here = state.status === "finished" ? { gloom: 0, warmth: 1 } : moodAt(state.x, state.y);
      mood.update(here, dt, first || reducedMotion);
      water.update(reducedMotion ? 0 : clock, mood.current.gloom, mood.current.warmth);
      places.update(clock, mood.current, reducedMotion);
      groundUniforms.uTime.value = reducedMotion ? 0 : clock;
      groundUniforms.uSun.value.copy(stage.sun.color).multiplyScalar(stage.sun.intensity);
      sunUniforms.uSunColor.value.copy(groundUniforms.uSun.value);
      rig.update(state, dt);
      stage.renderer.getDrawingBufferSize(drawSize);
      updateOcclusion(camera, boat.group.position, drawSize.x, drawSize.y);
      lanterns.updateLights(boat.group.position);
      sunUniforms.uSunDir.value
        .subVectors(stage.sun.position, stage.sun.target.position)
        .normalize()
        .transformDirection(camera.matrixWorldInverse);
      preview(state, aim);
      billow *= Math.exp(-dt * 2.5);
      fx.update(dt);
      flow.update(reducedMotion ? 0 : dt, { x: state.x, y: state.y }, flowing, {
        x: boat.group.position.x,
        y: -boat.group.position.z,
        visible: !carrying,
      });
      lanterns.floating.forEach((l, i) => {
        if (l.visible && !reducedMotion && !gsap.isTweening(l.position))
          l.position.y = 0.02 + Math.sin(clock * 1.6 + i) * 0.03;
      });
      stage.render();
      first = false;
    },
    /** Visual captures: pin the camera (null returns it to the boat), the clock and the effects. */
    setView(v: View | null) {
      if (!disposed) rig.setView(v);
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
      if (disposed) return;
      rescueMotion?.cancel();
      rescueMotion = null;
      motions.cancel();
      carrying = false;
      duck.group.visible = false;
      lanterns.reset();
      lanterns.floating.forEach((l, i) => {
        const p = course.lanterns[i];
        if (p) l.position.set(p.x, 0.02, -p.y);
        l.visible = !state.lanterns[i];
      });
      carried.set(state.lanterns.filter(Boolean).length);
      if (state.status === "finished") lanterns.lightSlots(state.lanterns);
      fx.reset();
      flow.reseed();
      billow = clock = 0;
      first = true;
      placeBoat(state);
      rig.reset(state);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rescueMotion?.cancel();
      rescueMotion = null;
      motions.cancel();
      fx.reset();
      owner.resources.tree(scene);
      stage.dispose();
    },
  };
  const initial = createState(course);
  api.reset(initial);
  api.frame(initial, null, 0, false);
  api.ready = stage
    .precompile()
    .then(() => {
      owner.assertAlive();
      api.frame(initial, null, 0, false);
    })
    .catch((error) => {
      api.dispose();
      throw error;
    });
  void api.ready.catch(() => {});
  return api;
}

export type World = ReturnType<typeof createWorld>;
