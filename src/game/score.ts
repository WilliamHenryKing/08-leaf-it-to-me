// Par and stars: fewer gusts is better, and a duck rescue costs as much as two gusts.

/** Gusts a careful sailor needs for each reach. */
export const PAR = [2, 2, 2] as const;
export const RESCUE_COST = 2;

export type Stars = 1 | 2 | 3;

/** What a reach "cost" in gusts, counting each rescue as extra gusts. */
export function reachCost(gusts: number, rescues: number) {
  return gusts + rescues * RESCUE_COST;
}

/** Three stars at or under par, two within two of it, otherwise one. */
export function starsFor(reach: number, gusts: number, rescues: number): Stars {
  const par = PAR[reach] ?? 2;
  const cost = reachCost(gusts, rescues);
  if (cost <= par) return 3;
  if (cost <= par + 2) return 2;
  return 1;
}

/** Keep the better of two saved results per reach. */
export function mergeBest(best: readonly number[], run: readonly number[]): Stars[] {
  return run.map((s, i) => Math.max(1, Math.min(3, Math.max(s, best[i] ?? 0))) as Stars);
}

/** Read saved best stars; anything malformed reads as no record. */
export function parseBest(raw: string | null, reaches: number): (Stars | 0)[] {
  const empty = Array.from({ length: reaches }, () => 0 as const);
  if (!raw) return empty;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return empty;
    return empty.map((_, i) => {
      const n = v[i];
      return n === 1 || n === 2 || n === 3 ? n : 0;
    });
  } catch {
    return empty;
  }
}
