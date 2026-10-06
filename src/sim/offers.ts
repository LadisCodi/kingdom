// The store's offers (Docs/features/14-monetization.md §2.4): packs that are
// not always on the shelf.
//
// An OFFER is a `store` product on the `offer` shelf. It has a WINDOW — when
// it opened, when it closes, how many it has sold — and something that opens
// it: a door, the purchase of the step before it in a chain, a Townhall
// level, a Mana pool run low, a build refused for want of a builder. A
// window that closes is read, never scheduled: an offer produces nothing, so
// it is no boundary of `advance()` (invariant 1) — `offerOn` compares the
// clock it is handed with the window's absolute instants.
//
// WHY THE LIVE TICK OPENS THEM, as it latches the ad offer (adOffers.ts): an
// offer is an opportunity shown to a player, not economy. Nothing in the sim
// reads it, and buying one is always a live action. A trigger met only in the
// middle of a replayed absence — the pool low at 3 a.m. — opens nothing.
//
// The DAILY offers are drawn, not opened: `dailyCount` products of the
// `daily` shelf a day, by `rand(seed, 'daily', day, sku)` — keyed on the day
// and the product, so the draw is the same however often it is asked and a
// product added to the pool moves no other product's roll (invariant 4).
//
// THE VALUE a pack prints is computed, never authored: what its contents
// would cost in Gems at the game's own Gem prices, over the Gems its price
// buys as a pack. An authored percentage could lie, and would go stale the
// first time a price moved.

import {
  BANNERS, BANNER_ORDER, DAILY_POOL, GEM_PACK_ORDER, HERO_LADDER, HEROES, ITEMS, KINGDOM_DEF, MANA, OFFERS,
  OFFER_ORDER, PARTY, STORE, WORLD, type StoreSkuDef,
} from './data/definitions';
import { track } from './analytics';
import { builderGemCost } from './commands';
import { dayIndex, DAY_MS } from './day';
import { isDoorOpen } from './doors';
import { adOfferEligible } from './adOffers';
import { addHeroXp, heroSlotGemCost, heroSlots } from './heroes';
import { grantItem } from './bag';
import { knowledgeGemPrice } from './knowledge';
import { rand } from './rng';
import { gemsToFinish } from './rush';
import { explorerGemCost } from './world/explorers';
import { addToWallet, townhall, type GameState, type HeroId, type ItemId, type OfferWindow, type StoreSkuId } from './state';

const HOUR_MS = 3_600_000;

/** Triggers that come back once their window has closed and cooled down. */
const REPEATS = new Set<StoreSkuDef['opensOn']>(['townhall', 'manaLow', 'buildersBusy']);

// ------------------------------------------------------------- the ceilings

/**
 * Can the kingdom still take everything permanent this pack opens? A pack
 * whose builder would go over the crew's ceiling is not sold half-useful:
 * it is held back, and does not open while it would be.
 */
export function slotsFit(state: GameState, sku: StoreSkuId): boolean {
  const s = STORE[sku];
  return state.kingdom.builders + s.builders <= KINGDOM_DEF.maxBuilders
    && heroSlots(state) + s.heroSlots <= PARTY.heroSlots
    && state.world.explorersBought + s.explorers <= WORLD.explorersForSale;
}

// ---------------------------------------------------------------- windows

export const offerWindow = (state: GameState, sku: StoreSkuId): OfferWindow | null =>
  state.player.offers.windows[sku] ?? null;

/** Is this offer on sale now: a window open, not sold out, and every slot it
 *  opens still fits? */
export function offerOn(state: GameState, sku: StoreSkuId, now: number): boolean {
  const w = offerWindow(state, sku);
  if (w === null || now < w.opened) return false;
  if (w.closes !== null && now >= w.closes) return false;
  const { limit } = STORE[sku];
  if (limit > 0 && w.bought >= limit) return false;
  return slotsFit(state, sku);
}

/** The offers on sale now, in shelf order. */
export const offersOn = (state: GameState, now: number): StoreSkuId[] =>
  OFFER_ORDER.filter((sku) => offerOn(state, sku, now));

/** May the trigger open this offer's window now? Once for a one-time trigger;
 *  for one that comes back, once the last window has closed and cooled. */
function mayOpen(state: GameState, sku: StoreSkuId, now: number): boolean {
  if (!isDoorOpen(state, 'store')) return false;
  if (!slotsFit(state, sku)) return false;
  const w = offerWindow(state, sku);
  if (w === null) return true;
  const s = STORE[sku];
  if (!REPEATS.has(s.opensOn) || w.closes === null) return false;
  return now >= w.closes + s.cooldownHours * HOUR_MS;
}

function open(state: GameState, sku: StoreSkuId, now: number): void {
  const { hours, opensOn } = STORE[sku];
  state.player.offers.windows[sku] = { opened: now, closes: hours > 0 ? now + hours * HOUR_MS : null, bought: 0 };
  track(state, 'offer_opened', { sku, trigger: opensOn });
}

/**
 * The latch, from the live tick. Opens every offer whose trigger is met and
 * whose window may open; buildersBusy is opened by the refusal itself
 * (`offerTrigger`), and an `after` by the purchase before it.
 */
export function refreshOffers(state: GameState, now: number): void {
  const level = townhall(state).level;
  const raised = level > state.player.offers.townhall;
  for (const sku of OFFER_ORDER) {
    const s = STORE[sku];
    const met = s.opensOn === 'always'
      || (s.opensOn === 'door' && s.door !== null && isDoorOpen(state, s.door))
      || (s.opensOn === 'after' && s.after !== null && (offerWindow(state, s.after)?.bought ?? 0) > 0)
      || (s.opensOn === 'townhall' && raised && level >= s.townhall)
      || (s.opensOn === 'manaLow' && adOfferEligible(state));
    if (met && mayOpen(state, sku, now)) open(state, sku, now);
  }
  state.player.offers.townhall = level;
}

/** A moment the live game reports rather than the tick sees: a build refused
 *  for want of a builder. */
export function offerTrigger(state: GameState, trigger: 'buildersBusy', now: number): StoreSkuId[] {
  const opened: StoreSkuId[] = [];
  for (const sku of OFFER_ORDER) {
    if (STORE[sku].opensOn === trigger && mayOpen(state, sku, now)) {
      open(state, sku, now);
      opened.push(sku);
    }
  }
  return opened;
}

/** A purchase of an offer: counted in its window, and the next step of its
 *  chain opened at once. */
export function recordOfferPurchase(state: GameState, sku: StoreSkuId, now: number): void {
  const w = offerWindow(state, sku);
  if (w !== null) w.bought += 1;
  for (const next of OFFER_ORDER) {
    if (STORE[next].opensOn === 'after' && STORE[next].after === sku && mayOpen(state, next, now)) open(state, next, now);
  }
}

// --------------------------------------------------------------- next day

/** Does this product hand anything over the day after it is bought? */
export const hasNextDay = (sku: StoreSkuId): boolean => {
  const s = STORE[sku];
  return s.nextDayGems + s.nextDayHeroXp + s.nextDayFragments > 0
    || Object.values(s.nextDayItems).some((n) => (n ?? 0) > 0);
};

/** A purchase with a next-day part: it waits for the start of the next day,
 *  UTC, and then for the player to claim it. */
export function scheduleNextDay(state: GameState, sku: StoreSkuId, now: number): void {
  if (!hasNextDay(sku)) return;
  state.player.offers.nextDay.push({ sku, claimableAt: (dayIndex(now) + 1) * DAY_MS });
}

/** The next-day deliveries the player can claim now. */
export const nextDayReady = (state: GameState, now: number): StoreSkuId[] =>
  state.player.offers.nextDay.filter((d) => now >= d.claimableAt).map((d) => d.sku);

/** A bought product's next-day part still waiting for its day. */
export const nextDayWaiting = (state: GameState, now: number): Array<{ sku: StoreSkuId; claimableAt: number }> =>
  state.player.offers.nextDay.filter((d) => now < d.claimableAt);

export type ClaimNextDayResult = 'Claimed' | 'NotYet' | 'Nothing';

/** Claim a product's next-day part: its Gems, Hero XP, fragments of its hero
 *  and items. */
export function claimNextDay(state: GameState, sku: StoreSkuId, now: number): ClaimNextDayResult {
  const at = state.player.offers.nextDay.findIndex((d) => d.sku === sku);
  if (at < 0) return 'Nothing';
  if (now < state.player.offers.nextDay[at].claimableAt) return 'NotYet';
  state.player.offers.nextDay.splice(at, 1);
  const s = STORE[sku];
  addToWallet(state.player.wallet, 'Gems', s.nextDayGems);
  if (s.nextDayHeroXp > 0) addHeroXp(state, s.nextDayHeroXp);
  if (s.hero !== null && s.nextDayFragments > 0) {
    state.heroes.fragments[s.hero] = (state.heroes.fragments[s.hero] ?? 0) + s.nextDayFragments;
  }
  for (const [id, n] of Object.entries(s.nextDayItems) as Array<[ItemId, number]>) grantItem(state, id, n);
  track(state, 'next_day_claimed', { sku });
  return 'Claimed';
}

// ------------------------------------------------------------------ daily

/** When today's draw ends and the next one begins. */
export const dailyResetsAt = (now: number): number => (dayIndex(now) + 1) * DAY_MS;

/** Today's daily offers: `dailyCount` of the pool, the Townhall's level
 *  permitting, the same draw however often it is asked. */
export function dailyOffers(state: GameState, now: number): StoreSkuId[] {
  if (!isDoorOpen(state, 'store')) return [];
  const day = dayIndex(now);
  const level = townhall(state).level;
  return DAILY_POOL
    .filter((sku) => STORE[sku].townhall <= level)
    .map((sku) => ({ sku, roll: rand(state.seed, 'daily', day, sku) }))
    .sort((a, b) => a.roll - b.roll)
    .slice(0, OFFERS.dailyCount)
    .map((d) => d.sku)
    .sort((a, b) => DAILY_POOL.indexOf(a) - DAILY_POOL.indexOf(b));
}

/** How many of this daily product were bought today. */
export const boughtToday = (state: GameState, sku: StoreSkuId, now: number): number =>
  (state.player.payer?.purchases ?? [])
    .filter((p) => p.sku === sku && dayIndex(p.at) === dayIndex(now)).length;

export function dailyOn(state: GameState, sku: StoreSkuId, now: number): boolean {
  if (!dailyOffers(state, now).includes(sku)) return false;
  const { limit } = STORE[sku];
  return limit === 0 || boughtToday(state, sku, now) < limit;
}

// ------------------------------------------------------------------ value

/** Gems a dollar buys at the best Gem pack — what the price of anything
 *  else is measured against. */
export function gemsPerDollar(): number {
  return Math.max(1, ...GEM_PACK_ORDER.map((id) => STORE[id].gems / STORE[id].priceUsd));
}

/** What a Bag item would cost in Gems: time at the Finish price, Mana at the
 *  first refill's, Knowledge at its fixed price, a key at the store's. */
export function itemGemWorth(id: ItemId): number {
  const it = ITEMS[id];
  switch (it.kind) {
    case 'speedup':
    case 'chest':
    case 'choice':
      return gemsToFinish(it.seconds);
    case 'boost':
      return gemsToFinish(it.seconds * it.value / 100);
    case 'flask':
      return Math.round((MANA.gemRefillCosts[0] ?? 0) * it.value / 100);
    case 'tome':
      return knowledgeGemPrice(it.value);
    case 'key':
      return BANNERS[BANNER_ORDER.find((b) => BANNERS[b].key === id) ?? BANNER_ORDER[0]].keyGemCost;
    default:
      return 0;
  }
}

/** What a hero would cost in keys to be sure of: the cheapest banner's
 *  guarantee for its rarity. */
export function heroGemWorth(id: HeroId): number {
  const rarity = HEROES[id].rarity;
  const prices = BANNER_ORDER.flatMap((b) => {
    const def = BANNERS[b];
    if (!(def.weights[rarity] > 0)) return [];
    const pity = rarity === 'Legendary' ? def.legendaryPityAt : def.hardPityAt;
    return pity > 0 ? [def.keyGemCost * pity] : [];
  });
  return prices.length === 0 ? 0 : Math.min(...prices);
}

/** Everything a product hands over, in Gems — the next day's part too. A
 *  fragment is a tenth of its hero, since ten recruit one; Hero XP has no
 *  Gem price and counts nothing. */
export function skuGemWorth(state: GameState, sku: StoreSkuId): number {
  const s = STORE[sku];
  const worth = (items: Partial<Record<ItemId, number>>): number =>
    (Object.entries(items) as Array<[ItemId, number]>).reduce((sum, [id, n]) => sum + itemGemWorth(id) * n, 0);
  const fragment = s.hero === null ? 0 : heroGemWorth(s.hero) / HERO_LADDER.fragmentsPerTierBase;
  return s.gems + worth(s.items) + s.nextDayGems + worth(s.nextDayItems)
    + Math.round(fragment * s.nextDayFragments)
    + (s.hero === null ? 0 : heroGemWorth(s.hero))
    + s.builders * builderGemCost(state)
    + s.heroSlots * heroSlotGemCost(state)
    + s.explorers * explorerGemCost(state);
}

/** The value a pack prints: its worth over what its price buys as Gems, in
 *  percent, to the nearest ten. 100 is a Gem pack. */
export function skuValuePercent(state: GameState, sku: StoreSkuId): number {
  const paid = STORE[sku].priceUsd * gemsPerDollar();
  if (!(paid > 0)) return 0;
  return Math.round(skuGemWorth(state, sku) / paid * 10) * 10;
}
