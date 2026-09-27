// Which sound each game event makes.
import type { GameEvent, GameState } from "../game/sim";
import type { Audio } from "./audio";

export function playCues(audio: Audio, events: GameEvent[], state: GameState) {
  for (const e of events) {
    switch (e.type) {
      case "gust":
        audio.whoosh(e.strength);
        audio.play("sail", 0.5 + e.strength * 0.5, 0.9 + e.strength * 0.2);
        if (e.spilled) audio.play("splashBig", 0.7, 1.15, 0.12);
        break;
      case "bump":
        audio.play("bump", Math.min(1, 0.4 + e.speed * 0.3), 0.9 + Math.random() * 0.2);
        audio.play("splashSmall", 0.5, 1.1);
        break;
      case "lantern": {
        // Each lantern rings a little higher than the last.
        const n = state.lanterns.filter(Boolean).length;
        audio.play("lantern", 0.8, 0.85 + n * 0.06);
        break;
      }
      case "checkpoint":
        audio.play("checkpoint", 0.8);
        break;
      case "stranded":
        audio.quack(0.5);
        audio.quack(0.85);
        break;
      case "rescued":
        audio.play("splashBig", 0.8);
        audio.quack(0.25);
        break;
      case "finished":
        audio.play("finish", 0.9);
        audio.setEnding(true);
        break;
    }
  }
}
