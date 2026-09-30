import { afterEach, describe, expect, test } from "bun:test";
import gsap from "gsap";
import * as THREE from "three";
import { createCourse } from "../src/game/course";
import { createState, startSailing } from "../src/game/sim";
import { createCameraRig } from "../src/scene/camera";
import type { Fx } from "../src/scene/fx";
import { SceneMotions } from "../src/scene/motions";
import { playRescue, type RescueMotion } from "../src/scene/rescue";
import { type Stage, toWorld } from "../src/scene/stage";

const motions: SceneMotions[] = [];
const rescues: RescueMotion[] = [];
const unrelated: gsap.core.Animation[] = [];
afterEach(() => {
  for (const motion of motions.splice(0)) motion.cancel();
  for (const rescue of rescues.splice(0)) rescue.cancel();
  for (const tween of unrelated.splice(0)) tween.kill();
  gsap.ticker.sleep();
});
function owned() {
  const motion = new SceneMotions();
  motions.push(motion);
  return motion;
}
function rescue(still = false) {
  const course = createCourse();
  const state = createState(course);
  state.status = "stranded";
  state.reach = 1;
  state.x = 2;
  state.y = 46;
  const boat = new THREE.Group();
  boat.position.copy(toWorld(state.x, state.y, 0.01));
  const duck = new THREE.Group();
  let done = 0;
  let splashes = 0;
  const fx = {
    splash: () => splashes++,
    bigSplash: () => splashes++,
  } as unknown as Fx;
  const motion = playRescue(
    { course, state, boat, duck, fx, still, dur: (seconds) => seconds },
    () => done++,
  );
  rescues.push(motion);
  return { motion, boat, duck, course, state, done: () => done, splashes: () => splashes };
}
function cameraStage(width: number, height: number) {
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 400);
  const stage = {
    camera,
    renderer: { domElement: { clientWidth: width, clientHeight: height } },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    portrait: () => width / height < 0.8,
    follow: () => {},
    resize: () => {},
  } as unknown as Stage;
  const course = createCourse();
  const state = createState(course);
  const boat = toWorld(state.x, state.y, 0.01);
  const rig = createCameraRig(stage, course, boat, false);
  return { camera, stage, course, state, boat, rig };
}

describe("owned replay and rescue motion", () => {
  test("canceling a scene leaves unrelated GSAP choreography intact", () => {
    const motion = owned();
    const ownTween = motion.to({ x: 0 }, { x: 1, duration: 1, paused: true });
    const other = gsap.to({ x: 0 }, { x: 1, duration: 1, paused: true });
    unrelated.push(other);
    motion.cancel();
    expect(ownTween.parent).toBeNull();
    expect(other.parent).not.toBeNull();
  });

  test("live calm finishes pickups and delayed finale callbacks exactly once", () => {
    const motion = owned();
    const parcel = { scale: 1 };
    let picked = 0;
    let lit = 0;
    motion.to(parcel, { scale: 0.2, duration: 0.5, paused: true, onComplete: () => picked++ });
    motion.later(30, () => lit++);
    motion.finish();
    motion.finish();
    expect(parcel.scale).toBeCloseTo(0.2);
    expect(picked).toBe(1);
    expect(lit).toBe(1);
  });

  test("rescue cancellation settles false and never advances the replacement run", async () => {
    const r = rescue();
    r.motion.cancel();
    r.motion.finish();
    r.motion.cancel();
    expect(await r.motion.completed).toBe(false);
    expect(r.done()).toBe(0);
    expect(r.duck.visible).toBe(false);
    expect(r.boat.position.z).toBe(-r.state.y);
  });

  test("finishing a rescue reaches the true checkpoint and settles once", async () => {
    const r = rescue();
    r.motion.finish();
    r.motion.finish();
    r.motion.cancel();
    const pool = r.course.reaches[r.state.reach]?.pool;
    if (!pool) throw new Error("authored rescue pool");
    expect(await r.motion.completed).toBe(true);
    expect(r.done()).toBe(1);
    expect(r.boat.position.toArray()).toEqual([pool.x, 0.01, -pool.y]);
    expect(r.duck.visible).toBe(false);
  });

  test("initial calm rescues finish immediately without splash animation", async () => {
    const r = rescue(true);
    expect(await r.motion.completed).toBe(true);
    expect(r.done()).toBe(1);
    expect(r.splashes()).toBe(0);
  });
});

describe("camera transition and projection ownership", () => {
  test("beginPlay gates physics synchronously and live calm finishes the glide", () => {
    const { rig, state } = cameraStage(1440, 900);
    rig.update(state, 6);
    startSailing(state);
    rig.beginPlay(false);
    expect(rig.gliding).toBe(true);
    rig.update(state, 0.2);
    expect(rig.gliding).toBe(true);
    rig.setMotion(true);
    expect(rig.gliding).toBe(false);
    rig.update(state, 0);
  });

  test("a reset preserves fixed capture pose and clearing it restores normal FOV", () => {
    const { rig, camera, stage, state } = cameraStage(320, 568);
    rig.setView({ position: [3, 4, 5], target: [0, 0, 0], fov: 33 });
    rig.reset(state);
    rig.update(state, 1);
    expect(camera.position.toArray()).toEqual([3, 4, 5]);
    expect(camera.fov).toBe(33);
    expect(camera.view?.enabled ?? false).toBe(false);
    rig.setView(null);
    startSailing(state);
    rig.beginPlay(true);
    rig.update(state, 0);
    expect(camera.fov).toBe(58);
    expect(stage.portrait()).toBe(true);
  });

  test("short-landscape framing keeps the boat in the clear band and ray projection agrees", () => {
    const { rig, camera, stage, state, boat } = cameraStage(568, 320);
    stage.insets = { top: 0.025, bottom: 0.025, left: 0.025, right: (260 + 8) / 568 };
    rig.update(state, 6);
    expect(camera.view?.offsetX).toBeCloseTo(-568 * 0.17);
    startSailing(state);
    rig.beginPlay(true);
    rig.update(state, 0);
    const projected = boat.clone().setY(0).project(camera);
    const u = (projected.x + 1) / 2;
    const v = (1 - projected.y) / 2;
    expect(u).toBeGreaterThan(stage.insets.left);
    expect(u).toBeLessThan(1 - stage.insets.right);
    expect(v).toBeGreaterThan(stage.insets.top);
    expect(v).toBeLessThan(1 - stage.insets.bottom);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
    const hit = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
    expect(hit?.x).toBeCloseTo(boat.x, 8);
    expect(hit?.z).toBeCloseTo(boat.z, 8);
  });
});
