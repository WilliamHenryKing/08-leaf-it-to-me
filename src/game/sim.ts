// Leaf-boat rules: current drag, momentum, gusts, collisions, stranding, rescue and finish.
import { type Course, centreX, halfWidth, reachAt } from "./course";
import { currentAt, windAt } from "./field";
import { angleDelta, clamp, closestOnSegment } from "./vec";

export const BOAT_RADIUS = 0.35;
/** How quickly the leaf is dragged to the current's speed (per second). */
export const DRAG = 0.7;
/** Speed change from a full, well-set gust on open water. */
export const GUST_POWER = 4.5;
/** Above this strength the little sail spills wind. */
export const SPILL_AT = 0.7;
/** Seconds pinned against something before the duck comes. */
export const STRAND_TIME = 2.2;
const STEP = 1 / 60;

export type Status = "intro" | "sailing" | "stranded" | "finished";

export type GameEvent =
  | { type: "gust"; strength: number; spilled: boolean; efficiency: number }
  | { type: "bump"; speed: number }
  | { type: "lantern"; index: number }
  | { type: "checkpoint"; reach: number }
  | { type: "stranded" }
  | { type: "rescued"; reach: number }
  | { type: "finished" };

export interface GameState {
  status: Status;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Direction the leaf points: 0 = downstream, positive turns towards +x. */
  heading: number;
  /** Visual lean, -1..1, from the last gust. */
  heel: number;
  /** 0..1: how soaked the beetle's coat is. */
  wet: number;
  time: number;
  reach: number;
  gusts: number;
  gustsByReach: number[];
  rescues: number;
  lanterns: boolean[];
  cooldown: number;
  pinned: number;
  inContact: boolean;
  events: GameEvent[];
}

export function createState(course: Course): GameState {
  return {
    status: "intro",
    x: course.start.x,
    y: course.start.y,
    vx: 0,
    vy: 0.4,
    heading: 0,
    heel: 0,
    wet: 0,
    time: 0,
    reach: 0,
    gusts: 0,
    gustsByReach: course.reaches.map(() => 0),
    rescues: 0,
    lanterns: course.lanterns.map(() => false),
    cooldown: 0,
    pinned: 0,
    inContact: false,
    events: [],
  };
}

export const cloneState = (s: GameState): GameState => ({
  ...s,
  gustsByReach: [...s.gustsByReach],
  lanterns: [...s.lanterns],
  events: [],
});

export function startSailing(s: GameState) {
  if (s.status === "intro") s.status = "sailing";
}

/** Useful strength after spill: the sail cannot hold a gale. */
export function effectiveStrength(strength: number) {
  const s = clamp(strength, 0, 1);
  return s <= SPILL_AT ? s : SPILL_AT + (s - SPILL_AT) * 0.3;
}

/** A gust along the leaf (from astern) fills the sail; a crosswind still catches it, less so. */
export function sailEfficiency(heading: number, gustAngle: number) {
  return 0.75 + 0.25 * Math.abs(Math.cos(angleDelta(heading, gustAngle)));
}

/** Change in velocity a gust would give right now. */
export function gustImpulse(course: Course, s: GameState, angle: number, strength: number) {
  const k =
    GUST_POWER *
    effectiveStrength(strength) *
    sailEfficiency(s.heading, angle) *
    windAt(course, { x: s.x, y: s.y });
  return { x: Math.sin(angle) * k, y: Math.cos(angle) * k, efficiency: k / GUST_POWER };
}

export const canGust = (s: GameState) => s.status === "sailing" && s.cooldown <= 0;

/** Release a gust. Angle 0 blows downstream; strength 0..1. */
export function applyGust(course: Course, s: GameState, angle: number, strength: number) {
  if (!canGust(s) || strength < 0.05) return false;
  const imp = gustImpulse(course, s, angle, strength);
  s.vx += imp.x;
  s.vy += imp.y;
  const spilled = strength > SPILL_AT;
  const side = Math.sin(angleDelta(s.heading, angle));
  s.heel = clamp(side * (0.4 + strength * 0.8), -1, 1);
  if (spilled) s.wet = 1;
  s.cooldown = 0.25 + 0.5 * strength;
  s.gusts++;
  s.gustsByReach[s.reach] = (s.gustsByReach[s.reach] ?? 0) + 1;
  s.events.push({ type: "gust", strength, spilled, efficiency: imp.efficiency });
  return true;
}

/** Push the boat out of anything solid. Returns the impact speed, or -1 if clear. */
function collide(course: Course, s: GameState) {
  let hit = -1;
  const resolve = (nx: number, ny: number, depth: number) => {
    s.x += nx * depth;
    s.y += ny * depth;
    const vn = s.vx * nx + s.vy * ny;
    if (vn < 0) {
      s.vx -= vn * 1.3 * nx;
      s.vy -= vn * 1.3 * ny;
      hit = Math.max(hit, -vn);
    } else hit = Math.max(hit, 0);
    // Scrape: rubbing along wet bark or stone bleeds speed.
    const tx = -ny;
    const ty = nx;
    const vt = s.vx * tx + s.vy * ty;
    s.vx -= vt * 0.06 * tx;
    s.vy -= vt * 0.06 * ty;
  };
  for (const o of course.obstacles) {
    const c = o.shape === "circle" ? o.c : closestOnSegment(s, o.a, o.b);
    const dx = s.x - c.x;
    const dy = s.y - c.y;
    const d = Math.hypot(dx, dy);
    const min = o.r + BOAT_RADIUS;
    if (d < min && d > 1e-6) resolve(dx / d, dy / d, min - d);
  }
  const hw = halfWidth(s.y) - BOAT_RADIUS;
  const u = s.x - centreX(s.y);
  if (u > hw) resolve(-1, 0, u - hw);
  else if (u < -hw) resolve(1, 0, -hw - u);
  if (s.y < -1.5) resolve(0, 1, -1.5 - s.y);
  const end = course.endY - BOAT_RADIUS;
  if (s.y > end) resolve(0, -1, s.y - end);
  return hit;
}

function tick(course: Course, s: GameState, dt: number) {
  s.time += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.heel *= Math.exp(-dt * 2.2);
  s.wet = Math.max(0, s.wet - dt * 0.35);

  const c = currentAt(course, s);
  const k = 1 - Math.exp(-DRAG * dt);
  s.vx += (c.x - s.vx) * k;
  s.vy += (c.y - s.vy) * k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  const speed = Math.hypot(s.vx, s.vy);
  if (speed > 0.15) {
    const target = Math.atan2(s.vx, s.vy);
    s.heading += angleDelta(s.heading, target) * Math.min(1, dt * 2.5 * Math.min(speed, 1.2));
  }

  const hit = collide(course, s);
  s.inContact = hit >= 0;
  if (hit > 0.8) s.events.push({ type: "bump", speed: hit });
  const after = Math.hypot(s.vx, s.vy);
  s.pinned = s.inContact && after < 0.4 ? s.pinned + dt : Math.max(0, s.pinned - dt * 2);
  if (s.pinned >= STRAND_TIME) {
    s.status = "stranded";
    s.events.push({ type: "stranded" });
    return;
  }

  course.lanterns.forEach((l, i) => {
    if (!s.lanterns[i] && Math.hypot(s.x - l.x, s.y - l.y) < 0.95) {
      s.lanterns[i] = true;
      s.events.push({ type: "lantern", index: i });
    }
  });

  const r = reachAt(course, s.y);
  if (r > s.reach) {
    s.reach = r;
    s.events.push({ type: "checkpoint", reach: r });
  }

  if (Math.hypot(s.x - course.finish.c.x, s.y - course.finish.c.y) < course.finish.r) {
    s.status = "finished";
    s.events.push({ type: "finished" });
  }
}

/** Advance the game by dt seconds in fixed steps. Events accumulate in s.events. */
export function step(course: Course, s: GameState, dt: number) {
  let left = Math.min(dt, 0.25);
  while (left > 1e-9 && s.status === "sailing") {
    const h = Math.min(STEP, left);
    tick(course, s, h);
    left -= h;
  }
}

/** The duck lifts a stranded boat to the pool at the start of its current reach. */
export function rescue(course: Course, s: GameState) {
  if (s.status !== "stranded") return;
  const pool = (course.reaches[s.reach] ?? course.reaches[0])?.pool ?? course.start;
  s.x = pool.x;
  s.y = pool.y;
  s.vx = 0;
  s.vy = 0.3;
  s.heading = 0;
  s.heel = 0;
  s.pinned = 0;
  s.rescues++;
  s.status = "sailing";
  s.events.push({ type: "rescued", reach: s.reach });
}

/** Where the boat would go over the next few seconds if this gust were released now. */
export function predict(
  course: Course,
  s: GameState,
  gust: { angle: number; strength: number } | null,
  seconds = 3,
  every = 0.1,
) {
  const p = cloneState(s);
  p.status = "sailing";
  p.cooldown = 0;
  if (gust) applyGust(course, p, gust.angle, gust.strength);
  const points: { x: number; y: number }[] = [{ x: p.x, y: p.y }];
  for (let t = 0; t < seconds && p.status === "sailing"; t += every) {
    step(course, p, every);
    points.push({ x: p.x, y: p.y });
  }
  return { points, status: p.status };
}

export function takeEvents(s: GameState) {
  const e = s.events;
  s.events = [];
  return e;
}
