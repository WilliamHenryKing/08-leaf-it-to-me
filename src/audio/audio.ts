// Sound: a crossfaded music loop and brook ambience, sampled SFX, and two synthesized voices
// (the gust and the duck). Nothing plays until the first user gesture unlocks the context.

const MUTE_KEY = "leaf-it-to-me:muted";
const FILES = {
  music: "music.mp3",
  river: "river.mp3",
  birds: "birds.mp3",
  sail: "sail.mp3",
  splashSmall: "splash-small.mp3",
  splashBig: "splash-big.mp3",
  bump: "bump.mp3",
  lantern: "lantern.mp3",
  checkpoint: "checkpoint.mp3",
  finish: "finish.mp3",
  click: "click.mp3",
  toggle: "toggle.mp3",
  aim: "aim.mp3",
} as const;
type Sound = keyof typeof FILES;
interface Voice {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  at: number;
  loop: boolean;
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function createAudio(base = `${import.meta.env.BASE_URL}audio/`) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let ambience: GainNode | null = null;
  let river: GainNode | null = null;
  let birds: GainNode | null = null;
  let sfx: GainNode | null = null;
  let muted = readMuted();
  let noise: AudioBuffer | null = null;
  const raw = new Map<Sound, Promise<ArrayBuffer | null>>();
  const buffers = new Map<Sound, AudioBuffer>();
  const loops: { stop: () => void }[] = [];
  const voices = new Set<Voice>();
  const nodes = new Set<AudioNode>();
  const lifetime = new AbortController();
  let disposed = false;
  let aiming = false;
  let ending = false;
  let waterLevel = 0.55;
  let pond = false;

  const own = <T extends AudioNode>(node: T): T => {
    nodes.add(node);
    return node;
  };
  const release = (voice: Voice, stop = true) => {
    if (!voices.delete(voice)) return;
    for (const source of voice.sources) {
      source.onended = null;
      if (stop) {
        try {
          source.stop();
        } catch {
          /* Already ended. */
        }
      }
      source.disconnect();
    }
    for (const node of voice.nodes) node.disconnect();
  };
  const track = (
    sources: AudioScheduledSourceNode[],
    graph: AudioNode[],
    at: number,
    looped = false,
  ) => {
    const voice: Voice = { sources, nodes: graph, at, loop: looped };
    voices.add(voice);
    let ended = 0;
    for (const source of sources)
      source.onended = () => {
        if (++ended === sources.length) release(voice, false);
      };
  };
  const musicLevel = () => (ending ? 0.22 : aiming ? 0.14 : 0.3);
  const refreshMusic = (seconds: number) => {
    if (!disposed && ctx && music)
      music.gain.setTargetAtTime(musicLevel(), ctx.currentTime, seconds);
  };
  const cancelPending = () => {
    if (!ctx) return;
    for (const voice of voices) if (!voice.loop && voice.at >= ctx.currentTime) release(voice);
  };

  /** Fetch the files early (after the world is ready); decoding waits for the context. */
  function preload() {
    if (disposed) return;
    for (const [k, f] of Object.entries(FILES) as [Sound, string][]) {
      if (!raw.has(k))
        raw.set(
          k,
          fetch(base + f, { signal: lifetime.signal })
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .catch(() => null),
        );
    }
  }

  async function decodeAll(c: AudioContext) {
    preload();
    await Promise.all(
      [...raw].map(async ([k, p]) => {
        const data = await p;
        if (!data || disposed) return;
        try {
          const buffer = await c.decodeAudioData(data.slice(0));
          if (!disposed && ctx === c) buffers.set(k, buffer);
        } catch {
          // An undecodable file only silences that one sound.
        }
      }),
    );
  }

  const gain = (c: AudioContext, v: number, to: AudioNode, persistent = false) => {
    const g = c.createGain();
    if (persistent) own(g);
    g.gain.value = v;
    g.connect(to);
    return g;
  };

  /** Loop a buffer forever by overlapping copies with equal-power fades (hides MP3 padding). */
  function loop(name: Sound, bus: GainNode, fade = 3) {
    const c = ctx;
    const buf = buffers.get(name);
    if (!c || !buf || disposed || buf.duration <= 0.1) return;
    fade = Math.min(fade, buf.duration * 0.25);
    let next = c.currentTime + 0.05;
    let stopped = false;
    const playOnce = (at: number) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + fade);
      g.gain.setValueAtTime(1, at + buf.duration - fade);
      g.gain.linearRampToValueAtTime(0, at + buf.duration);
      src.connect(g).connect(bus);
      track([src], [g], at, true);
      src.start(at);
      src.stop(at + buf.duration + 0.05);
    };
    const tick = () => {
      if (stopped || disposed) return;
      if (next < c.currentTime) next = c.currentTime + 0.05;
      let scheduled = 0;
      while (next < c.currentTime + 4 && scheduled++ < 8) {
        playOnce(next);
        next += buf.duration - fade;
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    loops.push({
      stop: () => {
        stopped = true;
        window.clearInterval(id);
      },
    });
  }

  function play(name: Sound, volume = 1, rate = 1, delay = 0) {
    const c = ctx;
    const buf = buffers.get(name);
    if (!c || !sfx || !buf || muted || disposed || document.hidden) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const level = gain(c, volume, sfx);
    src.connect(level);
    const at = c.currentTime + delay;
    track([src], [level], at);
    src.start(at);
  }

  function noiseBuffer(c: AudioContext) {
    if (noise) return noise;
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }

  /** A breath of wind: band-passed noise that swells and sweeps with the gust. */
  function whoosh(strength: number) {
    const c = ctx;
    if (!c || !sfx || muted || disposed || document.hidden) return;
    const t = c.currentTime;
    const dur = 0.45 + strength * 0.6;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(900 + strength * 1600, t + dur * 0.35);
    bp.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + strength * 0.55, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(sfx);
    track([src], [bp, g], t);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** "Qua-ack": a nasal sawtooth through two vowel formants, pitch falling. */
  function quack(delay = 0) {
    const c = ctx;
    if (!c || !sfx || muted || disposed || document.hidden) return;
    const t = c.currentTime + delay;
    const out = gain(c, 0.0001, sfx);
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.linearRampToValueAtTime(330, t + 0.08);
    osc.frequency.linearRampToValueAtTime(250, t + 0.24);
    const graph: AudioNode[] = [out];
    for (const [f, q, v] of [
      [900, 6, 1],
      [1700, 8, 0.6],
    ] as const) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = q;
      const level = gain(c, v, out);
      osc.connect(bp).connect(level);
      graph.push(bp, level);
    }
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    out.gain.setValueAtTime(0.9, t + 0.06);
    out.gain.exponentialRampToValueAtTime(0.35, t + 0.1);
    out.gain.exponentialRampToValueAtTime(0.8, t + 0.14);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    track([osc], graph, t);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  const setMaster = () => {
    if (!disposed && ctx && master)
      master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.08);
  };

  /** Create the context on a user gesture and start the beds. Safe to call repeatedly. */
  async function unlock() {
    if (disposed) return;
    if (ctx) {
      if (ctx.state === "suspended" && !document.hidden) await ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const c = new Ctor();
    ctx = c;
    const comp = own(c.createDynamicsCompressor());
    comp.connect(c.destination);
    master = gain(c, 0, comp, true);
    music = gain(c, musicLevel(), master, true);
    ambience = gain(c, 0.6, master, true);
    river = gain(c, waterLevel, ambience, true);
    birds = gain(c, pond ? 0.55 : 0.3, ambience, true);
    sfx = gain(c, 0.85, master, true);
    setMaster();
    await decodeAll(c);
    if (disposed || ctx !== c) return;
    loop("music", music, 4);
    loop("river", river, 3);
    loop("birds", birds, 3);
  }

  const visibility = () => {
    if (!ctx || disposed) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else void ctx.resume().catch(() => {});
  };
  document.addEventListener("visibilitychange", visibility);

  function setAiming(on: boolean) {
    if (aiming === on) return;
    aiming = on;
    refreshMusic(0.25);
  }
  function updateWater(level: number, inPond: boolean) {
    if (Math.abs(level - waterLevel) >= 0.005) {
      waterLevel = level;
      if (ctx && river) river.gain.setTargetAtTime(level, ctx.currentTime, 0.8);
    }
    if (pond !== inPond) {
      pond = inPond;
      if (ctx && birds) birds.gain.setTargetAtTime(inPond ? 0.55 : 0.3, ctx.currentTime, 1.5);
    }
  }

  return {
    preload,
    unlock,
    get muted() {
      return muted;
    },
    setMuted(m: boolean) {
      if (disposed) return;
      muted = m;
      try {
        window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
      } catch {
        // Private mode: the choice lasts for this visit only.
      }
      setMaster();
    },
    play,
    whoosh,
    quack,
    /** Music dips and the brook comes forward while a gust is being aimed. */
    setFocus(aiming: boolean) {
      if (disposed) return;
      setAiming(aiming);
    },
    /** Faster water sounds louder; the pond is quieter water and more birdsong. */
    setWater(speed: number, pond: boolean) {
      if (disposed) return;
      const v = Math.min(1, 0.3 + speed * 0.3) * (pond ? 0.55 : 1);
      updateWater(v, pond);
    },
    /** At the gathering the music settles. */
    setEnding(on: boolean) {
      if (disposed || ending === on) return;
      ending = on;
      refreshMusic(1);
    },
    cancelPending,
    reset() {
      if (disposed) return;
      for (const voice of voices) if (!voice.loop) release(voice);
      aiming = ending = false;
      refreshMusic(0.25);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      document.removeEventListener("visibilitychange", visibility);
      for (const l of loops) l.stop();
      loops.length = 0;
      for (const voice of voices) release(voice);
      for (const node of nodes) node.disconnect();
      nodes.clear();
      raw.clear();
      buffers.clear();
      noise = null;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      ctx = master = music = ambience = river = birds = sfx = null;
    },
  };
}

export type Audio = ReturnType<typeof createAudio>;
