// A tiny external store the HUD reads with useSyncExternalStore.
import type { Status } from "../game/sim";

export interface HudState {
  status: Status;
  reach: number;
  reachName: string;
  gusts: number;
  gustsByReach: number[];
  lanterns: number;
  totalLanterns: number;
  rescues: number;
  aim: { strength: number; spill: boolean; efficiency: number } | null;
  toast: { id: number; text: string } | null;
  hint: boolean;
  muted: boolean;
}

export function createStore(initial: HudState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<HudState>) {
      const next = { ...state, ...patch };
      const changed = (Object.keys(patch) as (keyof HudState)[]).some(
        (k) => JSON.stringify(next[k]) !== JSON.stringify(state[k]),
      );
      if (!changed) return;
      state = next;
      for (const l of listeners) l();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
