import { describe, expect, test } from "bun:test";
import { createCourse } from "../src/game/course";
import { mergeBest, PAR, parseBest, reachCost, starsFor } from "../src/game/score";
import { createState, rescue, startSailing, step } from "../src/game/sim";

describe("par and stars", () => {
  test("every reach has a par", () => {
    expect(PAR).toHaveLength(createCourse().reaches.length);
  });

  test("three stars at par, two just over, one well over", () => {
    expect(starsFor(0, 1, 0)).toBe(3);
    expect(starsFor(0, PAR[0], 0)).toBe(3);
    expect(starsFor(0, PAR[0] + 2, 0)).toBe(2);
    expect(starsFor(0, PAR[0] + 3, 0)).toBe(1);
  });

  test("a duck rescue costs two gusts", () => {
    expect(reachCost(1, 1)).toBe(3);
    expect(starsFor(0, 0, 1)).toBe(3);
    expect(starsFor(0, 1, 1)).toBe(2);
  });

  test("best results keep the higher stars and survive bad storage", () => {
    expect(mergeBest([3, 0, 1], [2, 2, 3])).toEqual([3, 2, 3]);
    expect(parseBest(null, 3)).toEqual([0, 0, 0]);
    expect(parseBest("nonsense", 3)).toEqual([0, 0, 0]);
    expect(parseBest("[3, 7, 2]", 3)).toEqual([3, 0, 2]);
  });

  test("rescues are counted against the reach they happen in", () => {
    const course = createCourse();
    const s = createState(course);
    startSailing(s);
    for (let i = 0; i < 400 && s.status === "sailing"; i++) step(course, s, 0.1);
    expect(s.status).toBe("stranded");
    rescue(course, s);
    expect(s.rescuesByReach).toEqual([1, 0, 0]);
  });
});
