// Explorers and the world fog (Docs/features/19-world-map.md §3).
//
// An explorer is a SLOT, like a builder: Cartography opens the first and the
// Atlas adds more. Sent to a hex, it takes the quickest way there through
// explored ground (sim/world/travel.ts), works at it — longer the further it
// lies from the city — and only then reveals it and the hexes round it, and
// walks home the way it came. It never fights and can never be stopped, so
// it lives here, in the player's own save.
//
// THE REVEAL IS COMPUTED, NOT STEPPED. A trip is priced when it leaves —
// path, pace, work, radius — so what it has revealed at `t` is a pure
// function of the trip and `t`, and nothing in the sim needs a boundary for
// it. A trip has exactly ONE boundary, the moment it is home, when its
// reveal is folded into the stored bitset and its slot frees. An absence of
// any length adds at most one boundary per explorer, because nothing ever
// sends one out again on its own (CLAUDE.md, invariant 1).

import { WORLD } from '../data/definitions';
import { gemsToFinish } from '../rush';
import { resolve } from '../modifiers';
import { isTechComplete } from '../research';
import { randInt } from '../rng';
import {
  getWallet, newId, type ExplorerTrip, type GameState, type WorldBuild, type WorldState,
} from '../state';
import { techFlat, techMultiplier } from '../techEffects';
import { SEAT_INDICES } from './board';
import { clearBit, copyBits, countBits, emptyBits, hasBit, setBit, type HexBits } from './fogBits';
import { PORTAL_INDEX, boardNeighbors, boardWithin, hexAt, hexDistance, isBoardIndex } from './hex';
import { boardOf } from './source';
import { payScout, type ScoutPay } from './scouting';
import { fastestRoute, homeboundMs, outboundMs, type Route } from './travel';

/** A new kingdom's world: a board and a seat derived from the kingdom's own
 *  seed — the stand-in for "the first board with a free city, on its first
 *  free corner, assigned at random" until the server assigns one. */
export function freshWorld(seed: number): WorldState {
  const boardSeed = randInt(seed, 0x1_0000_0000, 'world', 'board');
  return {
    board: { id: `local-${boardSeed.toString(36)}`, seed: boardSeed, seat: randInt(seed, 6, 'world', 'seat') },
    revealed: emptyBits(),
    explorers: [],
    builds: [],
    sanctuaries: 0,
    armies: [],
  };
}

/** The player's city hex, as a board index. */
export const homeIndex = (state: GameState): number => SEAT_INDICES[state.world.board.seat] ?? SEAT_INDICES[0];

// ----------------------------------------------------------- the numbers

/** How many explorers can be out at once: Cartography's, plus the Atlas
 *  ladder's. Zero until Cartography is researched. */
export function explorerSlots(state: GameState): number {
  const base = isTechComplete(state, 'Cartography') ? WORLD.cartographyExplorers : 0;
  return base + Math.max(0, Math.floor(techFlat(state, 'explorerSlots')));
}

export const freeExplorers = (state: GameState): number =>
  Math.max(0, explorerSlots(state) - state.world.explorers.length);

/** Hexes an explorer reveals round each hex of its path. */
export function revealRadius(state: GameState): number {
  const radius = WORLD.explorerRevealRadius + Math.floor(techFlat(state, 'worldRevealRadius'));
  return Math.min(WORLD.revealRadiusMax, Math.max(1, radius));
}

/** How much faster an explorer marches over every hex: `worldRevealSpeed`
 *  (a speed — it never slows a march). */
export const explorerSpeed = (state: GameState): number =>
  // The tree at the base stage (`explorerSpeed`), the hero's boon on top.
  Math.max(1, resolve(state, 'worldRevealSpeed', techMultiplier(state, 'explorerSpeed')));

/**
 * The quickest way an explorer can take to a hex: through Revealed ground
 * only, every hex adding its own time as it is left (sim/world/travel.ts).
 * The destination may be any hex the player has at least Sensed — that is
 * what an explorer goes to see. Null when there is no way.
 */
export function explorerRoute(state: GameState, target: number, now: number): Route | null {
  if (!isBoardIndex(target)) return null;
  const fog = worldFogAt(state, now);
  if (fogStateOf(state, target, now, fog) === 'Unknown') return null;
  const speed = explorerSpeed(state);
  return fastestRoute(boardOf(state.world.board).hexes, homeIndex(state), target, 'explorer', (i) => hasBit(fog, i), () => speed);
}

/** How long an explorer works at a hex before it is revealed: a base, and
 *  more for every hex it lies from the city. */
export const exploreWorkMs = (state: GameState, target: number): number =>
  (WORLD.exploreWorkSeconds + WORLD.exploreWorkSecondsPerHex * hexDistance(hexAt(homeIndex(state)), hexAt(target))) * 1000;

/** Gold to send an explorer to a hex, paid when it leaves: dearer the
 *  further the hex lies from the city. */
export const exploreGold = (state: GameState, target: number): number =>
  Math.round(WORLD.exploreGoldBase
    * WORLD.exploreGoldGrowth ** Math.max(0, hexDistance(hexAt(homeIndex(state)), hexAt(target)) - 1));

// ------------------------------------------------------------- a trip

export const arrivesAt = (trip: ExplorerTrip): number => trip.departedAt + outboundMs(trip.stepMs);

/** When its work is done and the hex is revealed. */
export const revealsAt = (trip: ExplorerTrip): number => arrivesAt(trip) + trip.workMs;

export const returnsAt = (trip: ExplorerTrip): number => revealsAt(trip) + homeboundMs(trip.stepMs);

/** The target and the hexes round it, once the work there is done. */
function revealInto(bits: HexBits, trip: ExplorerTrip): void {
  for (const i of boardWithin(trip.target, trip.radius)) setBit(bits, i);
}

// --------------------------------------------------------------- the fog

export type FogState = 'Revealed' | 'Sensed' | 'Unknown';

/** Every hex the player can see at `t`: the folded bitset, the city and the
 *  Portal, and whatever the explorers out have reached so far. */
export function worldFogAt(state: GameState, t: number): HexBits {
  const bits = copyBits(state.world.revealed);
  setBit(bits, homeIndex(state));
  setBit(bits, PORTAL_INDEX);
  for (const trip of state.world.explorers) if (t >= revealsAt(trip)) revealInto(bits, trip);
  return bits;
}

/**
 * A hex is Revealed if the player can see it, Sensed if it is next to a hex
 * the player revealed, and Unknown otherwise. The Portal, revealed for
 * everyone, senses nothing (19 §3).
 */
export function fogStateOf(state: GameState, index: number, t: number, fog: HexBits = worldFogAt(state, t)): FogState {
  if (hasBit(fog, index)) return 'Revealed';
  const sensed = boardNeighbors(index).some((n) => n !== PORTAL_INDEX && hasBit(fog, n));
  return sensed ? 'Sensed' : 'Unknown';
}

// ------------------------------------------------------------ commands

export type DispatchResult =
  | { kind: 'Sent'; trip: ExplorerTrip }
  | { kind: 'OffBoard' }
  | { kind: 'Home' }
  /** Already Revealed: there is nothing left there to explore. */
  | { kind: 'Explored' }
  /** An explorer out already will reveal it. */
  | { kind: 'BeingExplored'; trip: ExplorerTrip }
  | { kind: 'NoCartography' }
  | { kind: 'NoExplorerFree'; nextFreeAt: number }
  /** No way there through explored ground. */
  | { kind: 'NoRoute' }
  | { kind: 'NotEnoughGold'; gold: number };

/** Send an explorer to a hex. Everything about the trip is priced now. */
export function dispatchExplorer(state: GameState, target: number, now: number): DispatchResult {
  if (!isBoardIndex(target)) return { kind: 'OffBoard' };
  const home = homeIndex(state);
  if (target === home) return { kind: 'Home' };
  if (fogStateOf(state, target, now) === 'Revealed') return { kind: 'Explored' };
  const already = tripRevealing(state, target);
  if (already !== null) return { kind: 'BeingExplored', trip: already };
  if (explorerSlots(state) === 0) return { kind: 'NoCartography' };
  if (freeExplorers(state) === 0) {
    return { kind: 'NoExplorerFree', nextFreeAt: Math.min(...state.world.explorers.map(returnsAt)) };
  }
  const route = explorerRoute(state, target, now);
  if (route === null) return { kind: 'NoRoute' };
  const gold = exploreGold(state, target);
  if (getWallet(state.city.wallet, 'Gold') < gold) return { kind: 'NotEnoughGold', gold };
  state.city.wallet.Gold = getWallet(state.city.wallet, 'Gold') - gold;
  const trip: ExplorerTrip = {
    id: newId(state, 'explorer'),
    target,
    path: route.path,
    departedAt: now,
    stepMs: route.stepMs,
    workMs: exploreWorkMs(state, target),
    radius: revealRadius(state),
  };
  state.world.explorers.push(trip);
  return { kind: 'Sent', trip };
}

// ------------------------------------------------------------ advance()

/** The next explorer home strictly after `after`, or null. */
export function nextExplorerReturn(state: GameState, after: number): number | null {
  let next: number | null = null;
  for (const trip of state.world.explorers) {
    const at = returnsAt(trip);
    if (at > after && (next === null || at < next)) next = at;
  }
  return next;
}

// --------------------------------------------------- builders on the board

/** The next world build a builder finishes strictly after `after`, or null.
 *  A TIMER priced when the server accepted it: the builder comes home then. */
export function nextWorldBuildDone(state: GameState, after: number): number | null {
  let next: number | null = null;
  for (const b of state.world.builds) if (b.finishesAt > after && (next === null || b.finishesAt < next)) next = b.finishesAt;
  return next;
}

/** Free the builders whose world build is done by `t`; what they finished. */
export function finishWorldBuilds(state: GameState, t: number): WorldBuild[] {
  const done = state.world.builds.filter((b) => b.finishesAt <= t);
  if (done.length > 0) state.world.builds = state.world.builds.filter((b) => b.finishesAt > t);
  return done.sort((a, b) => a.finishesAt - b.finishesAt || a.index - b.index);
}

/** An explorer that came home, how many hexes its trip added to the fog,
 *  and what its target's promise paid (19 §3.2) — null when the target was
 *  already revealed, or promised nothing. */
export interface ExplorerHome { id: string; target: number; revealed: number; paid: ScoutPay | null }

/** Fold every trip home by `t` into the stored fog and free its slot, in
 *  the order they came home. */
export function returnExplorers(state: GameState, t: number): ExplorerHome[] {
  const due = state.world.explorers
    .filter((trip) => returnsAt(trip) <= t)
    .sort((a, b) => returnsAt(a) - returnsAt(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (due.length === 0) return [];
  const out = due.map((trip) => foldHome(state, trip));
  const home = new Set(due.map((trip) => trip.id));
  state.world.explorers = state.world.explorers.filter((trip) => !home.has(trip.id));
  return out;
}

/** A trip's reveal, folded into the stored fog. */
function foldHome(state: GameState, trip: ExplorerTrip): ExplorerHome {
  const before = countBits(state.world.revealed);
  // Its target pays its promise, once: only if the stored fog had not
  // revealed it yet.
  const fresh = !hasBit(state.world.revealed, trip.target) && trip.target !== homeIndex(state) && trip.target !== PORTAL_INDEX;
  revealInto(state.world.revealed, trip);
  // The city and the Portal are always revealed; they are never stored.
  clearBit(state.world.revealed, homeIndex(state));
  clearBit(state.world.revealed, PORTAL_INDEX);
  const paid = fresh ? payScout(state, boardOf(state.world.board).hexes[trip.target]) : null;
  return { id: trip.id, target: trip.target, revealed: countBits(state.world.revealed) - before, paid };
}

/** The trip out that will reveal a hex — sent to it, or to a hex beside it
 *  within its reach — or null. */
export function tripRevealing(state: GameState, index: number): ExplorerTrip | null {
  return state.world.explorers.find((trip) => trip.target === index)
    ?? state.world.explorers.find((trip) => boardWithin(trip.target, trip.radius).includes(index))
    ?? null;
}

/** Gems to bring a trip home now, its reveal done: the time it has left, at
 *  the build queue's rate (`rush.secondsPerGem`) — one rule for buying time,
 *  wherever the player meets it. */
export const explorerRushCost = (trip: ExplorerTrip, now: number): number =>
  gemsToFinish((returnsAt(trip) - now) / 1000);

export type FinishExplorerResult =
  | { kind: 'Finished'; home: ExplorerHome }
  | { kind: 'NotFound' }
  | { kind: 'NotEnoughGems'; gems: number };

/** Finish a trip with Gems: what it would reveal is revealed now, and the
 *  explorer is home, its slot free. */
export function finishExplorerWithGems(state: GameState, tripId: string, now: number): FinishExplorerResult {
  const trip = state.world.explorers.find((t) => t.id === tripId);
  if (trip === undefined) return { kind: 'NotFound' };
  const gems = explorerRushCost(trip, now);
  if (getWallet(state.player.wallet, 'Gems') < gems) return { kind: 'NotEnoughGems', gems };
  state.player.wallet.Gems = getWallet(state.player.wallet, 'Gems') - gems;
  // Out of the list FIRST, so an advance cannot bring it home twice.
  state.world.explorers = state.world.explorers.filter((t) => t !== trip);
  return { kind: 'Finished', home: foldHome(state, trip) };
}
