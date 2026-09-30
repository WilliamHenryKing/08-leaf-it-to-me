// Connects the capture hook to a running game: a bookmark places the boat, pins the camera and
// freezes time so every capture of it is the same frame.
import { type Course, centreX, reachAt } from "../game/course";
import { createState, type GameState, startSailing } from "../game/sim";
import type { Aim, World } from "../scene/world";
import { BOOKMARKS } from "./bookmarks";
import { installVisualTest, visualTestEnabled } from "./inspection";

export interface VisualHost {
  course: Course;
  world: World;
  getState(): GameState;
  setState(s: GameState): void;
  getAim(): Aim | null;
  setAim(a: Aim | null): void;
  setFrozen(f: boolean): void;
  quiet(): void;
}

export function wireVisualTest(host: VisualHost) {
  if (!visualTestEnabled()) return;
  const { world, course } = host;
  return installVisualTest({
    renderer: world.stage.renderer,
    loaded: world.ready,
    scene: world.stage.scene,
    camera: world.stage.camera,
    apply(id) {
      const b = BOOKMARKS.find((x) => x.id === id);
      if (!b) return;
      const s = createState(course);
      startSailing(s);
      s.y = b.boat.y;
      s.x = centreX(b.boat.y) + b.boat.u;
      s.heading = b.boat.heading ?? 0;
      s.vx = 0;
      s.vy = 0;
      s.reach = reachAt(course, s.y);
      host.setState(s);
      host.setAim(b.aim ?? null);
      host.quiet();
      document.body.classList.toggle("visual-no-ui", !b.ui);
      world.reset(s);
      world.setView(b.view ?? null);
      world.setClock(12);
      world.prime(s);
      host.setFrozen(true);
      for (let i = 0; i < 3; i++) world.frame(s, host.getAim(), 1 / 30, false);
    },
    freeze() {
      host.setFrozen(true);
      world.setClock(12);
    },
    render() {
      world.frame(host.getState(), host.getAim(), 0, false);
    },
    quality: () => world.stage.pipeline.state(),
    degrade: () => world.stage.pipeline.step(),
  });
}
