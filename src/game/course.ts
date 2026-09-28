// The authored stream: three reaches of one brook. Everything here affects the boat;
// the scene builds its meshes from the same data so nothing is decorative.
import { clamp, lerp, type Vec2, v } from "./vec";

export type ObstacleKind = "branch" | "pebble" | "pot" | "rock" | "root" | "knuckle" | "lily";

export type Obstacle =
  | { shape: "circle"; kind: ObstacleKind; c: Vec2; r: number }
  | { shape: "capsule"; kind: ObstacleKind; a: Vec2; b: Vec2; r: number };

/** A ribbon of fast water flowing from a to b. */
export interface Jet {
  a: Vec2;
  b: Vec2;
  r: number;
  speed: number;
}
/** A rotating body of water; spin +1 turns clockwise on screen (right side flows downstream). */
export interface Eddy {
  c: Vec2;
  r: number;
  speed: number;
  spin: 1 | -1;
}
/** Calm water: the current is scaled down to `calm` inside. */
export interface Pool {
  c: Vec2;
  r: number;
  calm: number;
}
/** Wind shadow: gusts are multiplied by `factor` inside. */
export interface Shelter {
  c: Vec2;
  r: number;
  factor: number;
  kind: "clover" | "root" | "reeds";
}

export interface Reach {
  name: string;
  startY: number;
  /** Where the duck brings a stranded boat back to, and where this reach begins. */
  pool: Vec2;
}

export interface Course {
  reaches: Reach[];
  /** Crossing y > checkpoints[i] unlocks reach i + 1. */
  checkpoints: number[];
  jets: Jet[];
  eddies: Eddy[];
  pools: Pool[];
  shelters: Shelter[];
  obstacles: Obstacle[];
  lanterns: Vec2[];
  finish: { c: Vec2; r: number };
  start: Vec2;
  endY: number;
}

/** The brook's centreline meanders gently. */
export const centreX = (y: number) => 1.4 * Math.sin(y * 0.075);

// Half-width control points [y, halfWidth]; linear in between.
const WIDTH: [number, number][] = [
  [-2, 4],
  [6, 4],
  [10, 3.2],
  [14, 5],
  [27, 5],
  [30, 3.4],
  [33, 4.2],
  [37, 4.2],
  [40, 3],
  [44, 5.2],
  [58, 5.2],
  [61, 3.4],
  [65, 4.2],
  [69, 4.2],
  [72, 5],
  [76, 9],
  [92, 9],
  [96, 6],
  [101, 4],
];

export function halfWidth(y: number) {
  const first = WIDTH[0] as [number, number];
  if (y <= first[0]) return first[1];
  for (let i = 1; i < WIDTH.length; i++) {
    const [y1, w1] = WIDTH[i] as [number, number];
    const [y0, w0] = WIDTH[i - 1] as [number, number];
    if (y <= y1) return lerp(w0, w1, (y - y0) / (y1 - y0));
  }
  return (WIDTH[WIDTH.length - 1] as [number, number])[1];
}

/** Base downstream speed of the brook before authored features. */
export function baseSpeed(y: number) {
  if (y > 74) return 0.5; // the pond barely moves
  return clamp(0.9 + 0.25 * Math.sin(y * 0.2), 0.6, 1.1);
}

/** Point `u` across from the centreline at distance `y` downstream. */
const at = (u: number, y: number) => v(centreX(y) + u, y);

export function createCourse(): Course {
  return {
    start: at(0, 2.5),
    endY: 99,
    reaches: [
      { name: "The Flooded Flowerpot", startY: 0, pool: at(0, 2.5) },
      { name: "The Root Tunnel", startY: 32, pool: at(0, 35) },
      { name: "The Lantern Pond", startY: 64, pool: at(0, 67) },
    ],
    checkpoints: [32, 64],
    jets: [
      // Reach 1: the current runs straight at the fallen branch.
      { a: at(0, 5.5), b: at(0, 17.4), r: 1.8, speed: 2 },
      // The left chute: short and fast, past a rock.
      { a: at(-3.6, 19), b: at(-2.6, 26), r: 1.3, speed: 2.4 },
      { a: at(-2.6, 26), b: at(0, 31.5), r: 1.4, speed: 2.1 },
      // The sheltered lane: slow, steady water beside the flowerpot.
      { a: at(3.5, 19.5), b: at(3.1, 28.5), r: 1.6, speed: 0.95 },
      { a: at(3.1, 28.5), b: at(0.4, 33.5), r: 1.5, speed: 1 },
      // Reach 2: the current drives into the root's knuckle.
      { a: at(0, 37.5), b: at(0.2, 44.6), r: 1.6, speed: 1.9 },
      // Beneath the root: a steady, sheltered glide.
      { a: at(-2.7, 45), b: at(-2.7, 54.5), r: 1.3, speed: 1.3 },
      { a: at(-2.7, 54.5), b: at(-0.4, 62.5), r: 1.5, speed: 1.3 },
      // Around the outside: a fast race with a rock in it.
      { a: at(2.4, 46.5), b: at(3.4, 56), r: 1.3, speed: 2.4 },
      { a: at(3.4, 56), b: at(0.6, 62), r: 1.5, speed: 1.8 },
      // Reach 3: the entry fans out into the pond.
      { a: at(0, 69), b: at(0, 77), r: 2, speed: 1.3 },
    ],
    eddies: [
      // Behind the flowerpot a gentle eddy turns you back into the stream.
      { c: at(1.6, 27.5), r: 2, speed: 0.6, spin: 1 },
      // Small eddies curl in the lee of the rocks.
      { c: at(-3.7, 24.4), r: 0.9, speed: 0.5, spin: -1 },
      { c: at(4, 52.3), r: 1, speed: 0.5, spin: 1 },
      // The pond's slow gyre sweeps left past the reeds and back up the far side.
      { c: at(0, 86.5), r: 7.5, speed: 1, spin: -1 },
    ],
    pools: [
      { c: at(0, 2.5), r: 3, calm: 0.35 },
      { c: at(0, 35), r: 2.6, calm: 0.3 },
      { c: at(0, 67), r: 2.6, calm: 0.3 },
    ],
    shelters: [
      { c: at(3.7, 23.5), r: 2.8, factor: 0.45, kind: "clover" },
      { c: at(-2.7, 50), r: 3.4, factor: 0.3, kind: "root" },
      { c: at(-6.5, 84), r: 3.8, factor: 0.4, kind: "reeds" },
    ],
    obstacles: [
      { shape: "capsule", kind: "branch", a: at(-1.9, 18.4), b: at(1.7, 18.4), r: 0.35 },
      { shape: "circle", kind: "pebble", c: at(2, 18.6), r: 0.45 },
      { shape: "circle", kind: "pot", c: at(0.8, 23.5), r: 1.5 },
      { shape: "circle", kind: "rock", c: at(-3.9, 23.3), r: 0.5 },
      { shape: "circle", kind: "knuckle", c: at(0.3, 46.2), r: 1 },
      { shape: "capsule", kind: "root", a: at(-0.6, 46.6), b: at(-1.3, 53), r: 0.3 },
      { shape: "capsule", kind: "root", a: at(-4.5, 45.6), b: at(-4.4, 53.5), r: 0.3 },
      { shape: "circle", kind: "rock", c: at(3.9, 51), r: 0.6 },
      { shape: "circle", kind: "lily", c: at(-6.6, 80.5), r: 1.2 },
      { shape: "circle", kind: "lily", c: at(4.4, 81.5), r: 1.3 },
      { shape: "circle", kind: "lily", c: at(0.6, 86.5), r: 1.2 },
      { shape: "circle", kind: "lily", c: at(-7.2, 91.5), r: 1.2 },
      { shape: "circle", kind: "lily", c: at(2.8, 93), r: 1 },
    ],
    lanterns: [
      at(-3.3, 21.5),
      at(3.6, 22),
      at(0.2, 30.5),
      at(-2.7, 50),
      at(3.2, 49),
      at(0.4, 59.5),
      at(3, 76.5),
      at(-4, 85),
      at(-0.6, 93.5),
    ],
    finish: { c: at(6.4, 86.5), r: 2.2 },
  };
}

/** Which reach a y position belongs to. */
export function reachAt(course: Course, y: number) {
  let r = 0;
  for (const cp of course.checkpoints) if (y > cp) r++;
  return r;
}
