// Keep the boat visible: roots and earth that come between the camera and the leaf dissolve with a
// screen-door dither in a soft circle around it (and only in front of it), then return.
import * as THREE from "three";

export const occlusionUniforms = {
  uBoatScreen: { value: new THREE.Vector2(-10, -10) },
  uBoatDepth: { value: 0 },
  uViewport: { value: new THREE.Vector2(1, 1) },
};

export function fadeWhenOccluding<T extends THREE.Material>(material: T): T {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, occlusionUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec2 uBoatScreen;\nuniform float uBoatDepth;\nuniform vec2 uViewport;",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
{
  vec2 occP = (gl_FragCoord.xy / uViewport - uBoatScreen) * vec2(uViewport.x / uViewport.y, 1.0);
  float occ = (1.0 - smoothstep(0.1, 0.22, length(occP))) * step(-vViewPosition.z, uBoatDepth - 0.4);
  // 4x4 ordered dither: keep a shrinking share of pixels as the fade deepens.
  vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
  float bayer = mod(cell.x * 4.0 + cell.y * 9.0, 16.0) / 16.0;
  if (occ * 0.82 > bayer) discard;
}`,
      );
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ""}|occlude`;
  return material;
}

const tmp = new THREE.Vector3();
/** Track the boat on screen each frame. */
export function updateOcclusion(
  camera: THREE.Camera,
  boat: THREE.Vector3,
  width: number,
  height: number,
) {
  tmp
    .copy(boat)
    .setY(boat.y + 0.2)
    .project(camera);
  occlusionUniforms.uBoatScreen.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
  occlusionUniforms.uBoatDepth.value =
    tmp.copy(boat).applyMatrix4(camera.matrixWorldInverse).z * -1;
  occlusionUniforms.uViewport.value.set(width, height);
}
