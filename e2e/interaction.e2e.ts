import { expect, test } from "@playwright/test";
import { boatPoint, type Probe, read, readableGuide, ready, shot, start } from "./support";

test("the title and glide hold physics; live calm and real guide actions settle cleanly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?e2e&intro");
  await ready(page);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  expect((await read(page)).status).toBe("intro");
  expect((await read(page)).gusts).toBe(0);
  await page.getByRole("button", { name: "Set sail", exact: true }).click();
  await expect.poll(async () => (await read(page)).opening).toBe(true);
  await page.waitForTimeout(500);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  expect((await read(page)).time).toBe(0);
  expect((await read(page)).gusts).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await read(page)).opening, { timeout: 1500 }).toBe(false);
  await expect(page.locator("#stage")).toBeFocused();
  await readableGuide(page);
  await page.keyboard.press("ArrowRight");
  expect((await read(page)).guide).toBe(1);
  await page.keyboard.press("Escape");
  expect((await read(page)).guide).toBe(0);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  expect((await read(page)).gusts).toBe(1);
  expect((await read(page)).guide).toBe(2);
  await shot(page, "live-calm-guide");
  // Reopening practice immediately after a gust must not strand it on "Let go"
  // when the cooldown rejects the next release. All events share one task.
  const rejected = await page.evaluate(() => {
    const probe = (window as unknown as { leafItToMe: Probe }).leafItToMe;
    const canvas = document.querySelector<HTMLCanvasElement>("#stage");
    const press = (key: string) => {
      canvas?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      canvas?.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
    };
    canvas?.focus();
    press("ArrowLeft");
    press(" ");
    document.querySelector<HTMLButtonElement>('[aria-label="How to play"]')?.click();
    canvas?.focus();
    press("ArrowRight");
    const aiming = probe.snapshot();
    press(" ");
    return { aiming, released: probe.snapshot() };
  });
  expect(rejected.aiming.guide).toBe(1);
  expect(rejected.released.gusts).toBe(rejected.aiming.gusts);
  expect(rejected.released.guide).toBe(0);
  expect(errors).toEqual([]);
});

test("native actions, modifiers, text fields and blur cannot leak gust controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?e2e");
  await start(page);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  expect((await read(page)).gusts).toBe(1);
  const restart = page.getByRole("button", { name: "Restart from the first reach", exact: true });
  await restart.focus();
  await page.keyboard.press("Space");
  expect((await read(page)).gusts).toBe(0);
  await expect(page.locator("#stage")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.press("Space");
  expect((await read(page)).gusts).toBe(0);
  await page.evaluate(() => {
    const input = document.createElement("textarea");
    input.id = "editing-fixture";
    input.style.cssText = "position:fixed;top:160px;left:20px;z-index:200";
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.type("wasderqm ");
  await expect(page.locator("#editing-fixture")).toHaveValue("wasderqm ");
  expect((await read(page)).gusts).toBe(0);
  await page.locator("#editing-fixture").evaluate((element) => element.remove());
  await page.locator("#stage").focus();
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
      }),
    ),
  );
  await page.keyboard.press("Space");
  expect((await read(page)).gusts).toBe(0);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [390, 844],
  [568, 320],
  [320, 568],
] as const) {
  test(`touch aiming cancels and the guide leaves the boat exposed at ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("http://127.0.0.1:4618/?e2e");
      await start(page);
      await readableGuide(page);
      const boat = await boatPoint(page);
      expect(boat.exposed).toBe(true);
      await shot(page, `guide-${width}`);
      const cdp = await context.newCDPSession(page);
      const end = { x: Math.min(width - 20, boat.x + 38), y: boat.y - 12, id: 1 };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: boat.x, y: boat.y, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] });
      await expect.poll(async () => (await read(page)).guide).toBe(1);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      expect((await read(page)).gusts).toBe(0);
      expect((await read(page)).guide).toBe(0);
      const next = await boatPoint(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: next.x, y: next.y, id: 2 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: Math.min(width - 20, next.x + 35), y: next.y - 10, id: 2 }],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      expect((await read(page)).gusts).toBe(1);
      await expect(page.locator(".guide")).toContainText("Between gusts");
      await readableGuide(page);
      await expect.poll(async () => (await boatPoint(page)).exposed).toBe(true);
      await shot(page, `guide-current-${width}`);
      await page.getByRole("button", { name: "Skip the guide", exact: true }).tap();
      await page.getByRole("button", { name: "How to play", exact: true }).tap();
      await readableGuide(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("a slow scanned asset stays covered instead of exposing an unfinished scene", async ({
  page,
}) => {
  await page.route("**/models/planter_pot_clay.glb", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.continue().catch(() => {});
  });
  await page.goto("/?e2e", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12_500);
  await expect(page.locator("#arrival")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { leafItToMe?: Probe }).leafItToMe?.snapshot().gusts ?? 0,
    ),
  ).toBe(0);
  await start(page);
  await readableGuide(page);
  await shot(page, "slow-startup");
});

test("runtime failure exposes focused, clickable recovery", async ({ page }) => {
  await page.goto("/?e2e");
  await start(page);
  await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>("#stage")?.getContext("webgl2");
    if (!gl) throw new Error("Missing game WebGL context");
    const original = gl.drawElements;
    gl.drawElements = () => {
      gl.drawElements = original;
      throw new Error("Injected render failure");
    };
  });
  const reload = page.getByRole("button", { name: "Reload", exact: true });
  await expect(reload).toBeFocused();
  await reload.click({ trial: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await shot(page, "runtime-recovery");
});
