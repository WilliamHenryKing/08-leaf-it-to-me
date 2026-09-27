// The brook's surface: a standard lit material whose ripples are advected by the authored
// current (a two-phase flow map), so fast water, eddies, pools and wind shadow read at a glance.
import * as THREE from "three";
import type { Course } from "../game/course";
import { createFlowTexture, createNoiseTexture, FLOW_BOUNDS } from "./textures";

export function createWater(course: Course) {
  const { x0, x1, y0, y1 } = FLOW_BOUNDS;
  const uniforms = {
    uFlow: { value: createFlowTexture(course) },
    uNoise: { value: createNoiseTexture() },
    uTime: { value: 0 },
  };

  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.2,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGame;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGame = (modelMatrix * vec4(transformed, 1.0)).xz * vec2(1.0, -1.0);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vGame;
uniform sampler2D uFlow;
uniform sampler2D uNoise;
uniform float uTime;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec2 fuv = (vGame - vec2(${x0.toFixed(1)}, ${y0.toFixed(1)})) / vec2(${(x1 - x0).toFixed(1)}, ${(y1 - y0).toFixed(1)});
vec4 fl = texture2D(uFlow, fuv);
vec2 vel = (fl.rg - 0.5) * 8.0;
float spd = length(vel);
// Two offset phases, each dragged along the current and cross-faded before it smears.
float period = 1.4;
float ph0 = fract(uTime / period);
float ph1 = fract(uTime / period + 0.5);
float w0 = 1.0 - abs(1.0 - 2.0 * ph0);
// Ripples travel a little slower than the water so they never smear; the seed fluff shows true speed.
vec2 drift = vel * period * 0.6;
vec2 p = vGame;
vec2 uvA0 = p * 0.16 - drift * 0.16 * ph0;
vec2 uvA1 = p * 0.16 - drift * 0.16 * ph1 + 0.43;
vec2 uvB0 = p * 0.5 - drift * 0.5 * ph0;
vec2 uvB1 = p * 0.5 - drift * 0.5 * ph1 + 0.21;
float nA = mix(texture2D(uNoise, uvA1).r, texture2D(uNoise, uvA0).r, w0);
float nB = mix(texture2D(uNoise, uvB1).g, texture2D(uNoise, uvB0).g, w0);
float fast = smoothstep(0.7, 2.3, spd);
vec3 deep = vec3(0.075, 0.13, 0.10);
vec3 run = vec3(0.23, 0.31, 0.24);
vec3 water = mix(deep, run, fast * 0.8 + nA * 0.18);
// Wind shadow: shade from the canopy above.
water *= mix(0.62, 1.0, fl.b);
// Shallows by the banks.
water = mix(water, vec3(0.36, 0.31, 0.19), smoothstep(0.35, 1.0, fl.a) * 0.55);
float streak = smoothstep(0.56, 0.78, nA * 0.45 + nB * 0.55);
float foam = streak * (0.12 + fast * 0.85) + smoothstep(0.9, 1.0, fl.a) * smoothstep(0.55, 0.75, nB) * 0.45;
water = mix(water, vec3(0.78, 0.8, 0.72), clamp(foam, 0.0, 1.0));
diffuseColor.rgb = water;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.06, 0.32, fast) + foam * 0.4;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
float e = 0.03;
float hx = mix(texture2D(uNoise, uvB1 + vec2(e, 0.0)).g, texture2D(uNoise, uvB0 + vec2(e, 0.0)).g, w0) - nB;
float hz = mix(texture2D(uNoise, uvB1 + vec2(0.0, e)).g, texture2D(uNoise, uvB0 + vec2(0.0, e)).g, w0) - nB;
float bump = 0.9 + fast * 2.2;
normal = normalize(normal + (viewMatrix * vec4(-hx * bump, 0.0, hz * bump, 0.0)).xyz * 4.0);`,
      );
  };

  const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((x0 + x1) / 2, 0, -(y0 + y1) / 2);
  mesh.receiveShadow = true;

  return {
    mesh,
    update(time: number) {
      uniforms.uTime.value = time;
    },
  };
}
