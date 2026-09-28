// The banks and the bed as one PBR splat of three sourced CC0 sets: river pebbles under the water,
// wet forest mud at the waterline, mossy leaf litter above. Each set is sampled twice, at different
// scales and rotations, and mixed by low-frequency noise so it never visibly tiles. The waterline
// darkens and turns glossy; below it, light is absorbed with depth and sun caustics ripple on the bed.
import * as THREE from "three";
import type { Assets, PbrSet } from "./assets";

export interface GroundUniforms {
  uTime: { value: number };
  uSun: { value: THREE.Color };
}

export function createGroundMaterial(assets: Assets, uniforms: GroundUniforms) {
  const { bed, mud, leaves } = assets;
  if (!bed || !mud || !leaves) return null;
  const material = new THREE.MeshStandardMaterial({
    name: "ground",
    roughness: 1,
    metalness: 0,
  });
  const tex = (set: PbrSet, k: keyof PbrSet) => ({ value: set[k] });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      tBedC: tex(bed, "map"),
      tBedN: tex(bed, "normalMap"),
      tBedA: tex(bed, "arm"),
      tMudC: tex(mud, "map"),
      tMudN: tex(mud, "normalMap"),
      tMudA: tex(mud, "arm"),
      tLeafC: tex(leaves, "map"),
      tLeafN: tex(leaves, "normalMap"),
      tLeafA: tex(leaves, "arm"),
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aEdge;\nvarying float vEdge;\nvarying vec3 vGround;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvEdge = aEdge;\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vEdge;
varying vec3 vGround;
uniform float uTime;
uniform vec3 uSun;
uniform sampler2D tBedC, tBedN, tBedA, tMudC, tMudN, tMudA, tLeafC, tLeafN, tLeafA;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + 1.0), f.x), f.y);
}
// Two decorrelated samples of one texture, blended by noise: no visible repeat.
vec2 gRot(vec2 p, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * p; }
vec4 gPair(sampler2D t, vec2 uv, float n) {
  return mix(texture2D(t, uv), texture2D(t, gRot(uv, 1.7) * 0.73 + 0.37), smoothstep(0.3, 0.7, n));
}
float gCaustic(vec2 p, float t) {
  vec2 q = p * 1.6;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    q = gRot(q, 1.1) + vec2(sin(q.y * 1.3 + t * 0.9), cos(q.x * 1.1 - t * 0.7));
    c += abs(sin(q.x) * sin(q.y));
  }
  return pow(1.0 - clamp(c / 3.0, 0.0, 1.0), 6.0);
}`,
      )
      .replace(
        "#include <map_fragment>",
        `vec2 gp = vec2(vGround.x, -vGround.z);
float gn = gNoise(gp * 0.09);
float gm = gNoise(gp * 0.31 + 7.0);
vec2 uvBed = gp / 4.5, uvMud = gp / 7.0, uvLeaf = gp / 9.0;
// Splat weights from distance to the water's edge, broken up by noise.
float wBed = 1.0 - smoothstep(-0.9, -0.2, vEdge + (gm - 0.5) * 0.6);
float wLeaf = smoothstep(0.6, 1.8, vEdge + (gm - 0.5) * 1.2);
float wMud = max(0.0, 1.0 - wBed - wLeaf);
vec3 gC = gPair(tBedC, uvBed, gn).rgb * wBed + gPair(tMudC, uvMud, gn).rgb * wMud + gPair(tLeafC, uvLeaf, gn).rgb * wLeaf;
vec3 gA = gPair(tBedA, uvBed, gn).rgb * wBed + gPair(tMudA, uvMud, gn).rgb * wMud + gPair(tLeafA, uvLeaf, gn).rgb * wLeaf;
vec3 gN = gPair(tBedN, uvBed, gn).rgb * wBed + gPair(tMudN, uvMud, gn).rgb * wMud + gPair(tLeafN, uvLeaf, gn).rgb * wLeaf;
// Macro variation across the banks.
gC *= mix(0.82, 1.12, gNoise(gp * 0.05 + 3.0));
float h = vGround.y;
// Wet band just above the water: darker and glossy.
float wet = 1.0 - smoothstep(0.0, 0.28, h);
gC *= mix(1.0, 0.55, wet);
// Below the surface: light absorbed with depth (red first), and sun caustics in the shallows.
float below = max(-h, 0.0);
gC *= exp(-below * vec3(1.9, 0.95, 0.75));
diffuseColor.rgb = gC;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor = mix(gA.g, gA.g * 0.3, wet);",
      )
      .replace(
        "#include <normal_fragment_maps>",
        `vec3 gTs = gN * 2.0 - 1.0;
vec3 gWorldN = normalize(inverseTransformDirection(normal, viewMatrix));
vec3 gT = normalize(vec3(1.0, 0.0, 0.0) - gWorldN * gWorldN.x);
vec3 gB = cross(gWorldN, gT);
normal = normalize((viewMatrix * vec4(normalize(gT * gTs.x - gB * gTs.y + gWorldN * gTs.z * 0.8), 0.0)).xyz);`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= gA.r;
float shallow = smoothstep(0.0, 0.08, below) * (1.0 - smoothstep(0.25, 0.8, below));
reflectedLight.directDiffuse += uSun * gC * gCaustic(gp, uTime) * shallow * 0.9;`,
      );
  };
  material.customProgramCacheKey = () => "leaf-ground-v1";
  return material;
}
