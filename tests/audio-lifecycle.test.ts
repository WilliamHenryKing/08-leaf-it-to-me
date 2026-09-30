import { afterEach, describe, expect, test } from "bun:test";
import { type Audio, createAudio } from "../src/audio/audio";

class Parameter {
  value = 0;
  targets: number[] = [];
  setValueAtTime(value: number) {
    this.targets.push(value);
  }
  linearRampToValueAtTime(value: number) {
    this.targets.push(value);
  }
  exponentialRampToValueAtTime(value: number) {
    this.targets.push(value);
  }
  setTargetAtTime(value: number) {
    this.targets.push(value);
  }
}
class Node {
  gain = new Parameter();
  frequency = new Parameter();
  Q = new Parameter();
  playbackRate = new Parameter();
  type = "";
  disconnected = 0;
  connect(destination: Node) {
    return destination;
  }
  disconnect() {
    this.disconnected++;
  }
}
class Source extends Node {
  buffer: unknown = null;
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  start(at = 0) {
    this.starts.push(at);
  }
  stop(at?: number) {
    this.stops.push(at);
  }
  end() {
    this.onended?.();
  }
}
class Context {
  static created: Context[] = [];
  static decode = () => Promise.resolve({ duration: 30 });
  currentTime = 10;
  state = "running";
  destination = new Node();
  nodes: Node[] = [];
  sources: Source[] = [];
  closed = 0;
  constructor() {
    Context.created.push(this);
  }
  createGain() {
    const node = new Node();
    this.nodes.push(node);
    return node;
  }
  createDynamicsCompressor() {
    return this.createGain();
  }
  createBiquadFilter() {
    return this.createGain();
  }
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  createOscillator() {
    return this.createBufferSource();
  }
  decodeAudioData() {
    return Context.decode();
  }
  async close() {
    this.closed++;
    this.state = "closed";
  }
  async suspend() {
    this.state = "suspended";
  }
  async resume() {
    this.state = "running";
  }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalFetch = globalThis.fetch;
const sounds: Audio[] = [];
const intervals = new Map<number, () => void>();
const listeners = new Set<() => void>();
const signals: AbortSignal[] = [];
const page = {
  hidden: false,
  addEventListener: (_type: string, handler: () => void) => listeners.add(handler),
  removeEventListener: (_type: string, handler: () => void) => listeners.delete(handler),
};
let nextInterval = 0;
function audio() {
  Object.defineProperty(globalThis, "document", { configurable: true, value: page });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      AudioContext: Context,
      localStorage: { getItem: () => null, setItem: () => {} },
      setInterval: (callback: () => void) => {
        const id = ++nextInterval;
        intervals.set(id, callback);
        return id;
      },
      clearInterval: (id: number) => intervals.delete(id),
    },
  });
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    return Promise.resolve(new Response(new Uint8Array([1])));
  }) as unknown as typeof fetch;
  const sound = createAudio("/audio/");
  sounds.push(sound);
  return sound;
}
function context() {
  const context = Context.created.at(-1);
  if (!context) throw new Error("audio context");
  return context;
}
afterEach(() => {
  for (const sound of sounds.splice(0)) sound.dispose();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
  globalThis.fetch = originalFetch;
  Context.created.length = 0;
  Context.decode = () => Promise.resolve({ duration: 30 });
  intervals.clear();
  listeners.clear();
  signals.length = 0;
  page.hidden = false;
});

describe("audio ownership and delayed cues", () => {
  test("disposing during decode never schedules late loops, closes once, and removes the visibility listener", async () => {
    let finish: (buffer: { duration: number }) => void = () => {};
    const decoding = new Promise<{ duration: number }>((resolve) => {
      finish = resolve;
    });
    Context.decode = () => decoding;
    const sound = audio();
    const unlocking = sound.unlock();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const c = context();
    expect(signals.length).toBeGreaterThan(0);
    expect(listeners.size).toBe(1);
    sound.dispose();
    sound.dispose();
    finish({ duration: 30 });
    await unlocking;
    await sound.unlock();
    expect(c.closed).toBe(1);
    expect(Context.created).toHaveLength(1);
    expect(c.sources).toHaveLength(0);
    expect(intervals.size).toBe(0);
    expect(listeners.size).toBe(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    for (const node of c.nodes) expect(node.disconnected).toBe(1);
  });

  test("cancelPending silences a future rescue quack while preserving an active cue and ambience", async () => {
    const sound = audio();
    await sound.unlock();
    const c = context();
    const beds = [...c.sources];
    sound.play("lantern");
    const playing = c.sources.at(-1);
    c.currentTime += 0.2;
    sound.quack(2);
    const future = c.sources.at(-1);
    sound.cancelPending();
    expect(future?.disconnected).toBe(1);
    expect(future?.stops.at(-1)).toBeUndefined();
    expect(playing?.disconnected).toBe(0);
    for (const bed of beds) expect(bed.disconnected).toBe(0);
  });

  test("replay stops active cues, restores music, and repeated water updates do not enqueue automation", async () => {
    const sound = audio();
    sound.setFocus(true);
    sound.setEnding(true);
    sound.setWater(0.8, true);
    await sound.unlock();
    const c = context();
    const music = c.nodes[2];
    const river = c.nodes[4];
    const birds = c.nodes[5];
    expect(music?.gain.value).toBe(0.22);
    expect(river?.gain.value).toBeCloseTo((0.3 + 0.8 * 0.3) * 0.55);
    expect(birds?.gain.value).toBe(0.55);
    for (let i = 0; i < 120; i++) sound.setWater(0.8, true);
    expect(river?.gain.targets).toEqual([]);
    expect(birds?.gain.targets).toEqual([]);
    sound.play("finish");
    const cue = c.sources.at(-1);
    sound.reset();
    expect(cue?.disconnected).toBe(1);
    expect(music?.gain.targets.at(-1)).toBe(0.3);
    expect(intervals.size).toBe(3);
  });

  test("ended synthesized voices release their filters and teardown stops all remaining sources", async () => {
    const sound = audio();
    await sound.unlock();
    const c = context();
    const before = c.nodes.length;
    sound.quack();
    const quack = c.sources.at(-1);
    quack?.end();
    quack?.end();
    expect(quack?.disconnected).toBe(1);
    for (const node of c.nodes.slice(before)) expect(node.disconnected).toBe(1);
    sound.dispose();
    expect(intervals.size).toBe(0);
    for (const source of c.sources) expect(source.disconnected).toBe(1);
  });

  test("unexpectedly short loop files and resumed clocks schedule a bounded number of voices", async () => {
    Context.decode = () => Promise.resolve({ duration: 0.2 });
    const sound = audio();
    await sound.unlock();
    const c = context();
    expect(c.sources).toHaveLength(24);
    c.currentTime = 100;
    for (const tick of intervals.values()) tick();
    expect(c.sources).toHaveLength(48);
    sound.dispose();
    for (const source of c.sources) expect(source.disconnected).toBe(1);
  });
});
