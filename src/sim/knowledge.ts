// The Knowledge bar (Docs/features/07-research.md §3).
//
// Knowledge is what research is paid in, and it arrives four ways:
//
//  * THE DRIP — `KNOWLEDGE.basePerHour`, fixed for the whole game, while the
//    kingdom holds less than `KNOWLEDGE.cap`. Nothing raises the rate or the
//    cap: territory, buildings and technologies pay lumps instead.
//  * LUMPS — a landmark claimed, a ruin cleared to its bottom, a ruin room, a
//    quest. Every lump passes through `knowledgeLump`, which is where
//    Scriptorium and the `knowledgeYield` stack scale it. A lump always lands
//    in full, over the cap if it must.
//  * GOLD — the nth point ever bought with Gold costs n × `goldPriceBase`, and
//    the count never resets.
//  * GEMS — a fixed price a point.
//
// THE CAP STOPS THE DRIP, NOT THE CLOCK. Over the cap the anchor keeps moving
// and banks nothing, the same as a full Mana pool (mana.ts): the units are
// computed, the anchor advances, and only what fits under the cap is paid. Do
// NOT snap the anchor to `toTime` when the bar is full — a window that crosses
// the cap would then end on a different instant under one-call replay than
// under stepped ticking (invariant 1).
//
// THE DRIP IGNORES THE OFFLINE CAP. It is production, but the bar already
// bounds it: ten hours away fills it, and cutting it at eight would mean a
// bar that never fills overnight (invariant 2 — save.ts's capped replay
// leaves `lastKnowledgeAt` alone so the uncapped tail pays it).

import { DELVE, KNOWLEDGE, RUINS } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { resolve } from './modifiers';
import { isTechComplete } from './research';
import { techFlat, techValue } from './techEffects';
import {
  addToWallet, getWallet, type GameState, type RuinId,
} from './state';

export const knowledgeHeld = (state: GameState): number =>
  getWallet(state.kingdom.wallet, 'Knowledge');

/** The bar's cap. The drip stops at it; nothing else does. */
export const knowledgeCap = (): number => KNOWLEDGE.cap;

/** The drip, an hour, while the bar is under its cap. */
export const knowledgePerHour = (): number => KNOWLEDGE.basePerHour;

/** A whole-millisecond period, so the anchor only ever moves by integer
 *  multiples of it and one-call replay and stepped ticking agree to the bit. */
const msPerPoint = (): number => Math.max(1, Math.round(3_600_000 / knowledgePerHour()));

/** Pay Knowledge into the kingdom, over the cap if it must. */
export function payKnowledge(state: GameState, amount: number): number {
  if (amount <= 0) return 0;
  addToWallet(state.kingdom.wallet, 'Knowledge', amount);
  recordResourceDiscovery(state, 'Knowledge');
  return amount;
}

/**
 * Accrue whole points of the drip against `lastKnowledgeAt`.
 *
 * Runs in `runContinuous`. The clock is consumed whether or not the bar has
 * room; what arrives over the cap is simply not paid.
 */
export function accrueKnowledge(state: GameState, toTime: number): number {
  if (knowledgePerHour() <= 0) {
    state.kingdom.lastKnowledgeAt = Math.max(state.kingdom.lastKnowledgeAt, toTime);
    return 0;
  }
  const msPer = msPerPoint();
  const units = Math.floor((toTime - state.kingdom.lastKnowledgeAt) / msPer);
  if (units <= 0) return 0;
  state.kingdom.lastKnowledgeAt += units * msPer;
  const room = Math.max(0, knowledgeCap() - knowledgeHeld(state));
  return payKnowledge(state, Math.min(units, room));
}

/** Ms until the drip pays its next point, or null when the bar is full. */
export function msToNextKnowledge(state: GameState, now: number): number | null {
  if (knowledgePerHour() <= 0 || knowledgeHeld(state) >= knowledgeCap()) return null;
  const msPer = msPerPoint();
  const elapsed = Math.max(0, now - state.kingdom.lastKnowledgeAt);
  return msPer - (elapsed % msPer);
}

/** Ms until the bar is full, 0 when it already is, null when nothing drips. */
export function msToFullKnowledge(state: GameState, now: number): number | null {
  const short = knowledgeCap() - knowledgeHeld(state);
  if (short <= 0) return 0;
  const next = msToNextKnowledge(state, now);
  if (next === null) return null;
  return next + (short - 1) * msPerPoint();
}

// ------------------------------------------------------------------ lumps

/**
 * Every lump of Knowledge passes through here: the ranks' `knowledgeYield`
 * percent, then the modifier stack (a Legendary's boon). Never the drip, never
 * a purchase.
 */
export const knowledgeLump = (state: GameState, raw: number): number =>
  raw <= 0 ? 0 : Math.max(0, Math.round(
    resolve(state, 'knowledgeYield', techValue(state, 'knowledgeYield', raw))));

/** What claiming one landmark pays: the lump, plus Wayposts. */
export const landmarkClaimLump = (state: GameState): number =>
  knowledgeLump(state, KNOWLEDGE.landmarkClaimLump + techFlat(state, 'landmarkClaimKnowledge'));

/** What clearing one ruin to its bottom pays: the lump, Vigils and Conquest
 *  on top, and Sanctified Ruins doubling the whole of it. */
export const firstClearLump = (state: GameState): number =>
  knowledgeLump(state,
    (DELVE.firstClearKnowledge
      + techFlat(state, 'firstClearKnowledge')
      + (isTechComplete(state, 'Conquest') ? KNOWLEDGE.conquestFirstClearLump : 0))
    * (isTechComplete(state, 'SanctifiedRuins') ? 2 : 1));

/** What a ruin room pays, from the room's own reward scale — at least 1. */
export const roomKnowledge = (state: GameState, scale: number): number =>
  Math.max(1, knowledgeLump(state, Math.max(1, Math.round(KNOWLEDGE.roomCoef * scale))));

const claimedLandmarks = (state: GameState): number =>
  Object.values(state.landmarks.claimed).filter((c) => c === true).length;

const clearedRuins = (state: GameState): number =>
  (Object.keys(RUINS) as RuinId[]).filter((id) => state.ruinsCleared[id] === true).length;

/**
 * What the ground already held is worth in lumps, at today's prices.
 *
 * A technology that raises a lump pays its raise BACK for every site already
 * claimed or cleared (07-research.md §3): researching it late must never cost
 * what researching it early would have paid. So the research command reads
 * this before and after a technology lands and pays the difference.
 */
export const territoryKnowledge = (state: GameState): number =>
  claimedLandmarks(state) * landmarkClaimLump(state)
  + clearedRuins(state) * firstClearLump(state);

// --------------------------------------------------------------- buying it

/** Gold for the next `count` points: the nth point ever bought costs
 *  n × base, and the count never resets. */
export function knowledgeGoldPrice(state: GameState, count: number): number {
  if (count <= 0) return 0;
  const n = state.kingdom.knowledgeBoughtWithGold;
  // base × ((n+1) + … + (n+count))
  return KNOWLEDGE.goldPriceBase * (count * (2 * n + count + 1)) / 2;
}

/** Gems for `count` points. Never rises. */
export const knowledgeGemPrice = (count: number): number =>
  Math.max(0, count) * KNOWLEDGE.gemsPerPoint;

export type KnowledgeTill = 'Gold' | 'Gems';
export type BuyKnowledgeResult = 'Bought' | 'NothingToBuy' | 'NotEnoughGold' | 'NotEnoughGems';

/** Buy `count` points into the bar, over the cap if it must. */
export function buyKnowledge(state: GameState, count: number, till: KnowledgeTill): BuyKnowledgeResult {
  if (!Number.isInteger(count) || count <= 0) return 'NothingToBuy';
  if (till === 'Gold') {
    const price = knowledgeGoldPrice(state, count);
    if (getWallet(state.city.wallet, 'Gold') < price) return 'NotEnoughGold';
    addToWallet(state.city.wallet, 'Gold', -price);
    state.kingdom.knowledgeBoughtWithGold += count;
  } else {
    const price = knowledgeGemPrice(count);
    if (getWallet(state.player.wallet, 'Gems') < price) return 'NotEnoughGems';
    addToWallet(state.player.wallet, 'Gems', -price);
  }
  payKnowledge(state, count);
  return 'Bought';
}
