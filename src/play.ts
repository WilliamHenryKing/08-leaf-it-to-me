// Wiring: the game loop joins the pure rules, the three.js world, input, sound and the HUD store.
import { createAudio } from "./audio/audio";
import { playCues } from "./audio/cues";
import { createCourse } from "./game/course";
import { windAt } from "./game/field";
import { mergeBest, PAR, parseBest, type Stars, starsFor } from "./game/score";
import {
  applyGust,
  createState,
  type GameEvent,
  rescue,
  SPILL_AT,
  sailEfficiency,
  startSailing,
  step,
  takeEvents,
} from "./game/sim";
import { worldReady } from "./loader";
import { attachInput } from "./scene/input";
import { type Aim, createWorld } from "./scene/world";
import { createStore } from "./ui/store";

const HINT_KEY = "leaf-it-to-me:hint-seen";
const BEST_KEY = "leaf-it-to-me:best-stars";

function readBest(reaches: number) {
  try {
    return parseBest(window.localStorage.getItem(BEST_KEY), reaches);
  } catch {
    return parseBest(null, reaches);
  }
}
function writeBest(best: Stars[]) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Private mode: the record lasts for this visit only.
  }
}
/** Time runs slowly while a gust is being aimed, so choices can be deliberate. */
const AIM_TIME_SCALE = 0.3;

function readHintSeen() {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}
function writeHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Private mode: the hint simply shows again next time.
  }
}

export function createPlay(canvas: HTMLCanvasElement) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const course = createCourse();
  let state = createState(course);
  let aim: Aim | null = null;
  let toastId = 0;
  const world = createWorld(canvas, course, reducedMotion);
  const audio = createAudio();
  // Any first gesture starts the sound; M toggles mute everywhere.
  const unlock = () => void audio.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  const store = createStore({
    status: state.status,
    reach: 0,
    reachName: course.reaches[0]?.name ?? "",
    gusts: 0,
    gustsByReach: state.gustsByReach,
    lanterns: 0,
    totalLanterns: course.lanterns.length,
    rescues: 0,
    aim: null,
    toast: null,
    hint: false,
    muted: audio.muted,
    par: [...PAR],
    stars: [],
    best: readBest(course.reaches.length),
    rescuesByReach: state.rescuesByReach,
  });
  const starsOf = (reach: number) =>
    starsFor(reach, state.gustsByReach[reach] ?? 0, state.rescuesByReach[reach] ?? 0);
  const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
  /** Score a finished reach; after the last one, keep the best of this run and earlier ones. */
  const completeReach = (reach: number) => {
    const stars = [...store.get().stars];
    stars[reach] = starsOf(reach);
    store.set({ stars });
    if (reach === course.reaches.length - 1) {
      const best = mergeBest(store.get().best, stars);
      writeBest(best);
      store.set({ best });
    }
    return stars[reach] as Stars;
  };

  const toast = (text: string) => store.set({ toast: { id: ++toastId, text } });

  const sync = () =>
    store.set({
      status: state.status,
      reach: state.reach,
      reachName: course.reaches[state.reach]?.name ?? "",
      gusts: state.gusts,
      gustsByReach: [...state.gustsByReach],
      lanterns: state.lanterns.filter(Boolean).length,
      rescues: state.rescues,
      rescuesByReach: [...state.rescuesByReach],
      aim: aim
        ? {
            strength: aim.strength,
            spill: aim.strength > SPILL_AT,
            efficiency:
              sailEfficiency(state.heading, aim.angle) * windAt(course, { x: state.x, y: state.y }),
          }
        : null,
    });

  const describe = (e: GameEvent) => {
    if (e.type === "gust" && e.spilled)
      toast("Too strong: the sail spilled the wind and soaked the coat.");
    else if (e.type === "checkpoint") {
      const done = e.reach - 1;
      const stars = completeReach(done);
      const g = state.gustsByReach[done] ?? 0;
      toast(
        `${starText(stars)} ${g} gust${g === 1 ? "" : "s"}, par ${PAR[done]} · on to ${course.reaches[e.reach]?.name}`,
      );
    } else if (e.type === "finished") completeReach(course.reaches.length - 1);
    else if (e.type === "stranded") toast("Stuck fast. Here comes a duck…");
    else if (e.type === "rescued") toast("Quack. Set down in the last calm pool.");
    else if (e.type === "lantern") toast("A lantern for the gathering.");
  };

  const handle = (events: GameEvent[]) => {
    if (!events.length) return;
    playCues(audio, events, state);
    world.onEvents(events, state, () => {
      rescue(course, state);
      handle(takeEvents(state));
    });
    for (const e of events) describe(e);
    sync();
  };

  const input = attachInput(canvas, {
    toGame: world.toGame,
    aim(angle, strength) {
      if (state.status !== "sailing") return;
      if (!aim) {
        audio.play("aim", 0.35);
        audio.setFocus(true);
      }
      aim = { angle, strength };
      sync();
    },
    release() {
      if (aim && applyGust(course, state, aim.angle, aim.strength)) {
        if (store.get().hint) {
          store.set({ hint: false });
          writeHintSeen();
        }
      }
      aim = null;
      audio.setFocus(false);
      handle(takeEvents(state));
      sync();
    },
    cancel() {
      if (aim) audio.setFocus(false);
      aim = null;
      sync();
    },
  });

  const toggleMute = () => {
    audio.setMuted(!audio.muted);
    audio.play("toggle", 0.6);
    store.set({ muted: audio.muted });
  };
  window.addEventListener("keydown", (e) => {
    if ((e.key === "m" || e.key === "M") && !(e.target as HTMLElement | null)?.closest("input")) {
      toggleMute();
    }
  });

  const onResize = () => world.resize();
  window.addEventListener("resize", onResize);
  world.resize();

  let last = performance.now();
  let firstFrame = true;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const scale = aim ? AIM_TIME_SCALE : 1;
    if (!document.hidden) step(course, state, dt * scale);
    handle(takeEvents(state));
    world.frame(state, aim, dt, state.status !== "stranded");
    audio.setWater(Math.hypot(state.vx, state.vy), state.reach === 2);
    if (firstFrame) {
      firstFrame = false;
      requestAnimationFrame(() => {
        worldReady();
        audio.preload();
      });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    store,
    toggleMute,
    start() {
      void audio.unlock();
      audio.play("click", 0.5);
      startSailing(state);
      store.set({ hint: !readHintSeen() });
      toast(`Reach 1 · ${course.reaches[0]?.name}`);
      sync();
    },
    restart() {
      state = createState(course);
      aim = null;
      store.set({ stars: [] });
      audio.setEnding(false);
      audio.setFocus(false);
      audio.play("click", 0.5);
      input.clear();
      world.reset(state);
      startSailing(state);
      toast(`Reach 1 · ${course.reaches[0]?.name}`);
      sync();
    },
    showHint() {
      audio.play("click", 0.5);
      store.set({ hint: true });
    },
    hideHint() {
      audio.play("click", 0.5);
      store.set({ hint: false });
      writeHintSeen();
    },
  };
}

export type Play = ReturnType<typeof createPlay>;
