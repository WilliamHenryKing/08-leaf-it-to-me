// Procedural surfaces where no CC0 scan exists: the leaf boat (veins, mottling, browned edge),
// knitted coats, lily pads, clover and the toadstool cap. Each draws a colour canvas and a height
// canvas; the normal map is derived from the height (Sobel), so the relief matches the pattern.
// Thin surfaces (leaves, pads, petals) also get back-lit translucency against the sun.
import * as THREE from "three";
import { rng } from "./bankside";

type Paint = (
  ctx: CanvasRenderingContext2D,
  height: CanvasRenderingContext2D,
  w: number,
  h: number,
) => void;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function normalFromHeight(src: HTMLCanvasElement, strength: number) {
  const { width: w, height: h } = src;
  const hd = (src.getContext("2d") as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const octx = out.getContext("2d") as CanvasRenderingContext2D;
  const img = octx.createImageData(w, h);
  const at = (x: number, y: number) => (hd[(((y + h) % h) * w + ((x + w) % w)) * 4] ?? 0) / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const k = (y * w + x) * 4;
      img.data[k] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[k + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function skin(w: number, h: number, paint: Paint, strength: number, wrap = false) {
  const col = canvas(w, h);
  const hei = canvas(w, h);
  const c = col.getContext("2d") as CanvasRenderingContext2D;
  const g = hei.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, w, h);
  paint(c, g, w, h);
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalFromHeight(hei, strength));
  for (const t of [map, normalMap]) {
    t.anisotropy = 8;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return { map, normalMap };
}

/** Mottled colour: many soft, low-alpha blobs. */
function mottle(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  hues: string[],
  n: number,
  seed: number,
) {
  const rand = rng(seed);
  for (let i = 0; i < n; i++) {
    c.globalAlpha = 0.05 + rand() * 0.08;
    c.fillStyle = hues[i % hues.length] ?? "#000";
    c.beginPath();
    c.ellipse(rand() * w, rand() * h, 4 + rand() * 30, 4 + rand() * 30, rand() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

/** The leaf blade in (u across, v along): midrib, paired side veins, a browning margin. */
export function leafSkin() {
  return skin(
    512,
    1024,
    (c, g, w, h) => {
      const grad = c.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#7a6a1e");
      grad.addColorStop(0.12, "#4e7a20");
      grad.addColorStop(0.5, "#3f6e1c");
      grad.addColorStop(0.88, "#4e7a20");
      grad.addColorStop(1, "#7a6a1e");
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
      mottle(c, w, h, ["#6f8f2a", "#2f5a16", "#8a8a2a", "#5a7a22"], 500, 3);
      const vein = (ctx: CanvasRenderingContext2D, colour: string, scale: number) => {
        ctx.strokeStyle = colour;
        ctx.lineCap = "round";
        // Midrib, tapering towards the tip (v = 1).
        for (let k = 0; k < 8; k++) {
          ctx.lineWidth = (13 - k * 1.2) * scale;
          ctx.beginPath();
          ctx.moveTo(w / 2, (k / 8) * h);
          ctx.lineTo(w / 2, ((k + 1) / 8) * h);
          ctx.stroke();
        }
        // Side veins sweep forwards to the margin, alternating slightly left and right.
        for (let i = 1; i < 11; i++) {
          for (const side of [-1, 1]) {
            const y = (i / 11.5) * h + (side > 0 ? h * 0.02 : 0);
            ctx.lineWidth = 3.2 * scale * (1 - i / 16);
            ctx.beginPath();
            ctx.moveTo(w / 2, y);
            ctx.bezierCurveTo(
              w / 2 + side * w * 0.12,
              y + h * 0.05,
              w / 2 + side * w * 0.3,
              y + h * 0.12,
              w / 2 + side * w * 0.46,
              y + h * 0.2,
            );
            ctx.stroke();
          }
        }
      };
      vein(c, "rgba(170, 186, 96, 0.45)", 1);
      vein(g, "rgba(90, 90, 90, 1)", 1.4);
      vein(g, "rgba(40, 40, 40, 1)", 0.7);
    },
    3,
  );
}

/** Knitted wool, tileable: rows of V stitches. Grey, so the material colour tints it. */
export function knitSkin() {
  return skin(
    128,
    128,
    (c, g, w, h) => {
      c.fillStyle = "#d8d8d8";
      c.fillRect(0, 0, w, h);
      for (const [ctx, colour] of [
        [c, "#f4f4f4"],
        [g, "#d0d0d0"],
      ] as [CanvasRenderingContext2D, string][]) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 5;
        for (let y = -8; y < h + 8; y += 12)
          for (let x = 0; x < w; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x + 1, y);
            ctx.lineTo(x + 8, y + 10);
            ctx.lineTo(x + 15, y);
            ctx.stroke();
          }
      }
    },
    4,
    true,
  );
}

/** A lily pad: radial veins from the notch, darker rim, waxy mottling. */
export function lilySkin() {
  return skin(
    512,
    512,
    (c, g, w, h) => {
      c.fillStyle = "#3d6a26";
      c.fillRect(0, 0, w, h);
      mottle(c, w, h, ["#5a8a32", "#2a4f1a", "#6a7a2a"], 400, 9);
      for (const [ctx, colour] of [
        [c, "rgba(150, 180, 90, 0.5)"],
        [g, "rgba(170, 170, 170, 1)"],
      ] as [CanvasRenderingContext2D, string][]) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 3;
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(w / 2, h / 2);
          ctx.lineTo(w / 2 + Math.cos(a) * w * 0.5, h / 2 + Math.sin(a) * h * 0.5);
          ctx.stroke();
        }
      }
      const rim = c.createRadialGradient(w / 2, h / 2, w * 0.36, w / 2, h / 2, w * 0.5);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(1, "rgba(70, 40, 20, 0.55)");
      c.fillStyle = rim;
      c.fillRect(0, 0, w, h);
    },
    2.5,
  );
}

/** The toadstool cap: warm rust with pale flecks and fine radial fibres. */
export function capSkin() {
  return skin(
    512,
    512,
    (c, g, w, h) => {
      c.fillStyle = "#a4482a";
      c.fillRect(0, 0, w, h);
      mottle(c, w, h, ["#c2643a", "#7a2e1a", "#b85a30"], 500, 21);
      const rand = rng(44);
      for (let i = 0; i < 60; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 3 + rand() * 9;
        for (const [ctx, colour] of [
          [c, "rgba(236, 222, 196, 0.85)"],
          [g, "rgba(200, 200, 200, 1)"],
        ] as [CanvasRenderingContext2D, string][]) {
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.8, rand() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    2.5,
  );
}

export interface SunUniforms {
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
}

export const sunUniforms: SunUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
};

/** Light through a thin surface: sunlight arriving from the far side glows through, tinted. */
export function translucent<T extends THREE.MeshStandardMaterial>(m: T, amount = 0.5): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    Object.assign(shader.uniforms, sunUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uSunDir;\nuniform vec3 uSunColor;",
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
float through = saturate(dot(-normal, uSunDir));
float forward = 0.4 + 0.6 * pow(saturate(dot(normalize(vViewPosition), uSunDir)), 3.0);
reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.9, 1.0, 0.55) * uSunColor * through * forward * ${amount.toFixed(2)};`,
      );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${key ? key() : ""}|translucent`;
  return m;
}
