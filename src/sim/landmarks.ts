// Landmarks (Docs/features/08-magic.md §3): small, numerous, passive map sites
// that raise Mana CAPACITY permanently when claimed.
//
// They are what makes exploration compound rather than merely pay:
//
//   explore → a bigger pool → a bigger ad → more taps → explore further
//
// Capacity rather than rate, deliberately (2026-09-02). An ad pays a whole
// pool, so a claim makes every future ad permanently bigger — the claim is
// worth MORE the longer you play. The +1 Mana/h it used to pay was worth most
// on the day you found it and less every day after, which is the wrong shape
// for the reward at the end of an exponential fog cost.
//
// A flat resource drip cannot do that, because it does not feed the constraint
// that gates everything else. This is also the design's answer to paid fog
// being the primary economic sink — the sink has to buy something that makes
// the next stretch of it cheaper.
//
// Claiming comes in two flavours, which is what keeps them from being a
// formality:
//
//  - UNDEFENDED — a one-off Gold cost scaling with distance. A pure economic
//    decision, and another sink on the fog's own curve.
//  - DEFENDED — an enemy army holds it. Clear the encounter, then claim. This
//    gives combat a second job outside dungeons, and it is a ONE-OFF encounter
//    rather than a permanent commitment: the army is never locked up holding
//    ground.

import { FOG, KNOWLEDGE, LANDMARKS, type LandmarkDef } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { fogState, recordVisibleSites } from './fog';
import { resolve } from './modifiers';
import { effect } from './upgrades';
import { cellsWithinRadiusOfRect, type MapData } from './grid';
import { allLandmarkCells, landmarkDefAt } from './sites';
import { addToWallet, coordKey, getWallet, type Coord, type GameState } from './state';

export const landmarkAt = landmarkDefAt;

export const landmarkById = (id: string): LandmarkDef | undefined =>
  LANDMARKS.find((l) => l.id === id);

export const isLandmarkClaimed = (state: GameState, id: string): boolean =>
  state.landmarks.claimed[id] === true;

/** A defended landmark whose guard has been beaten (or that never had one). */
export const isLandmarkClear = (state: GameState, def: LandmarkDef): boolean =>
  !def.defended || state.landmarks.cleared[def.id] === true;

/**
 * Gold to claim, authored per sanctuary.
 *
 * It used to ride the fog's own exponential distance curve. Tiers replaced it
 * because the PRICES are the design: one sanctuary sits inside the Townhall's
 * own reveal, visible from the first minute and costing 5,000 — a thing to
 * save for rather than buy — and the rest sit two rings further out at 25,000
 * and 100,000. A curve cannot land on those numbers, and a claim the player
 * has been staring at for a week should cost what the designer said.
 */
export const landmarkClaimCost = (state: GameState, def: LandmarkDef): number =>
  Math.max(1, Math.round(resolve(
    state, 'claimCost', def.claimCost * Math.max(0, 1 - effect(state, 'Pilgrimage')),
  )));

export type ClaimResult =
  | 'Claimed' | 'AlreadyClaimed' | 'NotRevealed' | 'Defended' | 'NotEnoughGold' | 'NoLandmark';

export function claimLandmark(state: GameState, map: MapData, cell: Coord): ClaimResult {
  const def = landmarkAt(cell);
  if (!def) return 'NoLandmark';
  if (isLandmarkClaimed(state, def.id)) return 'AlreadyClaimed';
  if (fogState(state, map, def.location) !== 'Revealed') return 'NotRevealed';
  if (!isLandmarkClear(state, def)) return 'Defended';
  const cost = landmarkClaimCost(state, def);
  if (getWallet(state.city.wallet, 'Gold') < cost) return 'NotEnoughGold';
  addToWallet(state.city.wallet, 'Gold', -cost);
  state.landmarks.claimed[def.id] = true;
  // Taking ground is an event, not a rate change nobody is looking at.
  addToWallet(state.kingdom.wallet, 'Knowledge', KNOWLEDGE.landmarkClaimLump);
  recordResourceDiscovery(state, 'Knowledge');
  discoverAroundLandmark(state, map, def);
  return 'Claimed';
}

/**
 * A claim lifts the fog around the sanctuary: every cell within
 * `fog.claim_discover_radius` becomes DISCOVERED.
 *
 * Discovered, never revealed — and that distinction is the whole design. The
 * paid reveal stays the economy's main sink, so a claim cannot be allowed to
 * hand the player ground for free. What it hands them is a place to LOOK: a
 * hundred-odd cells of dark tiles with their features showing, which is a map
 * to plan against and a frontier to push at, bought with the Gold they saved.
 *
 * It also gives the second and third sanctuaries a job beyond Mana capacity —
 * each one is a lantern held up over a new part of the map, which is what
 * makes "go and claim the far one" a reason to explore rather than a chore at
 * the end of exploring.
 *
 * Cells the player has already cleared are left alone: revealed outranks
 * discovered, and overwriting would undo paid-for progress.
 */
function discoverAroundLandmark(state: GameState, map: MapData, def: LandmarkDef): void {
  for (const cell of cellsWithinRadiusOfRect(
    map, def.location, { x: 1, y: 1 }, FOG.claimDiscoverRadius,
  )) {
    const key = coordKey(cell);
    if (!state.fog.revealed[key]) state.fog.discovered[key] = true;
  }
  // The lantern this just held up almost certainly caught something.
  recordVisibleSites(state, map);
}

/** Landmarks the player can currently see — revealed cells only. */
export const visibleLandmarks = (state: GameState, map: MapData): LandmarkDef[] =>
  LANDMARKS.filter((l) => fogState(state, map, l.location) === 'Revealed');

export const claimedLandmarkCount = (state: GameState): number =>
  Object.keys(state.landmarks.claimed).length;

/** Every landmark cell, for the renderer. */
export const landmarkCells = allLandmarkCells;
