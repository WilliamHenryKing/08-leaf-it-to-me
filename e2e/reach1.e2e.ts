import { expect, type Page, test } from "@playwright/test";

interface Snapshot {
  status: string;
  reach: number;
  x: number;
  y: number;
  gusts: number;
  rescues: number;
}

const snapshot = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { leafItToMe: { snapshot: () => Snapshot } }).leafItToMe.snapshot(),
  );

test("a deliberate crosswind carries the leaf through the chute and out of reach 1", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("leaf-it-to-me:hint-seen", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Set sail" }).click();

  // Wait until the current has the leaf in its grip, heading for the branch.
  await expect.poll(async () => (await snapshot(page)).y, { timeout: 180_000 }).toBeGreaterThan(10);
  expect((await snapshot(page)).status).toBe("sailing");

  // Aim a crosswind to the left (eight sixteenth-turns) at 60% and blow.
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).gusts).toBe(1);

  // The leaf slips past the branch and reaches the Root Tunnel without a duck.
  await expect
    .poll(async () => (await snapshot(page)).reach, { timeout: 280_000, intervals: [500] })
    .toBe(1);
  const end = await snapshot(page);
  expect(end.rescues).toBe(0);
  await expect(page.locator("header").getByText("The Root Tunnel")).toBeVisible();
});
