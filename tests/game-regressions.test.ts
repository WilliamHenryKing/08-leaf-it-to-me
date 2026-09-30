import { describe, expect, test } from "bun:test";
import { createCourse } from "../src/game/course";
import {
  applyGust,
  BOAT_RADIUS,
  cloneState,
  createState,
  predict,
  rescue,
  startSailing,
  step,
  takeEvents,
} from "../src/game/sim";
import { closestOnSegment } from "../src/game/vec";

describe("the same river at different frame rates", () => {
  test("irregular frame partitions produce the same motion and events as 60 Hz", () => {
    const course = createCourse();
    const steady = createState(course);
    const irregular = createState(course);
    for (const state of [steady, irregular]) {
      startSailing(state);
      applyGust(course, state, Math.PI / 6, 0.6);
    }
    for (let tick = 0; tick < 180; tick++) step(course, steady, 1 / 60);
    for (let frame = 0; frame < 60; frame++) {
      for (const dt of [0.011, 0.013, 0.007, 0.004, 0.015]) step(course, irregular, dt);
    }
    expect(irregular.x).toBeCloseTo(steady.x, 10);
    expect(irregular.y).toBeCloseTo(steady.y, 10);
    expect(irregular.vx).toBeCloseTo(steady.vx, 10);
    expect(irregular.vy).toBeCloseTo(steady.vy, 10);
    expect(irregular.time).toBeCloseTo(3, 10);
    expect(takeEvents(irregular)).toEqual(takeEvents(steady));
  });

  test("a long stalled frame remains bounded to a quarter second", () => {
    const course = createCourse();
    const state = createState(course);
    startSailing(state);
    step(course, state, 3);
    expect(state.time).toBeCloseTo(0.25, 10);
    expect(state.y).toBeLessThan(course.start.y + 0.2);
  });
});

describe("the dotted route describes an actual release", () => {
  test("cooldown rejection produces the same forecast as the real boat", () => {
    const course = createCourse();
    const state = createState(course);
    startSailing(state);
    applyGust(course, state, 0, 0.6);
    step(course, state, 0.013);
    const before = structuredClone(state);
    const actual = cloneState(state);
    const gust = { angle: Math.PI / 2, strength: 0.5 };
    expect(applyGust(course, actual, gust.angle, gust.strength)).toBe(false);
    for (let tick = 0; tick < 180; tick++) step(course, actual, 1 / 60);

    const forecast = predict(course, state, gust, 3);

    expect(forecast.points.at(-1)?.x).toBeCloseTo(actual.x, 10);
    expect(forecast.points.at(-1)?.y).toBeCloseTo(actual.y, 10);
    expect(forecast.status).toBe(actual.status);
    expect(state).toEqual(before);
  });

  test("an uneven sampling interval never overshoots or shortens the horizon", () => {
    const course = createCourse();
    const state = createState(course);
    startSailing(state);
    applyGust(course, state, 0.2, 0.6);
    const actual = cloneState(state);
    for (let tick = 0; tick < 24; tick++) step(course, actual, 1 / 60);

    const forecast = predict(course, state, null, 0.4, 0.3);

    expect(forecast.points.at(-1)?.x).toBeCloseTo(actual.x, 10);
    expect(forecast.points.at(-1)?.y).toBeCloseTo(actual.y, 10);
    expect(forecast.points).toHaveLength(3);
  });

  test("terminal boats stay terminal in the forecast", () => {
    const course = createCourse();
    for (const status of ["intro", "stranded", "finished"] as const) {
      const state = createState(course);
      state.status = status;
      const before = structuredClone(state);
      expect(predict(course, state, { angle: 0, strength: 0.6 })).toEqual({
        points: [{ x: state.x, y: state.y }],
        status,
      });
      expect(state).toEqual(before);
    }
  });
});

describe("solid obstacles resolve even at exact contact centres", () => {
  for (const shape of ["circle", "capsule"] as const) {
    test(`a stationary leaf inside a ${shape} cannot pass through it`, () => {
      const course = createCourse();
      course.start = { x: 0, y: 2.5 };
      course.jets = [];
      course.eddies = [];
      course.pools = [{ c: { ...course.start }, r: 100, calm: 0 }];
      course.obstacles = [
        shape === "circle"
          ? { shape, kind: "rock", c: { ...course.start }, r: 0.5 }
          : { shape, kind: "branch", a: { x: -1, y: 2.5 }, b: { x: 1, y: 2.5 }, r: 0.35 },
      ];
      const state = createState(course);
      startSailing(state);
      state.vy = 0;

      step(course, state, 1 / 60);

      const obstacle = course.obstacles[0];
      if (!obstacle) throw new Error("obstacle");
      const contact =
        obstacle.shape === "circle" ? obstacle.c : closestOnSegment(state, obstacle.a, obstacle.b);
      expect(Math.hypot(state.x - contact.x, state.y - contact.y)).toBeGreaterThanOrEqual(
        obstacle.r + BOAT_RADIUS - 1e-10,
      );
      expect(state.inContact).toBe(true);
      expect(Number.isFinite(state.vx) && Number.isFinite(state.vy)).toBe(true);
    });
  }

  test("rescue clears old contact and preserves earned lanterns and reach costs", () => {
    const course = createCourse();
    const state = createState(course);
    startSailing(state);
    for (let tick = 0; tick < 3000 && state.status === "sailing"; tick++) {
      step(course, state, 1 / 60);
    }
    expect(state.status).toBe("stranded");
    state.lanterns[0] = true;
    const gusts = [...state.gustsByReach];
    rescue(course, state);
    rescue(course, state);
    expect(state.status).toBe("sailing");
    expect(state.inContact).toBe(false);
    expect(state.pinned).toBe(0);
    expect(state.rescues).toBe(1);
    expect(state.rescuesByReach).toEqual([1, 0, 0]);
    expect(state.gustsByReach).toEqual(gusts);
    expect(state.lanterns[0]).toBe(true);
  });
});
