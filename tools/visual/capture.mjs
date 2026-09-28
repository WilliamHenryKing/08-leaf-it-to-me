// Captures every visual bookmark from a running build (bun run build && bun run preview) in
// headless Chromium on SwiftShader, and records the renderer string and scene inventory.
// Usage: node tools/visual/capture.mjs <out-dir> [base-url] [comma-separated bookmark ids]
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "docs/visual/captures/latest";
const base = process.argv[3] ?? "http://127.0.0.1:4618/";
const only = process.argv[4]?.split(",");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = { capturedAt: new Date().toISOString(), base, shots: [] };
const probe = await browser.newPage();
await probe.goto(`${base}?e2e`);
await probe.waitForFunction(() => window.__VISUAL_TEST__);
const bookmarks = await probe.evaluate(() => window.__VISUAL_TEST__.bookmarks);
await probe.close();

for (const b of bookmarks.filter((x) => !only || only.includes(x.id))) {
  const [width, height, dpr] = b.size;
  // The phone bookmark runs as a phone (touch, coarse pointer), so it gets the phone tier.
  const phone = dpr > 1;
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("leaf-it-to-me:hint-seen", "1"));
  await page.goto(`${base}?e2e`);
  await page.waitForFunction(() => window.__VISUAL_TEST__);
  await page.evaluate(() => window.__VISUAL_TEST__.ready);
  await page.evaluate((id) => window.__VISUAL_TEST__.setBookmark(id), b.id);
  await page.evaluate(() => window.__VISUAL_TEST__.settle(6));
  await page.screenshot({ path: `${out}/${b.id}.png` });
  const info = await page.evaluate(() => window.__VISUAL_TEST__.info());
  report.shots.push({ ...b, info });
  console.log(`${b.id}: ${info.gpu} · ${info.drawCalls} draws · ${info.sceneTriangles} tris`);
  await ctx.close();
}
writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
