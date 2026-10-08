// Heroes and the gacha (Docs/features/10-heroes.md).
//
// Fragments and a Stardust toll fill a hero's ascension stars one point at a
// time, and each full star raises the level cap Hero XP climbs inside
// (sim/heroLadder.ts).
//
// THE LINE THAT KEEPS MONETIZATION HONEST:
//
//     The gacha sells power. It never sells a power ceiling you cannot also
//     reach by playing.
//
// Every drop has a play-based route: Fragments come from repeat delves as well
// as from duplicates, and the first call is free and always a hero, so the
// system is reachable without spending anything. Break that and the positioning goes
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

import { track } from './analytics';
import { tr } from '../i18n/tr';
import { roundPrice } from './roundPrice';
import { addModifier, resolve, type ModifierStat } from './modifiers';
import { techMultiplier, techValue } from './techEffects';
import {
  BANNER_ORDER, BANNERS, DISTRICTS, HERO_LADDER, HERO_ORDER, HEROES, PARTY, heroesOfRarity, levelIndexed,
  type BannerId, type BannerLoot, type HeroBoon, type HeroRarity,
} from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import {
  ascensionBlock, ascensionFragmentCost, emptyEntry, fullStars, heroBody, heroLevelCap, isHeroMaxLevel,
  xpLevelCost, type CollectionEntry,
} from './heroLadder';
import { dayIndex } from './day';
import { rand } from './rng';
import { addToWallet, getWallet, type GoodsStock, type ItemId, type GameState, type HeroId } from './state';
import { SKILLS, maxSkillRank } from './skills';
import { resolvePrice } from './precious';
import { canAffordGoods, payGoods } from './goods';
import { recordEvent } from './events';
import { grantItem, itemCount, takeItem } from './bag';

// ------------------------------------------------------------ the collection

export const ownsHeroId = (state: GameState, id: HeroId): boolean =>
  state.heroes.owned.includes(id);

export function heroEntry(state: GameState, id: HeroId): CollectionEntry {
  return {
    level: state.heroes.levels[id] ?? 1,
    ascension: state.heroes.ascension[id] ?? 0,
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
  state.heroes.ascension[id] = fresh.ascension;
  state.heroes.fragments[id] = state.heroes.fragments[id] ?? 0;
  syncHeroBoons(state);
  return 'Granted';
}

// -------------------------------------------------------------- the boons

const BOON_PREFIX = 'hero:';

/**
 * THE BOON (Docs/proposals/legendary-boons.md): one kingdom passive per
 * LEGENDARY hero, on while that hero is owned.
 *
 * Not the type passive (which acts on the board, at battle start) and not the
 * trait (which acts on a party, best-of and never summed). A boon is a
 * modifier at the base stage, `expiresAt: null`, in the same stack a relic
 * uses — and boons SUM, because two Legendaries are two heroes rather than two
 * quartermasters in one party.
 *
 * Idempotent and total, for the reason `syncArtifactModifiers` gives: a call
 * landing, a save loading and a debug grant all move the same input, and one
 * rebuild that cannot drift beats three paths that each have to remember.
 */
export function syncHeroBoons(state: GameState): void {
  state.modifiers = state.modifiers.filter((m) => !m.id.startsWith(BOON_PREFIX));
  for (const id of state.heroes.owned) {
    const { boon } = HEROES[id];
    if (boon === null) continue;
    addModifier(state, {
      id: `${BOON_PREFIX}${id}`,
      source: 'hero',
      stat: boon.stat,
      scope: null,
      op: 'mul',
      value: boon.value,
      expiresAt: null,
    });
  }
}

/**
 * WHAT A BOON SAYS, generated rather than authored — the technology card's
 * rule (`techProse.ts`), for the same reason: a sentence on the sheet drifts
 * from the number beside it the first time the number moves.
 *
 * One line per stat a boon may carry. A stat with no line here is a boon the
 * player cannot read, which `tests/heroBoons.test.ts` refuses to let ship.
 */
const BOON_SAYS: Partial<Record<ModifierStat, (v: string) => string>> = {
  buildSpeed: (v) => tr('The builders work {v} faster', { v }),
  worldRevealSpeed: (v) => tr('Explorers march {v} faster', { v }),
  manaRegen: (v) => tr('Your kingdom makes {v} more Mana', { v }),
  knowledgeYield: (v) => tr('Every lump of Knowledge is {v} bigger', { v }),
  heroXp: (v) => tr('Every room teaches your heroes {v} more', { v }),
  unitHp: (v) => tr('Every unit you field has {v} more health', { v }),
  unitAtk: (v) => tr('Every unit you field hits {v} harder', { v }),
  unitDef: (v) => tr('Every unit you field takes {v} less', { v }),
  armyCap: (v) => tr('Your halls field {v} more power', { v }),
  discoverRadius: (v) => tr('Your buildings see {v} further', { v }),
  tapYield: (v) => tr('Every tap is worth {v} more', { v }),
  stardustYield: (v) => tr('Rooms pay {v} more Stardust', { v }),
  workerSpeed: (v) => tr('Your workers walk {v} faster', { v }),
  manaCap: (v) => tr('Your Mana pool holds {v} more', { v }),
  taxRate: (v) => tr('Your villagers pay {v} more tax', { v }),
  workerYield: (v) => tr('Every worker carries {v} more', { v }),
};

/** The sentence a hero's card prints under its trait, or null if it has no
 *  boon. A boon is always a multiplier, so the number is always a percent. */
export function boonText(boon: HeroBoon): string | null {
  const says = BOON_SAYS[boon.stat];
  if (says === undefined) return null;
  return says(`${Math.round((boon.value - 1) * 100)}%`);
}

/** Every boon the player is collecting — the roster's own summary. */
export const activeBoons = (state: GameState): Array<{ id: HeroId; boon: HeroBoon }> =>
  state.heroes.owned
    .map((id) => ({ id, boon: HEROES[id].boon }))
    .filter((row): row is { id: HeroId; boon: HeroBoon } => row.boon !== null);

export type HeroLevelResult =
  | 'Levelled' | 'NotOwned' | 'AtMaxLevel' | 'AscensionCapped' | 'NotEnoughXp';

/**
 * A level costs HERO XP, not Stardust.
 *
 * The two are not interchangeable and the split is the point: Stardust is the
 * relics' currency with a hero tax on it (the ascension toll), and XP is what
 * a hero's own levels are bought with. Written out longhand rather than
 * through the shared `levelBlock`, which reads a Stardust purse and is the
 * relics'.
 */
export function levelUpHero(state: GameState, id: HeroId): HeroLevelResult {
  if (!ownsHeroId(state, id)) return 'NotOwned';
  const entry = heroEntry(state, id);
  if (isHeroMaxLevel(entry)) return 'AtMaxLevel';
  if (entry.level >= heroLevelCap(entry.ascension)) return 'AscensionCapped';
  const cost = xpLevelCost(entry.level);
  if (getWallet(state.kingdom.wallet, 'HeroXp') < cost) return 'NotEnoughXp';
  addToWallet(state.kingdom.wallet, 'HeroXp', -cost);
  state.heroes.levels[id] = entry.level + 1;
  recordEvent(state, { kind: 'heroLevel', hero: id });
  track(state, 'hero_up', { hero: id, what: 'level', to: entry.level + 1 });
  return 'Levelled';
}

/**
 * Fragments that buy an unowned hero outright.
 *
 * The banner hands out TWO different prizes — a hero, or fragments of one —
 * and until this existed the second was only worth anything on a hero you
 * already had. Fragments of a stranger piled up against a door with no
 * handle, which is the one thing "every gacha drop has a play-based route"
 * (Docs/features/10-heroes.md §4) cannot survive.
 *
 * It is deliberately NOT an ascension: an unlocked hero still starts with
 * every star empty and the whole ascension ladder ahead of them.
 */
export const heroUnlockCost = (id: HeroId): number => HERO_LADDER.recruitFragments[HEROES[id].rarity];

export type HeroUnlockResult = 'Unlocked' | 'AlreadyOwned' | 'NotEnoughFragments';

export function unlockHero(state: GameState, id: HeroId): HeroUnlockResult {
  if (ownsHeroId(state, id)) return 'AlreadyOwned';
  const held = state.heroes.fragments[id] ?? 0;
  if (held < heroUnlockCost(id)) return 'NotEnoughFragments';
  // Spend, then grant — `grantHero` preserves whatever is left over, so a
  // player sitting on seventeen keeps two toward the first ascensions.
  state.heroes.fragments[id] = held - heroUnlockCost(id);
  grantHero(state, id);
  track(state, 'hero_up', { hero: id, what: 'recruit', to: 1 });
  return 'Unlocked';
}

/** Enough fragments to recruit them, and not owned yet. */
export const canUnlockHero = (state: GameState, id: HeroId): boolean =>
  !ownsHeroId(state, id) && (state.heroes.fragments[id] ?? 0) >= heroUnlockCost(id);

/**
 * The Stardust the NEXT ascension asks for on top of the fragments — the
 * same for every point of a star, `growth` times dearer each star.
 *
 * A hero pays TWO prices to ascend and a relic pays one: the fragments are
 * the chase, the Stardust is the toll (Docs/features/10-heroes.md §4). It is
 * what keeps Stardust the relics' currency with a hero tax on it rather than
 * a second hero currency.
 */
export const ascensionStardustCost = (ascension: number): number => roundPrice(
  HERO_LADDER.ascensionStardustBase * HERO_LADDER.ascensionStardustGrowth ** fullStars(ascension),
);

export type HeroAscendResult =
  | 'Ascended' | 'NotOwned' | 'AtMaxAscension' | 'NotEnoughFragments' | 'NotEnoughStardust';

/** Fill the next point of the hero's current star. */
export function ascendHero(state: GameState, id: HeroId): HeroAscendResult {
  if (!ownsHeroId(state, id)) return 'NotOwned';
  const entry = heroEntry(state, id);
  const block = ascensionBlock(entry);
  if (block !== null) return block;
  const toll = ascensionStardustCost(entry.ascension);
  if (getWallet(state.kingdom.wallet, 'Stardust') < toll) return 'NotEnoughStardust';
  // Both prices, or neither: a half-paid ascension would eat the fragments
  // and leave the star where it was.
  addToWallet(state.kingdom.wallet, 'Stardust', -toll);
  state.heroes.fragments[id] = entry.fragments - ascensionFragmentCost(entry.ascension);
  state.heroes.ascension[id] = entry.ascension + 1;
  track(state, 'hero_up', { hero: id, what: 'star', to: entry.ascension + 1 });
  return 'Ascended';
}

// -------------------------------------------------------------- skill ranks

/** A hero's skill rank: 1 until a rank is bought (10-heroes.md §2.5). */
export const skillRank = (state: GameState, id: HeroId): number =>
  Math.min(maxSkillRank(), state.heroes.skillRanks[id] ?? 1);

/** The level the NEXT rank unlocks at, or null at the top. */
export function nextSkillRankLevel(rank: number): number | null {
  return HERO_LADDER.skillRankLevels[rank - 1] ?? null;
}

/**
 * What the NEXT rank costs: Stardust, and the skill family's precious
 * material — asked only once the world is open (19-world-map.md §7.6), so
 * before the Watchtower a rank is Stardust alone.
 */
export function skillRankPrice(state: GameState, id: HeroId): { stardust: number; goods: GoodsStock } | null {
  const rank = skillRank(state, id);
  if (rank >= maxSkillRank()) return null;
  const material = SKILLS[HEROES[id].skill.id].material;
  return {
    stardust: HERO_LADDER.skillRankStardust[rank - 1] ?? 0,
    goods: resolvePrice(state, { [material]: HERO_LADDER.skillRankMaterial[rank - 1] ?? 0 }),
  };
}

export type SkillRankBlock = 'NotOwned' | 'AtMaxRank' | 'LevelTooLow' | 'NotEnoughStardust' | 'NotEnoughMaterial';

/** Why the next rank cannot be bought now, or null when it can. */
export function skillRankBlock(state: GameState, id: HeroId): SkillRankBlock | null {
  if (!ownsHeroId(state, id)) return 'NotOwned';
  const price = skillRankPrice(state, id);
  if (price === null) return 'AtMaxRank';
  const unlock = nextSkillRankLevel(skillRank(state, id))!;
  if (heroEntry(state, id).level < unlock) return 'LevelTooLow';
  if (getWallet(state.kingdom.wallet, 'Stardust') < price.stardust) return 'NotEnoughStardust';
  if (!canAffordGoods(state.city.goods, price.goods)) return 'NotEnoughMaterial';
  return null;
}

export type SkillRankResult = 'Ranked' | SkillRankBlock;

/** Buy the next skill rank. Never raised on its own: a level only unlocks
 *  the purchase (10-heroes.md §2.5). */
export function buySkillRank(state: GameState, id: HeroId): SkillRankResult {
  const block = skillRankBlock(state, id);
  if (block !== null) return block;
  const price = skillRankPrice(state, id)!;
  addToWallet(state.kingdom.wallet, 'Stardust', -price.stardust);
  payGoods(state.city.goods, price.goods);
  state.heroes.skillRanks[id] = skillRank(state, id) + 1;
  track(state, 'hero_up', { hero: id, what: 'skill', to: skillRank(state, id) });
  return 'Ranked';
}

/** A hero's stat line at their current level, for the roster and the party. */
export function heroStats(state: GameState, id: HeroId): { atk: number; dmg: number; def: number; hp: number } {
  const entry = heroEntry(state, id);
  const body = heroBody(HEROES[id], entry.level, entry.ascension);
  return {
    atk: Math.round(body.atk), dmg: Math.round(body.dmg), def: Math.round(body.def), hp: Math.round(body.hp),
  };
}

// ---------------------------------------------------------- the hero slots

/**
 * How many heroes the player may put on a board.
 *
 * **One is free and every further one is Gems, always**
 * (Docs/features/10-heroes.md §3), up to the board's three
 * (Docs/features/combat.md §3) — which is what keeps a hero slot the one
 * thing in the party that is bought rather than earned, and the party's TROOP
 * slots the one thing that is earned rather than bought.
 */
export const heroSlots = (state: GameState): number =>
  Math.min(PARTY.heroSlots, 1 + state.heroes.heroSlotsPurchased);

/** The next one's price: the party-slot ladder with a higher base, because a
 *  hero slot carries a type buff as well as a body. */
export const heroSlotGemCost = (state: GameState): number => roundPrice(
  PARTY.heroSlotGemCostBase * PARTY.heroSlotGemCostGrowth ** state.heroes.heroSlotsPurchased,
);

export type BuyHeroSlotResult = 'Purchased' | 'AtMax' | 'NotEnoughGems';

export function buyHeroSlot(state: GameState): BuyHeroSlotResult {
  if (heroSlots(state) >= PARTY.heroSlots) return 'AtMax';
  const cost = heroSlotGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  track(state, 'gems_spent', { sink: 'hero_slot', gems: cost });
  state.heroes.heroSlotsPurchased += 1;
  return 'Purchased';
}

/**
 * Bank what a fight taught the party.
 *
 * ONE KINGDOM COUNTER, not a tally per hero. XP used to be written beside the
 * hero that earned it and read by nobody, and the moment it started buying
 * levels that shape would have been the wrong one: a Legendary pulled today
 * would arrive at level 1 with an empty tally of its own, unusable until it
 * had gone and earned one. It is levelled with what the Commons brought back
 * instead (Docs/features/10-heroes.md §4).
 */
export function addHeroXp(state: GameState, amount: number): number {
  // The Sagas' Tales (+%/rank) and every Tavern level, rounded once here so
  // XP stays a whole number.
  const paid = Math.round(resolve(state, 'heroXp',
    techValue(state, 'heroXp', amount) * tavernXpMultiplier(state)));
  addToWallet(state.kingdom.wallet, 'HeroXp', paid);
  recordResourceDiscovery(state, 'HeroXp');
  return paid;
}

/** What every standing Tavern does to Hero XP: its level's TOTAL percent,
 *  summed over the Taverns (there is one). ×1 with none. */
export function tavernXpMultiplier(state: GameState): number {
  let pct = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built') continue;
    const list = DISTRICTS[d.definitionId].heroXpBonusPerLevel;
    if (list.length > 0) pct += levelIndexed(list, d.level);
  }
  return 1 + pct / 100;
}

// ------------------------------------------------------------------ the pull

/** Stardust a call's loot pays: the authored amount, raised by the Sagas'
 *  Warm Welcome (`summonStardust`). Whole units. */
export const callStardust = (state: GameState, amount: number): number =>
  Math.round(amount * techMultiplier(state, 'summonStardust'));

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
): { key: ItemId; amount: number } {
  const free = banner === STANDARD_BANNER && pullCount(state, banner) === 0;
  return { key: BANNERS[banner].key, amount: free ? 0 : 1 };
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
 * The chance a call brings a hero BEFORE pity: a ladder by how many heroes
 * the player owns (Docs/features/10-heroes.md §6.6) — generous while the
 * roster is empty, thin once it is not, the last rung for ever after.
 */
export function baseHeroChance(state: GameState, banner: BannerId = STANDARD_BANNER): number {
  const ladder = BANNERS[banner].heroChanceByOwned;
  return ladder[Math.min(state.heroes.owned.length, ladder.length - 1)] ?? 0;
}

/**
 * The chance THIS pull yields a hero.
 *
 * Soft pity ramps the rate between `softPityAt` and `hardPityAt` so the run of
 * misses gets visibly better rather than staying flat until a cliff; hard pity
 * is a guarantee, not a probability.
 */
export function heroChanceAt(
  state: GameState, banner: BannerId = STANDARD_BANNER, pity = pityCount(state, banner),
): number {
  const b = BANNERS[banner];
  const base = baseHeroChance(state, banner);
  if (pity >= b.hardPityAt - 1) return 1;
  if (pity < b.softPityAt) return base;
  const span = Math.max(1, b.hardPityAt - b.softPityAt);
  const t = (pity - b.softPityAt) / span;
  return Math.min(1, base + (1 - base) * t);
}

/** Which rarities this banner can roll at all: a weight of 0 excludes one,
 *  which is how the Legendary stays off the basic call. */
export const bannerRarities = (banner: BannerId): HeroRarity[] =>
  (Object.keys(BANNERS[banner].weights) as HeroRarity[])
    .filter((r) => BANNERS[banner].weights[r] > 0);

// ------------------------------------------------------------------ the bag

/**
 * THE BAG (Docs/features/10-heroes.md §6.6): the heroes a call can reach, per
 * rarity and shared by both banners — every hero the player owns, plus a few
 * they do not, the OPEN ones.
 *
 * It exists to put Fragments where they recruit. A call that pays a fragment
 * of any of fourteen strangers leaves fourteen bars a tenth full; a call that
 * pays one of three fills a bar to a recruit.
 *
 * Derived, never stored: who is owned, who holds Fragments and the order say
 * what is in it, so there is no save field to migrate and nothing to drift.
 */

/** The order a rarity's heroes open in: the ranked ones by `bagRank`, then
 *  the rest shuffled per kingdom — a hash of the hero, never of the moment. */
export function bagOrder(state: GameState, rarity: HeroRarity): HeroId[] {
  const all = heroesOfRarity(rarity);
  const ranked = all.filter((id) => HEROES[id].bagRank !== null)
    .sort((a, b) => HEROES[a].bagRank! - HEROES[b].bagRank!);
  const shuffled = all.filter((id) => HEROES[id].bagRank === null)
    .map((id) => ({ id, key: rand(state.seed, 'heroBag', id) }))
    .sort((a, b) => a.key - b.key)
    .map(({ id }) => id);
  return [...ranked, ...shuffled];
}

/** The season heroes the banners lean toward. */
const featuredHeroes = (): HeroId[] =>
  BANNER_ORDER.map((b) => BANNERS[b].featuredHero).filter((id): id is HeroId => id !== '');

/**
 * The heroes of a rarity the player does not own that are open: the first
 * `bagOpen` of them in the bag's order, and — over that count — any who
 * already hold Fragments, so a Fragment from elsewhere is never stranded, and
 * a season hero while its banner leans toward them.
 */
export function openHeroes(state: GameState, rarity: HeroRarity): HeroId[] {
  const missing = bagOrder(state, rarity).filter((id) => !ownsHeroId(state, id));
  const base = new Set(missing.slice(0, HERO_LADDER.bagOpen[rarity]));
  const featured = featuredHeroes();
  return missing.filter((id) =>
    base.has(id) || (state.heroes.fragments[id] ?? 0) > 0 || featured.includes(id));
}

/** Everyone of a rarity in the bag: the owned, then the open. */
export const bagHeroes = (state: GameState, rarity: HeroRarity): HeroId[] => [
  ...heroesOfRarity(rarity).filter((id) => ownsHeroId(state, id)),
  ...openHeroes(state, rarity),
];

/**
 * Who a hit on this banner can hand you at this rarity: an open hero, a new
 * one. Only once the rarity is complete is it someone already owned — a
 * duplicate, paid in Fragments. An empty list means the banner does not call
 * this rarity; the caller falls back to another (`pull` does).
 */
export function bannerPool(state: GameState, banner: BannerId, rarity: HeroRarity): HeroId[] {
  if (BANNERS[banner].weights[rarity] <= 0) return [];
  const open = openHeroes(state, rarity);
  return open.length > 0 ? open : bagHeroes(state, rarity);
}

/** Everyone this banner could hand you or pay Fragments of, at any rarity —
 *  its share of the bag. */
export const bannerHeroes = (state: GameState, banner: BannerId): HeroId[] =>
  bannerRarities(banner).flatMap((r) => bagHeroes(state, r));

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

/** One prize a call drew from its banner's loot table, as paid. */
export type CallLoot =
  | { kind: 'fragments'; heroId: HeroId; amount: number }
  | { kind: 'currency'; currency: 'Stardust' | 'HeroXp'; amount: number }
  | { kind: 'item'; item: ItemId; amount: number };

export interface PullResult {
  result: 'Pulled' | 'NotEnoughKeys' | 'NothingToPull';
  heroId: HeroId | null;
  /** The rarity that was rolled; null on a miss. */
  rarity: HeroRarity | null;
  /** True when the hero was already owned and converted to Fragments. */
  duplicate: boolean;
  /** Fragments a duplicate paid. Loot fragments are in `loot`. */
  fragments: number;
  fragmentsOf: HeroId | null;
  /** The prizes the call drew from its loot table, hero or not. */
  loot: CallLoot[];
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
 * midnight. The day is UTC (`dayIndex`), for the reason `day.ts` gives — the
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

/** A weighted draw from some rows of a loot table, or null when none
 *  carries a weight. */
function drawRow(rows: readonly BannerLoot[], roll: number): BannerLoot | null {
  const live = rows.filter((e) => e.weight > 0);
  const total = live.reduce((sum, e) => sum + e.weight, 0);
  if (live.length === 0) return null;
  let cut = roll * total;
  for (const e of live) {
    cut -= e.weight;
    if (cut < 0) return e;
  }
  return live[live.length - 1]!;
}

/** Which slot a loot row fills: its reward says (10-heroes.md §6.4). */
export type LootSlot = 'hero' | 'heroGoods' | 'supplies';
export const lootSlot = (e: BannerLoot): LootSlot =>
  e.reward === 'Fragments' ? 'hero' : e.reward === 'Item' ? 'supplies' : 'heroGoods';

/**
 * A call's prizes beside the hero roll (Docs/features/10-heroes.md §6.4) —
 * THREE SLOTS, always: the hero slot pays a Fragment of a hero in the bag
 * when the roll missed (a hit fills it with the hero instead); the
 * hero-goods slot Stardust or Hero XP — or, on `extraHeroSlotChance` of
 * calls, a second Fragment; the supplies slot a speed-up or a chest. Paid as
 * drawn. Every roll is keyed by `(banner, pullNumber, slot)`, so a ten-call
 * is ten taps.
 */
export function drawLoot(state: GameState, banner: BannerId, n: number, hit: boolean): CallLoot[] {
  const b = BANNERS[banner];
  const rows = (slot: LootSlot): BannerLoot[] => b.loot.filter((e) => lootSlot(e) === slot);
  const out: CallLoot[] = [];
  const pay = (slot: LootSlot, i: number): void => {
    const entry = drawRow(rows(slot), rand(state.seed, 'gachaLoot', banner, n, i));
    if (entry === null) return;
    const paid = payLoot(state, banner, entry, rand(state.seed, 'gachaFrag', banner, n, i));
    if (paid !== null) out.push(paid);
  };
  if (!hit) pay('hero', 0);
  const extra = rand(state.seed, 'gachaExtra', banner, n) < b.extraHeroSlotChance;
  pay(extra ? 'hero' : 'heroGoods', 1);
  pay('supplies', 2);
  return out;
}

function payLoot(state: GameState, banner: BannerId, e: BannerLoot, roll: number): CallLoot | null {
  switch (e.reward) {
    case 'Fragments': {
      // Anyone of that rarity in the bag, owned or open: a fragment of a
      // held hero climbs the stars, of an open one toward a recruit.
      const rarity = e.rarity === '' ? null : e.rarity;
      const pool = rarity !== null && BANNERS[banner].weights[rarity] > 0
        ? bagHeroes(state, rarity) : bannerHeroes(state, banner);
      if (pool.length === 0) return null;
      const heroId = pool[Math.floor(roll * pool.length)]!;
      state.heroes.fragments[heroId] = (state.heroes.fragments[heroId] ?? 0) + e.amount;
      return { kind: 'fragments', heroId, amount: e.amount };
    }
    case 'Stardust': {
      const amount = callStardust(state, e.amount);
      addToWallet(state.kingdom.wallet, 'Stardust', amount);
      recordResourceDiscovery(state, 'Stardust');
      return { kind: 'currency', currency: 'Stardust', amount };
    }
    case 'HeroXp':
      return { kind: 'currency', currency: 'HeroXp', amount: addHeroXp(state, e.amount) };
    case 'Item':
      if (e.item === '') return null;
      grantItem(state, e.item, e.amount);
      return { kind: 'item', item: e.item, amount: e.amount };
  }
}

/**
 * One pull on one banner.
 *
 * Independent hash draws, all keyed by `(seed, namespace, banner,
 * pullNumber)` — never a stream, so a new consumer cannot shift every later
 * roll and a replay cannot desync (`rng.ts`):
 *
 *   1. hit or miss, against the hero-chance ladder and the soft-pity ramp
 *   2. on a hit, WHICH RARITY, by the banner's weights
 *   3. within that rarity, which hero — an open one from the bag
 *   4. the three slots' prizes (`drawLoot`) — the hero slot only on a miss
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
    fragments: 0, fragmentsOf: null, loot: [],
    guaranteed: false, guaranteedLegendary: false,
  };
  const price = pullPrice(state, banner);
  const cost = opts.free === true ? 0 : price.amount;
  if (itemCount(state, price.key) < cost) return miss;
  if (bannerHeroes(state, banner).length === 0) return { ...miss, result: 'NothingToPull' };

  if (cost > 0) takeItem(state, price.key, cost);

  const n = pullCount(state, banner);
  // THE FIRST CALL CANNOT MISS (Docs/features/22-progression.md §6): the
  // standard banner's first call is the free one, and a free call that pays
  // Fragments is a tutorial that teaches the wrong lesson. Only the hit is
  // forced; which hero is still the roll's.
  const firstCall = banner === STANDARD_BANNER && n === 0;
  // THE FIRST CALLS ACROSS EVERY BANNER ARE A NEW HERO: a quest that asks for
  // heroes must never wait on a roll. The hit is forced and the hero is one
  // the player does not own; which one is still the roll's.
  const starter = Object.values(state.gacha.pullCounts).reduce((sum, c) => sum + c, 0)
    < HERO_LADDER.firstCallsNewHero;
  const forcedHit = firstCall || starter;
  const pity = pityCount(state, banner);
  const legPity = legendaryPityCount(state, banner);
  state.gacha.pullCounts[banner] = n + 1;

  const roll = rand(state.seed, 'gacha', banner, n);
  if (!forcedHit && roll >= heroChanceAt(state, banner, pity)) {
    // Never a dead pull: the hero slot pays a Fragment instead.
    state.gacha.pityCounters[banner] = pity + 1;
    state.gacha.legendaryPity[banner] = legPity + 1;
    const loot = drawLoot(state, banner, n, false);
    track(state, 'hero_call', { banner, n: n + 1, free: cost === 0, hero: null, rarity: null });
    return {
      result: 'Pulled', heroId: null, rarity: null, duplicate: false,
      fragments: 0, fragmentsOf: null, loot,
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
  if (starter && pool.every((id) => ownsHeroId(state, id))) {
    // This rarity is complete: a starter call moves to one that is not.
    for (const r of bannerRarities(banner)) {
      const alt = bannerPool(state, banner, r).filter((id) => !ownsHeroId(state, id));
      if (alt.length > 0) { rarity = r; pool = alt; break; }
    }
  }

  state.gacha.pityCounters[banner] = 0;
  state.gacha.legendaryPity[banner] = rarity === 'Legendary' ? 0 : legPity + 1;
  const heroId = pool[Math.floor(rand(state.seed, 'gachaHero', banner, n) * pool.length)]!;
  const outcome = grantHero(state, heroId, b.duplicateFragments);
  const loot = drawLoot(state, banner, n, true);
  track(state, 'hero_call', {
    banner, n: n + 1, free: cost === 0, hero: heroId, rarity, duplicate: outcome === 'Duplicate',
  });
  return {
    result: 'Pulled',
    heroId,
    rarity,
    duplicate: outcome === 'Duplicate',
    fragments: outcome === 'Duplicate' ? b.duplicateFragments : 0,
    fragmentsOf: outcome === 'Duplicate' ? heroId : null,
    loot,
    guaranteed: forcedHit || pity >= b.hardPityAt - 1,
    guaranteedLegendary: forced && rarity === 'Legendary',
  };
}

// ------------------------------------------------- a call that cannot miss

/** What a guaranteed call paid. The shape a `PullResult` would have if a roll
 *  had happened — minus every field that describes one, because none did. */
export interface GuaranteedCall {
  heroId: HeroId;
  /** The player already had them, so the call paid Fragments instead. */
  duplicate: boolean;
  fragments: number;
}

/**
 * A CALL WHOSE HERO IS DECIDED BEFORE IT IS MADE — the collection prize's
 * golden call (Docs/features/09-relics.md §5, §10), and so far its only
 * caller.
 *
 * It is a CALL, so it converts a hero the player already owns into that
 * banner's duplicate Fragments, exactly as a rolled one does. It is
 * GUARANTEED, so it does four things a roll does not:
 *
 *  - it charges NOTHING. The five albums were the price.
 *  - it draws NO loot: the loot table is a roll, and this call has none.
 *  - it spends NO `rand`. There is nothing to decide, so there is no roll to
 *    key — which is also why it can never desync a replay (invariant 4).
 *  - it moves NO counter. `pullCounts` keys future rolls and the two pity
 *    counters are a promise about them; a call that never rolled must neither
 *    consume the pity a player has banked nor advance it.
 */
export function callGuaranteed(
  state: GameState, banner: BannerId, heroId: HeroId,
): GuaranteedCall {
  const b = BANNERS[banner];
  const outcome = grantHero(state, heroId, b.duplicateFragments);
  return {
    heroId,
    duplicate: outcome === 'Duplicate',
    fragments: outcome === 'Duplicate' ? b.duplicateFragments : 0,
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
  if (itemCount(state, price.key) < owed) {
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
      levelCap: heroLevelCap(entry.ascension),
    };
  });
}
