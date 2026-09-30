import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import type { GameState } from "../src/game/sim";

export type Snapshot = GameState & {
  ready: boolean;
  opening: boolean;
  guide: number;
  hint: boolean;
};
export interface Probe {
  snapshot(): Snapshot;
  state(): GameState;
  toScreen(x: number, y: number): { x: number; y: number };
  advance(seconds: number): void;
  pending(): number;
}
export const read = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => (window as unknown as { leafItToMe: Probe }).leafItToMe.snapshot());
export async function ready(page: Page) {
  await expect(page.locator("#arrival")).toHaveCount(0, { timeout: 90_000 });
  await page.waitForFunction(
    () => (window as unknown as { leafItToMe?: Probe }).leafItToMe?.snapshot().ready,
  );
  if (process.env.REQUIRE_REAL_GPU === "1") {
    const gpu = await page.evaluate(() => window.__VISUAL_TEST__?.info().gpu);
    expect(gpu).toMatch(/NVIDIA|RTX/i);
    expect(gpu).not.toMatch(/SwiftShader|llvmpipe/i);
  }
}
export async function start(page: Page) {
  await ready(page);
  await page.getByRole("button", { name: "Set sail", exact: true }).click();
  await expect.poll(async () => (await read(page)).opening).toBe(false);
  await expect(page.locator("#stage")).toBeFocused();
}
export async function shot(page: Page, name: string) {
  const out = path.resolve("../../.workspace/bug-pass-2026-09-30/08");
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}
export async function readableGuide(page: Page) {
  const guide = page.locator(".guide");
  await expect(guide).toBeVisible();
  expect(
    await guide.evaluate((element) => {
      const paragraphs = [...element.querySelectorAll("p")];
      const body =
        paragraphs.find((p) => p.classList.contains("guide-body")) ??
        paragraphs[2] ??
        paragraphs[1];
      if (!body) return false;
      const r = body.getBoundingClientRect();
      return (
        r.top >= 0 &&
        r.top + 10 < innerHeight &&
        element.contains(document.elementFromPoint(r.left + 15, r.top + 10))
      );
    }),
  ).toBe(true);
}
export async function boatPoint(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as { leafItToMe: Probe }).leafItToMe;
    const state = probe.snapshot();
    const point = probe.toScreen(state.x, state.y);
    return { ...point, exposed: document.elementFromPoint(point.x, point.y)?.id === "stage" };
  });
}
