// Heroes and the gacha (Docs/features/heroes-and-gacha.md).
//
// Heroes reuse the collection substrate verbatim: Fragments raise a tier cap,
// Knowledge buys levels within it. That is the whole point of building the
// substrate first — a hero and a relic are two KINDS OF THING, not two systems
// with two vocabularies, and the player learns the rules once.
//
// THE LINE THAT KEEPS MONETIZATION HONEST:
//
//     The gacha sells breadth and speed. It never sells a power ceiling you
//     cannot earn.
//
// Every drop has a play-based route: Fragments come from repeat delves as well
// as from duplicates, and one hero is free at the start so the system is
// reachable without spending anything. Break that and the positioning goes
// with it.
//
// FOUR RULES, none of them negotiable:
//
//  - PITY IS MANDATORY. It is the single thing that makes a gacha read as fair
//    rather than predatory, and it matters more here, in a cozy game, than it
//    would in a mid-core one.
//  - DUPLICATES ALWAYS CONVERT TO FRAGMENTS. No dead pulls, ever.
//  - PULLS COST GEMS DIRECTLY. One wallet, one thing to understand; every
//    event already gifts Gems.
//  - ROLLS USE THE SEEDED HASH RNG, keyed by (seed, banner, pullNumber). Gacha
//    odds are the one thing that will eventually HAVE to be server-authoritative,
//    and this design makes that a lift-and-shift rather than a rewrite.

import { COLLECTION, GACHA, HERO_ORDER, HEROES } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { emptyEntry, levelBlock, levelCost, tierBlock, tierCost, type CollectionEntry } from './collection';
import { rand } from './rng';
import { addToWallet, getWallet, type GameState, type HeroId } from './state';

// ------------------------------------------------------------ the collection

export const ownsHeroId = (state: GameState, id: HeroId): boolean =>
  state.heroes.owned.includes(id);

export function heroEntry(state: GameState, id: HeroId): CollectionEntry {
  return {
    level: state.heroes.levels[id] ?? 1,
    tier: state.heroes.tiers[id] ?? 1,
    fragments: state.heroes.fragments[id] ?? 0,
  };
}

export function grantHero(state: GameState, id: HeroId): 'Granted' | 'Duplicate' {
  if (ownsHeroId(state, id)) {
    state.heroes.fragments[id] = (state.heroes.fragments[id] ?? 0) + GACHA.duplicateFragments;
    return 'Duplicate';
  }
  state.heroes.owned.push(id);
  const fresh = emptyEntry();
  state.heroes.levels[id] = fresh.level;
  state.heroes.tiers[id] = fresh.tier;
  state.heroes.fragments[id] = state.heroes.fragments[id] ?? 0;
  return 'Granted';
}

export type HeroLevelResult =
  | 'Levelled' | 'NotOwned' | 'AtMaxLevel' | 'TierCapped' | 'NotEnoughKnowledge';

export function levelUpHero(state: GameState, id: HeroId): HeroLevelResult {
  if (!ownsHeroId(state, id)) return 'NotOwned';
  const entry = heroEntry(state, id);
  const block = levelBlock(entry, getWallet(state.kingdom.wallet, 'Knowledge'));
  if (block !== null) return block;
  addToWallet(state.kingdom.wallet, 'Knowledge', -levelCost(entry.level));
  state.heroes.levels[id] = entry.level + 1;
  return 'Levelled';
}

export type HeroTierResult = 'Raised' | 'NotOwned' | 'AtMaxTier' | 'NotEnoughFragments';

export function raiseHeroTier(state: GameState, id: HeroId): HeroTierResult {
  if (!ownsHeroId(state, id)) return 'NotOwned';
  const entry = heroEntry(state, id);
  const block = tierBlock(entry);
  if (block !== null) return block;
  state.heroes.fragments[id] = entry.fragments - tierCost(entry.tier);
  state.heroes.tiers[id] = entry.tier + 1;
  return 'Raised';
}

/** A hero's stat line at their current level, for the roster and the party. */
export function heroStats(state: GameState, id: HeroId): { atk: number; def: number; hp: number } {
  const def = HEROES[id];
  const level = heroEntry(state, id).level;
  return {
    atk: Math.round(def.atk + def.atkPerLevel * (level - 1)),
    def: Math.round(def.def + def.defPerLevel * (level - 1)),
    hp: Math.round(def.hp + def.hpPerLevel * (level - 1)),
  };
}

/** Delves pay XP whether or not the run banked anything, so a bad push still
 *  taught the party something. XP is a soft second track: it never gates. */
export function addHeroXp(state: GameState, id: HeroId, amount: number): void {
  state.heroes.xp[id] = (state.heroes.xp[id] ?? 0) + amount;
}

// ------------------------------------------------------------------ the pull

export const STANDARD_BANNER = 'standard';

/**
 * What the NEXT pull costs on this banner.
 *
 * The first one on the standard banner is free (Docs/onboarding.md, step 25).
 * The tutorial hands the player a hero rather than a price list: a summon they
 * have never seen is not something they can judge the cost of, and a banner
 * whose first impression is "you cannot afford this" teaches the wrong thing
 * about the whole system.
 *
 * It needs no new save field — `pullCounts` is already persisted for pity, and
 * "have you pulled here yet" is exactly what it records.
 */
export const pullCost = (state: GameState, banner: string = STANDARD_BANNER): number =>
  (banner === STANDARD_BANNER && pullCount(state, banner) === 0) ? 0 : GACHA.pullGemCost;

export const pullCount = (state: GameState, banner: string): number =>
  state.gacha.pullCounts[banner] ?? 0;

/** How many pulls since the last hero. The counter the screen must always show
 *  — a hidden pity counter is the same as no pity counter. */
export const pityCount = (state: GameState, banner: string): number =>
  state.gacha.pityCounters[banner] ?? 0;

export const pullsToGuarantee = (state: GameState, banner: string): number =>
  Math.max(0, GACHA.hardPityAt - pityCount(state, banner));

/**
 * The chance THIS pull yields a hero.
 *
 * Soft pity ramps the rate between `softPityAt` and `hardPityAt` so the run of
 * misses gets visibly better rather than staying flat until a cliff; hard pity
 * is a guarantee, not a probability.
 */
export function heroChanceAt(pity: number): number {
  if (pity >= GACHA.hardPityAt - 1) return 1;
  if (pity < GACHA.softPityAt) return GACHA.heroChance;
  const span = Math.max(1, GACHA.hardPityAt - GACHA.softPityAt);
  const t = (pity - GACHA.softPityAt) / span;
  return Math.min(1, GACHA.heroChance + (1 - GACHA.heroChance) * t);
}

export interface PullResult {
  result: 'Pulled' | 'NotEnoughGems' | 'NothingToPull';
  heroId: HeroId | null;
  /** True when the hero was already owned and converted to Fragments. */
  duplicate: boolean;
  /** Fragments paid — from a duplicate, or the consolation on a miss. */
  fragments: number;
  fragmentsOf: HeroId | null;
  /** Knowledge paid — the same on every pull, hero or not. */
  knowledge: number;
  /** Whether hard pity delivered this one. */
  guaranteed: boolean;
}

/**
 * One pull.
 *
 * Keyed by `(seed, banner, pullNumber)` — the pull counter IS the key, and it
 * has to be persisted for pity anyway, which is exactly why the "long unkeyed
 * sequence" objection to a hash RNG does not apply here.
 */
export function pull(state: GameState, banner: string = STANDARD_BANNER): PullResult {
  const miss: PullResult = {
    result: 'NotEnoughGems', heroId: null, duplicate: false,
    fragments: 0, fragmentsOf: null, knowledge: 0, guaranteed: false,
  };
  const cost = pullCost(state, banner);
  if (getWallet(state.player.wallet, 'Gems') < cost) return miss;

  const pool = bannerPool(state, banner);
  if (pool.length === 0) {
    return { ...miss, result: 'NothingToPull' };
  }

  addToWallet(state.player.wallet, 'Gems', -cost);
  // Every pull pays Knowledge, before the roll is even read. A banner is one
  // of the two places Knowledge comes from, and paying it up front is what
  // makes the WHOLE pull worth something — the Fragments below only ever
  // point at one hero, but Knowledge levels whoever the player already has.
  addToWallet(state.kingdom.wallet, 'Knowledge', GACHA.pullKnowledge);
  recordResourceDiscovery(state, 'Knowledge');
  const n = pullCount(state, banner);
  const pity = pityCount(state, banner);
  state.gacha.pullCounts[banner] = n + 1;

  const chance = heroChanceAt(pity);
  const roll = rand(state.seed, 'gacha', banner, n);
  if (roll >= chance) {
    // Never a dead pull: a miss still pays Fragments toward someone.
    state.gacha.pityCounters[banner] = pity + 1;
    const target = pool[Math.floor(rand(state.seed, 'gachaFrag', banner, n) * pool.length)];
    state.heroes.fragments[target] =
      (state.heroes.fragments[target] ?? 0) + GACHA.fragmentsPerMiss;
    return {
      result: 'Pulled', heroId: null, duplicate: false,
      fragments: GACHA.fragmentsPerMiss, fragmentsOf: target,
      knowledge: GACHA.pullKnowledge, guaranteed: false,
    };
  }

  state.gacha.pityCounters[banner] = 0;
  const heroId = pool[Math.floor(rand(state.seed, 'gachaHero', banner, n) * pool.length)];
  const outcome = grantHero(state, heroId);
  return {
    result: 'Pulled',
    heroId,
    duplicate: outcome === 'Duplicate',
    fragments: outcome === 'Duplicate' ? GACHA.duplicateFragments : 0,
    fragmentsOf: outcome === 'Duplicate' ? heroId : null,
    knowledge: GACHA.pullKnowledge,
    guaranteed: pity >= GACHA.hardPityAt - 1,
  };
}

/** Who can come out of this banner. Unowned heroes first — an unowned hero is
 *  the reason to pull — falling back to the full roster once they are all
 *  found, so late pulls still pay Fragments into something. */
export function bannerPool(state: GameState, banner: string): HeroId[] {
  void banner;
  const missing = HERO_ORDER.filter((id) => !ownsHeroId(state, id));
  return missing.length > 0 ? missing : [...HERO_ORDER];
}

/** Every hero, with what the player has of them — the roster screen's data. */
export function rosterView(state: GameState): Array<{
  id: HeroId; owned: boolean; entry: CollectionEntry; levelCap: number;
}> {
  return HERO_ORDER.map((id) => {
    const entry = heroEntry(state, id);
    return {
      id,
      owned: ownsHeroId(state, id),
      entry,
      levelCap: Math.min(COLLECTION.maxLevel, entry.tier * COLLECTION.levelsPerTier),
    };
  });
}
