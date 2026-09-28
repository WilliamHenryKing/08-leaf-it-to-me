// Fixed shots for visual review. Each sets the boat and (optionally) pins the camera; the rest of
// the world is deterministic, so the same bookmark renders the same frame every time.
import { centreX } from "../game/course";
import type { View } from "../scene/world";

export interface Bookmark {
  id: string;
  purpose: string;
  hero: boolean;
  /** Suggested capture size (CSS pixels) and device pixel ratio. */
  size: [number, number, number];
  boat: { u: number; y: number; heading?: number };
  /** Omit to use the normal follow camera. */
  view?: View;
  aim?: { angle: number; strength: number };
  ui: boolean;
}

/** World position from (across-centreline, downstream, height). */
const at = (u: number, y: number, h: number): [number, number, number] => [centreX(y) + u, h, -y];

export const BOOKMARKS: Bookmark[] = [
  {
    id: "establishing-wide",
    purpose: "Reach 1 from above: the current, the branch, both passages and the flooded pot.",
    hero: false,
    size: [1440, 900, 1],
    boat: { u: 0, y: 12 },
    view: { position: at(0, 4, 13), target: at(0, 21, 0), fov: 50 },
    ui: false,
  },
  {
    id: "hero",
    purpose: "The game as played: aiming a crosswind at the branch, HUD and route preview.",
    hero: true,
    size: [1440, 900, 1],
    boat: { u: -0.1, y: 12.5 },
    aim: { angle: -Math.PI / 2, strength: 0.55 },
    ui: true,
  },
  {
    id: "closeup-boat",
    purpose: "Arm's length: the leaf boat, twig mast, petal sail and the beetle in its coat.",
    hero: false,
    size: [1440, 900, 1],
    boat: { u: 0, y: 16, heading: 0.35 },
    view: { position: at(0.95, 15.1, 0.62), target: at(0, 16.05, 0.18), fov: 38 },
    ui: false,
  },
  {
    id: "grazing-materials",
    purpose: "Low across the water at the chute rock and bank: reflections, wet stone, the bed.",
    hero: false,
    size: [1440, 900, 1],
    boat: { u: -3, y: 19.5 },
    view: { position: at(-1.2, 20, 0.42), target: at(-4.2, 23.6, 0.15), fov: 45 },
    ui: false,
  },
  {
    id: "phone-hero",
    purpose: "The hero moment in portrait on a phone.",
    hero: true,
    size: [390, 844, 2],
    boat: { u: -0.1, y: 12.5 },
    aim: { angle: -Math.PI / 2, strength: 0.55 },
    ui: true,
  },
  {
    id: "root-tunnel",
    purpose: "Under the root: shade, arches and shafts of light.",
    hero: false,
    size: [1440, 900, 1],
    boat: { u: -2.7, y: 49.5 },
    ui: false,
  },
  {
    id: "lantern-pond",
    purpose: "The warm finale: lanterns, fireflies and the gathering waiting on the raft.",
    hero: false,
    size: [1440, 900, 1],
    boat: { u: 3.2, y: 84.2, heading: 0.9 },
    ui: false,
  },
];
