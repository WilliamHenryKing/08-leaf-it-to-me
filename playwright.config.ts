import { defineConfig } from "@playwright/test";

// End-to-end: builds the game, serves the production preview and sails it in headless Chromium.
// Software WebGL (SwiftShader) is enough; the game's own clock keeps the rules frame-rate safe.
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 480_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4618",
    // Desktop default; touch regressions use their own bounded phone contexts.
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://127.0.0.1:4618",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
