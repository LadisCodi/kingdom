// How long a march takes, hex by hex (Docs/features/19-world-map.md §4).
//
// A march is a PATH, one hex at a time, and every hex adds its own time to
// the trip — counted as the marcher LEAVES it: open ground the base, a forest
// half again, a mountain three times. The way taken is the quickest one,
// through hexes the marcher may enter.
//
// FAR GROUND IS SLOWER. A hex costs more the further it lies from the
// marcher's own city — `marchGrowthPerHex` for every hex out, up to
// `marchGrowthHexes` — so the ground round a city is crossed quickly and a
// march on a rival takes its time. The march's first hex is always that city
// (an explorer's and an army's path both start there), so the distance is
// read off the path itself.
//
// Every kind of marcher has its own pace on open ground — an explorer is
// quicker than an army — and the ground multiplies it. `speed` is the hook
// for whatever makes a march faster over some ground — a hero, a technology:
// it divides one hex's time, so a bonus only ever shortens a trip.

import { WORLD, WORLD_TRAVEL } from '../data/definitions';
import { hexDistance } from './hex';

/** Who is marching, which sets the pace on open ground. */
export type Marcher = 'explorer' | 'army';

const baseMs = (who: Marcher): number =>
  (who === 'explorer' ? WORLD.explorerSecondsPerHex : WORLD.armySecondsPerHex) * 1000;
import type { BoardHex } from './board';
import { boardNeighbors } from './hex';

/** What this ground does to a pace: its terrain's factor times each of its
 *  features'. */
export function hexTravelFactor(bh: BoardHex): number {
  let factor = bh.role === 'portal' ? WORLD_TRAVEL.portal : WORLD_TRAVEL.terrain[bh.terrain ?? 'Grassland'] ?? 1;
  for (const f of bh.features) factor *= WORLD_TRAVEL.feature[f] ?? 1;
  return factor;
}

/** How much longer a hex `d` from the marcher's city takes to cross. */
export const distanceFactor = (d: number): number =>
  WORLD.marchGrowthPerHex ** Math.min(Math.max(0, d), WORLD.marchGrowthHexes);

/** Milliseconds for `who` to leave this hex, `d` hexes from its own city,
 *  before any speed. */
export const hexTravelMs = (bh: BoardHex, who: Marcher, d = 0): number =>
  baseMs(who) * hexTravelFactor(bh) * distanceFactor(d);

/** The time to leave one hex on a march out of `origin`, at a speed. */
const leaveMs = (bh: BoardHex, origin: BoardHex, who: Marcher, speed: (bh: BoardHex) => number): number =>
  Math.max(1, Math.round(hexTravelMs(bh, who, hexDistance(origin.hex, bh.hex)) / Math.max(1, speed(bh))));

/** A march's way: the hexes, city first, and the milliseconds it takes to
 *  leave each one — the last is spent on the way back. */
export interface Route { path: number[]; stepMs: number[] }

/** The time to leave each hex of a path, at a speed (≥ 1). The path starts
 *  at the marcher's city, which every hex's distance is read from. */
export const stepTimes = (
  hexes: readonly BoardHex[], path: readonly number[], who: Marcher, speed: (bh: BoardHex) => number = () => 1,
): number[] => path.map((i) => leaveMs(hexes[i], hexes[path[0]], who, speed));

/**
 * The quickest way from `from` to `to`, entering only hexes `canEnter`
 * allows — the destination is always allowed. Null when there is none.
 * Dijkstra over the board; ties broken by board index, so the same board
 * gives the same way every time.
 */
export function fastestRoute(
  hexes: readonly BoardHex[], from: number, to: number, who: Marcher,
  canEnter: (index: number) => boolean, speed: (bh: BoardHex) => number = () => 1,
): Route | null {
  if (from === to) return null;
  // Every hex timed from `from`, the marcher's city.
  const leave = hexes.map((h) => leaveMs(h, hexes[from], who, speed));
  const dist = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  for (;;) {
    let at = -1;
    let best = Infinity;
    for (const [i, d] of dist) if (!done.has(i) && (d < best || (d === best && i < at))) { at = i; best = d; }
    if (at < 0) return null;
    if (at === to) break;
    done.add(at);
    for (const n of boardNeighbors(at)) {
      if (done.has(n) || (n !== to && !canEnter(n))) continue;
      const d = best + leave[at];
      if (d < (dist.get(n) ?? Infinity)) { dist.set(n, d); prev.set(n, at); }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return { path, stepMs: path.map((i) => leave[i]) };
}

/** Milliseconds from setting out to reaching the end of the path. */
export const outboundMs = (stepMs: readonly number[]): number =>
  stepMs.slice(0, -1).reduce((s, x) => s + x, 0);

/** Milliseconds from the end of the path back to the city. */
export const homeboundMs = (stepMs: readonly number[]): number =>
  stepMs.slice(1).reduce((s, x) => s + x, 0);

/** When, from setting out, the marcher reaches path[k]. */
export const reachMs = (stepMs: readonly number[], k: number): number =>
  stepMs.slice(0, k).reduce((s, x) => s + x, 0);

/**
 * Where a marcher is on its path `elapsed` ms into a leg: between hex `k`
 * and the next one it walks to, `f` of the way. Out, it walks up the path;
 * home, down it. Each stretch takes the time to leave the hex it starts from.
 */
export function legPosition(stepMs: readonly number[], elapsed: number, outbound: boolean): { k: number; next: number; f: number } {
  const last = stepMs.length - 1;
  if (last <= 0) return { k: 0, next: 0, f: 0 };
  let e = Math.max(0, elapsed);
  if (outbound) {
    let k = 0;
    while (k < last - 1 && e >= stepMs[k]) { e -= stepMs[k]; k += 1; }
    return { k, next: k + 1, f: Math.min(1, e / stepMs[k]) };
  }
  let k = last;
  while (k > 1 && e >= stepMs[k]) { e -= stepMs[k]; k -= 1; }
  return { k, next: k - 1, f: Math.min(1, e / stepMs[k]) };
}
