// Explorers and the world fog (Docs/features/19-world-map.md §3).
//
// An explorer is a SLOT, like a builder: every kingdom starts with one and
// the Atlas adds more. Sent to a hex, it takes the quickest way there through
// explored ground (sim/world/travel.ts) and works at it — longer the further
// it lies from the city. Then it WAITS THERE for the player: nothing is
// revealed and nothing is paid until the player taps the hex
// (`revealExplored`), and only then does it walk home the way it came. It
// never fights and can never be stopped, so it lives here, in the player's
// own save.
//
// A TRIP IS PRICED WHEN IT LEAVES — path, pace, work, radius — so where it is
// at `t` is a pure function of the trip and `t`. Its work being done is a
// state read off the clock, not a boundary: nothing changes in the sim then.
// A trip has exactly ONE boundary, the moment it is home after its reveal,
// when its slot frees. An absence of any length adds at most one boundary per
// explorer, because nothing ever sends one out or reveals on its own
// (CLAUDE.md, invariant 1).

import { roundPrice } from '../roundPrice';
import { WORLD } from '../data/definitions';
import { gemsToFinish } from '../rush';
import { resolve } from '../modifiers';
import { randInt } from '../rng';
import { track } from '../analytics';
import {
  addToWallet, getWallet, newId, type ExplorerTrip, type GameState, type WorldBuild, type WorldState,
} from '../state';
import { techFlat, techMultiplier } from '../techEffects';
import { SEAT_INDICES } from './board';
import { clearBit, copyBits, countBits, emptyBits, hasBit, setBit, type HexBits } from './fogBits';
import { BOARD_SIZE, PORTAL_INDICES, boardNeighbors, boardWithin, hexAt, hexDistance, isBoardIndex } from './hex';
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
    explorersBought: 0,
    tripsSent: 0,
    builds: [],
    sanctuaries: 0,
    chapels: [],
    armies: [],
    effectSeq: 0,
    portalAnnounced: 0,
    portalPrizes: [],
  };
}

/** The player's city hex, as a board index. */
export const homeIndex = (state: GameState): number => SEAT_INDICES[state.world.board.seat] ?? SEAT_INDICES[0];

// ----------------------------------------------------------- the numbers

/** How many explorers can be out at once: the kingdom's own from the start,
 *  plus the Atlas ladder's, plus the ones bought. */
export const explorerSlots = (state: GameState): number =>
  WORLD.startingExplorers + state.world.explorersBought + Math.max(0, Math.floor(techFlat(state, 'explorerSlots')));

/** Gems for the next explorer bought, on the builders' curve:
 *  `round(base × growth^bought)`. */
export const explorerGemCost = (state: GameState): number =>
  roundPrice(WORLD.explorerGemCostBase * WORLD.explorerGemCostGrowth ** state.world.explorersBought);

export type BuyExplorerResult = 'Bought' | 'AtMax' | 'NotEnoughGems';

/** Buy one more explorer for good, with Gems — the purchase the Explorer
 *  pack makes in money. */
export function buyExplorer(state: GameState): BuyExplorerResult {
  if (state.world.explorersBought >= WORLD.explorersForSale) return 'AtMax';
  const cost = explorerGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.world.explorersBought += 1;
  track(state, 'gems_spent', { sink: 'explorer', gems: cost });
  return 'Bought';
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
export function explorerRoute(state: GameState, target: number): Route | null {
  if (!isBoardIndex(target)) return null;
  const fog = worldFog(state);
  if (fogStateOf(state, target, fog) === 'Unknown') return null;
  const speed = explorerSpeed(state);
  return fastestRoute(boardOf(state.world.board).hexes, homeIndex(state), target, 'explorer', (i) => hasBit(fog, i), () => speed);
}

/** How much faster an explorer works a hex: `exploreSpeed` (a speed — it
 *  never lengthens the work). */
export const exploreSpeed = (state: GameState): number => Math.max(1, techMultiplier(state, 'exploreSpeed'));

/** How long an explorer works at a hex before the player can reveal it: a
 *  base, and more for every hex it lies from the city, divided by
 *  `exploreSpeed`. */
export const exploreWorkMs = (state: GameState, target: number): number => Math.round(
  (WORLD.exploreWorkSeconds + WORLD.exploreWorkSecondsPerHex * hexDistance(hexAt(homeIndex(state)), hexAt(target)))
  * 1000 / exploreSpeed(state));

/** The first trip a kingdom sends is the tutorial's, and costs nothing
 *  (Docs/features/19-world-map.md §3.1). */
export const firstTripFree = (state: GameState): boolean => state.world.tripsSent === 0;

/** Gold to send an explorer to a hex, paid when it leaves: dearer the
 *  further the hex lies from the city — and nothing for the first trip. */
export const exploreGold = (state: GameState, target: number): number => (firstTripFree(state) ? 0
  : roundPrice(WORLD.exploreGoldBase
    * WORLD.exploreGoldGrowth ** Math.max(0, hexDistance(hexAt(homeIndex(state)), hexAt(target)) - 1)));

// ------------------------------------------------------------- a trip

export const arrivesAt = (trip: ExplorerTrip): number => trip.departedAt + outboundMs(trip.stepMs);

/** When its work is done: from then on it waits at the hex for the player. */
export const readyAt = (trip: ExplorerTrip): number => arrivesAt(trip) + trip.workMs;

/** When it is home — `Infinity` until the player has revealed its hex, for it
 *  does not set out for home before. */
export const returnsAt = (trip: ExplorerTrip): number =>
  (trip.revealedAt === null ? Number.POSITIVE_INFINITY : trip.revealedAt + homeboundMs(trip.stepMs));

/** Where a trip stands at `now`: on its way out, working the hex, waiting
 *  there for the player's tap, or walking home. */
export type TripPhase = 'out' | 'working' | 'ready' | 'home';

export function tripPhase(trip: ExplorerTrip, now: number): TripPhase {
  if (trip.revealedAt !== null) return 'home';
  if (now < arrivesAt(trip)) return 'out';
  return now < readyAt(trip) ? 'working' : 'ready';
}

/** The trips waiting at their hex for the player, the longest-waiting first. */
export const readyTrips = (state: GameState, now: number): ExplorerTrip[] =>
  state.world.explorers.filter((t) => tripPhase(t, now) === 'ready')
    .sort((a, b) => readyAt(a) - readyAt(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The trip waiting at this hex for the player, or null. */
export const readyTripAt = (state: GameState, index: number, now: number): ExplorerTrip | null =>
  state.world.explorers.find((t) => t.target === index && tripPhase(t, now) === 'ready') ?? null;

/** The next explorer to be home, or null when none is on its way back —
 *  every one out is still out there, or waiting for the player. */
export function nextFreeAt(state: GameState): number | null {
  const at = Math.min(...state.world.explorers.map(returnsAt));
  return Number.isFinite(at) ? at : null;
}

/** The target and the hexes round it. */
function revealInto(bits: HexBits, trip: ExplorerTrip): void {
  for (const i of boardWithin(trip.target, trip.radius)) setBit(bits, i);
}

// --------------------------------------------------------------- the fog

export type FogState = 'Revealed' | 'Sensed' | 'Unknown';

/** Every hex the player can see: the stored bitset, the city and every
 *  Portal. An explorer out adds nothing until the player reveals its hex. */
export function worldFog(state: GameState): HexBits {
  const bits = copyBits(state.world.revealed);
  setBit(bits, homeIndex(state));
  for (const portal of PORTAL_INDICES) setBit(bits, portal);
  return bits;
}

/**
 * A hex is Revealed if the player can see it, Sensed if it is next to a hex
 * the player revealed, and Unknown otherwise. A Portal, revealed for
 * everyone, senses nothing (19 §3).
 */
export function fogStateOf(state: GameState, index: number, fog: HexBits = worldFog(state)): FogState {
  if (hasBit(fog, index)) return 'Revealed';
  const sensed = boardNeighbors(index).some((n) => !PORTAL_INDICES.includes(n) && hasBit(fog, n));
  return sensed ? 'Sensed' : 'Unknown';
}

/** Each hex's neighbours that can sense it — every one but a Portal. */
let sensers: number[][] | null = null;

/** `fogStateOf` for every hex of the world at once, by index: what a frame
 *  of the board reads, without asking the neighbours of each hex anew. */
export function fogStatesOf(fog: HexBits): FogState[] {
  sensers ??= Array.from({ length: BOARD_SIZE }, (_, i) => boardNeighbors(i).filter((n) => !PORTAL_INDICES.includes(n)));
  const out = new Array<FogState>(BOARD_SIZE);
  for (let i = 0; i < BOARD_SIZE; i++) {
    out[i] = hasBit(fog, i) ? 'Revealed' : sensers[i].some((n) => hasBit(fog, n)) ? 'Sensed' : 'Unknown';
  }
  return out;
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
  /** Every explorer is out: `nextFreeAt` is when the first is home, or null
   *  when none is on its way back yet. */
  | { kind: 'NoExplorerFree'; nextFreeAt: number | null }
  /** No way there through explored ground. */
  | { kind: 'NoRoute' }
  | { kind: 'NotEnoughGold'; gold: number };

/** Send an explorer to a hex. Everything about the trip is priced now. */
export function dispatchExplorer(state: GameState, target: number, now: number): DispatchResult {
  if (!isBoardIndex(target)) return { kind: 'OffBoard' };
  const home = homeIndex(state);
  if (target === home) return { kind: 'Home' };
  if (fogStateOf(state, target) === 'Revealed') return { kind: 'Explored' };
  const already = tripRevealing(state, target);
  if (already !== null) return { kind: 'BeingExplored', trip: already };
  if (freeExplorers(state) === 0) return { kind: 'NoExplorerFree', nextFreeAt: nextFreeAt(state) };
  const route = explorerRoute(state, target);
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
    revealedAt: null,
  };
  state.world.explorers.push(trip);
  state.world.tripsSent += 1;
  return { kind: 'Sent', trip };
}

/** What the player found by revealing a trip's hex: how many hexes it added
 *  to the fog, and what its target's promise paid (19 §3.2). */
export interface ExplorerFound { id: string; target: number; revealed: number; paid: ScoutPay | null }

export type RevealResult =
  | { kind: 'Revealed'; found: ExplorerFound }
  /** No explorer waits at that hex — none was sent, or it is still working. */
  | { kind: 'NotReady' };

/**
 * THE PLAYER'S TAP ON A HEX AN EXPLORER WAITS AT: the hex and the ones round
 * it are revealed now, its promise is paid now, and the explorer sets out for
 * home. Nothing an explorer finds is revealed or paid without this tap.
 */
export function revealExplored(state: GameState, index: number, now: number): RevealResult {
  const trip = readyTripAt(state, index, now);
  if (trip === null) return { kind: 'NotReady' };
  return { kind: 'Revealed', found: reveal(state, trip, now) };
}

/** Fold a trip's reveal into the stored fog, pay its target, and turn it
 *  for home. */
function reveal(state: GameState, trip: ExplorerTrip, now: number): ExplorerFound {
  const before = countBits(state.world.revealed);
  revealInto(state.world.revealed, trip);
  // The city and the Portals are always revealed; they are never stored.
  clearBit(state.world.revealed, homeIndex(state));
  for (const portal of PORTAL_INDICES) clearBit(state.world.revealed, portal);
  // The hex it was sent to pays its promise, even if another trip's reveal
  // has uncovered it since: this trip was paid for.
  const paid = payScout(state, boardOf(state.world.board).hexes[trip.target]);
  trip.revealedAt = now;
  track(state, 'world_explored', { hex: trip.target });
  return { id: trip.id, target: trip.target, revealed: countBits(state.world.revealed) - before, paid };
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

/** Free the slot of every explorer home by `t`; the ids, in the order they
 *  came home. Its reveal was folded in when the player tapped its hex. */
export function returnExplorers(state: GameState, t: number): string[] {
  const due = state.world.explorers
    .filter((trip) => returnsAt(trip) <= t)
    .sort((a, b) => returnsAt(a) - returnsAt(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (due.length === 0) return [];
  const home = new Set(due.map((trip) => trip.id));
  state.world.explorers = state.world.explorers.filter((trip) => !home.has(trip.id));
  return due.map((trip) => trip.id);
}

/** The trip out that will reveal a hex — sent to it, or to a hex beside it
 *  within its reach — or null. */
export function tripRevealing(state: GameState, index: number): ExplorerTrip | null {
  return state.world.explorers.find((trip) => trip.target === index)
    ?? state.world.explorers.find((trip) => boardWithin(trip.target, trip.radius).includes(index))
    ?? null;
}

/** The wait a trip has left that time can be bought off: until its work is
 *  done, or, once revealed, until it is home. Null while it waits for the
 *  player — there is nothing to hurry. */
export function tripMsLeft(trip: ExplorerTrip, now: number): number | null {
  const phase = tripPhase(trip, now);
  if (phase === 'ready') return null;
  return Math.max(0, (phase === 'home' ? returnsAt(trip) : readyAt(trip)) - now);
}

/** Gems to finish what a trip is doing: the time it has left, at the build
 *  queue's rate (`rush.secondsPerGem`) — one rule for buying time, wherever
 *  the player meets it. */
export const explorerRushCost = (trip: ExplorerTrip, now: number): number =>
  gemsToFinish((tripMsLeft(trip, now) ?? 0) / 1000);

/** What finishing a trip did: revealed its hex — the player's own act, on
 *  that hex's card — or brought it home. */
export type TripFinished = { found: ExplorerFound | null; home: boolean };

/**
 * TAKE `ms` OFF A TRIP, at `now` — a speed-up (sim/speedups.ts). Before its
 * work is done the whole trip moves earlier; one that covers what is left
 * finishes the work AND reveals the hex, exactly as the Gem finish does —
 * finishing is the player's tap. On the road home, it comes home sooner, or
 * now. Returns the milliseconds used and what it finished, if it did.
 */
export function cutExplorer(
  state: GameState, tripId: string, ms: number, now: number,
): { used: number; finished: TripFinished | null } {
  const trip = state.world.explorers.find((t) => t.id === tripId);
  const left = trip === undefined ? null : tripMsLeft(trip, now);
  if (trip === undefined || left === null || !(ms > 0)) return { used: 0, finished: null };
  if (ms < left) {
    if (trip.revealedAt === null) trip.departedAt -= ms;
    else trip.revealedAt -= ms;
    return { used: ms, finished: null };
  }
  return { used: left, finished: finishTrip(state, trip, now) };
}

/** The wait of a trip, done: its work, and the reveal — or the road home. */
function finishTrip(state: GameState, trip: ExplorerTrip, now: number): TripFinished {
  if (trip.revealedAt !== null) {
    state.world.explorers = state.world.explorers.filter((t) => t !== trip);
    return { found: null, home: true };
  }
  trip.departedAt -= Math.max(0, readyAt(trip) - now);
  return { found: reveal(state, trip, now), home: false };
}

export type FinishExplorerResult =
  | { kind: 'Finished'; finished: TripFinished }
  | { kind: 'NotFound' }
  /** It waits at its hex: the reveal is a tap, not a purchase. */
  | { kind: 'Waiting' }
  | { kind: 'NotEnoughGems'; gems: number };

/** Finish what a trip is doing with Gems: its work, revealing the hex now —
 *  or its road home, its slot free now. */
export function finishExplorerWithGems(state: GameState, tripId: string, now: number): FinishExplorerResult {
  const trip = state.world.explorers.find((t) => t.id === tripId);
  if (trip === undefined) return { kind: 'NotFound' };
  if (tripMsLeft(trip, now) === null) return { kind: 'Waiting' };
  const gems = explorerRushCost(trip, now);
  if (getWallet(state.player.wallet, 'Gems') < gems) return { kind: 'NotEnoughGems', gems };
  state.player.wallet.Gems = getWallet(state.player.wallet, 'Gems') - gems;
  track(state, 'gems_spent', { sink: 'rush_explorer', gems: gems });
  return { kind: 'Finished', finished: finishTrip(state, trip, now) };
}
