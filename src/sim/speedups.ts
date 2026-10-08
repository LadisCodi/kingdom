// SPEED-UPS (Docs/proposals/inventory.md §3.2, Docs/plans/relics-and-bag.md
// step 2): Bag items that take time off a running timer.
//
// Three rules this file keeps:
//
//  1. A SPEED-UP IS A COMMAND AT `now`. It moves the timer's end (a build, a
//     training line) or adds the crew's work (a workshop, which has no end),
//     and nothing reads a clock — the offline replay never sees it.
//  2. IT NEVER GIVES TIME AWAY. What it finishes completes at `now`, never at
//     the earlier instant the cut implies, and what follows starts at `now`.
//     The rest of a speed-up bigger than the wait is lost.
//  3. A TYPED SPEED-UP FITS ITS OWN KIND, A GENERAL ONE FITS ALL. The picker
//     offers the typed ones first, then General, smallest first.

import { track } from './analytics';
import { recordEvent } from './events';
import { cutLine, lineFor, lineRemainingSeconds } from './army';
import { cutQueueItem } from './commands';
import { ITEMS, type SpeedupKind } from './data/definitions';
import type { MapData } from './grid';
import { itemCount } from './bag';
import { districtById, remainingSeconds, type GameState, type ItemId } from './state';
import { cutExplorer, tripMsLeft } from './world/explorers';
import { cutWorkshopItem, isWorkshop, itemRemainingSeconds } from './workshops';

/** A running timer a speed-up can be used on. A world build (`hex`) is the
 *  world server's time: the game asks the server to move it
 *  (`handleWorld`'s `hurry`) and only then spends the items. */
export type SpeedJob =
  | { kind: 'queue'; itemId: string }
  | { kind: 'training'; buildingId: string }
  | { kind: 'workshop'; districtId: string }
  | { kind: 'explorer'; tripId: string }
  | { kind: 'hex'; index: number }
  // An army on the road: the server's, so the job carries when it arrives,
  // kept true by the client from each snapshot.
  | { kind: 'army'; armyId: string; at: number };

/** The typed speed-up that fits this job; null where only General does — an
 *  explorer's march, whose own March speed-ups are not made yet. */
export const jobKind = (job: SpeedJob): Exclude<SpeedupKind, 'General'> | null => {
  switch (job.kind) {
    case 'queue': case 'hex': return 'Construction';
    case 'training': return 'Training';
    case 'workshop': return 'Workshop';
    case 'explorer': case 'army': return null;
  }
};

/** Does this speed-up fit this job? */
export const fits = (id: ItemId, job: SpeedJob): boolean => {
  const def = ITEMS[id];
  return def !== undefined && def.kind === 'speedup'
    && (def.speeds === 'General' || def.speeds === jobKind(job));
};

/** Seconds left on the job at `now`, or null when it is not running — gone,
 *  waiting for a builder, or a workshop nobody works. A training line is the
 *  whole line: what is on the bench and everyone behind it. */
export function jobRemainingSeconds(state: GameState, job: SpeedJob, now: number): number | null {
  if (job.kind === 'queue') {
    const item = state.city.queue.find((q) => q.uniqueId === job.itemId);
    return item === undefined || item.startedAt === null ? null : remainingSeconds(item, now);
  }
  if (job.kind === 'training') {
    return lineFor(state, job.buildingId).length === 0 ? null : lineRemainingSeconds(state, job.buildingId, now);
  }
  if (job.kind === 'explorer') {
    // Nothing runs while it waits at its hex for the player's tap.
    const trip = state.world.explorers.find((t) => t.id === job.tripId);
    const left = trip === undefined ? null : tripMsLeft(trip, now);
    return left === null ? null : left / 1000;
  }
  if (job.kind === 'army') return job.at <= now ? null : (job.at - now) / 1000;
  if (job.kind === 'hex') {
    // The client's mirror of the server's timer (`state.world.builds`).
    const build = state.world.builds.find((b) => b.index === job.index);
    return build === undefined ? null : Math.max(0, (build.finishesAt - now) / 1000);
  }
  const d = districtById(state, job.districtId);
  return d === undefined || !isWorkshop(d) ? null : itemRemainingSeconds(state, d, now);
}

/** The speed-ups held that fit this job: the typed ones, then General, each
 *  smallest first — the picker's rows (Docs/art/ui-inventory.md §3.7). */
export function speedupsFor(state: GameState, job: SpeedJob): ItemId[] {
  const held = (Object.keys(ITEMS) as ItemId[]).filter((id) => fits(id, job) && itemCount(state, id) > 0);
  const typed = (id: ItemId) => (ITEMS[id].speeds === 'General' ? 1 : 0);
  return held.sort((a, b) => typed(a) - typed(b) || ITEMS[a].seconds - ITEMS[b].seconds);
}

export type SpeedupResult = 'Used' | 'NotHeld' | 'DoesNotFit' | 'NothingRunning' | 'OnTheServer';

/** Why `n` of this speed-up cannot be used on the job now, or null. */
export function speedupRefusal(
  state: GameState, job: SpeedJob, id: ItemId, n: number, now: number,
): Exclude<SpeedupResult, 'Used' | 'OnTheServer'> | null {
  if (!fits(id, job)) return 'DoesNotFit';
  if (!(n >= 1) || !Number.isInteger(n) || itemCount(state, id) < n) return 'NotHeld';
  if (jobRemainingSeconds(state, job, now) === null) return 'NothingRunning';
  return null;
}

/** Take `n` of a speed-up out of the Bag, spent on a job. All `n` go, even
 *  past what the job had left — the picker shows the time left, and Auto
 *  never overshoots by more than its smallest item. */
export function spendSpeedups(state: GameState, job: SpeedJob, id: ItemId, n: number): void {
  const left = itemCount(state, id) - n;
  if (left > 0) state.bag.held[id] = left;
  else {
    delete state.bag.held[id];
    delete state.bag.fresh[id];
  }
  recordEvent(state, { kind: 'itemUsed', count: n });
  track(state, 'item_used', { item: id, count: n, job: job.kind });
}

/** Take `seconds` off a job the client owns, at `now`. */
function cut(state: GameState, map: MapData, job: SpeedJob, seconds: number, now: number): void {
  if (job.kind === 'queue') cutQueueItem(state, map, job.itemId, seconds * 1000, now);
  else if (job.kind === 'training') cutLine(state, job.buildingId, seconds * 1000, now);
  else if (job.kind === 'workshop') cutWorkshopItem(state, job.districtId, seconds, now);
  else if (job.kind === 'explorer') cutExplorer(state, job.tripId, seconds * 1000, now);
}

/** Use `n` of a speed-up on a job the client owns, at `now`. A world build
 *  is the server's: the caller asks it first (`OnTheServer`). */
export function useSpeedup(
  state: GameState, map: MapData, job: SpeedJob, id: ItemId, n: number, now: number,
): SpeedupResult {
  const refused = speedupRefusal(state, job, id, n, now);
  if (refused !== null) return refused;
  if (job.kind === 'hex' || job.kind === 'army') return 'OnTheServer';
  cut(state, map, job, ITEMS[id].seconds * n, now);
  spendSpeedups(state, job, id, n);
  return 'Used';
}

/** What Auto would spend: a count per speed-up. */
export type AutoPlan = Array<{ id: ItemId; n: number }>;

const planSeconds = (plan: AutoPlan): number =>
  plan.reduce((s, p) => s + ITEMS[p.id].seconds * p.n, 0);
const planCount = (plan: AutoPlan): number => plan.reduce((s, p) => s + p.n, 0);

/**
 * AUTO (Docs/art/ui-inventory.md §3.7): the fewest speed-ups that finish the
 * job, wasting less than the smallest one it uses — or, when everything held
 * cannot finish it, everything held.
 *
 * Two candidates, the fewer items winning and the less waste breaking a tie:
 * the largest sizes first, topped up by the smallest size that covers what
 * is left; and the one smallest item that covers the whole wait alone. Then
 * any item the plan can do without is dropped, smallest first — which is what
 * holds the waste under the smallest item used.
 */
export function autoPlan(state: GameState, job: SpeedJob, now: number): AutoPlan {
  const left = jobRemainingSeconds(state, job, now);
  if (left === null || left <= 0) return [];
  const held = speedupsFor(state, job);
  // Largest first; at one size the typed one before General.
  const byLargest = [...held].sort((a, b) => ITEMS[b].seconds - ITEMS[a].seconds
    || (ITEMS[a].speeds === 'General' ? 1 : 0) - (ITEMS[b].speeds === 'General' ? 1 : 0));

  const greedy: AutoPlan = [];
  let rest = left;
  const spare = new Map(held.map((id) => [id, itemCount(state, id)]));
  for (const id of byLargest) {
    const s = ITEMS[id].seconds;
    const n = Math.min(spare.get(id)!, Math.floor(rest / s));
    if (n > 0) {
      greedy.push({ id, n });
      spare.set(id, spare.get(id)! - n);
      rest -= n * s;
    }
  }
  if (rest > 0) {
    const cover = [...byLargest].reverse().find((id) => spare.get(id)! > 0 && ITEMS[id].seconds >= rest);
    if (cover !== undefined) {
      const at = greedy.find((p) => p.id === cover);
      if (at) at.n += 1;
      else greedy.push({ id: cover, n: 1 });
    }
  }
  const finishes = (plan: AutoPlan) => planSeconds(plan) >= left;
  const candidates: AutoPlan[] = [greedy];
  const single = [...byLargest].reverse().find((id) => ITEMS[id].seconds >= left);
  if (single !== undefined) candidates.push([{ id: single, n: 1 }]);
  const finishing = candidates.filter(finishes);
  if (finishing.length === 0) return held.map((id) => ({ id, n: itemCount(state, id) }));
  finishing.sort((a, b) => planCount(a) - planCount(b) || planSeconds(a) - planSeconds(b));
  const plan = finishing[0].map((p) => ({ ...p }));
  // Drop what it can do without, smallest first.
  for (const p of [...plan].sort((a, b) => ITEMS[a.id].seconds - ITEMS[b.id].seconds)) {
    while (p.n > 0 && planSeconds(plan) - ITEMS[p.id].seconds >= left) p.n -= 1;
  }
  return plan.filter((p) => p.n > 0);
}

/** Spend Auto's plan at `now`. */
export function useAuto(state: GameState, map: MapData, job: SpeedJob, now: number): SpeedupResult {
  const plan = autoPlan(state, job, now);
  if (plan.length === 0) return jobRemainingSeconds(state, job, now) === null ? 'NothingRunning' : 'NotHeld';
  if (job.kind === 'hex' || job.kind === 'army') return 'OnTheServer';
  for (const p of plan) {
    if (jobRemainingSeconds(state, job, now) === null) break;
    useSpeedup(state, map, job, p.id, p.n, now);
  }
  return 'Used';
}
