// Landmarks (Docs/features/magic.md §4): small, numerous, passive map sites
// that raise Mana PRODUCTION permanently when claimed.
//
// They are what makes exploration compound rather than merely pay:
//
//   explore → more Mana/h → more taps → more of everything → explore further
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

import { LANDMARKS, MANA, type LandmarkDef } from './data/definitions';
import { fogState } from './fog';
import { townhallDistance, type MapData } from './grid';
import { allLandmarkCells, landmarkDefAt } from './sites';
import { addToWallet, getWallet, type Coord, type GameState } from './state';

export const landmarkAt = landmarkDefAt;

export const landmarkById = (id: string): LandmarkDef | undefined =>
  LANDMARKS.find((l) => l.id === id);

export const isLandmarkClaimed = (state: GameState, id: string): boolean =>
  state.landmarks.claimed[id] === true;

/** A defended landmark whose guard has been beaten (or that never had one). */
export const isLandmarkClear = (state: GameState, def: LandmarkDef): boolean =>
  !def.defended || state.landmarks.cleared[def.id] === true;

/** Gold to claim, on the fog's own exponential distance curve — so a far
 *  landmark is a real investment rather than a pickup. */
export const landmarkClaimCost = (map: MapData, def: LandmarkDef): number =>
  Math.round(
    MANA.landmarkClaimCostBase * MANA.landmarkClaimCostGrowth ** townhallDistance(map, def.location),
  );

export type ClaimResult =
  | 'Claimed' | 'AlreadyClaimed' | 'NotRevealed' | 'Defended' | 'NotEnoughGold' | 'NoLandmark';

export function claimLandmark(state: GameState, map: MapData, cell: Coord): ClaimResult {
  const def = landmarkAt(cell);
  if (!def) return 'NoLandmark';
  if (isLandmarkClaimed(state, def.id)) return 'AlreadyClaimed';
  if (fogState(state, map, def.location) !== 'Revealed') return 'NotRevealed';
  if (!isLandmarkClear(state, def)) return 'Defended';
  const cost = landmarkClaimCost(map, def);
  if (getWallet(state.city.wallet, 'Gold') < cost) return 'NotEnoughGold';
  addToWallet(state.city.wallet, 'Gold', -cost);
  state.landmarks.claimed[def.id] = true;
  return 'Claimed';
}

/** Landmarks the player can currently see — revealed cells only. */
export const visibleLandmarks = (state: GameState, map: MapData): LandmarkDef[] =>
  LANDMARKS.filter((l) => fogState(state, map, l.location) === 'Revealed');

export const claimedLandmarkCount = (state: GameState): number =>
  Object.keys(state.landmarks.claimed).length;

/** Every landmark cell, for the renderer. */
export const landmarkCells = allLandmarkCells;
