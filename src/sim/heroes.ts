// Heroes and the gacha (Docs/features/10-heroes.md).
//
// Heroes reuse the collection substrate verbatim: Fragments raise a tier cap,
// Stardust buys levels within it. That is the whole point of building the
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

import { resolve } from './modifiers';
import { techValue } from './techEffects';
import {
  BANNERS, COLLECTION, HERO_ORDER, HEROES, heroesOfRarity,
  type BannerId, type HeroRarity,
} from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { emptyEntry, levelBlock, levelCost, tierBlock, tierCost, type CollectionEntry } from './collection';
import { dayIndex } from './daily';
import { rand } from './rng';
import { addToWallet, getWallet, type CurrencyId, type GameState, type HeroId } from './state';

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

export function grantHero(
  state: GameState, id: HeroId, duplicateFragments = 0,
): 'Granted' | 'Duplicate' {
  if (ownsHeroId(state, id)) {
    state.heroes.fragments[id] = (state.heroes.fragments[id] ?? 0) + duplicateFragments;
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
  | 'Levelled' | 'NotOwned' | 'AtMaxLevel' | 'TierCapped' | 'NotEnoughStardust';

export function levelUpHero(state: GameState, id: HeroId): HeroLevelResult {
  if (!ownsHeroId(state, id)) return 'NotOwned';
  const entry = heroEntry(state, id);
  const block = levelBlock(entry, getWallet(state.kingdom.wallet, 'Stardust'));
  if (block !== null) return block;
  addToWallet(state.kingdom.wallet, 'Stardust', -levelCost(entry.level));
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
  // Drillmaster: +5%/rank, rounded once here so XP stays a whole number.
  const paid = Math.round(resolve(state, 'heroXp', techValue(state, 'heroXp', amount)));
  state.heroes.xp[id] = (state.heroes.xp[id] ?? 0) + paid;
}

// ------------------------------------------------------------------ the pull

export const STANDARD_BANNER: BannerId = 'basic';

/**
 * What the NEXT pull costs on this banner: one key of that banner's kind.
 *
 * A pull used to cost 1,000 Gems directly. Keys replaced that on 2026-09-08 —
 * Gems buy keys in the store and keys buy pulls — so the two banners are told
 * apart by their price before the player has read a single number, and the
 * free pull an ad pays for has something to be free OF.
 *
 * The first one on the basic banner is free (Docs/features/12-quests.md §2).
 * The tutorial hands the player a hero rather than a price list: a summon they
 * have never seen is not something they can judge the cost of. It needs no new
 * save field — `pullCounts` already records "have you pulled here yet".
 */
export function pullPrice(
  state: GameState, banner: BannerId = STANDARD_BANNER,
): { currency: CurrencyId; amount: number } {
  const free = banner === STANDARD_BANNER && pullCount(state, banner) === 0;
  return { currency: BANNERS[banner].key, amount: free ? 0 : 1 };
}

export const pullCount = (state: GameState, banner: string): number =>
  state.gacha.pullCounts[banner] ?? 0;

/** How many pulls since the last hero. The counter the screen must always show
 *  — a hidden pity counter is the same as no pity counter. */
export const pityCount = (state: GameState, banner: string): number =>
  state.gacha.pityCounters[banner] ?? 0;

/** How many pulls since the last Legendary. */
export const legendaryPityCount = (state: GameState, banner: string): number =>
  state.gacha.legendaryPity[banner] ?? 0;

export const pullsToGuarantee = (state: GameState, banner: BannerId): number =>
  Math.max(0, BANNERS[banner].hardPityAt - pityCount(state, banner));

/** …and to the Legendary guarantee, on a banner that has one. `null` when it
 *  does not, which is what the basic banner's card shows instead of a number. */
export const pullsToLegendary = (state: GameState, banner: BannerId): number | null =>
  BANNERS[banner].legendaryPityAt === 0
    ? null
    : Math.max(0, BANNERS[banner].legendaryPityAt - legendaryPityCount(state, banner));

/**
 * The chance THIS pull yields a hero.
 *
 * Soft pity ramps the rate between `softPityAt` and `hardPityAt` so the run of
 * misses gets visibly better rather than staying flat until a cliff; hard pity
 * is a guarantee, not a probability.
 */
export function heroChanceAt(pity: number, banner: BannerId = STANDARD_BANNER): number {
  const b = BANNERS[banner];
  if (pity >= b.hardPityAt - 1) return 1;
  if (pity < b.softPityAt) return b.heroChance;
  const span = Math.max(1, b.hardPityAt - b.softPityAt);
  const t = (pity - b.softPityAt) / span;
  return Math.min(1, b.heroChance + (1 - b.heroChance) * t);
}

/** Which rarities this banner can roll at all: a weight of 0 excludes one,
 *  which is how the Legendary stays off the basic call. */
export const bannerRarities = (banner: BannerId): HeroRarity[] =>
  (Object.keys(BANNERS[banner].weights) as HeroRarity[])
    .filter((r) => BANNERS[banner].weights[r] > 0);

/**
 * Who this banner can hand you at this rarity, preferring heroes the player
 * does not own.
 *
 * The "prefer unowned" rule is what makes a roster of thirty-two a collection
 * rather than a slot machine: a duplicate is only reachable once that rarity
 * is complete, and then it pays Fragments instead. An empty list means the
 * caller must fall back to another rarity — `pull` does.
 */
export function bannerPool(state: GameState, banner: BannerId, rarity: HeroRarity): HeroId[] {
  if (BANNERS[banner].weights[rarity] <= 0) return [];
  const all = heroesOfRarity(rarity);
  const missing = all.filter((id) => !ownsHeroId(state, id));
  return missing.length > 0 ? missing : all;
}

/** Everyone this banner could ever hand you, at any rarity — what a miss pays
 *  Fragments toward, and what the card lists. */
export const bannerHeroes = (state: GameState, banner: BannerId): HeroId[] =>
  bannerRarities(banner).flatMap((r) => bannerPool(state, banner, r));

/**
 * The rarity this pull lands on: a weighted draw, unless the Legendary
 * guarantee is due, in which case it is Legendary and no roll is spent.
 */
export function rarityFor(
  state: GameState, banner: BannerId, roll: number,
): HeroRarity {
  const b = BANNERS[banner];
  const rarities = bannerRarities(banner);
  if (b.legendaryPityAt > 0 && legendaryPityCount(state, banner) >= b.legendaryPityAt - 1) {
    return 'Legendary';
  }
  const total = rarities.reduce((n, r) => n + b.weights[r], 0);
  let cut = roll * total;
  for (const r of rarities) {
    cut -= b.weights[r];
    if (cut < 0) return r;
  }
  return rarities[rarities.length - 1]!;
}

export interface PullResult {
  result: 'Pulled' | 'NotEnoughKeys' | 'NothingToPull';
  heroId: HeroId | null;
  /** The rarity that was rolled; null on a miss. */
  rarity: HeroRarity | null;
  /** True when the hero was already owned and converted to Fragments. */
  duplicate: boolean;
  /** Fragments paid — from a duplicate, or the consolation on a miss. */
  fragments: number;
  fragmentsOf: HeroId | null;
  /** Stardust paid — the same on every pull of this banner, hero or not. */
  stardust: number;
  /** Whether hard pity delivered this one. */
  guaranteed: boolean;
  /** Whether the Legendary guarantee delivered this one. */
  guaranteedLegendary: boolean;
}

// ------------------------------------------------- the free pull, for an ad

/**
 * The free-pull ledger for a banner, rolled onto today.
 *
 * Lazy and idempotent, exactly as `store.ts` rolls the monthly budget: every
 * writer calls it, so a stale day never leaks and nothing has to happen at
 * midnight. The day is UTC (`dayIndex`), for the reason `daily.ts` gives — the
 * sim may not read a clock it was not handed, and a mechanic that never
 * punishes a miss can afford a rollover at a different local hour per player.
 */
function rollFreePulls(
  state: GameState, banner: BannerId, now: number,
): { day: number; used: number; readyAt: number } {
  const today = dayIndex(now);
  const held = state.gacha.freePulls[banner];
  if (held === undefined || held.day !== today) {
    const fresh = { day: today, used: 0, readyAt: held?.readyAt ?? 0 };
    state.gacha.freePulls[banner] = fresh;
    return fresh;
  }
  return held;
}

/** How many free pulls this banner has left today, without spending one. */
export function freePullsLeft(state: GameState, banner: BannerId, now: number): number {
  const today = dayIndex(now);
  const held = state.gacha.freePulls[banner];
  const used = held !== undefined && held.day === today ? held.used : 0;
  return Math.max(0, BANNERS[banner].freePerDay - used);
}

/** When the next free pull is offered, or 0 if one is offered now. A TIMER, so
 *  it is read from a stamp rather than counted down — a throttled tab and a
 *  night away both resolve correctly on return. */
export const freePullReadyAt = (state: GameState, banner: BannerId): number =>
  state.gacha.freePulls[banner]?.readyAt ?? 0;

export const freePullAvailable = (state: GameState, banner: BannerId, now: number): boolean =>
  BANNERS[banner].freePerDay > 0
  && freePullsLeft(state, banner, now) > 0
  && now >= freePullReadyAt(state, banner);

export type FreePullResult =
  | { result: 'Pulled'; pull: PullResult }
  | { result: 'NoneLeft' | 'OnCooldown' | 'NoFreePulls' };

/**
 * Spend the free allowance a rewarded ad pays for.
 *
 * The allowance lives here rather than in the presenter because it is state
 * the save owns and a refusal the sim must be able to make: the ad screen is
 * a surface, and a surface cannot be the thing that decides whether a pull is
 * owed.
 */
export function claimFreePull(
  state: GameState, banner: BannerId, now: number,
): FreePullResult {
  if (BANNERS[banner].freePerDay <= 0) return { result: 'NoFreePulls' };
  if (freePullsLeft(state, banner, now) <= 0) return { result: 'NoneLeft' };
  if (now < freePullReadyAt(state, banner)) return { result: 'OnCooldown' };
  const ledger = rollFreePulls(state, banner, now);
  ledger.used += 1;
  ledger.readyAt = now + BANNERS[banner].freeCooldownSeconds * 1000;
  return { result: 'Pulled', pull: pull(state, banner, { free: true }) };
}

/**
 * One pull on one banner.
 *
 * Three decisions, three independent hash draws, all keyed by
 * `(seed, namespace, banner, pullNumber)` — never a stream, so a new consumer
 * cannot shift every later roll and a replay cannot desync (`rng.ts`):
 *
 *   1. hit or miss, against the soft-pity ramp
 *   2. on a hit, WHICH RARITY, by the banner's weights
 *   3. within that rarity, which hero — preferring unowned
 *
 * `opts.free` skips the charge and nothing else: the allowance that grants it
 * lives in `claimFreePull`, so the roll cannot be reached without paying one
 * way or the other.
 */
export function pull(
  state: GameState,
  banner: BannerId = STANDARD_BANNER,
  opts: { free?: boolean } = {},
): PullResult {
  const b = BANNERS[banner];
  const miss: PullResult = {
    result: 'NotEnoughKeys', heroId: null, rarity: null, duplicate: false,
    fragments: 0, fragmentsOf: null, stardust: 0,
    guaranteed: false, guaranteedLegendary: false,
  };
  const price = pullPrice(state, banner);
  const cost = opts.free === true ? 0 : price.amount;
  if (getWallet(state.player.wallet, price.currency) < cost) return miss;
  if (bannerHeroes(state, banner).length === 0) return { ...miss, result: 'NothingToPull' };

  if (cost > 0) addToWallet(state.player.wallet, price.currency, -cost);
  addToWallet(state.kingdom.wallet, 'Stardust', b.pullStardust);
  recordResourceDiscovery(state, 'Stardust');

  const n = pullCount(state, banner);
  const pity = pityCount(state, banner);
  const legPity = legendaryPityCount(state, banner);
  state.gacha.pullCounts[banner] = n + 1;

  const roll = rand(state.seed, 'gacha', banner, n);
  if (roll >= heroChanceAt(pity, banner)) {
    // Never a dead pull: a miss still pays Fragments toward someone this
    // banner could have given you.
    state.gacha.pityCounters[banner] = pity + 1;
    state.gacha.legendaryPity[banner] = legPity + 1;
    const pool = bannerHeroes(state, banner);
    const target = pool[Math.floor(rand(state.seed, 'gachaFrag', banner, n) * pool.length)]!;
    state.heroes.fragments[target] = (state.heroes.fragments[target] ?? 0) + b.fragmentsPerMiss;
    return {
      result: 'Pulled', heroId: null, rarity: null, duplicate: false,
      fragments: b.fragmentsPerMiss, fragmentsOf: target, stardust: b.pullStardust,
      guaranteed: false, guaranteedLegendary: false,
    };
  }

  // Read the guarantee BEFORE the counters move — `rarityFor` consults it.
  const forced = b.legendaryPityAt > 0 && legPity >= b.legendaryPityAt - 1;
  let rarity = rarityFor(state, banner, rand(state.seed, 'gachaRarity', banner, n));
  let pool = bannerPool(state, banner, rarity);
  if (pool.length === 0) {
    // A rarity this banner weights that no hero carries yet. Fall back to one
    // it can actually fill rather than eating the pull.
    for (const r of bannerRarities(banner)) {
      const alt = bannerPool(state, banner, r);
      if (alt.length > 0) { rarity = r; pool = alt; break; }
    }
  }

  state.gacha.pityCounters[banner] = 0;
  state.gacha.legendaryPity[banner] = rarity === 'Legendary' ? 0 : legPity + 1;
  const heroId = pool[Math.floor(rand(state.seed, 'gachaHero', banner, n) * pool.length)]!;
  const outcome = grantHero(state, heroId, b.duplicateFragments);
  return {
    result: 'Pulled',
    heroId,
    rarity,
    duplicate: outcome === 'Duplicate',
    fragments: outcome === 'Duplicate' ? b.duplicateFragments : 0,
    fragmentsOf: outcome === 'Duplicate' ? heroId : null,
    stardust: b.pullStardust,
    guaranteed: pity >= b.hardPityAt - 1,
    guaranteedLegendary: forced && rarity === 'Legendary',
  };
}

export interface PullManyResult {
  result: 'Pulled' | 'NotEnoughKeys' | 'NothingToPull';
  pulls: PullResult[];
}

/**
 * Ten calls at once, at ten keys — no discount. Buying in bulk buys TIME, not
 * a better price: a discount would make the single call the wrong button and
 * quietly retire it.
 *
 * All or nothing: the purse is checked for the whole batch up front, so a
 * player never spends nine keys and is told the tenth is short. Correct by
 * construction otherwise — each iteration bumps `pullCounts`, so the rng parts
 * stay unique and both pity counters carry across the ten exactly as they
 * would across ten separate presses.
 */
export function pullMany(
  state: GameState, banner: BannerId, count: number,
): PullManyResult {
  const price = pullPrice(state, banner);
  // The free first call is free inside a batch too, so the batch costs one
  // less than it looks.
  const owed = price.amount === 0 ? Math.max(0, count - 1) : count;
  if (getWallet(state.player.wallet, price.currency) < owed) {
    return { result: 'NotEnoughKeys', pulls: [] };
  }
  if (bannerHeroes(state, banner).length === 0) {
    return { result: 'NothingToPull', pulls: [] };
  }
  const pulls: PullResult[] = [];
  for (let i = 0; i < count; i += 1) pulls.push(pull(state, banner));
  return { result: 'Pulled', pulls };
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
