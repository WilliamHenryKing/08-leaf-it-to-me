// The light of each place: shade under the root tunnel, a warm dusk over the lantern pond.
import * as THREE from "three";
import { centreX } from "../game/course";
import { smoothstep } from "../game/vec";
import { PALETTE, type Stage } from "./stage";

export interface Mood {
  gloom: number;
  warmth: number;
}

/** How dim (tunnel) and how warm (pond) the light is at a point on the brook. */
export function moodAt(x: number, y: number): Mood {
  const u = x - centreX(y);
  const inTunnelSpan = smoothstep(43.5, 46.5, y) * (1 - smoothstep(53.5, 56.5, y));
  const underRoot = 0.45 + 0.55 * smoothstep(0.5, -2, u);
  return { gloom: inTunnelSpan * underRoot, warmth: smoothstep(64, 80, y) };
}

const TUNNEL_FOG = new THREE.Color("#4a4630");
const DUSK_FOG = new THREE.Color("#bfa48c");
const DUSK_SUN = new THREE.Color("#ffb680");
const DUSK_SKY = new THREE.Color("#9a8fb4");

/** Eases the stage's light, fog and background towards the mood of where the boat is. */
export function createMoodLight(stage: Stage) {
  const current: Mood = { gloom: 0, warmth: 0 };
  const fog = stage.scene.fog as THREE.Fog;
  const bg = stage.scene.background as THREE.Color;
  return {
    current,
    update(target: Mood, dt: number, snap = false) {
      const k = snap ? 1 : 1 - Math.exp(-dt * 1.2);
      current.gloom += (target.gloom - current.gloom) * k;
      current.warmth += (target.warmth - current.warmth) * k;
      const { gloom: g, warmth: w } = current;
      stage.sun.intensity = 2.6 * (1 - 0.6 * g) * (1 - 0.12 * w);
      stage.sun.color.copy(PALETTE.sun).lerp(DUSK_SUN, w);
      stage.hemi.intensity = 1.1 * (1 - 0.5 * g) * (1 + 0.1 * w);
      stage.hemi.color.copy(PALETTE.sky).lerp(DUSK_SKY, w);
      fog.color
        .copy(PALETTE.haze)
        .lerp(DUSK_FOG, w * 0.8)
        .lerp(TUNNEL_FOG, g * 0.7);
      fog.near = 16 - g * 8;
      bg.copy(fog.color);
    },
  };
}
