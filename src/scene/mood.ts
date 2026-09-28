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

const TUNNEL_FOG = new THREE.Color("#262a18");
const DUSK_SUN = new THREE.Color("#ffb070");

/**
 * Eases light, sky and fog towards the mood of where the boat is: under the root the sun and the
 * environment dim together; at the pond the sky becomes the low forest sun and the key warms.
 */
export function createMoodLight(stage: Stage) {
  const current: Mood = { gloom: 0, warmth: 0 };
  const fog = stage.scene.fog as THREE.Fog;
  let sky: "day" | "dusk" | null = null;
  return {
    current,
    update(target: Mood, dt: number, snap = false) {
      const k = snap ? 1 : 1 - Math.exp(-dt * 1.2);
      current.gloom += (target.gloom - current.gloom) * k;
      current.warmth += (target.warmth - current.warmth) * k;
      const { gloom: g, warmth: w } = current;
      const { day, dusk } = stage.skies;
      const want = w > 0.5 ? "dusk" : "day";
      const chosen = want === "dusk" ? dusk : day;
      if (chosen && sky !== want) {
        sky = want;
        stage.scene.environment = chosen.env;
        stage.scene.background = chosen.background;
      }
      stage.sun.intensity = 3.2 * (1 - 0.7 * g) * (1 - 0.25 * w);
      stage.sun.color.copy(PALETTE.sun).lerp(DUSK_SUN, w);
      stage.scene.environmentIntensity = 1 - 0.6 * g;
      stage.scene.backgroundIntensity = 1 - 0.6 * g;
      if (day && dusk) fog.color.copy(day.horizon).lerp(dusk.horizon, w);
      fog.color.lerp(TUNNEL_FOG, g * 0.7);
      fog.near = 18 - g * 9;
    },
  };
}
