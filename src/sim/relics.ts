// RELICS FOUND AND RESTORED (Docs/proposals/relic-restoration.md §1–§4, §9;
// Docs/plans/relics-and-bag.md step 5).
//
// A relic is six fragments — five pieces and one keystone. Fragments are
// found where the game already pays; six distinct ones restore the relic at
// level 1, and every fragment past that is a spare that levels it, with no
// ceiling. Rules this file keeps:
//
//  1. THE FIRST FRAGMENT IS FOUND BY PLAY, at the relic's door — a lair's
//     prize for a city relic, a world source for a world one. A drop never
//     rolls a relic the player has not met.
//  2. ROLLS ARE COUNTER/HASH on the event that paid them (`parts`), never on
//     the moment: a replay deals the same fragments.
//  3. FOUND AND BOUND ARE COUNTED APART. What was bought or forged is bound;
//     only found fragments may ever be sent (step 8).
//  4. A RELIC'S LEVEL IS `artifacts.levels`, so its passive and its active
//     are what they were (`artifacts.ts`, `casting.ts`) until it is hosted.

import { track } from './analytics';
import { grantArtifactLevel, artifactLevel } from './artifacts';
import {
  ARTIFACT_ORDER, RELIC_RULES, relicDoor, relicKind, type RelicKind,
} from './data/definitions';
import { rand } from './rng';
import { addToWallet, getWallet, type ArtifactId, type GameState } from './state';

/** Slots 0–4 are the pieces, 5 the keystone. */
export const SLOTS = 6;
export const KEYSTONE = 5;

/** What the player holds of one relic's fragments, slot by slot. */
export interface RelicFragments {
  found: number[];
  bound: number[];
}

const empty = (): RelicFragments => ({ found: [0, 0, 0, 0, 0, 0], bound: [0, 0, 0, 0, 0, 0] });

/** The fragments held of this relic (a copy-free view; zeros when none). */
export const fragmentsOf = (state: GameState, id: ArtifactId): RelicFragments =>
  state.relics.held[id] ?? empty();

const own = (state: GameState, id: ArtifactId): RelicFragments =>
  (state.relics.held[id] ??= empty());

/** Of one slot, found and bound together. */
export const slotCount = (state: GameState, id: ArtifactId, slot: number): number => {
  const f = fragmentsOf(state, id);
  return (f.found[slot] ?? 0) + (f.bound[slot] ?? 0);
};

export const isRestored = (state: GameState, id: ArtifactId): boolean => artifactLevel(state, id) >= 1;

/** Has the player met this relic — found a fragment of it, or restored it? */
export const isMet = (state: GameState, id: ArtifactId): boolean =>
  isRestored(state, id) || Array.from({ length: SLOTS }, (_, s) => slotCount(state, id, s)).some((n) => n > 0);

/** Distinct slots held: six restore it. */
export const distinctHeld = (state: GameState, id: ArtifactId): number =>
  Array.from({ length: SLOTS }, (_, s) => slotCount(state, id, s)).filter((n) => n > 0).length;

export const canRestore = (state: GameState, id: ArtifactId): boolean =>
  !isRestored(state, id) && distinctHeld(state, id) === SLOTS;

const worthOf = (slot: number): number => (slot === KEYSTONE ? RELIC_RULES.keystoneWorth : 1);

/** What the spares are worth in levels: every fragment once the relic is
 *  restored; before that, only the copies past the first of each slot. */
export function spareWorth(state: GameState, id: ArtifactId): number {
  const keep = isRestored(state, id) ? 0 : 1;
  let worth = 0;
  for (let s = 0; s < SLOTS; s++) worth += Math.max(0, slotCount(state, id, s) - keep) * worthOf(s);
  return worth;
}

/** Spares the next level asks: `levelCostBase`, one more every
 *  `levelCostEvery` levels (§11: 2, +1 every 2 levels). */
export const levelCost = (level: number): number =>
  RELIC_RULES.levelCostBase + Math.floor(Math.max(0, level - 1) / Math.max(1, RELIC_RULES.levelCostEvery));

/**
 * Spend spares worth at least `worth`: bound before found (the found are
 * what can be sent), pieces before the keystone (it is worth more). Before
 * restoration the first of each slot is never touched. Returns false, and
 * spends nothing, when they are not worth enough.
 */
function spendSpares(state: GameState, id: ArtifactId, worth: number): boolean {
  if (spareWorth(state, id) < worth) return false;
  const f = own(state, id);
  const keep = isRestored(state, id) ? 0 : 1;
  let left = worth;
  for (const slot of [0, 1, 2, 3, 4, KEYSTONE]) {
    for (const pile of [f.bound, f.found]) {
      while (left > 0 && pile[slot] > 0 && f.found[slot] + f.bound[slot] > keep) {
        pile[slot] -= 1;
        left -= worthOf(slot);
      }
    }
  }
  return true;
}

export type RestoreResult = 'Restored' | 'Missing' | 'AlreadyRestored';

/** Restore a relic from six distinct fragments: one of each goes, the relic
 *  is level 1. */
export function restoreRelic(state: GameState, id: ArtifactId): RestoreResult {
  if (isRestored(state, id)) return 'AlreadyRestored';
  if (distinctHeld(state, id) < SLOTS) return 'Missing';
  const f = own(state, id);
  for (let s = 0; s < SLOTS; s++) {
    if (f.bound[s] > 0) f.bound[s] -= 1;
    else f.found[s] -= 1;
  }
  grantArtifactLevel(state, id);
  track(state, 'relic_restored', { relic: id });
  return 'Restored';
}

export type LevelUpResult = 'Levelled' | 'NotRestored' | 'NotEnoughSpares';

/** Spend spares for the next level. */
export function levelUpRelic(state: GameState, id: ArtifactId): LevelUpResult {
  if (!isRestored(state, id)) return 'NotRestored';
  const level = artifactLevel(state, id);
  if (!spendSpares(state, id, levelCost(level))) return 'NotEnoughSpares';
  grantArtifactLevel(state, id);
  track(state, 'relic_levelled', { relic: id, level: level + 1 });
  return 'Levelled';
}

// ----------------------------------------------------------------- the drops

/** Which relics a drop of this kind may roll: the met ones, in order. */
const rollable = (state: GameState, kind: RelicKind | 'any'): ArtifactId[] =>
  ARTIFACT_ORDER.filter((id) => (kind === 'any' || relicKind(id) === kind) && isMet(state, id));

/** One fragment's slot: the keystone one time in `keystoneOneIn`, else a
 *  piece. */
const rollSlot = (seed: number, parts: readonly (string | number)[]): number =>
  rand(seed, ...parts, 'slot') < 1 / Math.max(1, RELIC_RULES.keystoneOneIn)
    ? KEYSTONE
    : Math.min(4, Math.floor(rand(seed, ...parts, 'piece') * 5));

/** A fragment that landed. */
export interface FragmentDrop {
  relic: ArtifactId;
  slot: number;
}

/**
 * Drop `n` fragments of relics of `kind` the player has met, rolled on
 * `parts` — the event that paid them. Nothing when no relic of the kind has
 * been met: a drop never rolls a relic the player has not found.
 */
export function dropFragments(
  state: GameState, kind: RelicKind | 'any', n: number, parts: readonly (string | number)[], bound = false,
): FragmentDrop[] {
  const out: FragmentDrop[] = [];
  const pool = rollable(state, kind);
  if (pool.length === 0) return out;
  for (let i = 0; i < n; i++) {
    const relic = pool[Math.min(pool.length - 1, Math.floor(rand(state.seed, 'fragment', ...parts, i, 'relic') * pool.length))];
    const slot = rollSlot(state.seed, ['fragment', ...parts, i]);
    const f = own(state, relic);
    (bound ? f.bound : f.found)[slot] += 1;
    out.push({ relic, slot });
  }
  return out;
}

/**
 * A relic's door: the event that hands over its first fragment. The first
 * piece of every relic behind this door that the player has not met yet.
 */
export function openRelicDoor(state: GameState, door: string): FragmentDrop[] {
  const out: FragmentDrop[] = [];
  for (const id of ARTIFACT_ORDER) {
    if (relicDoor(id) !== door || isMet(state, id)) continue;
    own(state, id).found[0] += 1;
    out.push({ relic: id, slot: 0 });
  }
  return out;
}

// --------------------------------------------------------- the paid doors

/** What forging a missing fragment costs (§9): spares alone, or a few
 *  spares and Gems. */
export const replicaPrice = (slot: number): { freeSpares: number; spares: number; gems: number } => ({
  freeSpares: slot === KEYSTONE ? RELIC_RULES.replicaFreeSparesKeystone : RELIC_RULES.replicaFreeSparesPiece,
  spares: RELIC_RULES.replicaSpares,
  gems: slot === KEYSTONE ? RELIC_RULES.replicaGemsKeystone : RELIC_RULES.replicaGemsPiece,
});

export type ForgeResult = 'Forged' | 'NotMissing' | 'AlreadyRestored' | 'NotEnoughSpares' | 'NotEnoughGems';

/** Forge a missing fragment, bound: with spares alone (`free`), or with
 *  fewer spares and Gems. */
export function forgeReplica(state: GameState, id: ArtifactId, slot: number, withGems: boolean): ForgeResult {
  if (isRestored(state, id)) return 'AlreadyRestored';
  if (slotCount(state, id, slot) > 0) return 'NotMissing';
  const price = replicaPrice(slot);
  const spares = withGems ? price.spares : price.freeSpares;
  if (spareWorth(state, id) < spares) return 'NotEnoughSpares';
  if (withGems && getWallet(state.player.wallet, 'Gems') < price.gems) return 'NotEnoughGems';
  spendSpares(state, id, spares);
  if (withGems) addToWallet(state.player.wallet, 'Gems', -price.gems);
  own(state, id).bound[slot] += 1;
  track(state, 'relic_forged', { relic: id, slot, gems: withGems });
  return 'Forged';
}

export type RestorerChestResult = { kind: 'Opened'; drops: FragmentDrop[] } | { kind: 'NotRestored' } | { kind: 'NotEnoughGems' };

/** The Restorer's chest (§9): `restorerChestSize` bound fragments of a
 *  chosen restored relic, for Gems, at the published odds — the keystone one
 *  time in `keystoneOneIn`. */
export function openRestorerChest(state: GameState, id: ArtifactId): RestorerChestResult {
  if (!isRestored(state, id)) return { kind: 'NotRestored' };
  if (getWallet(state.player.wallet, 'Gems') < RELIC_RULES.restorerChestGems) return { kind: 'NotEnoughGems' };
  addToWallet(state.player.wallet, 'Gems', -RELIC_RULES.restorerChestGems);
  const n = (state.relics.chests += 1);
  const drops: FragmentDrop[] = [];
  for (let i = 0; i < RELIC_RULES.restorerChestSize; i++) {
    const slot = rollSlot(state.seed, ['chest', id, n, i]);
    own(state, id).bound[slot] += 1;
    drops.push({ relic: id, slot });
  }
  track(state, 'relic_chest', { relic: id });
  return { kind: 'Opened', drops };
}
