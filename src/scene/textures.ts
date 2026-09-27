// Procedural textures: tileable noise for ripples, the course flow map, and a soft glow.
import * as THREE from "three";
import { type Course, centreX, halfWidth } from "../game/course";
import { currentAt, windAt } from "../game/field";

/** World extent covered by the flow map, in game units. */
export const FLOW_BOUNDS = { x0: -16, x1: 16, y0: -6, y1: 106 };

function hash(x: number, y: number, seed: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth periodic value noise, sampled on an integer lattice of `period` cells. */
function tileNoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (i: number, j: number) =>
    hash(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function createNoiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0;
      let g = 0;
      let amp = 0.5;
      for (let o = 0; o < 4; o++) {
        const period = 8 << o;
        const k = period / size;
        r += tileNoise(i * k, j * k, period, 1 + o) * amp;
        g += tileNoise(i * k, j * k, period, 9 + o) * amp;
        amp *= 0.5;
      }
      const p = (j * size + i) * 4;
      data[p] = Math.round((r / 0.9375) * 255);
      data[p + 1] = Math.round((g / 0.9375) * 255);
      data[p + 2] = Math.round(hash(i, j, 3) * 255);
      data[p + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** RG: current (±4 u/s), B: wind reaching the water, A: nearness to the bank. */
export function createFlowTexture(course: Course, perUnit = 2) {
  const { x0, x1, y0, y1 } = FLOW_BOUNDS;
  const w = Math.round((x1 - x0) * perUnit);
  const h = Math.round((y1 - y0) * perUnit);
  const data = new Uint8Array(w * h * 4);
  const enc = (n: number) => Math.round(Math.min(1, Math.max(0, n / 8 + 0.5)) * 255);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = { x: x0 + ((i + 0.5) / w) * (x1 - x0), y: y0 + ((j + 0.5) / h) * (y1 - y0) };
      const c = currentAt(course, p);
      const inside = halfWidth(p.y) - Math.abs(p.x - centreX(p.y));
      const k = (j * w + i) * 4;
      data[k] = enc(c.x);
      data[k + 1] = enc(c.y);
      data[k + 2] = Math.round(windAt(course, p) * 255);
      data[k + 3] = Math.round(Math.min(1, Math.max(0, 1 - inside / 0.9)) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A soft round glow for lanterns and fireflies. */
export function createGlowTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (i + 0.5) / size - 0.5;
      const dy = (j + 0.5) / size - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = (1 - d) ** 2.2;
      const k = (j * size + i) * 4;
      data[k] = 255;
      data[k + 1] = 214;
      data[k + 2] = 150;
      data[k + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
