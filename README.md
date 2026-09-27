# LEAF IT TO ME

**Status: v1 complete.** A miniature river adventure where you steer the wind. A beetle in a coat sails a curled leaf down three short reaches of one brook (the Flooded Flowerpot, the Root Tunnel and the Lantern Pond) to an evening lantern gathering. The current, eddies, calm pools and wind shadows are authored data shared by the rules, the tests and the water shader, so what you see on the water is what moves the boat. Built with Vite, React, strict TypeScript, three.js and GSAP; everything is procedural and there are no external assets or network calls.

## How to play

- **Drag anywhere** (mouse or touch) to aim a gust: the gust blows the way you drag, and a longer drag makes it stronger. Time slows while you aim, and a dotted line previews where the leaf will go. **Let go** to blow.
- **Keyboard:** `←` `→` turn the gust, `↑` `↓` change its strength, `Space` or `Enter` blows, `Esc` cancels.
- Read the water. Streaky, pale water is fast. Calm pools are still. Shade under clover, roots and reeds is a **wind shadow**, where gusts barely reach the sail.
- A gust from behind fills the petal sail best; a crosswind catches less of it. Past about 70% the sail **spills** the extra wind and soaks the beetle, so stronger is not always better.
- Each reach has two passages. In reach 1 the current carries you straight at a fallen branch: slip left through the fast chute, or right into the sheltered lane past the flooded flowerpot. In reach 2 you can go beneath the root in its slow, sheltered tunnel or race the outside. In reach 3, ride the pond's gyre or cut across to the gathering.
- Gather floating lanterns along the way. At the end, each one you bring lights up the gathering.
- If the leaf gets stuck, a duck lifts it back to the calm pool at the start of that reach.
- `↺` restarts and `?` shows the controls again.

## Development

```sh
bun install --frozen-lockfile
bun run dev      # http://127.0.0.1:4518/
bun run check    # tsc, Biome, bun test, production build into dist/
bun run preview  # http://127.0.0.1:4618/
```

Layout: `src/game/` holds the pure rules and course data (tested in `tests/game.test.ts`), `src/scene/` the three.js world and input, `src/ui/` the React HUD, and `src/play.ts` + `src/main.tsx` the wiring. `development/` is the old smoke harness and is not part of the app.

## Credits

All geometry, textures and shaders are generated in code for this project. There are no third-party assets. The type uses system font stacks.
