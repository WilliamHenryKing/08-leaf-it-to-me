// Wet stone and bark: darker and glossier just above the water, and under it the same depth
// absorption the bed gets, so rocks sit in the brook instead of on it.
import type * as THREE from "three";

export function wetLine<T extends THREE.MeshStandardMaterial>(material: T, band = 0.14): T {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWetY;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 wetP = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
wetP = instanceMatrix * wetP;
#endif
vWetY = (modelMatrix * wetP).y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWetY;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float wetK = 1.0 - smoothstep(0.0, ${band.toFixed(3)}, vWetY);
diffuseColor.rgb *= mix(1.0, 0.5, wetK);
diffuseColor.rgb *= exp(-max(-vWetY, 0.0) * vec3(1.9, 0.95, 0.75));`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.0, 0.3, wetK);",
      );
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ""}|wet${band}`;
  return material;
}
