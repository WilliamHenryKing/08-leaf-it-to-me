// Small per-browser memories: whether the hint was seen, and the best stars per reach.
import { parseBest, type Stars } from "../game/score";

const HINT_KEY = "leaf-it-to-me:hint-seen";
const BEST_KEY = "leaf-it-to-me:best-stars";

export function readBest(reaches: number) {
  try {
    return parseBest(window.localStorage.getItem(BEST_KEY), reaches);
  } catch {
    return parseBest(null, reaches);
  }
}
export function writeBest(best: Stars[]) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Private mode: the record lasts for this visit only.
  }
}
export function readHintSeen() {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}
export function writeHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Private mode: the hint simply shows again next time.
  }
}
