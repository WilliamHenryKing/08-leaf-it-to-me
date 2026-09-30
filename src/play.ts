// Integrates the pure sailing rules, presentation, input, sound and HUD for one owned run.
import { createAudio } from "./audio/audio";
import { playCues } from "./audio/cues";
import { centreX, createCourse, reachAt } from "./game/course";
import { windAt } from "./game/field";
import { mergeBest, PAR, type Stars, starsFor } from "./game/score";
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
import type { Assets } from "./scene/assets";
import { attachInput, isEditingTarget } from "./scene/input";
import { type Aim, createWorld } from "./scene/world";
import { GUIDE_STEPS, guidePrompt } from "./ui/guidePrompt";
import { readBest, readHintSeen, writeBest, writeHintSeen } from "./ui/storage";
import { createStore } from "./ui/store";
import { visualTestEnabled } from "./visual/inspection";
import { wireVisualTest } from "./visual/wire";

const AIM_TIME_SCALE = 0.3;

export { GUIDE_STEPS };

const GUIDE_HOLD = [0, 0, 9, 8];

export function createPlay(
  canvas: HTMLCanvasElement,
  assets: Assets,
  onFailure: (error: unknown) => void,
) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touch = window.matchMedia("(pointer: coarse)");
  let reduced = motion.matches;
  const query = new URLSearchParams(location.search);
  const manualClock = query.has("capture");
  const skipOpening = (import.meta.env.DEV || query.has("e2e")) && !query.has("intro");
  const course = createCourse();
  let state = createState(course);
  let aim: Aim | null = null;
  let ready = false;
  let disposed = false;
  let generation = 0;
  let toastId = 0;
  let guideClock = 0;
  let queued = 0;
  let frozen = false;
  let raf = 0;
  let focusRaf = 0;
  let layoutDirty = true;
  let restarting = false;
  let last = performance.now();
  const world = createWorld(canvas, course, reduced, assets);
  const audio = createAudio();
  canvas.inert = true;
  const store = createStore({
    status: state.status,
    reach: 0,
    reachName: course.reaches[0]?.name ?? "",
    gusts: 0,
    gustsByReach: [...state.gustsByReach],
    lanterns: 0,
    totalLanterns: course.lanterns.length,
    rescues: 0,
    aim: null,
    toast: null,
    hint: false,
    guide: 0,
    guidePrompt: null,
    muted: audio.muted,
    par: [...PAR],
    stars: [],
    best: readBest(course.reaches.length),
    rescuesByReach: [...state.rescuesByReach],
    reduced,
    ready,
    opening: false,
  });
  const canAct = () =>
    ready &&
    !disposed &&
    !frozen &&
    !document.hidden &&
    !world.gliding &&
    state.status === "sailing";
  const focusCanvas = () => {
    cancelAnimationFrame(focusRaf);
    focusRaf = requestAnimationFrame(() => {
      if (canAct()) canvas.focus({ preventScroll: true });
    });
  };
  const sync = () => {
    if (disposed) return;
    canvas.inert = !canAct();
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
            efficiency: sailEfficiency(state.heading, aim.angle) * windAt(course, state),
          }
        : null,
      ready,
      reduced,
      opening: world.gliding,
      guidePrompt: store.get().hint
        ? guidePrompt(
            {
              status: state.status,
              reach: state.reach,
              reachName: course.reaches[state.reach]?.name ?? "",
              guide: store.get().guide,
            },
            touch.matches,
          )
        : null,
    });
  };
  const toast = (text: string) => store.set({ toast: { id: ++toastId, text } });
  const completeReach = (reach: number) => {
    const stars = [...store.get().stars];
    stars[reach] = starsFor(
      reach,
      state.gustsByReach[reach] ?? 0,
      state.rescuesByReach[reach] ?? 0,
    );
    store.set({ stars });
    if (reach === course.reaches.length - 1) {
      const best = mergeBest(store.get().best, stars);
      writeBest(best);
      store.set({ best });
    }
    return stars[reach] as Stars;
  };
  const describe = (event: GameEvent) => {
    if (event.type === "gust" && event.spilled)
      toast("Too strong: the sail spilled the wind and soaked the coat.");
    else if (event.type === "checkpoint") {
      const done = event.reach - 1;
      const stars = completeReach(done);
      const gusts = state.gustsByReach[done] ?? 0;
      toast(
        `${"★".repeat(stars)}${"☆".repeat(3 - stars)} ${gusts} gust${gusts === 1 ? "" : "s"}, par ${PAR[done]} · on to ${course.reaches[event.reach]?.name}`,
      );
    } else if (event.type === "finished") completeReach(course.reaches.length - 1);
    else if (event.type === "stranded") toast("Stuck fast. Here comes a duck…");
    else if (event.type === "rescued") toast("Quack. Set down in the last calm pool.");
    else if (event.type === "lantern") toast("A lantern for the gathering.");
  };
  const guideTo = (next: number) => {
    guideClock = 0;
    if (next >= GUIDE_STEPS) {
      store.set({ hint: false });
      writeHintSeen();
    } else store.set({ guide: next });
  };
  const handle = (events: GameEvent[]) => {
    if (disposed || !events.length) return;
    if (events.some((event) => event.type === "stranded" || event.type === "finished"))
      input.clear();
    if (events.some((event) => event.type === "finished")) {
      store.set({ hint: false });
      writeHintSeen();
    }
    playCues(audio, events, state);
    const run = state;
    const epoch = generation;
    world.onEvents(events, run, () => {
      if (disposed || state !== run || generation !== epoch) return;
      rescue(course, run);
      handle(takeEvents(run));
      focusCanvas();
    });
    for (const event of events) describe(event);
    sync();
  };
  const input = attachInput(canvas, {
    toGame: world.toGame,
    active: canAct,
    aim(angle, strength) {
      if (!canAct()) return;
      if (!aim) {
        audio.play("aim", 0.35);
        audio.setFocus(true);
      }
      aim = { angle, strength };
      if (store.get().hint && store.get().guide === 0) guideTo(1);
      sync();
    },
    release() {
      if (!canAct()) {
        input.clear();
        return;
      }
      if (aim && applyGust(course, state, aim.angle, aim.strength)) {
        const { hint, guide } = store.get();
        if (hint && guide <= 2) guideTo(guide < 2 ? 2 : 3);
      } else if (store.get().hint && store.get().guide === 1) {
        guideTo(0);
      }
      aim = null;
      audio.setFocus(false);
      handle(takeEvents(state));
      sync();
    },
    cancel() {
      aim = null;
      audio.setFocus(false);
      if (!disposed && store.get().hint && store.get().guide === 1) guideTo(0);
      sync();
    },
  });
  const toggleMute = () => {
    if (disposed) return;
    audio.setMuted(!audio.muted);
    audio.play("toggle", 0.6);
    store.set({ muted: audio.muted });
  };
  const unlock = () => {
    if (!disposed) void audio.unlock();
  };
  const onKey = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      isEditingTarget(event.target)
    )
      return;
    if (event.key.toLowerCase() === "m") toggleMute();
    else if (event.key === "Enter" && state.status === "intro") {
      if ((event.target as HTMLElement | null)?.closest("button, a")) return;
      event.preventDefault();
      api.start();
    }
  };
  const onResize = () => {
    input.clear();
    layoutDirty = true;
    world.resize();
  };
  const onVisibility = () => {
    last = performance.now();
    if (document.hidden) input.clear();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    fail(new Error("The WebGL context was lost."));
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);
  world.resize();

  const measured = new Set<Element>();
  const observer = new ResizeObserver(() => {
    layoutDirty = true;
  });
  const watchLayout = () => {
    for (const element of measured)
      if (!element.isConnected) {
        observer.unobserve(element);
        measured.delete(element);
        layoutDirty = true;
      }
    for (const element of document.querySelectorAll(".hud-top, .hud-bottom, .play-hud")) {
      if (!measured.has(element)) {
        measured.add(element);
        observer.observe(element);
        layoutDirty = true;
      }
    }
  };
  const mutations = new MutationObserver(watchLayout);
  const interfaceRoot = document.getElementById("root");
  if (interfaceRoot) mutations.observe(interfaceRoot, { childList: true, subtree: true });
  const layout = () => {
    layoutDirty = false;
    const width = canvas.clientWidth || innerWidth;
    const height = canvas.clientHeight || innerHeight;
    if (width <= 720 && height <= 550 && width > height) {
      world.setInsets({
        top: 0.025,
        bottom: 0.025,
        left: 0.025,
        right: (Math.min(260, width * 0.46) + 8) / width,
      });
    } else if (width / height < 0.8) {
      const top = document.querySelector(".hud-top")?.getBoundingClientRect();
      const bottom = document.querySelector(".hud-bottom")?.getBoundingClientRect();
      world.setInsets({
        top: top?.height ? Math.min(0.4, (top.bottom + 10) / height) : 0,
        bottom: bottom?.height ? Math.min(0.45, (height - bottom.top + 10) / height) : 0.04,
        left: 0,
        right: 0,
      });
    } else world.setInsets({ top: 0, bottom: 0, left: 0, right: 0 });
  };

  const visual = wireVisualTest({
    course,
    world,
    getState: () => state,
    setState: (next) => {
      generation++;
      input.clear();
      state = next;
      sync();
    },
    getAim: () => aim,
    setAim: (next) => {
      aim = next;
      sync();
    },
    setFrozen: (next) => {
      frozen = next;
      sync();
    },
    quiet: () => store.set({ hint: false, toast: null, status: "sailing" }),
  });
  const probe = {
    advance(seconds: number) {
      if (!manualClock || !Number.isFinite(seconds) || seconds <= 0 || disposed) return;
      queued = Math.min(120, queued + seconds);
    },
    pending: () => queued,
    snapshot: () => ({
      ...structuredClone(state),
      ready,
      opening: world.gliding,
      guide: store.get().guide,
      hint: store.get().hint,
    }),
    state: () => structuredClone(state),
    toScreen(x: number, y: number) {
      // Projection is observation only; tests still act through real pointer/keyboard input.
      const point = world.stage.camera.position.clone().set(x, 0, -y).project(world.stage.camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + ((point.x + 1) * rect.width) / 2,
        y: rect.top + ((1 - point.y) * rect.height) / 2,
      };
    },
  };
  const host = window as unknown as { leafItToMe?: typeof probe };
  if (visualTestEnabled() || manualClock) host.leafItToMe = probe;
  function dispose() {
    if (disposed) return;
    disposed = true;
    ready = false;
    generation++;
    canvas.inert = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(focusRaf);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    input.detach();
    observer.disconnect();
    mutations.disconnect();
    visual?.dispose();
    if (host.leafItToMe === probe) delete host.leafItToMe;
    audio.dispose();
    world.dispose();
  }
  function fail(error: unknown) {
    if (disposed) return;
    dispose();
    onFailure(error);
  }
  function loop(now: number) {
    if (disposed) return;
    try {
      const real = document.hidden ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const gliding = world.gliding;
      if (reduced !== motion.matches) {
        reduced = motion.matches;
        world.setMotion(reduced);
      }
      if (layoutDirty) layout();
      const tick = Math.min(queued, 1 / 30);
      if (!frozen && !document.hidden && manualClock) queued -= tick;
      const dt = frozen || document.hidden ? 0 : manualClock ? tick : real;
      if (canAct()) step(course, state, dt * (aim ? AIM_TIME_SCALE : 1));
      const guide = store.get();
      if (canAct() && guide.hint && (GUIDE_HOLD[guide.guide] ?? 0) > 0) {
        guideClock += dt;
        if (guideClock >= (GUIDE_HOLD[guide.guide] ?? 0)) guideTo(guide.guide + 1);
      }
      handle(takeEvents(state));
      world.frame(state, aim, dt, state.status !== "stranded", real);
      audio.setWater(Math.hypot(state.vx, state.vy), state.reach === 2);
      restarting = false;
      sync();
      if (gliding && !world.gliding) focusCanvas();
      raf = requestAnimationFrame(loop);
    } catch (error) {
      fail(error);
    }
  }
  const api = {
    store,
    toggleMute,
    focusCanvas,
    dispose,
    start() {
      if (!ready || disposed || state.status !== "intro") return;
      input.clear();
      void audio.unlock();
      audio.play("click", 0.5);
      startSailing(state);
      const at = import.meta.env.DEV ? Number(query.get("at")) : 0;
      if (Number.isFinite(at) && at > 0) {
        state.y = at;
        state.x = centreX(at);
        state.reach = reachAt(course, at);
        world.reset(state);
      }
      world.beginPlay(skipOpening);
      last = performance.now();
      queued = 0;
      guideClock = 0;
      store.set({ hint: !readHintSeen(), guide: 0 });
      toast(`Reach ${state.reach + 1} · ${course.reaches[state.reach]?.name}`);
      sync();
      focusCanvas();
    },
    restart() {
      if (!ready || disposed || restarting || state.status === "intro" || world.gliding) return;
      restarting = true;
      generation++;
      input.clear();
      state = createState(course);
      startSailing(state);
      frozen = false;
      queued = 0;
      guideClock = 0;
      audio.reset();
      audio.play("click", 0.5);
      world.setView(null);
      world.reset(state);
      world.beginPlay(true);
      store.set({ stars: [], hint: !readHintSeen(), guide: 0 });
      toast(`Reach 1 · ${course.reaches[0]?.name}`);
      last = performance.now();
      sync();
      focusCanvas();
    },
    showHint() {
      if (!canAct()) return;
      input.clear();
      audio.play("click", 0.5);
      guideClock = 0;
      store.set({ hint: true, guide: 0 });
      sync();
      focusCanvas();
    },
    hideHint() {
      if (!ready || disposed || !store.get().hint) return;
      input.clear();
      audio.play("click", 0.5);
      store.set({ hint: false });
      writeHintSeen();
      sync();
      focusCanvas();
    },
  };
  const prepared = world.ready.then(() => {
    if (disposed) return;
    world.frame(state, null, 0, false);
    ready = true;
    last = performance.now();
    sync();
    audio.preload();
    raf = requestAnimationFrame(loop);
  });
  return { ...api, ready: prepared };
}
export type Play = ReturnType<typeof createPlay>;
