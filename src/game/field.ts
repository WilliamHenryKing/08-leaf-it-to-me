// The water and wind fields sampled by the boat, the preview and the water shader.
import { baseSpeed, type Course, centreX, halfWidth } from "./course";
import { closestOnSegment, lerp, smoothstep, type Vec2 } from "./vec";

/** Current velocity (units/s) at a point. */
export function currentAt(course: Course, p: Vec2): Vec2 {
  // Base flow follows the centreline, slower near the banks.
  const hw = halfWidth(p.y);
  const u = p.x - centreX(p.y);
  const profile = 1 - 0.55 * Math.min(1, (u / hw) ** 2);
  const slope = 1.4 * 0.075 * Math.cos(p.y * 0.075);
  const s = baseSpeed(p.y) * profile;
  const n = Math.hypot(slope, 1);
  let cx = (slope / n) * s;
  let cy = (1 / n) * s;

  for (const j of course.jets) {
    const q = closestOnSegment(p, j.a, j.b);
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    const w = 1 - smoothstep(j.r * 0.45, j.r, d);
    if (w <= 0) continue;
    const dx = j.b.x - j.a.x;
    const dy = j.b.y - j.a.y;
    const l = Math.hypot(dx, dy) || 1;
    // Fast water draws floating things towards its seam.
    const pull = q.t > 0 && q.t < 1 ? 0.4 * Math.min(d, 1) : 0;
    const px = d > 1e-4 ? ((q.x - p.x) / d) * pull : 0;
    const py = d > 1e-4 ? ((q.y - p.y) / d) * pull : 0;
    cx = lerp(cx, (dx / l) * j.speed + px, w);
    cy = lerp(cy, (dy / l) * j.speed + py, w);
  }

  for (const e of course.eddies) {
    const dx = p.x - e.c.x;
    const dy = p.y - e.c.y;
    const d = Math.hypot(dx, dy);
    if (d >= e.r || d < 1e-4) continue;
    // Strongest in a ring, still in the eye.
    const w = smoothstep(0, e.r * 0.35, d) * (1 - smoothstep(e.r * 0.6, e.r, d));
    const tx = (-dy / d) * e.spin * e.speed;
    const ty = (dx / d) * e.spin * e.speed;
    cx = lerp(cx, tx, w * 0.85);
    cy = lerp(cy, ty, w * 0.85);
  }

  for (const pool of course.pools) {
    const d = Math.hypot(p.x - pool.c.x, p.y - pool.c.y);
    const w = 1 - smoothstep(pool.r * 0.5, pool.r, d);
    if (w <= 0) continue;
    const k = lerp(1, pool.calm, w);
    cx *= k;
    cy *= k;
  }
  return { x: cx, y: cy };
}

/** How much of a gust reaches the sail here (1 = open water). */
export function windAt(course: Course, p: Vec2) {
  let f = 1;
  for (const s of course.shelters) {
    const d = Math.hypot(p.x - s.c.x, p.y - s.c.y);
    const w = 1 - smoothstep(s.r * 0.6, s.r, d);
    f = Math.min(f, lerp(1, s.factor, w));
  }
  return f;
}
