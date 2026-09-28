// The brook's surface: a standard lit material whose ripples and foam streaks are advected by the
// authored current (a two-phase flow map). Fast water is bright and streaky, slack water glassy,
// channels dark and the shallows clear enough to see the pebbles on the bed.
import * as THREE from "three";
import type { Course } from "../game/course";
import { createFlowTexture, createNoiseTexture, FLOW_BOUNDS } from "./textures";

export function createWater(course: Course) {
  const { x0, x1, y0, y1 } = FLOW_BOUNDS;
  const uniforms = {
    uFlow: { value: createFlowTexture(course) },
    uNoise: { value: createNoiseTexture() },
    uTime: { value: 0 },
    /** 0 = open daylight, 1 = deep in the root tunnel's shade. */
    uGloom: { value: 0 },
    /** 0 = daylight, 1 = the pond at dusk. */
    uWarm: { value: 0 },
  };

  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.premultipliedAlpha = false;
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
uniform float uTime;
uniform float uGloom;
uniform float uWarm;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec2 fuv = (vGame - vec2(${x0.toFixed(1)}, ${y0.toFixed(1)})) / vec2(${(x1 - x0).toFixed(1)}, ${(y1 - y0).toFixed(1)});
vec4 fl = texture2D(uFlow, fuv);
vec2 vel = (fl.rg - 0.5) * 8.0;
float spd = length(vel);
float edge = fl.a;
float depth = 1.0 - edge;
// Two offset phases, each dragged along the current and cross-faded before it smears.
float period = 1.4;
float ph0 = fract(uTime / period);
float ph1 = fract(uTime / period + 0.5);
float w0 = 1.0 - abs(1.0 - 2.0 * ph0);
// Ripples travel a little slower than the water so they never smear.
vec2 drift = vel * period * 0.6;
vec2 p = vGame;
vec2 uvA0 = p * 0.16 - drift * 0.16 * ph0;
vec2 uvA1 = p * 0.16 - drift * 0.16 * ph1 + 0.43;
vec2 uvB0 = p * 0.5 - drift * 0.5 * ph0;
vec2 uvB1 = p * 0.5 - drift * 0.5 * ph1 + 0.21;
float nA = mix(texture2D(uNoise, uvA1).r, texture2D(uNoise, uvA0).r, w0);
float nB = mix(texture2D(uNoise, uvB1).g, texture2D(uNoise, uvB0).g, w0);
float fast = smoothstep(0.6, 2.2, spd);
float slack = 1.0 - smoothstep(0.15, 0.6, spd);
// Foam streaks: noise stretched along the local flow, so lines follow the current and curl in eddies.
vec2 dir = spd > 0.05 ? vel / spd : vec2(0.0, 1.0);
vec2 fp = vec2(dot(p, vec2(dir.y, -dir.x)), dot(p, dir));
float along = spd * period * 0.7;
float s0 = texture2D(uNoise, vec2(fp.x * 0.9, (fp.y - along * ph0) * 0.09)).r;
float s1 = texture2D(uNoise, vec2(fp.x * 0.9 + 0.5, (fp.y - along * ph1) * 0.09 + 0.3)).r;
float sN = mix(s1, s0, w0);
float streak = smoothstep(0.6, 0.78, sN) * (0.08 + fast * 0.9);
// Water itself has almost no albedo: only light scattered back by the water column (growing with
// depth, teal-green), aeration where it runs fast, and foam. Everything else is reflection (the
// environment, through the lighting below) and the bed seen through it.
vec3 inscatter = vec3(0.006, 0.03, 0.026) * (0.25 + smoothstep(0.0, 0.8, depth));
inscatter += vec3(0.03, 0.035, 0.03) * fast * (0.4 + 0.6 * nA);
// Wind shadow and the tunnel's gloom.
inscatter *= mix(0.6, 1.0, fl.b) * (1.0 - uGloom * 0.4);
// Dusk sky and lantern light scattered in the open pond.
inscatter += vec3(0.02, 0.012, 0.004) * uWarm;
float edgeFoam = smoothstep(0.8, 0.98, edge) * smoothstep(0.5, 0.75, nB) * (0.12 + fast * 0.45);
float foam = clamp(streak + edgeFoam, 0.0, 1.0);
diffuseColor.rgb = mix(inscatter, vec3(0.8, 0.82, 0.76), foam);
// How much of the bed the water hides: little in the shallows, more in deep or churned water.
float turbid = mix(0.06, 0.62, smoothstep(0.05, 0.85, depth)) + fast * 0.12;
`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.04, 0.2, fast) + foam * 0.5;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `// Premultiplied: the surface adds its reflection and scatter; the bed behind is kept by
// (1 - alpha), where alpha is the Fresnel reflectance, the turbidity and the foam.
float wCos = saturate(dot(normal, normalize(vViewPosition)));
float wFresnel = 0.02 + 0.98 * pow(1.0 - wCos, 5.0);
float wAlpha = clamp(max(max(wFresnel, turbid), foam * 0.9), 0.0, 1.0);
gl_FragColor = vec4(outgoingLight, wAlpha);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
float e = 0.03;
float hx = mix(texture2D(uNoise, uvB1 + vec2(e, 0.0)).g, texture2D(uNoise, uvB0 + vec2(e, 0.0)).g, w0) - nB;
float hz = mix(texture2D(uNoise, uvB1 + vec2(0.0, e)).g, texture2D(uNoise, uvB0 + vec2(0.0, e)).g, w0) - nB;
float bump = (0.35 + fast * 1.3) * (1.0 - slack * 0.7);
normal = normalize(normal + (viewMatrix * vec4(-hx * bump, 0.0, hz * bump, 0.0)).xyz * 4.0);`,
      );
  };

  const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((x0 + x1) / 2, 0, -(y0 + y1) / 2);
  mesh.receiveShadow = true;
  // Drawn first among see-through things, so streaks, glows and rings sit on top of it.
  mesh.renderOrder = -1;

  return {
    mesh,
    update(time: number, gloom = 0, warmth = 0) {
      uniforms.uTime.value = time;
      uniforms.uGloom.value = gloom;
      uniforms.uWarm.value = warmth;
    },
  };
}
