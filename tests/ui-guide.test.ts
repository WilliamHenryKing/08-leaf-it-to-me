import { describe, expect, test } from "bun:test";
import { GUIDE_STEPS, guidePrompt } from "../src/ui/guidePrompt";

const reaches = ["The Flooded Flowerpot", "The Root Tunnel", "The Lantern Pond"];
const prompt = (reach: number, guide: number, touch = false) =>
  guidePrompt({ status: "sailing", reach, reachName: reaches[reach] ?? "", guide }, touch);

describe("contextual sailing guide", () => {
  test("each replay starts with the current route rather than an earlier obstacle", () => {
    expect(prompt(0, 0).more).toContain("fallen branch");
    expect(prompt(1, 0).more).toContain("root tunnel");
    expect(prompt(1, 0).more).not.toContain("fallen branch");
    expect(prompt(2, 0).more).toContain("right side of the pond");
    expect(prompt(2, 0).more).not.toContain("root tunnel");
  });
  test("every stage has a concrete next action or scoring explanation", () => {
    expect(GUIDE_STEPS).toBe(4);
    for (let reach = 0; reach < reaches.length; reach++) {
      for (let step = 0; step < GUIDE_STEPS; step++) {
        const copy = prompt(reach, step);
        expect(copy.lead.length).toBeGreaterThan(10);
        expect(copy.more.length).toBeGreaterThan(25);
        expect(copy.key).toContain(`${reach}:${step}`);
      }
    }
  });
  test("touch copy does not demand a keyboard and keyboard copy names cancellation", () => {
    expect(prompt(0, 0, true).lead).toContain("Drag on the water");
    expect(prompt(0, 0, true).keys).toBeUndefined();
    expect(prompt(0, 1, true).lead).toBe("Let go to blow.");
    expect(prompt(0, 0).keys).toContain("← →");
    expect(prompt(0, 1).keys).toContain("Esc cancels");
  });
  test("recovery copy explains waiting, the real gust penalty, and preserved lanterns", () => {
    const copy = guidePrompt({
      status: "stranded",
      reach: 2,
      reachName: reaches[2] ?? "",
      guide: 1,
    });
    expect(copy.lead).toContain("duck");
    expect(copy.more).toContain("two gusts");
    expect(copy.more).toContain("lanterns stay");
    expect(copy.more).not.toContain("Let go");
  });
  test("checkpoint copy does not demand visiting the decorative calm pool", () => {
    expect(prompt(0, 3).more).toContain("Crossing into the next reach");
    expect(prompt(1, 3).more).not.toContain("calm pool");
    expect(prompt(2, 3).more).toContain("Lanterns are optional");
    expect(prompt(2, 3).more).toContain("to finish");
  });
  test("unexpected step values cannot produce a missing instruction", () => {
    for (const value of [-4, 99, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(prompt(0, value).lead.length).toBeGreaterThan(10);
    }
  });
});
