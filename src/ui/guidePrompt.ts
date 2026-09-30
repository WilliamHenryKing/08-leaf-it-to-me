import type { HudState } from "./store";

export const GUIDE_STEPS = 4;
export interface GuidePrompt {
  key: string;
  lead: string;
  more: string;
  keys?: string;
}

/** Copy follows the current reach; play owns progression from accepted actions. */
export function guidePrompt(
  state: Pick<HudState, "status" | "reach" | "reachName" | "guide">,
  touch = false,
): GuidePrompt {
  const step = Math.max(0, Math.min(GUIDE_STEPS - 1, Math.floor(state.guide) || 0));
  const key = `${state.status}:${state.reach}:${step}:${touch}`;
  if (state.status === "stranded") {
    return {
      key,
      lead: "The duck is coming to help.",
      more: "Wait for the leaf to return to this reach's pool. A rescue costs two gusts; your gathered lanterns stay with you.",
    };
  }
  const target =
    state.reach === 0
      ? "Choose a passage around the fallen branch."
      : state.reach === 1
        ? "Choose the root tunnel or the faster outside passage."
        : "Bring the leaf to the gathering on the right side of the pond.";
  const prompts = [
    {
      lead: touch
        ? "Drag on the water to aim a gust."
        : "Drag on the water, or use the arrow keys.",
      more: `A longer drag makes a stronger gust. ${target}`,
      keys: "← → turn · ↑ ↓ strength",
    },
    {
      lead: touch ? "Let go to blow." : "Let go, or press Space to blow.",
      more: "Time slows while you aim. The dotted line previews the route; wait a moment between gusts. Escape cancels an aim.",
      keys: "Space or Enter blows · Esc cancels",
    },
    {
      lead: "Between gusts, the current carries you.",
      more: `Watch where the leaf drifts before blowing again. Gusts above 70% spill from the sail. ${target}`,
    },
    {
      lead: "Fewer gusts, more stars.",
      more:
        state.reach < 2
          ? `Gather lanterns as you pass through ${state.reachName}. Crossing into the next reach saves a new rescue point; rescues add two gusts.`
          : "Lanterns are optional. Reach the gathering on the right side of the pond to finish; rescues add two gusts to this reach's score.",
    },
  ] as const;
  const prompt = prompts[step] ?? prompts[0];
  return { key, ...prompt, ...(touch ? { keys: undefined } : {}) };
}
