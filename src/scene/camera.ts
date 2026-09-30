import * as THREE from "three";
import { type Course, centreX } from "../game/course";
import type { GameState } from "../game/sim";
import { type Stage, toWorld } from "./stage";

export interface View {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
const GLIDE = 2.6;

/** Title crane and chase pose share the same camera/projection used for picking. */
export function createCameraRig(stage: Stage, course: Course, boat: THREE.Vector3, calm: boolean) {
  const { camera, renderer } = stage;
  const canvas = renderer.domElement;
  const focus = toWorld(course.start.x, course.start.y);
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const glideEye = new THREE.Vector3();
  const glideLook = new THREE.Vector3();
  const titleEye = new THREE.Vector3();
  const titleLook = new THREE.Vector3();
  const low = new THREE.Vector3(1.15, 0.42, 1.65);
  const high = new THREE.Vector3(-3.4, 8.4, 9.8);
  let first = true;
  let wasIntro = true;
  let titleClock = 0;
  let glide = -1;
  let view: View | null = null;

  function framing(title: number) {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const { left, right, top, bottom } = stage.insets;
    const portrait = stage.portrait();
    const x = (portrait ? 0 : -w * 0.17) * title + (right - left) * w * 0.5 * (1 - title);
    const y = (portrait ? h * 0.16 : 0) * title + (bottom - top) * h * 0.5 * (1 - title);
    if (Math.abs(x) + Math.abs(y) < 0.001) camera.clearViewOffset();
    else camera.setViewOffset(w, h, x, y, w, h);
  }
  const beginPlay = (skip: boolean) => {
    wasIntro = false;
    glide = skip || calm ? -1 : 0;
    glideEye.copy(camPos);
    glideLook.copy(look);
    first = true;
  };
  return {
    get gliding() {
      return glide >= 0;
    },
    beginPlay,
    setMotion(still: boolean) {
      calm = still;
      if (still) {
        glide = -1;
        first = true;
      }
    },
    setView(next: View | null) {
      view = next;
      stage.resize();
      first = true;
    },
    reset(state: GameState) {
      focus.copy(toWorld(state.x, state.y));
      first = true;
      titleClock = 0;
      wasIntro = state.status === "intro";
      glide = -1;
    },
    update(state: GameState, dt: number) {
      if (view) {
        camera.clearViewOffset();
        camera.position.set(...view.position);
        camera.lookAt(...view.target);
        if (view.fov) camera.fov = view.fov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        stage.follow(tmp.set(...view.target));
        return;
      }
      camera.fov = stage.portrait() ? 58 : 42;
      if (state.status === "intro") {
        titleClock += dt;
        const ahead = course.start.y + 24;
        const k = calm ? 1 : smooth(Math.min(1, titleClock / 8.5));
        titleEye.copy(low).lerp(high, k);
        titleEye.y += Math.sin(k * Math.PI) * 1.4;
        if (!calm && titleClock > 8.5)
          titleEye.applyAxisAngle(
            THREE.Object3D.DEFAULT_UP,
            Math.sin((titleClock - 8.5) * 0.11) * 0.22,
          );
        titleEye.add(boat);
        titleLook.set(boat.x, 0.16, boat.z).lerp(toWorld(centreX(ahead), ahead), k);
        framing(1);
        camera.position.copy(titleEye);
        camera.lookAt(titleLook);
        camPos.copy(titleEye);
        look.copy(titleLook);
        focus.copy(boat);
        wasIntro = true;
        first = false;
      } else {
        if (wasIntro) beginPlay(calm);
        const portrait = stage.portrait();
        let off: THREE.Vector3;
        let ahead: number;
        const snap = calm || first;
        if (state.status === "finished") {
          const f = course.finish.c;
          focus.lerp(toWorld(f.x - 1.5, f.y), snap ? 1 : 1 - Math.exp(-dt * 1.5));
          off = portrait ? new THREE.Vector3(-3, 10, 9) : new THREE.Vector3(-5, 5.5, 7.5);
          ahead = -1;
        } else {
          focus.lerp(boat, snap ? 1 : 1 - Math.exp(-dt * 3));
          off = portrait ? new THREE.Vector3(0, 7.2, 6.4) : new THREE.Vector3(0, 4.6, 6);
          ahead = portrait ? -2.6 : -2.2;
        }
        const gliding = glide >= 0;
        camPos.lerp(tmp.copy(focus).add(off), snap || gliding ? 1 : 1 - Math.exp(-dt * 2.2));
        look.lerp(
          tmp.set(focus.x, 0, focus.z + ahead),
          snap || gliding ? 1 : 1 - Math.exp(-dt * 3),
        );
        if (gliding) {
          glide += dt;
          const k = smooth(Math.min(1, glide / GLIDE));
          framing(1 - k);
          camera.position.copy(glideEye).lerp(camPos, k);
          camera.position.y += Math.sin(k * Math.PI) * 0.8;
          camera.lookAt(tmp.copy(glideLook).lerp(look, k));
          if (glide >= GLIDE) glide = -1;
        } else {
          framing(0);
          camera.position.copy(camPos);
          camera.lookAt(look);
        }
        first = false;
      }
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      stage.follow(focus);
    },
  };
}
