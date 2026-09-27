# LEAF IT TO ME — v1 brief for a cloud build session

You are building this project's v1 in one focused session. Ship a small, polished, complete experience — not a prototype and not a sprawling one. Read this brief once, write a plan of 5–10 lines, then build. Stop when the definition of done is met.

## The idea

**08 — LEAF IT TO ME.** Build a curled-leaf boat, a tiny beetle passenger and three short river reaches. Gust direction/strength, current fields, shelter and momentum should allow intentional route choices. Include readable obstacles, checkpoints and a lantern-gathering ending. Begin with one current, one obstacle and two routes the player can choose deliberately.

### G5. LEAF IT TO ME

**A miniature river adventure where you steer the wind.**

A tiny beetle in a coat is trying to reach an evening gathering downstream. Its boat is a curled leaf with a twig mast. You control brief gusts around the boat.

**What you do:** drag to choose a gust's direction and strength, then release it. The boat responds to the wind and current. Use a few gusts between calm pools to choose a route, catch an eddy or slip beneath a root.

**First playable moment:** the current is carrying the leaf towards a branch. A crosswind catches the little sail, the leaf heels over, and it slips through a gap. Droplets shake off the coat as the beetle settles back down.

**Depth:** judge current, wind shadow, sail orientation and momentum. Stronger gusts are not always better. A route with sheltered water may use fewer gusts than the short route through the current.

**Adventure:** a flooded flowerpot, a root tunnel and a lantern pond make three compact reaches of one stream. Tiny bankside details make the world feel huge from the beetle's scale.

**Failure and recovery:** a duck can rescue a stranded boat to the last pool. The joke should be brief enough that retrying stays pleasant.

**Small complete version:** three short reaches, a few authored current fields, a single gust mechanic and an ending at the lantern gathering.

**What would ruin it:** realistic-but-unreadable water physics, excessive drift or decorative obstacles that do not affect the boat.

**First proof:** one current, one branch and two possible passages. The player can deliberately choose either route.

Art direction: **LEAF IT TO ME:** a convincing macro world of leaves, water, roots, droplets and a tiny character.

## Definition of done (v1)

1. One focused scene delivering the idea above, with a complete loop: start → core interaction → a visible result or ending → replay. A short first-time hint teaches the controls in place.
2. Arrival loader: keep the veil in `index.html` and `src/loader.ts`; restyle the veil to the art direction and call `worldReady()` after the first rendered frame.
3. Desktop (1440×900) and phone (390×844) layouts; mouse, touch and keyboard; honour `prefers-reduced-motion`; visible focus and labelled controls.
4. `bun run check` passes: strict `tsc`, Biome, `bun test`, production build into `dist/`.
5. Unit tests of the game rules (pure TypeScript, no DOM) replace `tests/scaffold.test.ts`.
6. `README.md`: one status paragraph, how to play, and credits for any asset used.
No extra modes, settings screens, accounts, leaderboards, backends, analytics or network calls.

## Technical rules

- The stack is installed and pinned: Vite, React, strict TypeScript, three.js 0.186 (direct, no React Three Fiber), GSAP, Tailwind v4, Biome, Bun. Add a dependency only if essential, pinned exactly.
- `bun run dev` serves the real app (`index.html` → `src/main.tsx`); `bun run build` builds it into `dist/`. `development/` is old tooling: leave it alone.
- Single responsibility: `src/game/` pure rules and state (tested), `src/scene/` three.js scene, camera, lights and meshes, `src/ui/` React HUD and panels, `src/main.tsx` wiring. Files under ~300 lines.
- Visuals: author forms procedurally in code (geometry, instancing, small shaders where they clearly help), AgX or ACES tone mapping, one key light plus hemisphere or environment light, soft shadows where cheap, a cohesive palette and strong silhouettes. Type: a system font stack. External assets only if CC0 or public domain, with the source in README.
- Performance: 60 fps on a mid laptop; cap devicePixelRatio at 2.
- Do not change `wrangler.jsonc`, deploy or publish anything.

## Working method

- There is no GPU here. Do not loop on screenshots: at most two headless checks (desktop, phone) if Chromium is available (software WebGL is fine).
- Commit in small, clear steps. Finish with a message: what was built, how to play, known gaps.
