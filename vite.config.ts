import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  server: { host: "127.0.0.1", port: 4518, strictPort: true },
  preview: { host: "127.0.0.1", port: 4618, strictPort: true },
  // three.js is most of the ~0.9 MB bundle; one chunk is fine for a single scene.
  build: { cssMinify: "lightningcss", chunkSizeWarningLimit: 1000 },
});
