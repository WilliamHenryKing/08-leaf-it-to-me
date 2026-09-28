import { createRoot } from "react-dom/client";
import "./styles.css";
import { worldReady } from "./loader";
import { createPlay } from "./play";
import { loadAssets } from "./scene/assets";
import { App } from "./ui/App";

const canvas = document.createElement("canvas");
canvas.id = "stage";
canvas.tabIndex = 0;
canvas.setAttribute("role", "img");
canvas.setAttribute(
  "aria-label",
  "A curled-leaf boat with a beetle passenger on a miniature river. Drag or use the arrow keys to aim a gust, release or press Space to blow.",
);
document.body.prepend(canvas);

const root = document.getElementById("root");
// Sourced textures and scans load behind the arrival veil; any that fail fall back to procedural.
loadAssets()
  .then((assets) => {
    const play = createPlay(canvas, assets);
    if (root) createRoot(root).render(<App play={play} />);
  })
  .catch(fail);

function fail(err: unknown) {
  // No WebGL: say so plainly rather than leave a blank page.
  console.error(err);
  if (root) {
    createRoot(root).render(
      <main className="grid h-full place-items-center p-6 text-center">
        <p>LEAF IT TO ME needs WebGL, which this browser could not start.</p>
      </main>,
    );
  }
  worldReady();
}
