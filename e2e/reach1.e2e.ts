import { expect, type Page, test } from "@playwright/test";
import type { GameState } from "../src/game/sim";
import { read, shot, start } from "./support";

const wait = (page: Page, predicate: (state: GameState) => boolean, timeout = 120_000) =>
  expect.poll(async () => predicate(await read(page)), { timeout, intervals: [75] }).toBe(true);
async function gust(page: Page, turns: number, strengthSteps: number) {
  await page.locator("#stage").focus();
  await page.keyboard.press("Escape");
  for (let i = 0; i < Math.abs(turns); i++)
    await page.keyboard.press(turns < 0 ? "ArrowLeft" : "ArrowRight");
  for (let i = 0; i < strengthSteps; i++) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
}
for (const side of ["left", "right"] as const) {
  test(`all three reaches by the ${side} passages, lantern gathering and ${side === "left" ? "replay" : "modal recovery"}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?e2e");
    await start(page);
    await wait(page, (s) => s.y >= 12.5);
    await gust(page, side === "left" ? -8 : 8, 1);
    expect((await read(page)).gusts).toBe(1);
    expect((await read(page)).guide).toBe(2);
    await shot(page, `${side}-flowerpot`);
    await wait(page, (s) => s.reach === 1);
    await expect(
      page.locator("header").getByText("The Root Tunnel", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "How to play", exact: true }).click();
    await expect(page.locator(".guide")).toContainText(/root tunnel|outside passage/i);
    await wait(page, (s) => s.y >= 40);
    await gust(page, side === "left" ? -8 : 8, 1);
    expect((await read(page)).gusts).toBe(2);
    await shot(page, `${side}-root`);
    await wait(page, (s) => s.reach === 2);
    await page.getByRole("button", { name: "How to play", exact: true }).click();
    await expect(page.locator(".guide")).toContainText("gathering on the right side of the pond");
    await wait(page, (s) => s.y >= 81);
    await gust(page, 2, 3);
    expect((await read(page)).gusts).toBe(3);
    await shot(page, `${side}-pond`);
    await wait(page, (s) => s.status === "finished");
    const finished = await read(page);
    expect(finished.reach).toBe(2);
    expect(finished.gustsByReach).toEqual([1, 1, 1]);
    expect(finished.rescues).toBe(0);
    expect(finished.lanterns[side === "left" ? 0 : 1]).toBe(true);
    expect(finished.lanterns[side === "left" ? 3 : 4]).toBe(true);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("leaf-it-to-me:best-stars") ?? "null"),
      ),
    ).toEqual([3, 3, 3]);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeFocused();
    await expect(dialog.getByRole("img", { name: "3 of 3 stars", exact: true })).toHaveCount(3);
    await shot(page, `${side}-ending`);
    if (side === "right") {
      await page.evaluate(() => {
        const gl = document.querySelector<HTMLCanvasElement>("#stage")?.getContext("webgl2");
        if (!gl) throw new Error("Missing game WebGL context");
        const draw = gl.drawElements;
        gl.drawElements = () => {
          gl.drawElements = draw;
          throw new Error("Injected final render failure");
        };
      });
      await expect(dialog).toHaveCount(0);
      const reload = page.getByRole("button", { name: "Reload", exact: true });
      await expect(reload).toBeFocused();
      await reload.click({ trial: true });
      await shot(page, "ending-recovery");
    } else {
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      for (const [width, height] of [
        [390, 844],
        [568, 320],
        [320, 568],
      ] as const) {
        await page.setViewportSize({ width, height });
        await dialog.evaluate((element) => {
          (element as HTMLElement).focus();
          element.scrollTop = 0;
        });
        await shot(page, `ending-${width}`);
        await page.keyboard.press("Tab");
        await expect(dialog.getByRole("button", { name: /sound/i })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(dialog.getByRole("button", { name: "Sail again", exact: true })).toBeFocused();
        await expect(
          dialog.getByRole("button", { name: "Sail again", exact: true }),
        ).toBeInViewport();
        await shot(page, `ending-actions-${width}`);
        await dialog.evaluate((element) => {
          (element as HTMLElement).focus();
          element.scrollTop = 0;
        });
      }
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: /sound/i })).toBeFocused();
      await page.keyboard.press("Tab");
      const replay = dialog.getByRole("button", { name: "Sail again", exact: true });
      await expect(replay).toBeFocused();
      await expect(replay).toBeInViewport();
      await shot(page, "ending-keyboard-replay");
      await replay.evaluate((element) => {
        (element as HTMLButtonElement).click();
        (element as HTMLButtonElement).click();
      });
      await expect(dialog).toHaveCount(0);
      await expect(page.locator("#stage")).toBeFocused();
      await page.waitForTimeout(3500);
      const fresh = await read(page);
      expect(fresh.status).toBe("sailing");
      expect(fresh.reach).toBe(0);
      expect(fresh.gusts).toBe(0);
      expect(fresh.rescues).toBe(0);
      expect(fresh.lanterns.every((value) => !value)).toBe(true);
      await shot(page, "replayed");
    }
    expect(errors).toEqual([]);
  });
}

test("restart cancels an old duck rescue; live calm completes the next at its pool", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?e2e");
  await start(page);
  await wait(page, (s) => s.status === "stranded");
  await page.waitForTimeout(200);
  await shot(page, "duck-arriving");
  await page.getByRole("button", { name: "Restart from the first reach", exact: true }).click();
  await page.waitForTimeout(3500);
  expect((await read(page)).status).toBe("sailing");
  expect((await read(page)).rescues).toBe(0);
  expect((await read(page)).time).toBeLessThan(5);
  await wait(page, (s) => s.status === "stranded");
  await expect(page.locator(".guide")).toContainText("duck");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await wait(page, (s) => s.status === "sailing" && s.rescues === 1, 2000);
  const rescued = await read(page);
  expect(rescued.rescuesByReach).toEqual([1, 0, 0]);
  expect(rescued.gusts).toBe(0);
  expect(rescued.y).toBeLessThan(5);
  await expect(page.locator("#stage")).toBeFocused();
  await shot(page, "duck-pool");
  expect(errors).toEqual([]);
});
