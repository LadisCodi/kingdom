// RELICS FOUND AND RESTORED (Docs/proposals/relic-restoration.md §1–§4, §9;
// Docs/plans/relics-and-bag.md step 5).
//
// A relic is six fragments — five pieces and one keystone. Fragments are
// found where the game already pays; six distinct ones restore the relic at
// level 1, and every level after takes one of each of the six again, and
// Stardust, with no ceiling. Copies past the first of a slot are spares,
// which forge a missing one. Rules this file keeps:
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
import { roundPrice } from './roundPrice';
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

/** Stardust the next level-up asks, from `level`: `levelStardustBase`, times
 *  `levelStardustGrowth` a level, rounded as every curve's price is. */
export const levelStardust = (level: number): number =>
  roundPrice(RELIC_RULES.levelStardustBase * RELIC_RULES.levelStardustGrowth ** Math.max(0, level - 1));

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

export type LevelUpResult = 'Levelled' | 'NotRestored' | 'MissingFragments' | 'NotEnoughStardust';

/** Why the next level is out of reach, or null when it is not. */
export function levelUpBlock(state: GameState, id: ArtifactId): Exclude<LevelUpResult, 'Levelled'> | null {
  if (!isRestored(state, id)) return 'NotRestored';
  if (distinctHeld(state, id) < SLOTS) return 'MissingFragments';
  if (getWallet(state.kingdom.wallet, 'Stardust') < levelStardust(artifactLevel(state, id))) return 'NotEnoughStardust';
  return null;
}

/**
 * A LEVEL IS A WHOLE SET AND ITS STARDUST: one fragment of EACH of the six
 * slots — bound before found, since the found are what can be sent — and the
 * level's Stardust. Every level, always; nothing is spent when either falls
 * short.
 */
export function levelUpRelic(state: GameState, id: ArtifactId): LevelUpResult {
  const block = levelUpBlock(state, id);
  if (block !== null) return block;
  const level = artifactLevel(state, id);
  const f = own(state, id);
  for (let s = 0; s < SLOTS; s++) {
    if (f.bound[s] > 0) f.bound[s] -= 1;
    else f.found[s] -= 1;
  }
  addToWallet(state.kingdom.wallet, 'Stardust', -levelStardust(level));
  grantArtifactLevel(state, id);
  track(state, 'relic_levelled', { relic: id, level: level + 1 });
  return 'Levelled';
}

/**
 * A RELIC HANDED OVER WHOLE — a tutorial line's gift (`SceneLine.restores`):
 * restored at level 1, no fragments needed. Nothing when it already is.
 */
export function giveRelic(state: GameState, id: ArtifactId): boolean {
  if (isRestored(state, id)) return false;
  grantArtifactLevel(state, id);
  track(state, 'relic_gifted', { relic: id });
  return true;
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

export type FragmentPackResult = { kind: 'Opened'; drops: FragmentDrop[] } | { kind: 'NothingMet' } | { kind: 'NotEnoughGems' };

/** THE FRAGMENT PACK, sold in the store: `fragmentPackSize` bound fragments
 *  of the relics the player has met, at random, for Gems — the keystone one
 *  time in `keystoneOneIn`, like every drop. Never a relic not yet found. */
export function openFragmentPack(state: GameState): FragmentPackResult {
  if (rollable(state, 'any').length === 0) return { kind: 'NothingMet' };
  if (getWallet(state.player.wallet, 'Gems') < RELIC_RULES.fragmentPackGems) return { kind: 'NotEnoughGems' };
  addToWallet(state.player.wallet, 'Gems', -RELIC_RULES.fragmentPackGems);
  const n = (state.relics.chests += 1);
  const drops = dropFragments(state, 'any', RELIC_RULES.fragmentPackSize, ['pack', n], true);
  track(state, 'fragment_pack', { gems: RELIC_RULES.fragmentPackGems, n: drops.length });
  return { kind: 'Opened', drops };
}
