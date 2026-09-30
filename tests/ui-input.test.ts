import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { attachInput, isEditingTarget } from "../src/scene/input";

type Kind = "canvas" | "body" | "button" | "textarea" | "select" | "editable" | "dialog" | "scroll";
type Listener = (event: Event) => void;

class Surface {
  listeners = new Map<string, Set<Listener>>();
  constructor(public kind: Kind = "body") {}
  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string, fields: Record<string, unknown> = {}) {
    const event = new Event(type, { cancelable: true });
    const values = {
      target: this,
      button: 0,
      isPrimary: true,
      pointerType: "touch",
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...fields,
    };
    for (const [key, value] of Object.entries(values)) {
      Object.defineProperty(event, key, { value, configurable: true });
    }
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  closest(selector: string): Surface | null {
    if (this.kind === "textarea" && selector.includes("textarea")) return this;
    if (this.kind === "select" && selector.includes("select")) return this;
    if (this.kind === "editable" && selector.includes("contenteditable")) return this;
    if (
      this.kind === "button" &&
      selector.split(",").some((part) => ["button", "[role='button']"].includes(part.trim()))
    ) {
      return this;
    }
    if (this.kind === "dialog" && selector.includes("dialog")) return this;
    return null;
  }
  matches(selector: string) {
    return this.kind === "scroll" && selector === "[data-keyboard-scroll]";
  }
}

class Canvas extends Surface {
  clientWidth = 600;
  clientHeight = 400;
  captures = new Set<number>();
  constructor() {
    super("canvas");
  }
  setPointerCapture(id: number) {
    this.captures.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captures.has(id);
  }
  releasePointerCapture(id: number) {
    this.captures.delete(id);
    this.fire("lostpointercapture", { pointerId: id });
  }
  getBoundingClientRect() {
    return { left: 0, right: 600, top: 0, bottom: 400 };
  }
  focus() {
    doc.fire("focusin", { target: this });
  }
}

let win: Surface;
let doc: Surface & { hidden: boolean; elementFromPoint: () => Surface | null };
let canvas: Canvas;
let hit: Surface | null;
let mapping: { x: number; y: number };
let active: boolean;
let aims: { angle: number; strength: number }[];
let releases: number;
let cancels: number;
let input: ReturnType<typeof attachInput>;
let windowBefore: PropertyDescriptor | undefined;
let documentBefore: PropertyDescriptor | undefined;

beforeEach(() => {
  windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
  documentBefore = Object.getOwnPropertyDescriptor(globalThis, "document");
  win = new Surface();
  doc = Object.assign(new Surface(), { hidden: false, elementFromPoint: () => hit });
  canvas = new Canvas();
  hit = canvas;
  mapping = { x: 0, y: 0 };
  active = true;
  aims = [];
  releases = 0;
  cancels = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  input = attachInput(canvas as unknown as HTMLCanvasElement, {
    active: () => active,
    toGame: (x, y) => ({ x: x / 10 + mapping.x, y: y / 10 + mapping.y }),
    aim: (angle, strength) => aims.push({ angle, strength }),
    release: () => releases++,
    cancel: () => cancels++,
  });
});
afterEach(() => {
  input.detach();
  if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
  else Reflect.deleteProperty(globalThis, "window");
  if (documentBefore) Object.defineProperty(globalThis, "document", documentBefore);
  else Reflect.deleteProperty(globalThis, "document");
});

const key = (value: string, code = value, fields: Record<string, unknown> = {}) =>
  win.fire("keydown", { key: value, code, target: canvas, ...fields });
const point = (type: string, x = 100, y = 100, fields: Record<string, unknown> = {}) =>
  canvas.fire(type, { clientX: x, clientY: y, ...fields });

describe("owned pointer gusts", () => {
  test("a release uses its final location even when no move event was delivered", () => {
    point("pointerdown");
    point("pointerup", 160, 160);
    expect(releases).toBe(1);
    expect(aims[0]?.angle).toBeCloseTo(Math.PI / 4, 8);
    expect(aims[0]?.strength).toBeCloseTo(Math.hypot(60, 60) / 120, 8);
    expect(canvas.captures.size).toBe(0);
  });
  test("a tap cannot release a stale keyboard aim or a drag returned to its dead zone", () => {
    key("ArrowRight");
    point("pointerdown");
    point("pointerup", 101, 100);
    point("pointerdown");
    point("pointermove", 200, 100);
    point("pointerup", 102, 100);
    expect(releases).toBe(0);
    expect(canvas.captures.size).toBe(0);
  });
  test("camera translation cannot rotate an unchanged screen drag", () => {
    point("pointerdown");
    point("pointermove", 160, 160);
    mapping = { x: 150, y: -40 };
    point("pointermove", 160, 160);
    point("pointerup", 160, 160);
    expect(aims).toHaveLength(3);
    for (const aim of aims) expect(aim.angle).toBeCloseTo(Math.PI / 4, 8);
  });
  test("captured release over a HUD control or outside the canvas cancels", () => {
    point("pointerdown");
    point("pointermove", 160, 160);
    hit = new Surface("button");
    point("pointerup", 160, 160);
    expect(releases).toBe(0);
    hit = canvas;
    point("pointerdown");
    point("pointerup", 700, 100);
    expect(releases).toBe(0);
    expect(canvas.captures.size).toBe(0);
  });
  test("foreign contacts cannot move, release, or cancel the owner's drag", () => {
    point("pointerdown");
    point("pointermove", 160, 160, { pointerId: 2 });
    point("pointerup", 160, 160, { pointerId: 2 });
    point("pointercancel", 160, 160, { pointerId: 2 });
    expect(aims).toHaveLength(0);
    expect(canvas.captures.has(1)).toBe(true);
    point("pointerup", 160, 160);
    expect(releases).toBe(1);
  });
  test("secondary pointers and pen barrel buttons do not take ownership", () => {
    point("pointerdown", 100, 100, { isPrimary: false });
    point("pointerdown", 100, 100, { pointerType: "pen", button: 2 });
    expect(canvas.captures.size).toBe(0);
  });
  test("pointercancel and lost capture clear without a gust", () => {
    for (const type of ["pointercancel", "lostpointercapture"]) {
      point("pointerdown");
      point("pointermove", 160, 160);
      point(type);
      point("pointerup", 160, 160);
      expect(canvas.captures.size).toBe(0);
    }
    expect(releases).toBe(0);
  });
  test("Escape cancels the pointer owner and a keyboard command cannot steal it", () => {
    point("pointerdown");
    point("pointermove", 160, 160);
    const count = aims.length;
    key("ArrowLeft");
    key(" ", "Space");
    expect(aims).toHaveLength(count);
    expect(releases).toBe(0);
    expect(key("Escape").defaultPrevented).toBe(true);
    point("pointerup", 160, 160);
    expect(canvas.captures.size).toBe(0);
    expect(releases).toBe(0);
  });
});

describe("native keyboard ownership", () => {
  test("held Space and Enter each blow only once until their matching release", () => {
    key("ArrowRight");
    for (const [value, code] of [
      [" ", "Space"],
      ["Enter", "Enter"],
    ]) {
      key(value ?? "", code);
      for (let i = 0; i < 4; i++) {
        expect(key(value ?? "", code, { repeat: true }).defaultPrevented).toBe(true);
      }
      win.fire("keyup", { key: value, code });
    }
    expect(releases).toBe(2);
    key(" ", "Space");
    expect(releases).toBe(3);
  });
  test("first button activation stays native; repeated activation is suppressed", () => {
    key("ArrowRight");
    const button = new Surface("button");
    expect(key(" ", "Space", { target: button }).defaultPrevented).toBe(false);
    expect(key("Enter", "Enter", { target: button }).defaultPrevented).toBe(false);
    expect(key(" ", "Space", { target: button, repeat: true }).defaultPrevented).toBe(true);
    expect(releases).toBe(0);
  });
  test("native editing, modal, modified, and already-handled keys do not aim", () => {
    for (const kind of ["textarea", "select", "editable", "dialog"] as const) {
      const target = new Surface(kind);
      expect(key("ArrowRight", "ArrowRight", { target }).defaultPrevented).toBe(false);
      expect(key(" ", "Space", { target }).defaultPrevented).toBe(false);
    }
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      expect(key("ArrowRight", "ArrowRight", { [modifier]: true }).defaultPrevented).toBe(false);
    }
    const event = new Event("keydown", { cancelable: true });
    event.preventDefault();
    Object.defineProperties(event, { key: { value: "ArrowRight" }, target: { value: canvas } });
    for (const listener of win.listeners.get("keydown") ?? []) listener(event);
    expect(aims).toHaveLength(0);
  });
  test("scroll surfaces retain native arrows and repeated Space scrolling", () => {
    key("ArrowRight");
    const target = new Surface("scroll");
    for (const value of ["ArrowDown", "ArrowLeft", " "]) {
      expect(key(value, value, { target }).defaultPrevented).toBe(false);
      expect(key(value, value, { target, repeat: true }).defaultPrevented).toBe(false);
    }
    expect(releases).toBe(0);
    expect(aims).toHaveLength(1);
  });
  test("physical letter keys work, while arrows on ordinary buttons remain game controls", () => {
    key("A", "KeyA");
    key("ArrowRight", "ArrowRight", { target: new Surface("button") });
    expect(aims[0]?.angle).toBeCloseTo(-Math.PI / 16, 8);
    expect(aims[1]?.angle).toBeCloseTo(0, 8);
  });
  test("blur forgets remembered aim and a held key cannot resurrect it", () => {
    key("ArrowRight");
    win.fire("blur");
    key("ArrowRight", "ArrowRight", { repeat: true });
    key(" ", "Space");
    expect(aims).toHaveLength(1);
    expect(releases).toBe(0);
    win.fire("keyup", { key: "ArrowRight", code: "ArrowRight" });
    key("ArrowLeft");
    expect(aims[1]?.angle).toBeCloseTo(-Math.PI / 16, 8);
  });
  test("focus leaving the canvas cancels a remembered keyboard aim", () => {
    key("ArrowRight");
    doc.fire("focusin", { target: new Surface("button") });
    key(" ", "Space");
    expect(releases).toBe(0);
  });
  test("editing-target export recognizes text widgets without swallowing button commands", () => {
    expect(isEditingTarget(new Surface("textarea") as unknown as EventTarget)).toBe(true);
    expect(isEditingTarget(new Surface("select") as unknown as EventTarget)).toBe(true);
    expect(isEditingTarget(new Surface("editable") as unknown as EventTarget)).toBe(true);
    expect(isEditingTarget(new Surface("button") as unknown as EventTarget)).toBe(false);
    expect(isEditingTarget(null)).toBe(false);
  });
});

describe("input lifecycle", () => {
  test("hidden tabs and resize release owned capture and invalidate the release", () => {
    for (const type of ["visibilitychange", "resize"]) {
      point("pointerdown");
      point("pointermove", 160, 160);
      if (type === "visibilitychange") {
        doc.hidden = true;
        doc.fire(type);
        doc.hidden = false;
      } else win.fire(type);
      expect(canvas.captures.size).toBe(0);
      point("pointerup", 160, 160);
    }
    expect(releases).toBe(0);
  });
  test("an inactive transition cancels the owner before a later pointer release", () => {
    point("pointerdown");
    point("pointermove", 160, 160);
    active = false;
    point("pointermove", 170, 170);
    point("pointerup", 170, 170);
    key("ArrowRight");
    point("pointerdown");
    expect(releases).toBe(0);
    expect(aims).toHaveLength(1);
    expect(canvas.captures.size).toBe(0);
  });
  test("clear and detach cancel once, release capture, and leave no listeners", () => {
    point("pointerdown");
    point("pointermove", 160, 160);
    const before = cancels;
    input.clear();
    expect(cancels).toBe(before + 1);
    expect(canvas.captures.size).toBe(0);
    point("pointerdown");
    input.detach();
    const detached = cancels;
    input.dispose();
    expect(cancels).toBe(detached);
    key("ArrowRight");
    point("pointerup", 160, 160);
    expect(releases).toBe(0);
    for (const surface of [canvas, win, doc]) {
      for (const listeners of surface.listeners.values()) expect(listeners.size).toBe(0);
    }
  });
});
