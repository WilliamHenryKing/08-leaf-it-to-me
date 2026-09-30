import { createRoot } from "react-dom/client";
import "./styles.css";
import { worldFailed, worldReady } from "./loader";
import { createPlay, type Play } from "./play";
import { type Assets, disposeAssets, loadAssets } from "./scene/assets";
import { App } from "./ui/App";

const canvas = document.createElement("canvas");
canvas.id = "stage";
canvas.tabIndex = 0;
canvas.inert = true;
canvas.setAttribute("role", "application");
canvas.setAttribute(
  "aria-label",
  "A leaf boat on a miniature river. Drag to aim and release to blow, or use the arrow keys and Space. Escape cancels a gust. M toggles sound.",
);
document.body.prepend(canvas);
const element = document.getElementById("root");
if (!element) throw new Error("Missing game interface root");
const root = createRoot(element);
const controller = new AbortController();
let play: Play | undefined;
let assets: Assets | undefined;
let disposed = false;
let failed = false;
let mounted = true;
function cleanup() {
  controller.abort();
  if (mounted) {
    mounted = false;
    root.unmount();
  }
  if (play) play.dispose();
  else if (assets) disposeAssets(assets);
  canvas.inert = true;
}
function fail(error: unknown) {
  if (disposed || failed) return;
  failed = true;
  cleanup();
  console.error(error);
  worldFailed();
}
void loadAssets(controller.signal)
  .then(async (loaded) => {
    assets = loaded;
    if (disposed || failed) {
      disposeAssets(loaded);
      return;
    }
    play = createPlay(canvas, loaded, fail);
    root.render(<App play={play} />);
    await play.ready;
    if (!disposed && !failed) worldReady();
  })
  .catch(fail);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposed = true;
    cleanup();
    canvas.remove();
  });
