// Artifacts (Docs/features/magic.md §2, §3): the relics won from ruins, the
// slots they compete for, and the four abilities they cast.
//
// WHY RELICS AND NOT A SPELLBOOK. A loadout limit only has weight when the
// equipped thing works continuously. An active-only slot is trivially
// circumvented — you swap the ability in at the moment you cast — so the limit
// would tax casting instead of creating a decision. A passive is consumed every
// second, so committing a slot to one costs you the alternative for as long as
// you wear it.
//
// The lock is not the cost. Swapping applies the new passive immediately and
// then locks that slot for five minutes, which is exactly long enough to stop
// hot-swapping a relic in for a single cast, and never long enough to make a
// player wait for a benefit they have already earned. THE REAL COST OF A SWAP
// IS GOING WITHOUT THE PASSIVE YOU WERE LIVING OFF.

import { ARTIFACTS, ARTIFACT_ORDER, ATTUNEMENT, RUINS } from './data/definitions';
import { emptyEntry, levelBlock, levelCost, tierBlock, tierCost, type CollectionEntry } from './collection';
import { addModifier, resolve, type Modifier } from './modifiers';
import { isTechComplete } from './research';
import {
  addToWallet, getWallet, type ArtifactId, type GameState, type RuinId,
} from './state';

// ------------------------------------------------------------ the collection

export const ownsArtifact = (state: GameState, id: ArtifactId): boolean =>
  state.artifacts.owned.includes(id);

/** One relic's collection entry, defaulted — an unowned relic reads as level 1
 *  tier 1 so the UI can show what it WOULD be without special-casing. */
export function artifactEntry(state: GameState, id: ArtifactId): CollectionEntry {
  return {
    level: state.artifacts.levels[id] ?? 1,
    tier: state.artifacts.tiers[id] ?? 1,
    fragments: state.artifacts.fragments[id] ?? 0,
  };
}

/** Grant a relic. A DUPLICATE is never a dead drop: it converts to that
 *  relic's Fragments, which is the same currency repeat delves pay. */
export function grantArtifact(state: GameState, id: ArtifactId, duplicateFragments = 10): 'Granted' | 'Duplicate' {
  if (ownsArtifact(state, id)) {
    state.artifacts.fragments[id] = (state.artifacts.fragments[id] ?? 0) + duplicateFragments;
    return 'Duplicate';
  }
  state.artifacts.owned.push(id);
  const fresh = emptyEntry();
  state.artifacts.levels[id] = fresh.level;
  state.artifacts.tiers[id] = fresh.tier;
  state.artifacts.fragments[id] = state.artifacts.fragments[id] ?? 0;
  return 'Granted';
}

export function addArtifactFragments(state: GameState, id: ArtifactId, amount: number): void {
  state.artifacts.fragments[id] = (state.artifacts.fragments[id] ?? 0) + amount;
}

export type LevelUpResult = 'Levelled' | 'NotOwned' | 'AtMaxLevel' | 'TierCapped' | 'NotEnoughKnowledge';

/** Spend Knowledge for one level. Knowledge is KINGDOM-scoped deliberately: it
 *  survives a region reset, so it still works when regions become the content
 *  treadmill. */
export function levelUpArtifact(state: GameState, id: ArtifactId): LevelUpResult {
  if (!ownsArtifact(state, id)) return 'NotOwned';
  const entry = artifactEntry(state, id);
  const knowledge = getWallet(state.kingdom.wallet, 'Knowledge');
  const block = levelBlock(entry, knowledge);
  if (block !== null) return block;
  addToWallet(state.kingdom.wallet, 'Knowledge', -levelCost(entry.level));
  state.artifacts.levels[id] = entry.level + 1;
  syncArtifactModifiers(state); // the passive scales with level
  return 'Levelled';
}

export type RaiseTierResult = 'Raised' | 'NotOwned' | 'AtMaxTier' | 'NotEnoughFragments';

export function raiseArtifactTier(state: GameState, id: ArtifactId): RaiseTierResult {
  if (!ownsArtifact(state, id)) return 'NotOwned';
  const entry = artifactEntry(state, id);
  const block = tierBlock(entry);
  if (block !== null) return block;
  state.artifacts.fragments[id] = entry.fragments - tierCost(entry.tier);
  state.artifacts.tiers[id] = entry.tier + 1;
  return 'Raised';
}

// ------------------------------------------------------------------- slots

/** One at start, one from research, the rest with Gems — earned breadth first,
 *  so the paid gate is never the only thing between a player and the system. */
export function attunementSlots(state: GameState): number {
  const fromResearch = isTechComplete(state, 'Attunement') ? 1 : 0;
  const base = ATTUNEMENT.baseSlots + fromResearch + state.artifacts.slotsPurchased;
  // A season can LEND a socket for its window. It goes through the modifier
  // layer like everything else, so it retires itself when the window closes.
  return Math.max(1, Math.min(Math.round(resolve(state, 'attunementSlots', base)), ATTUNEMENT.maxSlots));
}

export const attunementSlotGemCost = (state: GameState): number =>
  Math.round(
    ATTUNEMENT.slotGemCostBase * ATTUNEMENT.slotGemCostGrowth ** state.artifacts.slotsPurchased,
  );

export type BuySlotResult = 'Purchased' | 'AtMax' | 'NotEnoughGems';

export function buyAttunementSlot(state: GameState): BuySlotResult {
  if (attunementSlots(state) >= ATTUNEMENT.maxSlots) return 'AtMax';
  const cost = attunementSlotGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.artifacts.slotsPurchased += 1;
  normaliseSlots(state);
  return 'Purchased';
}

/** Keep `attuned` and `lockedUntil` exactly as long as the player has slots.
 *  A slot is a visible empty socket, not an absence, so the arrays are dense.
 *  Shrinking never happens today, but un-attuning what falls off keeps the
 *  modifier stack honest if it ever does. */
export function normaliseSlots(state: GameState): void {
  const slots = attunementSlots(state);
  const { artifacts } = state;
  while (artifacts.attuned.length < slots) artifacts.attuned.push(null);
  while (artifacts.lockedUntil.length < slots) artifacts.lockedUntil.push(0);
  if (artifacts.attuned.length > slots) artifacts.attuned.length = slots;
  if (artifacts.lockedUntil.length > slots) artifacts.lockedUntil.length = slots;
  syncArtifactModifiers(state);
}

export const slotLockedUntil = (state: GameState, slot: number): number =>
  state.artifacts.lockedUntil[slot] ?? 0;

export const isSlotLocked = (state: GameState, slot: number, now: number): boolean =>
  now < slotLockedUntil(state, slot);

/** Seconds until the slot frees up (0 = free). */
export const slotUnlocksIn = (state: GameState, slot: number, now: number): number =>
  Math.max(0, (slotLockedUntil(state, slot) - now) / 1000);

export const attunedIn = (state: GameState, slot: number): ArtifactId | null =>
  state.artifacts.attuned[slot] ?? null;

export const isAttuned = (state: GameState, id: ArtifactId): boolean =>
  state.artifacts.attuned.includes(id);

/**
 * Relics currently underground — the "arm" half of attune-or-arm.
 *
 * A relic is carried for exactly as long as its delve is in `state.delves`,
 * the same span `heroIsBusy` uses. It therefore comes home when the player
 * COLLECTS, including after a failed push, rather than the moment the sim
 * decides the run is over. A hero and the relic it carried are committed and
 * released together, which is the only rule explicable in one line.
 *
 * It lives HERE rather than in `expeditions.ts` because it is a fact about an
 * artifact, and because `attune` below has to ask it — the other direction of
 * the same rule.
 */
export const artifactIsCarried = (state: GameState, id: ArtifactId): boolean =>
  state.delves.some((d) => d.artifactId === id);

/** Attuned to the kingdom, or in a party's pack. Neither socket is free. */
export const artifactIsCommitted = (state: GameState, id: ArtifactId): boolean =>
  isAttuned(state, id) || artifactIsCarried(state, id);

export type AttuneResult =
  | 'Attuned' | 'Unattuned' | 'NotOwned' | 'NoSuchSlot' | 'SlotLocked' | 'AlreadyAttuned'
  | 'Carried';

/**
 * Put `id` in `slot` (or empty it with null). The swap is IMMEDIATE — the new
 * passive applies at once — and then the slot locks.
 */
export function attune(
  state: GameState,
  slot: number,
  id: ArtifactId | null,
  now: number,
): AttuneResult {
  normaliseSlots(state);
  if (slot < 0 || slot >= attunementSlots(state)) return 'NoSuchSlot';
  if (isSlotLocked(state, slot, now)) return 'SlotLocked';
  if (id !== null) {
    if (!ownsArtifact(state, id)) return 'NotOwned';
    const existing = state.artifacts.attuned.indexOf(id);
    if (existing !== -1 && existing !== slot) return 'AlreadyAttuned';
    // The other direction of attune-OR-arm. A relic in a party's pack cannot
    // also be feeding the kingdom a passive, and the sim will not recall it
    // from underground to settle the question — it comes home when the party
    // does. Checked HERE rather than in the caller so no route into the
    // socket can miss it.
    if (artifactIsCarried(state, id)) return 'Carried';
  }
  const was = state.artifacts.attuned[slot];
  if (was === id) return id === null ? 'Unattuned' : 'Attuned';
  state.artifacts.attuned[slot] = id;
  state.artifacts.lockedUntil[slot] = now + ATTUNEMENT.swapLockSeconds * 1000;
  syncArtifactModifiers(state);
  return id === null ? 'Unattuned' : 'Attuned';
}

// -------------------------------------------------------------- the passives

/** The passive's value at this relic's current level. */
export function passiveValue(state: GameState, id: ArtifactId): number {
  const { passive } = ARTIFACTS[id];
  const level = artifactEntry(state, id).level;
  const value = passive.base + passive.perLevel * (level - 1);
  // A multiplier must never cross zero into a sign flip; an additive one must
  // never subtract what it is meant to add.
  return Math.max(0, value);
}

const MODIFIER_PREFIX = 'artifact:';

/**
 * Rebuild the artifact half of the modifier stack from `attuned`.
 *
 * Idempotent and total, rather than incremental: attuning, un-attuning,
 * levelling and loading a save all move the same inputs, and one rebuild that
 * cannot drift beats four paths that each have to remember to add AND remove.
 * Artifact passives are PERMANENT modifiers (`expiresAt: null`); the actives
 * are the timed ones.
 */
export function syncArtifactModifiers(state: GameState): void {
  state.modifiers = state.modifiers.filter((m) => !m.id.startsWith(MODIFIER_PREFIX));
  for (const id of state.artifacts.attuned) {
    if (id === null) continue;
    const { passive } = ARTIFACTS[id];
    const modifier: Modifier = {
      id: `${MODIFIER_PREFIX}${id}`,
      source: 'artifact',
      stat: passive.stat,
      scope: passive.scope,
      op: passive.op,
      value: passiveValue(state, id),
      expiresAt: null,
    };
    addModifier(state, modifier);
  }
}

// ------------------------------------------------------------------ sources

/** Which ruin grants which relic — the guaranteed first-clear reward. No
 *  randomness on the thing that gates a system. */
export const artifactOfRuin = (ruinId: RuinId): ArtifactId => RUINS[ruinId].artifact;

/** Relics the player owns, in authored order (stable across renders). */
export const ownedArtifacts = (state: GameState): ArtifactId[] =>
  ARTIFACT_ORDER.filter((id) => ownsArtifact(state, id));
