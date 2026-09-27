import { describe, expect, test } from "bun:test";
import { centreX, createCourse, halfWidth, reachAt } from "../src/game/course";
import { currentAt, windAt } from "../src/game/field";
import {
  applyGust,
  createState,
  effectiveStrength,
  GUST_POWER,
  gustImpulse,
  predict,
  rescue,
  STRAND_TIME,
  sailEfficiency,
  startSailing,
  step,
  takeEvents,
} from "../src/game/sim";

const course = createCourse();
const LEFT = -Math.PI / 2;
const RIGHT = Math.PI / 2;

/** Sail from a reach's pool with gusts [time, angle, strength] released on schedule. */
function sail(gusts: [number, number, number][], reach = 0, seconds = 80) {
  const s = createState(course);
  startSailing(s);
  const pool = course.reaches[reach]?.pool ?? course.start;
  s.x = pool.x;
  s.y = pool.y;
  s.reach = reach;
  const queue = [...gusts];
  const events: string[] = [];
  let t = 0;
  while (t < seconds && s.status === "sailing") {
    while (queue.length && (queue[0] as [number, number, number])[0] <= t) {
      const [, angle, strength] = queue.shift() as [number, number, number];
      applyGust(course, s, angle, strength);
    }
    step(course, s, 0.1);
    t += 0.1;
    for (const e of takeEvents(s)) events.push(e.type);
  }
  return { s, events };
}

const across = (p: { x: number; y: number }) => p.x - centreX(p.y);

describe("course", () => {
  test("three reaches with a checkpoint between each", () => {
    expect(course.reaches.map((r) => r.name)).toEqual([
      "The Flooded Flowerpot",
      "The Root Tunnel",
      "The Lantern Pond",
    ]);
    expect(course.checkpoints).toHaveLength(2);
    expect(reachAt(course, 10)).toBe(0);
    expect(reachAt(course, 40)).toBe(1);
    expect(reachAt(course, 80)).toBe(2);
  });

  test("lanterns and the gathering lie inside the water", () => {
    for (const l of [...course.lanterns, course.finish.c]) {
      expect(Math.abs(across(l))).toBeLessThan(halfWidth(l.y));
    }
  });
});

describe("fields", () => {
  test("the first current runs fast towards the branch", () => {
    const c = currentAt(course, { x: centreX(12), y: 12 });
    expect(c.y).toBeGreaterThan(1.8);
    expect(Math.abs(c.x)).toBeLessThan(0.3);
  });

  test("pools are calm and sheltered water blunts gusts", () => {
    const pool = course.reaches[1]?.pool ?? course.start;
    const c = currentAt(course, pool);
    expect(Math.hypot(c.x, c.y)).toBeLessThan(0.5);
    const tunnel = course.shelters.find((s) => s.kind === "root");
    expect(tunnel && windAt(course, tunnel.c)).toBeCloseTo(0.3);
    expect(windAt(course, { x: centreX(12), y: 12 })).toBe(1);
  });
});

describe("gusts", () => {
  test("strong gusts spill wind from the sail", () => {
    expect(effectiveStrength(0.5)).toBe(0.5);
    expect(effectiveStrength(1)).toBeLessThan(0.8);
    expect(effectiveStrength(1) - effectiveStrength(0.7)).toBeLessThan(0.1);
  });

  test("a gust from astern fills the sail better than a crosswind", () => {
    expect(sailEfficiency(0, 0)).toBe(1);
    expect(sailEfficiency(0, RIGHT)).toBeCloseTo(0.75);
  });

  test("gusts are counted, cool down and soak the beetle when overdone", () => {
    const s = createState(course);
    expect(applyGust(course, s, 0, 0.5)).toBe(false); // not sailing yet
    startSailing(s);
    expect(applyGust(course, s, RIGHT, 1)).toBe(true);
    expect(applyGust(course, s, RIGHT, 1)).toBe(false); // cooling down
    expect(s.gusts).toBe(1);
    expect(s.gustsByReach).toEqual([1, 0, 0]);
    expect(s.wet).toBe(1);
    expect(s.vx).toBeGreaterThan(0);
    const events = takeEvents(s);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "gust", strength: 1, spilled: true });
  });

  test("the same gust is weaker in a wind shadow", () => {
    const s = createState(course);
    const open = gustImpulse(course, s, 0, 0.6);
    const tunnel = course.shelters.find((x) => x.kind === "root");
    if (!tunnel) throw new Error("no tunnel");
    s.x = tunnel.c.x;
    s.y = tunnel.c.y;
    const shaded = gustImpulse(course, s, 0, 0.6);
    expect(open.y).toBeCloseTo(GUST_POWER * 0.6);
    expect(shaded.y).toBeLessThan(open.y * 0.5);
  });
});

describe("reach 1: one current, one branch, two passages", () => {
  test("drifting without a gust pins the leaf on the branch and strands it", () => {
    const { s, events } = sail([]);
    expect(s.status).toBe("stranded");
    expect(s.y).toBeGreaterThan(16);
    expect(s.y).toBeLessThan(19);
    expect(events).toContain("stranded");
  });

  test("a crosswind to the left slips through the fast chute", () => {
    const { s, events } = sail([[10, LEFT, 0.55]], 0, 30);
    expect(events).toContain("checkpoint");
    expect(s.lanterns[0]).toBe(true);
    expect(s.gusts).toBe(1);
  });

  test("a crosswind to the right takes the sheltered lane past the flowerpot", () => {
    const { s, events } = sail([[10, RIGHT, 0.55]], 0, 45);
    expect(events).toContain("checkpoint");
    expect(s.lanterns[1]).toBe(true);
    expect(s.lanterns[0]).toBe(false);
  });

  test("the chute is quicker than the sheltered lane", () => {
    const time = (angle: number) => {
      const s = createState(course);
      startSailing(s);
      let t = 0;
      while (s.reach === 0 && t < 80) {
        if (t === 10) applyGust(course, s, angle, 0.55);
        step(course, s, 0.5);
        t += 0.5;
      }
      return t;
    };
    expect(time(LEFT)).toBeLessThan(time(RIGHT));
  });
});

describe("reach 2: the root tunnel", () => {
  test("drift strands on the root's knuckle", () => {
    expect(sail([], 1, 40).s.status).toBe("stranded");
  });

  test("slipping beneath the root and racing round it both reach the pond", () => {
    const under = sail([[6.5, LEFT, 0.5]], 1, 45);
    const round = sail([[6.5, RIGHT, 0.5]], 1, 45);
    expect(under.s.lanterns[3]).toBe(true);
    expect(round.s.lanterns[4]).toBe(true);
    expect(under.s.reach).toBe(2);
    expect(round.s.reach).toBe(2);
  });
});

describe("reach 3 and the gathering", () => {
  test("the gathering needs a deliberate gust", () => {
    expect(sail([], 2, 90).s.status).not.toBe("finished");
    const { s, events } = sail([[16, Math.PI * 0.125, 0.8]], 2, 60);
    expect(s.status).toBe("finished");
    expect(events.at(-1)).toBe("finished");
  });
});

describe("stranding and the duck", () => {
  test("the duck returns a stranded boat to the pool of its reach", () => {
    const { s } = sail([], 1, 40);
    expect(s.pinned).toBeGreaterThanOrEqual(STRAND_TIME);
    rescue(course, s);
    const pool = course.reaches[1]?.pool;
    expect(s.status).toBe("sailing");
    expect(s.x).toBe(pool?.x ?? Number.NaN);
    expect(s.y).toBe(pool?.y ?? Number.NaN);
    expect(s.rescues).toBe(1);
  });

  test("rescue does nothing to a boat that is not stranded", () => {
    const s = createState(course);
    startSailing(s);
    rescue(course, s);
    expect(s.rescues).toBe(0);
  });
});

describe("prediction", () => {
  test("previews each passage without touching the real boat", () => {
    const s = createState(course);
    startSailing(s);
    s.y = 12;
    s.x = centreX(12);
    s.vy = 2;
    const before = structuredClone(s);
    const left = predict(course, s, { angle: LEFT, strength: 0.55 }, 3);
    const right = predict(course, s, { angle: RIGHT, strength: 0.55 }, 3);
    expect(s).toEqual(before);
    expect(across(left.points.at(-1) ?? s)).toBeLessThan(-1.5);
    expect(across(right.points.at(-1) ?? s)).toBeGreaterThan(1.5);
  });
});
