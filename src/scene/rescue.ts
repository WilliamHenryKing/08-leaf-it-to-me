// The duck rescue: a very large duck swims up, lifts the stranded leaf and sets it down in the
// last calm pool. Brief, so retrying stays pleasant.
import gsap from "gsap";
import type * as THREE from "three";
import type { Course } from "../game/course";
import type { GameState } from "../game/sim";
import type { Fx } from "./fx";
import { toWorld } from "./stage";

export interface RescueContext {
  course: Course;
  state: GameState;
  duck: THREE.Object3D;
  boat: THREE.Object3D;
  fx: Fx;
  dur: (s: number) => number;
  still?: boolean;
}

export function playRescue(ctx: RescueContext, onDone: () => void) {
  const { course, state, duck, boat, fx, dur } = ctx;
  const pool = course.reaches[state.reach]?.pool ?? course.start;
  const from = toWorld(state.x, state.y);
  const side = state.x > (pool.x ?? 0) ? 1 : -1;
  const d = duck;
  d.visible = true;
  d.position.set(from.x + side * 6, 0, from.z - 3);
  d.lookAt(from.x, 0, from.z);
  d.rotateY(Math.PI);
  let settled = false;
  let resolve: (completed: boolean) => void = () => {};
  const completed = new Promise<boolean>((done) => {
    resolve = done;
  });
  const complete = () => {
    if (settled) return;
    settled = true;
    d.visible = false;
    resolve(true);
    onDone();
  };
  const tl = gsap.timeline({ paused: true, onComplete: complete });
  const toPool = toWorld(pool.x, pool.y);
  tl.to(d.position, {
    x: from.x + side * 1.7,
    z: from.z - 1.4,
    duration: dur(0.8),
    ease: "power2.out",
  })
    .add(() => {
      if (!ctx.still) fx.splash(boat.position.clone().setY(0.2), 10, 1.2);
    })
    .to(boat.position, { y: 1.2, duration: dur(0.3), ease: "back.out(2)" })
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
    .to(boat.position, { x: toPool.x, z: toPool.z, duration: dur(1.1), ease: "sine.inOut" }, "<")
    .to(boat.position, { y: 0.01, duration: dur(0.3), ease: "bounce.out" })
    .add(() => {
      if (!ctx.still) fx.bigSplash(boat.position);
    })
    .to(d.position, {
      x: toPool.x + side * 9,
      y: 0,
      z: toPool.z + 2,
      duration: dur(0.8),
      ease: "power1.in",
    });
  const motion = {
    completed,
    finish() {
      if (settled) return;
      tl.totalProgress(1, false);
      boat.position.copy(toPool).setY(0.01);
      complete();
    },
    cancel() {
      if (settled) return;
      settled = true;
      tl.kill();
      d.visible = false;
      resolve(false);
    },
  };
  if (ctx.still) motion.finish();
  else tl.play();
  return motion;
}

export type RescueMotion = ReturnType<typeof playRescue>;
