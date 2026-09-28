# LEAF IT TO ME — visual audit

Captured with `node tools/visual/capture.mjs <dir>` against the production build (`bun run build && bun run preview`, page opened with `?e2e`), headless Chromium on SwiftShader:

> `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`

Bookmarks live in `src/visual/bookmarks.ts`; `window.__VISUAL_TEST__` (dev builds and `?e2e` only) applies one, freezes time at a fixed clock, reseeds the flow effects and settles six frames, so each capture is repeatable. `report.json` next to the images records the renderer and scene inventory per shot.

Scale: **1** placeholder · **2** tech demo · **3** competent indie · **4** premium studio web piece · **5** reference quality.

## Baseline (before) — `docs/visual/captures/baseline/`

Criteria: L light plausibility · M materials · D detail density · E environment integration · A atmosphere and depth · C composition · X artefacts (5 = none) · U motion and UI integration.

| Bookmark | L | M | D | E | A | C | X | U | Mean |
| --- | - | - | - | - | - | - | - | - | --- |
| establishing-wide | 2 | 1 | 2 | 2 | 2 | 3 | 2 | – | **2.0** |
| hero | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | **2.3** |
| closeup-boat | 2 | 1 | 1 | 2 | 2 | 2 | 1 | – | **1.6** |
| grazing-materials | 2 | 1 | 2 | 1 | 2 | 2 | 2 | – | **1.7** |
| phone-hero | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | **2.3** |
| root-tunnel | 2 | 1 | 1 | 2 | 2 | 1 | 1 | – | **1.4** |
| lantern-pond | 2 | 1 | 2 | 2 | 2 | 2 | 2 | – | **1.9** |

**Overall baseline: about 1.9: a readable tech demo.** The current reads well (streaks, depth tint), but almost nothing looks like a material, and the light is a flat ACES-mapped sun plus hemisphere with no environment.

### What the captures show

- **Lighting.** ACES tone mapping straight in the renderer, a hemisphere fill and no `scene.environment`: nothing reflects anything, so the water's only "reflection" is a painted tint. Fog is a flat beige plane where the sky should be. The lanterns glow by emissive colour and additive sprites; only the gathering has a light.
- **Materials.** Everything is a flat `MeshStandardMaterial` colour: rocks and pebbles are faceted icosahedra with no texture, the banks are vertex colours with visible triangle shading, and the branch, roots, pot, toadstool and raft are single colours. No wet darkening where water meets stone or mud.
- **Water.** Flow is readable, but the surface is a noise-tinted colour with alpha; it reflects neither sky nor banks, and the "clear shallows" are just lower alpha over vertex-coloured mud.
- **Leaf boat (close-up).** A flat green shell with no veins, no translucency and no thickness at the rim. The beetle's legs pass through the hull, and its coat reads as a clay pot rim. Wake rings and foam streaks show as hard white quads at arm's length.
- **Vegetation.** Grass blades are flat, identical-width ribbons (hue jitter only); reeds are separate tube meshes with no variation in material; the clover canopy is flat shapes.
- **Root tunnel.** The follow camera sits above the root arches, which hide the boat almost completely; the light shafts render as hard-edged triangles.
- **Lantern pond.** Brown, flat water; untextured lily pads; a plain box raft; the guests are identical models in different colours.

## Ranked fix list

1. **One lighting model:** AgX applied once in an `OutputPass`, a real CC0 river HDRI as `scene.environment` (PMREM), physical sun intensity, exposure as the only brightness control. Lanterns get real point lights (a small pool assigned to the nearest lanterns), not emissive boosts.
2. **Post-processing:** GTAO for contact shadow where things meet the banks and water, SMAA, bloom only above an HDR threshold (lanterns, glints), fitted and texel-snapped sun shadows.
3. **Scanned rocks and pebbles** (Poly Haven CC0) for every obstacle rock and bank or bed pebble, instanced with 15–25 % scale jitter, random rotation and slight hue jitter, darkened and glossier below a wet line at the water.
4. **Water:** Fresnel reflection of the environment, the bed visible through the shallows with depth absorption and caustics, keeping the flow-aligned streaks that make the current readable.
5. **Banks:** a PBR splat of sourced CC0 textures (wet mud at the waterline, leaf litter above, river gravel on the bed) with macro variation and no visible tiling.
6. **Root tunnel:** dither-fade anything between the camera and the boat; soft volumetric-looking light shafts; bark material on roots.
7. **Leaf boat:** a vein normal map and colour variation, back-lit translucency, rim thickness; fix the beetle's legs and give the coat a knitted look.
8. **Props:** a real clay pot (scanned), bark on the branch and roots, a proper toadstool material, a textured raft.
9. **Vegetation:** blades with a folded midrib, base-to-tip colour and width variation; instanced, varied reeds.
10. **Close-range effects:** soften wake rings and streak quads (feathered textures instead of hard quads).
