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
import { resolve } from '../modifiers';
import { isTechComplete } from '../research';
import { randInt } from '../rng';
import { newId, type ExplorerTrip, type GameState, type WorldBuild, type WorldState } from '../state';
import { techFlat } from '../techEffects';
import { SEAT_INDICES } from './board';
import { clearBit, copyBits, countBits, emptyBits, hasBit, setBit, type HexBits } from './fogBits';
import { PORTAL_INDEX, boardNeighbors, boardWithin, hexAt, hexDistance, isBoardIndex } from './hex';
import { boardOf } from './source';
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
export const explorerSpeed = (state: GameState): number => Math.max(1, resolve(state, 'worldRevealSpeed', 1));

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
  | { kind: 'NoCartography' }
  | { kind: 'NoExplorerFree'; nextFreeAt: number }
  /** No way there through explored ground. */
  | { kind: 'NoRoute' };

/** Send an explorer to a hex. Everything about the trip is priced now. */
export function dispatchExplorer(state: GameState, target: number, now: number): DispatchResult {
  if (!isBoardIndex(target)) return { kind: 'OffBoard' };
  const home = homeIndex(state);
  if (target === home) return { kind: 'Home' };
  if (fogStateOf(state, target, now) === 'Revealed') return { kind: 'Explored' };
  if (explorerSlots(state) === 0) return { kind: 'NoCartography' };
  if (freeExplorers(state) === 0) {
    return { kind: 'NoExplorerFree', nextFreeAt: Math.min(...state.world.explorers.map(returnsAt)) };
  }
  const route = explorerRoute(state, target, now);
  if (route === null) return { kind: 'NoRoute' };
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

/** An explorer that came home, and how many hexes its trip added to the
 *  fog. */
export interface ExplorerHome { id: string; target: number; revealed: number }

/** Fold every trip home by `t` into the stored fog and free its slot, in
 *  the order they came home. */
export function returnExplorers(state: GameState, t: number): ExplorerHome[] {
  const due = state.world.explorers
    .filter((trip) => returnsAt(trip) <= t)
    .sort((a, b) => returnsAt(a) - returnsAt(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (due.length === 0) return [];
  const out: ExplorerHome[] = [];
  for (const trip of due) {
    const before = countBits(state.world.revealed);
    revealInto(state.world.revealed, trip);
    // The city and the Portal are always revealed; they are never stored.
    clearBit(state.world.revealed, homeIndex(state));
    clearBit(state.world.revealed, PORTAL_INDEX);
    out.push({ id: trip.id, target: trip.target, revealed: countBits(state.world.revealed) - before });
  }
  const home = new Set(due.map((trip) => trip.id));
  state.world.explorers = state.world.explorers.filter((trip) => !home.has(trip.id));
  return out;
}
