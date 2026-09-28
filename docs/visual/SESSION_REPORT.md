# Fidelity pass — session report

Branch `cloud-v1`. Evidence: `docs/visual/captures/baseline/`, `docs/visual/captures/after/`, scorecard in [`AUDIT.md`](AUDIT.md). All captures are headless Chromium on SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`), not a GPU: look and performance still need a check on real hardware.

## Scores

| Bookmark | Before | After |
| --- | --- | --- |
| establishing-wide | 2.0 | 3.0 |
| hero | 2.3 | 3.0 |
| closeup-boat | 1.6 | 2.9 |
| grazing-materials | 1.7 | 3.1 |
| phone-hero | 2.3 | 3.0 |
| root-tunnel | 1.4 | 2.6 |
| lantern-pond | 1.9 | 3.1 |
| **Mean** | **1.9** | **3.0** |

Scale: 1 placeholder, 2 tech demo, 3 competent indie, 4 premium studio web piece.

## Assets

32 shipped files, **9.8 MB** in `public/` (budget about 25 MB), every one in `assets.manifest.json` with source, author, licence, date, sha256 and processing:

- HDRIs (3.7 MB): Poly Haven `river_walk_1`, `sunset_forest` (1k).
- PBR textures (4.1 MB, WebP): Poly Haven `clean_pebbles`, `mud_forest`, `brown_mud_leaves_01`, `bark_brown_02` (1k).
- Scanned models (1.0 MB, meshopt + WebP via gltf-transform): `rock_moss_set_01` (full and LOD), `rock_moss_set_02` (LOD), `planter_pot_clay`, `tree_stump_01` (LOD).
- Audio (1.1 MB): unchanged from the sound pass.

All CC0. Nothing was copied from ODD TIDE's `public/` (its textures and models are coastal and interior sets that don't suit a brook); its code was studied and adapted (below).

## What changed

- **Evidence tooling:** `window.__VISUAL_TEST__` (dev and `?e2e` only: `ready`, `setBookmark`, `freeze`, `settle`, `info`, `pick`), seven bookmarks in `src/visual/bookmarks.ts`, capture runner `tools/visual/capture.mjs`.
- **One lighting model:** AgX applied once in an `OutputPass`; the river HDRI as `scene.environment` (PMREM) and blurred sky, swapping to a dusk HDRI at the pond; warm sun as key at about 4:1 over the fill; exposure the only brightness control; texel-snapped fitted sun shadow; fog tinted from each sky's measured horizon.
- **Post-processing** (adapted from ODD TIDE's `pipeline.ts`): GTAO (transparents excluded), bloom above an HDR threshold only, a small linear saturation grade, SMAA, OutputPass.
- **Tiers:** phones (coarse pointer or small screen) get the low tier: no GTAO, smaller shadow and bloom buffers, pixel ratio ≤ 1.5. Adaptive quality on all tiers: if frame time stays above 16.7 ms for about 2 s, GTAO is dropped, then bloom and a quarter of the pixel ratio (never steps back up).
- **Ground:** a PBR splat of three CC0 sets by distance to the water, each sampled twice at different scales and rotations to hide tiling, a darker glossy wet band, depth absorption and sun caustics under water.
- **Rocks and pebbles:** scans split into separate stones, instanced per piece with scale, rotation and hue jitter; wet line on everything at the water (`wet.ts`).
- **Water** (after ODD TIDE's `water.ts`): near-zero albedo, Fresnel reflection of the HDRI, premultiplied blending so the bed shows through; the flow-aligned streaks that make the current readable are kept.
- **Leaf boat:** vein normal map and mottled skin, back-lit translucency for the leaf and sail, a knitted coat, legs that no longer pass through the hull.
- **Vegetation and props:** instanced reeds with height, lean and tint jitter; folded, translucent grass blades; lathed toadstools with flecked caps and gills; textured lily pads; scanned clay pot; bark on branch, roots and a log raft; scanned stumps.
- **Places:** roots and earth between the camera and the boat dissolve (ordered dither); soft additive light shafts; a pool of three real point lights follows the nearest floating lanterns (no emissive rescue, halo sprites removed).
- **Loading:** assets load behind the arrival veil; the dusk HDRI loads after the day one.

`bun run check` passes (strict tsc, Biome, 23 unit tests, build) and the Playwright end-to-end test passes (now about 3 minutes under SwiftShader, run on the low tier).

## What I could not do

- **No real-GPU check.** Frame rate, the high tier's cost (GTAO plus four texture sets plus ~400k triangles) and the adaptive step were not measured on hardware. SwiftShader renders at a few frames per second, so the adaptive step's thresholds are untested in practice.
- **Loader time** was not measured on a real connection; assets are about 9.8 MB, so on slow links the veil will stay up noticeably longer than 3 s. Splitting textures to load after the veil would be the next step.
- **No KTX2.** Textures ship as WebP; KTX2/Basis would cut GPU memory but needs a transcoder at runtime.
- **No transmission water.** Refraction is approximated by blending over the textured bed, not a transmission pass (also cheaper, per the RTX 2060 lesson).
- **Hero character and grass are still procedural** and hold the scores at about 3: there's no CC0 beetle, and the grass is geometry blades rather than alpha-tested scanned cards (Poly Haven's `grass_medium_02` would be the next source).
- **Remaining flaws** are listed per bookmark in `AUDIT.md`.

## Access

- Cloning `WilliamHenryKing/01-odd-tide` worked after attaching it read-only to this session.
- Poly Haven's API refuses Python's default user agent (HTTP 403); requests with an explicit user agent worked.
