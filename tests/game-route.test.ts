import { expect, test } from "bun:test";
import { type Course, createCourse } from "../src/game/course";
import { mergeBest, parseBest, starsFor } from "../src/game/score";
import {
  applyGust,
  createState,
  FIXED_DT,
  type GameState,
  rescue,
  startSailing,
  step,
  takeEvents,
} from "../src/game/sim";

function waitFor(
  course: Course,
  state: GameState,
  label: string,
  predicate: () => boolean,
  seconds = 90,
) {
  for (let tick = 0; tick < Math.ceil(seconds / FIXED_DT); tick++) {
    if (predicate()) return;
    if (state.status !== "sailing") break;
    step(course, state, FIXED_DT);
  }
  throw new Error(`${label}: ${JSON.stringify(state)}`);
}

function runRoute(side: -1 | 1, reactionTicks: number, rescueReach: 0 | 1 | null = null) {
  const course = createCourse();
  const state = createState(course);
  startSailing(state);
  const wait = (label: string, predicate: () => boolean) =>
    waitFor(course, state, label, predicate);
  const blow = (angle: number, strength: number) => {
    for (let tick = 0; tick < reactionTicks; tick++) step(course, state, FIXED_DT);
    expect(applyGust(course, state, angle, strength)).toBe(true);
  };
  if (rescueReach === 0) {
    wait("duck rescue", () => state.status === "stranded");
    rescue(course, state);
    expect(state.rescues).toBe(1);
  }
  wait("branch approach", () => state.y >= 12.5);
  blow((side * Math.PI) / 2, 0.6);
  wait("root reach", () => state.reach === 1);
  if (rescueReach === 1) {
    wait("root rescue", () => state.status === "stranded");
    rescue(course, state);
    expect(state.reach).toBe(1);
    expect(state.x).toBe(course.reaches[1]?.pool.x ?? Number.NaN);
    expect(state.y).toBe(course.reaches[1]?.pool.y ?? Number.NaN);
    expect(state.lanterns[side < 0 ? 0 : 1]).toBe(true);
  }
  wait("root approach", () => state.y >= 40);
  blow((side * Math.PI) / 2, 0.6);
  wait("pond reach", () => state.reach === 2);
  wait("pond approach", () => state.y >= 81);
  blow(Math.PI / 8, 0.8);
  wait("gathering", () => state.status === "finished");
  return { state, events: takeEvents(state) };
}

for (const side of [-1, 1] as const) {
  for (const reactionTicks of [0, 18, 36]) {
    test(`normal ${side < 0 ? "left" : "right"} passages finish with ${reactionTicks}-tick input delay`, () => {
      const { state, events } = runRoute(side, reactionTicks);
      expect(state.status).toBe("finished");
      expect(events.filter((event) => event.type === "checkpoint")).toHaveLength(2);
      expect(events.filter((event) => event.type === "finished")).toHaveLength(1);
      expect(state.lanterns[side < 0 ? 0 : 1]).toBe(true);
      expect(state.lanterns[side < 0 ? 3 : 4]).toBe(true);
      expect(state.gustsByReach).toEqual([1, 1, 1]);
      expect(state.rescues).toBe(0);
      const stars = state.gustsByReach.map((gusts, i) =>
        starsFor(i, gusts, state.rescuesByReach[i] ?? 0),
      );
      expect(stars).toEqual([3, 3, 3]);
      expect(parseBest(JSON.stringify(mergeBest([1, 2, 0], stars)), 3)).toEqual(stars);
    });
  }
}

test("the duck rescues a naturally stranded boat before a complete normal voyage", () => {
  const { state } = runRoute(1, 18, 0);
  expect(state.status).toBe("finished");
  expect(state.rescues).toBe(1);
  expect(state.rescuesByReach).toEqual([1, 0, 0]);
  expect(state.gustsByReach).toEqual([1, 1, 1]);
  expect(starsFor(0, state.gustsByReach[0] ?? 0, state.rescuesByReach[0] ?? 0)).toBe(2);
});

test("rescue after a checkpoint keeps the new pool, lantern and correct reach penalty", () => {
  const { state, events } = runRoute(-1, 18, 1);
  expect(state.status).toBe("finished");
  expect(state.rescuesByReach).toEqual([0, 1, 0]);
  expect(state.gustsByReach).toEqual([1, 1, 1]);
  expect(events.filter((event) => event.type === "checkpoint")).toHaveLength(2);
  const stars = state.gustsByReach.map((gusts, i) =>
    starsFor(i, gusts, state.rescuesByReach[i] ?? 0),
  );
  expect(stars).toEqual([3, 2, 3]);
  expect(parseBest(JSON.stringify(mergeBest([0, 3, 2], stars)), 3)).toEqual([3, 3, 3]);
});

test("a fresh replay sails the other passages without carrying progress from the last voyage", () => {
  const first = runRoute(-1, 18);
  const before = structuredClone(first.state);
  const replay = runRoute(1, 18);
  expect(replay.state.status).toBe("finished");
  expect(replay.state.gusts).toBe(3);
  expect(replay.state.rescues).toBe(0);
  expect(replay.state.lanterns[0]).toBe(false);
  expect(replay.state.lanterns[1]).toBe(true);
  expect(replay.state.lanterns[3]).toBe(false);
  expect(replay.state.lanterns[4]).toBe(true);
  expect(first.state).toEqual(before);
});
