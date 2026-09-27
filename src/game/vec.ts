// Tiny 2D vector helpers. Game space: x across the stream, y downstream.
export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Closest point on segment ab to p, plus the parameter t along it. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t, t };
}

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
