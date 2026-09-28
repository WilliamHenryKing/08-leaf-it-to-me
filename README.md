# LEAF IT TO ME

**Status: v1 complete.** A miniature river adventure where you steer the wind. A beetle in a coat sails a curled leaf down three short reaches of one brook (the Flooded Flowerpot, the Root Tunnel and the Lantern Pond) to an evening lantern gathering. The current, eddies, calm pools and wind shadows are authored data shared by the rules, the tests and the water shader, so what you see on the water is what moves the boat. Built with Vite, React, strict TypeScript, three.js and GSAP. The visuals are all procedural. Sound uses a small set of CC0 recordings (credited below), served from the site itself with no other network calls.

## How to play

- **Drag anywhere** (mouse or touch) to aim a gust: the gust blows the way you drag, and a longer drag makes it stronger. Time slows while you aim, and a dotted line previews where the leaf will go. **Let go** to blow.
- **Keyboard:** `←` `→` turn the gust, `↑` `↓` change its strength, `Space` or `Enter` blows, `Esc` cancels.
- Read the water. Foam streaks and petals ride the current: long, bright streaks mean fast water, faint ones slack water, and curling lines an eddy (look behind the rocks). Clear shallows by the banks show the gravel bed. Shade under clover, roots and reeds is a **wind shadow**, where gusts barely reach the sail.
- A gust from behind fills the petal sail best; a crosswind catches less of it. Past about 70% the sail **spills** the extra wind and soaks the beetle, so stronger is not always better.
- Each reach has two passages. In reach 1 the current carries you straight at a fallen branch: slip left through the fast chute, or right into the sheltered lane past the flooded flowerpot. In reach 2 you can go beneath the root in its slow, sheltered tunnel or race the outside. In reach 3, ride the pond's gyre or cut across to the gathering.
- Gather floating lanterns along the way. At the end, each one you bring lights up the gathering.
- If the leaf gets stuck, a duck lifts it back to the calm pool at the start of that reach.
- Each reach has a **par** of 2 gusts. At or under par earns 3 stars, up to two over earns 2, and more than that earns 1. A duck rescue counts as two gusts. Your best stars per reach are saved in this browser, and the Lantern Pond summary shows the whole run.
- `↺` restarts and `?` shows the controls again. The speaker button or `M` mutes sound, and the choice is remembered.

## Development

```sh
bun install --frozen-lockfile
bun run dev      # http://127.0.0.1:4518/
bun run check    # tsc, Biome, bun test, production build into dist/
bun run preview  # http://127.0.0.1:4618/
bun run e2e      # Playwright: builds, serves the preview, sails through reach 1 (headless, SwiftShader is fine)
```

Layout: `src/game/` holds the pure rules and course data (tested in `tests/game.test.ts`), `src/scene/` the three.js world and input, `src/ui/` the React HUD, and `src/play.ts` + `src/main.tsx` the wiring, `src/audio/` the sound, and `e2e/` the end-to-end test. `bun run e2e` uses `@playwright/test` 1.56.1, pinned to match the Chromium build installed in the cloud environment; elsewhere, run `bunx playwright install chromium` once. The page exposes a read-only `window.leafItToMe.snapshot()` for the test. `development/` is the old smoke harness and is not part of the app.

## Credits

All geometry, textures and shaders are generated in code for this project. The type uses system font stacks.

### Audio

Sound starts on the first tap, click or key press. Music and ambience loop in code with crossfades. Everything was trimmed, mixed to mono and re-encoded as MP3 (about 1.1 MB in total) in `public/audio/`. Every source is **CC0 (public domain)**; credit is given as thanks, not as a requirement.

| File | Used for | Source | Author | Licence |
| --- | --- | --- | --- | --- |
| `music.mp3` | Music (first 105 s of "Sunset Plains") | https://opengameart.org/content/sunset-plains | yoiyami | CC0 |
| `river.mp3` | Brook ambience (excerpt of `park_ambience_river.wav`) | https://opengameart.org/content/park-ambiences | thimras | CC0 |
| `birds.mp3` | Birdsong ambience (excerpt of `park_ambience_birds.wav`) | https://opengameart.org/content/park-ambiences | thimras | CC0 |
| `splash-small.mp3`, `splash-big.mp3` | Bumps, spills, the duck setting the boat down (`splash_10`, `splash_07`) | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | rubberduck | CC0 |
| `sail.mp3` | The sail filling on each gust (`cloth1`) | https://kenney.nl/assets/rpg-audio | Kenney (kenney.nl) | CC0 |
| `bump.mp3` | Hitting wood or stone (`impactWood_light_001`) | https://kenney.nl/assets/impact-sounds | Kenney (kenney.nl) | CC0 |
| `lantern.mp3`, `click.mp3`, `toggle.mp3`, `aim.mp3` | Lantern gathered, buttons, mute, start of aiming (`glass_004`, `click_001`, `toggle_001`, `pluck_002`) | https://kenney.nl/assets/interface-sounds | Kenney (kenney.nl) | CC0 |
| `checkpoint.mp3`, `finish.mp3` | New reach, arrival at the gathering (`jingles_PIZZI07`, `jingles_STEEL02`) | https://kenney.nl/assets/music-jingles | Kenney (kenney.nl) | CC0 |

The gust's rush of air and the duck's quack are synthesized live with the Web Audio API (`src/audio/audio.ts`). No CC0 quack recording could be found.
