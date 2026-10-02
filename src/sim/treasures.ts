// The fog's treasures: what the people who fled left on the ground
// (Docs/features/01-map-and-fog.md §6.2).
//
// A PACE, NOT A PLACE. A treasure is due every `everyReveals` cells the
// player pays to reveal — the first on the very first — and it lands in a
// cell that reveal has just DISCOVERED. So it is seen as a closed chest beside
// the frontier, a thing to go and get, at the same pace whichever way the
// player explores. The map authors none of them.
//
// RANDOMNESS BY THE TREASURE'S OWN ORDINAL. Which of the candidate cells it
// takes and which coin it is are `rand(seed, 'treasure', n, …)`: the n-th
// treasure of a kingdom is the same treasure however the reveals before it
// were grouped (Docs/implementation-plan.md §1, invariant 4).
//
// WHAT IT PAYS IS PRICED WHEN IT IS PICKED UP, in seconds of the kingdom's
// own production of its coin (`tap.workSeconds`'s rule), floored. Nothing
// here is time-based: a treasure waits for ever, so it needs no boundary.

import { HARVEST, TREASURE } from './data/definitions';
import { cityGoldPerSecond } from './collection';
import { explorationGate, fogState, isPayable } from './fog';
import { footprintCells, neighbors, type MapData } from './grid';
import { recordEvent } from './events';
import { payKnowledge } from './knowledge';
import { activeQuest } from './quests';
import { rand } from './rng';
import { cellHasSite } from './sites';
import { isTechComplete } from './research';
import {
  addToWallet, coordKey, getWallet, type Coord, type CurrencyId, type GameState, type Wallet,
} from './state';
import { cityGatherPerSecond } from './upgrades';

/** Is a treasure owed and not yet placed? One is owed on the first paid
 *  reveal and every `everyReveals` after it. */
export const treasureDue = (state: GameState): boolean =>
  state.fog.paidReveals > 0
  && state.fog.treasuresPlaced < 1 + Math.floor((state.fog.paidReveals - 1) / TREASURE.everyReveals);

/** The treasure waiting on this cell, or undefined. */
export const treasureAt = (state: GameState, cell: Coord) =>
  state.fog.treasures[coordKey(cell)];

/**
 * Can a treasure land here? A cell the player could pay for right now —
 * Discovered, touching their ground, inside the Townhall's reach, dry unless
 * Sailing is known — and not under a site or a block that spans cells.
 */
function canHold(state: GameState, map: MapData, cell: Coord): boolean {
  const key = coordKey(cell);
  if (!map.terrain.has(key)) return false;
  if (state.fog.treasures[key] !== undefined) return false;
  if (fogState(state, map, cell) !== 'Discovered') return false;
  if (!isPayable(state, map, cell)) return false;
  const gate = explorationGate(map, cell);
  if (gate !== null && !isTechComplete(state, gate)) return false;
  if (cellHasSite(state, cell)) return false;
  return footprintCells(map, cell).length === 1;
}

/** Is Stone on the plank yet: held, or its harvest open. The plank's own
 *  rule (game.ts `visibleCurrencies`), read off the state. */
function stoneShown(state: GameState): boolean {
  if (getWallet(state.city.wallet, 'Stone') > 0) return true;
  return Object.values(HARVEST).some((h) => h.currencyId === 'Stone'
    && h.requiredTech !== null && isTechComplete(state, h.requiredTech));
}

/** Which coin the n-th treasure is: the first is authored, the rest weighed
 *  by `weights` among the coins the player can already read. */
function coinFor(state: GameState, n: number): CurrencyId {
  if (n === 0) return TREASURE.firstCoin;
  const pool = (Object.entries(TREASURE.weights) as Array<[CurrencyId, number]>)
    .filter(([c, w]) => w > 0 && (c !== 'Stone' || stoneShown(state)));
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand(state.seed, 'treasure', n, 'coin') * total;
  for (const [c, w] of pool) {
    if (roll < w) return c;
    roll -= w;
  }
  return pool[pool.length - 1]?.[0] ?? 'Gold';
}

/**
 * A paid reveal landed: count its cells, and place the treasure it brings due.
 *
 * `fresh` is what the reveal DISCOVERED — the neighbours that were
 * Undiscovered before it — and the treasure prefers one of them, so it is
 * seen arriving. Failing that it takes another Discovered neighbour of the
 * ground just revealed; failing that it waits for the next paid reveal. One
 * reveal places one treasure at most.
 */
export function onPaidReveal(state: GameState, map: MapData, revealed: readonly Coord[], fresh: readonly Coord[]): void {
  state.fog.paidReveals += revealed.length;
  // A playtest signal: fog paid for with no quest asking for it — exploring
  // for its own sake (Docs/playtest.md §5).
  const asked = activeQuest(state)?.goalType;
  if (asked !== 'DiscoverCells' && asked !== 'DiscoverFeature' && asked !== 'FindLairs'
    && asked !== 'ClaimLandmarks') {
    recordEvent(state, { kind: 'signal', key: 'revealUnasked' });
  }
  if (!treasureDue(state)) return;
  const byKey = (cells: Iterable<Coord>) => [...new Map([...cells].map((c) => [coordKey(c), c])).entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, c]) => c)
    .filter((c) => canHold(state, map, c));
  // Bare ground first: a chest set down in a wood is a chest the trees hide.
  const bareFirst = (cells: Coord[]): Coord[] => {
    const bare = cells.filter((c) => state.features[coordKey(c)] === undefined);
    return bare.length > 0 ? bare : cells;
  };
  let candidates = bareFirst(byKey(fresh));
  if (candidates.length === 0) candidates = bareFirst(byKey(revealed.flatMap((c) => neighbors(map, c))));
  if (candidates.length === 0) return;
  const n = state.fog.treasuresPlaced;
  const at = candidates[Math.floor(rand(state.seed, 'treasure', n, 'cell') * candidates.length)];
  state.fog.treasures[coordKey(at)] = { n, coin: coinFor(state, n), at: state.lastAdvance };
  state.fog.treasuresPlaced = n + 1;
  recordEvent(state, { kind: 'signal', key: 'treasurePlaced' });
}

/** The neighbours of a block that are Undiscovered right now — read BEFORE a
 *  reveal, so after it they are exactly what it discovered. */
export function undiscoveredAround(state: GameState, map: MapData, block: readonly Coord[]): Coord[] {
  const inBlock = new Set(block.map(coordKey));
  return block.flatMap((c) => neighbors(map, c))
    .filter((c) => !inBlock.has(coordKey(c)) && fogState(state, map, c) === 'Undiscovered');
}

/** What the treasure on this cell would pay if it were picked up now. */
export function treasureReward(state: GameState, treasure: { n: number; coin: CurrencyId; at?: number }): Wallet {
  const { n, coin } = treasure;
  if (n === 0) return { [TREASURE.firstCoin]: TREASURE.firstAmount };
  if (coin === 'Knowledge') return { Knowledge: TREASURE.knowledge };
  const rate = coin === 'Gold' ? cityGoldPerSecond(state) : cityGatherPerSecond(state, coin);
  const floor = TREASURE.floor[coin] ?? 0;
  return { [coin]: Math.max(floor, Math.round(rate * TREASURE.workSeconds)) };
}

export type PickUpResult = { kind: 'PickedUp'; reward: Wallet } | { kind: 'None' } | { kind: 'Hidden' };

/**
 * Pick up the treasure on a revealed cell. Free: a find is not work, so it
 * draws no Mana, the way a store is collected free.
 */
export function pickUpTreasure(state: GameState, map: MapData, cell: Coord): PickUpResult {
  const key = coordKey(cell);
  const treasure = state.fog.treasures[key];
  if (treasure === undefined) return { kind: 'None' };
  if (fogState(state, map, cell) !== 'Revealed') return { kind: 'Hidden' };
  const reward = treasureReward(state, treasure);
  for (const [coin, amount] of Object.entries(reward) as Array<[CurrencyId, number]>) {
    if (coin === 'Knowledge') payKnowledge(state, amount);
    else addToWallet(state.city.wallet, coin, amount);
  }
  delete state.fog.treasures[key];
  state.signals.treasureWaitMs += Math.max(0, state.lastAdvance - treasure.at);
  recordEvent(state, { kind: 'signal', key: 'treasurePicked' });
  return { kind: 'PickedUp', reward };
}
