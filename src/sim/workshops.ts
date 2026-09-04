// Workshops: the queue of goods, and the crew that works it
// (Docs/plans/builder-30-days.md §3).
//
// **Nothing happens without a worker.** A workshop with no villager assigned
// does not advance — there is no hand production and no collect tap. The crew
// is the engine, and it is what the player is building Housing for.
//
// The crew spreads itself over the items in progress: at most one item per
// worker, front of the queue first, and a worker with no item of its own
// helps on another. So two workers on one item finish it in half the time,
// two workers on two items finish both in the same time, and throughput is
// always `crew × one item-second per second` whatever the queue holds. One
// more villager is therefore always faster, which is the whole point of
// pricing the late city in goods.
//
// Progress is kept in WORKER-MILLISECONDS, never as a deadline: the rate
// moves whenever the crew or the queue changes, so what is durable is the
// work done, not the moment it would have finished. The anchor advances in
// whole `k`-millisecond chunks — the same trick as the tax and Mana anchors —
// so one-call replay and stepped ticking agree exactly (invariant 1).

import { DISTRICTS, GOODS, RUSH, levelIndexed } from './data/definitions';
import { addGood, canAffordGoods, payGoods, refundGoods } from './goods';
import { canPayMana, grantMana, payMana } from './mana';
import { canAfford, pay, refund } from './wallet';
import {
  addToWallet, districtById, getWallet,
  type District, type GameState, type GoodId,
} from './state';

/** One queued good. `good` is stored rather than read off the district so a
 *  save reads back what it was making, not what the sheet says today. */
export interface WorkshopItem {
  good: GoodId;
  /** Worker-milliseconds of work done. `GoodDef.workSeconds` is what ONE
   *  villager owes it. */
  workMs: number;
}

export interface WorkshopLine {
  items: WorkshopItem[];
  /** Epoch ms the work is measured from. Advanced only in whole chunks. */
  anchor: number;
}

export const isWorkshop = (d: District): boolean =>
  DISTRICTS[d.definitionId].produces !== null;

export const workshops = (state: GameState): District[] =>
  state.city.districts.filter((d) => d.state === 'Built' && isWorkshop(d));

/** How many items may be queued here at once. */
export const queueCapacity = (d: District): number =>
  levelIndexed(DISTRICTS[d.definitionId].queueLengthPerLevel, d.level);

/** The line, created on first use so a district carries no state until it
 *  is actually used as a workshop. */
export function lineOf(state: GameState, d: District, now: number): WorkshopLine {
  const existing = state.city.workshops[d.uniqueId];
  if (existing) return existing;
  const fresh: WorkshopLine = { items: [], anchor: now };
  state.city.workshops[d.uniqueId] = fresh;
  return fresh;
}

/** Items being worked right now: one per villager, front of the queue first. */
const inProgress = (d: District, line: WorkshopLine): number =>
  Math.min(d.assignedWorkers, line.items.length);

const needMs = (item: WorkshopItem): number => GOODS[item.good].workSeconds * 1000;

/**
 * Fold elapsed time into the work done, up to `t`.
 *
 * With `n` workers over `k` items each item gains `n / k` worker-seconds a
 * second. Kept exact by advancing the anchor in whole `k`-ms chunks: each
 * chunk is `n` worker-ms per item, an integer, and the leftover stays on the
 * anchor for the next call — so it does not matter how the caller stepped.
 */
export function settle(state: GameState, d: District, t: number): void {
  const line = state.city.workshops[d.uniqueId];
  if (!line) return;
  const k = inProgress(d, line);
  if (k === 0 || t <= line.anchor) return;
  const chunks = Math.floor((t - line.anchor) / k);
  if (chunks <= 0) return;
  const gained = chunks * d.assignedWorkers;
  for (let i = 0; i < k; i++) {
    line.items[i].workMs = Math.min(line.items[i].workMs + gained, needMs(line.items[i]));
  }
  line.anchor += chunks * k;
}

/** Settle, then re-anchor — for the moments the RATE changes: a villager
 *  arriving or leaving, an item queued, cancelled or finished. */
export function reanchor(state: GameState, d: District, now: number): void {
  settle(state, d, now);
  const line = state.city.workshops[d.uniqueId];
  if (line) line.anchor = now;
}

/** Every workshop's crew, run between boundaries. Production, so the 8-hour
 *  offline cap applies to it exactly as it does to a Sawmill's crew. */
export function advanceWorkshops(state: GameState, toTime: number): void {
  for (const d of workshops(state)) settle(state, d, toTime);
}

/** A good delivered to the stockpile. */
export interface GoodMade {
  districtUniqueId: string;
  good: GoodId;
}

/** Hand over everything finished. Discrete work: it runs at the boundary. */
export function completeWorkshopItems(state: GameState, t: number): GoodMade[] {
  const made: GoodMade[] = [];
  for (const d of workshops(state)) {
    const line = state.city.workshops[d.uniqueId];
    if (!line) continue;
    settle(state, d, t);
    let finished = false;
    while (line.items.length > 0 && line.items[0].workMs >= needMs(line.items[0])) {
      const item = line.items.shift()!;
      addGood(state.city.goods, item.good, 1);
      made.push({ districtUniqueId: d.uniqueId, good: item.good });
      finished = true;
    }
    // One finishing changes how the crew spreads over what is left.
    if (finished) line.anchor = t;
  }
  return made;
}

/** When the next good is ready anywhere in the city, or null. */
export function nextWorkshopCompletion(state: GameState, after: number): number | null {
  let soonest: number | null = null;
  for (const d of workshops(state)) {
    const line = state.city.workshops[d.uniqueId];
    if (!line) continue;
    const k = inProgress(d, line);
    if (k === 0) continue;
    for (let i = 0; i < k; i++) {
      const item = line.items[i];
      const remaining = needMs(item) - item.workMs;
      // `chunks` whole k-ms steps, each worth `n` worker-ms, must cover it.
      const chunks = Math.max(0, Math.ceil(remaining / d.assignedWorkers));
      const at = line.anchor + chunks * k;
      if (at > after && (soonest === null || at < soonest)) soonest = at;
    }
  }
  return soonest;
}

// ------------------------------------------------------------------ commands

export type QueueGoodResult =
  | 'Queued' | 'NotAWorkshop' | 'NotBuilt' | 'QueueFull'
  | 'NotEnoughResources' | 'NotEnoughGoods' | 'NotEnoughMana';

/** What one item of this workshop's good consumes. */
export const recipeOf = (d: District) => GOODS[DISTRICTS[d.definitionId].produces!];

export function queueGood(
  state: GameState,
  districtUniqueId: string,
  now: number,
): QueueGoodResult {
  const d = districtById(state, districtUniqueId);
  if (!d || !isWorkshop(d)) return 'NotAWorkshop';
  if (d.state !== 'Built') return 'NotBuilt';
  const line = lineOf(state, d, now);
  if (line.items.length >= queueCapacity(d)) return 'QueueFull';

  const recipe = recipeOf(d);
  const goodCost = recipe.inputGood === null
    ? {} : { [recipe.inputGood]: recipe.inputGoodAmount };
  if (!canAfford(state.city.wallet, recipe.input)) return 'NotEnoughResources';
  if (!canAffordGoods(state.city.goods, goodCost)) return 'NotEnoughGoods';
  if (recipe.inputMana > 0 && !canPayMana(state, recipe.inputMana)) return 'NotEnoughMana';

  // Paid on QUEUEING, not on starting: the player has committed the materials the
  // moment they ask for the item, and a queue that reserved nothing would let
  // one workshop's queue promise resources another already spent.
  pay(state.city.wallet, recipe.input);
  payGoods(state.city.goods, goodCost);
  if (recipe.inputMana > 0) payMana(state, recipe.inputMana);

  reanchor(state, d, now);
  line.items.push({ good: recipe.id, workMs: 0 });
  return 'Queued';
}

/**
 * Seconds of wall clock left on the item being worked, at the crew's current
 * rate. What the rush is priced on — the same rule as a build or a training
 * line: Gems buy the TIME that is left, not the item.
 */
export function itemRemainingSeconds(state: GameState, d: District, now: number): number | null {
  const line = state.city.workshops[d.uniqueId];
  if (!line) return null;
  const k = inProgress(d, line);
  if (k === 0) return null;
  settle(state, d, now);
  const remaining = needMs(line.items[0]) - line.items[0].workMs;
  return Math.max(0, (remaining * k) / d.assignedWorkers) / 1000;
}

export const itemRushCost = (state: GameState, d: District, now: number): number | null => {
  const seconds = itemRemainingSeconds(state, d, now);
  return seconds === null ? null : Math.max(1, Math.ceil(seconds / RUSH.secondsPerGem));
};

export type RushItemResult = 'Success' | 'NothingWorking' | 'NotEnoughGems';

/** Finish the item in progress. Only that one: the queue behind it is not for
 *  sale, and neither is a worker slot. */
export function finishItemWithGems(
  state: GameState,
  districtUniqueId: string,
  now: number,
): RushItemResult {
  const d = districtById(state, districtUniqueId);
  if (!d || !isWorkshop(d)) return 'NothingWorking';
  const cost = itemRushCost(state, d, now);
  if (cost === null) return 'NothingWorking';
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  const line = state.city.workshops[d.uniqueId]!;
  line.items[0].workMs = needMs(line.items[0]);
  return 'Success';
}

export type CancelItemResult = 'Cancelled' | 'NotAWorkshop' | 'NoSuchItem';

/** Cancel a queued item and refund it in full, the way cancelling a build
 *  does. The work already done is lost; the materials never are. */
export function cancelWorkshopItem(
  state: GameState,
  districtUniqueId: string,
  index: number,
  now: number,
): CancelItemResult {
  const d = districtById(state, districtUniqueId);
  if (!d || !isWorkshop(d)) return 'NotAWorkshop';
  const line = state.city.workshops[districtUniqueId];
  if (!line || index < 0 || index >= line.items.length) return 'NoSuchItem';
  reanchor(state, d, now);
  const [item] = line.items.splice(index, 1);
  const recipe = GOODS[item.good];
  refund(state.city.wallet, recipe.input);
  if (recipe.inputGood !== null) {
    refundGoods(state.city.goods, { [recipe.inputGood]: recipe.inputGoodAmount });
  }
  if (recipe.inputMana > 0) grantMana(state, recipe.inputMana);
  return 'Cancelled';
}
