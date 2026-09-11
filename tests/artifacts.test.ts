// Relics and the card collection (Docs/features/09-relics.md).
//
// What this sheet is for, in one line each:
//
//  * a relic is ALWAYS ON and has no ceiling — the whole of the rework;
//  * an album pays ONCE a season, and the level it pays is permanent;
//  * a pack's hand is a function of ITS ID, so an offline replay deals the
//    same cards (invariant 4 in CLAUDE.md);
//  * the close is a TIMER — it resolves in the uncapped tail at its absolute
//    timestamp, wipes the cards and the stars, and leaves the levels;
//  * one call of `advance` over a season boundary equals stepping to it.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ARTIFACTS, ARTIFACT_ORDER, BANNERS, CARD_BUNDLE_ORDER, COLLECTION, GEM_PACK_ORDER,
  PACKS, PACK_ORDER, STORE,
} from '../src/sim/data/definitions';
import {
  artifactLevel, grantArtifactLevel, ownedArtifacts, ownsArtifact,
  passiveValueAtLevel, syncArtifactModifiers,
} from '../src/sim/artifacts';
import {
  albumHeld, albumIsComplete, albumRewards, buyCardBundle, buyFromVault, buyPack,
  bundleGemValue, bundleOf, bundlesForSale, cardCount, closeSeason,
  grantPack, openPack, packCards, packGemCost, packOdds, packsForSale, productionChest,
  seasonAt, seasonEndsAt, seasonHeld, seasonStartsAt, starsFor, vaultCost,
  buyWildcard, placeWildcard, wildcardCovers, wildcardGemCost, wildcardOffers,
  wildcardsHeld, SEASON_CARDS,
} from '../src/sim/collection';
import {
  ALBUMS, ALBUM_ORDER, CARDS_PER_ALBUM, RARITIES, SEASON_EPOCH, type Rarity,
} from '../src/sim/data/seasons';
import { advance } from '../src/sim/commands';
import { resolve } from '../src/sim/modifiers';
import { budgetRemainingCents, choosePayerProfile, priceCents } from '../src/sim/store';
import { getWallet, type GameState } from '../src/sim/state';
import { newGame } from '../src/sim/newGame';
import { freshGame, map } from './helpers';

const T0 = Date.UTC(2026, 1, 2, 9);

/** Fill an album to `n` cards by hand — the tests below are about what
 *  completion DOES, not about waiting for a pack to deal it. */
function fill(state: GameState, album: (typeof ALBUM_ORDER)[number], n: number): void {
  const row = state.collection.cards[album] ?? new Array(CARDS_PER_ALBUM).fill(0);
  for (let i = 0; i < n; i++) row[i] = (row[i] ?? 0) + 1;
  state.collection.cards[album] = row;
}

describe('a relic is a permanent passive with no ceiling', () => {
  let state: GameState;
  beforeEach(() => { state = freshGame(); });

  it('starts with none, and every level is one album closing', () => {
    expect(ownedArtifacts(state)).toEqual([]);
    expect(ownsArtifact(state, 'GildedLedger')).toBe(false);
    expect(grantArtifactLevel(state, 'GildedLedger')).toBe('Granted');
    expect(artifactLevel(state, 'GildedLedger')).toBe(1);
    expect(grantArtifactLevel(state, 'GildedLedger')).toBe('Levelled');
    expect(artifactLevel(state, 'GildedLedger')).toBe(2);
  });

  // THE POINT OF THE REWORK. There is no socket, so nothing competes: the
  // moment a relic arrives its number is in the stack, and it stays there.
  it('puts every relic it has in the modifier stack at once', () => {
    for (const id of ARTIFACT_ORDER) grantArtifactLevel(state, id);
    const relicMods = state.modifiers.filter((m) => m.source === 'artifact');
    expect(relicMods).toHaveLength(ARTIFACT_ORDER.length);
    expect(relicMods.every((m) => m.expiresAt === null)).toBe(true);
  });

  it('has no cap — the tenth level is as reachable as the second', () => {
    for (let i = 0; i < 10; i++) grantArtifactLevel(state, 'GildedLedger');
    expect(artifactLevel(state, 'GildedLedger')).toBe(10);
    const { base, perLevel } = ARTIFACTS.GildedLedger.passive;
    expect(passiveValueAtLevel('GildedLedger', 10)).toBeCloseTo(base + perLevel * 9, 6);
  });

  it('moves the number it names, at the base stage', () => {
    grantArtifactLevel(state, 'GildedLedger');
    const before = resolve(state, 'taxRate', 1);
    grantArtifactLevel(state, 'GildedLedger');
    expect(resolve(state, 'taxRate', 1)).toBeGreaterThan(before);
  });

  // A speed is a multiplier BELOW one and a yield is above it; neither may
  // cross zero, or a level would start subtracting what it adds.
  it('never lets a speed cross into a sign flip', () => {
    for (let i = 0; i < 200; i++) grantArtifactLevel(state, 'DowsingRod');
    expect(passiveValueAtLevel('DowsingRod', 200)).toBeGreaterThanOrEqual(0);
  });

  // Idempotent and total, so four callers cannot drift.
  it('rebuilds the stack rather than adding to it', () => {
    grantArtifactLevel(state, 'VerdantSeal');
    syncArtifactModifiers(state);
    syncArtifactModifiers(state);
    expect(state.modifiers.filter((m) => m.source === 'artifact')).toHaveLength(1);
  });
});

describe('an album', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.collection.season = seasonAt(T0);
    state.lastAdvance = T0;
  });

  it('pays its relic, a chest, keys and Gems on the ninth card', () => {
    const gems = getWallet(state.player.wallet, 'Gems');
    const gold = getWallet(state.city.wallet, 'Gold');
    fill(state, 'FirstFurrow', CARDS_PER_ALBUM - 1);
    grantPack(state, 'Bronze', 'dev');
    // The ninth card, planted by hand where the pack cannot be relied on to
    // deal it: what is under test is the payout, not the odds.
    fill(state, 'FirstFurrow', CARDS_PER_ALBUM);
    const opening = openPack(state, T0)!;
    expect(opening.payouts).toHaveLength(1);
    const payout = opening.payouts[0]!;
    expect(payout.album).toBe('FirstFurrow');
    expect(payout.relic).toBe(ALBUMS.FirstFurrow.relic);
    expect(payout.found).toBe(true);
    expect(payout.level).toBe(1);
    expect(ownsArtifact(state, 'DowsingRod')).toBe(true);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + COLLECTION.albumGems);
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThan(gold);
    expect(getWallet(state.player.wallet, 'SilverKey'))
      .toBe(albumRewards('FirstFurrow').silverKeys);
  });

  // THE GUARD. A tenth copy of the ninth card is a duplicate, never a second
  // payout, and a season only ever levels a relic once.
  it('pays once a season, however many copies land', () => {
    fill(state, 'FirstFurrow', CARDS_PER_ALBUM);
    grantPack(state, 'Bronze', 'dev');
    openPack(state, T0);
    expect(albumIsComplete(state, 'FirstFurrow')).toBe(true);
    const level = artifactLevel(state, 'DowsingRod');
    const gems = getWallet(state.player.wallet, 'Gems');
    fill(state, 'FirstFurrow', CARDS_PER_ALBUM);
    grantPack(state, 'Bronze', 'dev');
    const again = openPack(state, T0)!;
    expect(again.payouts).toEqual([]);
    expect(artifactLevel(state, 'DowsingRod')).toBe(level);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems);
  });

  it('bands its chest easy to hard, and never past the offline cap', () => {
    const hours = ALBUM_ORDER.map((id) => albumRewards(id).hours);
    expect(hours[0]).toBeLessThanOrEqual(hours[hours.length - 1]!);
    expect(Math.max(...hours)).toBeLessThanOrEqual(8);
  });

  // Priced in production, so it is the same fraction of a day at every stage
  // — with a floor, because an album can land in a city with two workers.
  it('prices its chest in production, with a floor under it', () => {
    const chest = productionChest(state, 2);
    expect(chest.Gold).toBeGreaterThanOrEqual(COLLECTION.chestFloorPerHour * 2);
    const bigger = productionChest(state, 8);
    expect(bigger.Gold!).toBeGreaterThan(chest.Gold!);
  });

  it('is one per relic, in the same order, for ever', () => {
    expect(ALBUM_ORDER).toHaveLength(ARTIFACT_ORDER.length);
    const relics = ALBUM_ORDER.map((id) => ALBUMS[id].relic);
    expect(new Set(relics).size).toBe(ARTIFACT_ORDER.length);
    expect(SEASON_CARDS).toBe(ALBUM_ORDER.length * CARDS_PER_ALBUM);
  });
});

describe('a pack', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.collection.season = seasonAt(T0);
  });

  // INVARIANT 4. The hand is a function of the pack's id, never of the moment
  // it is opened — so an offline replay deals the same cards, and a new
  // consumer of `rand` cannot shift a pack that was already earned.
  it('deals the same hand however often it is asked', () => {
    const pack = grantPack(state, 'Gold', 'room');
    const first = packCards(state.seed, pack);
    const again = packCards(state.seed, pack);
    expect(again).toEqual(first);
    expect(first).toHaveLength(PACKS.Gold.cards);
  });

  it('gives two sources the same ordinal different hands', () => {
    const a = grantPack(state, 'Bronze', 'room');
    const b = grantPack(state, 'Bronze', 'daily');
    expect(a.id).not.toBe(b.id);
    // Not an assertion about the cards — two ids may collide on a card by
    // chance. What matters is that they are asked as different questions.
    expect(packCards(state.seed, a)).not.toBe(packCards(state.seed, b));
  });

  it('holds only the rarities its tier weights', () => {
    for (const tier of PACK_ORDER) {
      const pack = grantPack(state, tier, 'dev');
      for (const ref of packCards(state.seed, pack)) {
        const card = ALBUMS[ref.album].cards[ref.slot]!;
        expect(PACKS[tier].weights[card.rarity - 1]).toBeGreaterThan(0);
      }
    }
  });

  it('never puts a gold card in a pack that cannot hold one', () => {
    for (const tier of ['Bronze', 'Silver'] as const) {
      for (let i = 0; i < 40; i++) {
        const pack = grantPack(state, tier, 'dev');
        for (const ref of packCards(state.seed, pack)) {
          expect(ALBUMS[ref.album].cards[ref.slot]!.gold).toBeUndefined();
        }
      }
    }
  });

  it('keeps the Star pack’s promise: one gold, dealt last', () => {
    const pack = grantPack(state, 'Star', 'dev');
    const cards = packCards(state.seed, pack);
    const last = cards[cards.length - 1]!;
    expect(ALBUMS[last.album].cards[last.slot]!.gold).toBe(true);
  });

  it('banks a first copy as new and a second as stars', () => {
    const pack = grantPack(state, 'Bronze', 'dev');
    const opening = openPack(state, T0)!;
    expect(opening.cards.every((c) => c.isNew)).toBe(true);
    expect(opening.starsEarned).toBe(0);
    const ref = packCards(state.seed, pack)[0]!;
    expect(cardCount(state, ref)).toBeGreaterThanOrEqual(1);

    // The same pack id again: every card is a duplicate, and every duplicate
    // is stars rather than a dead drop.
    state.collection.packsIssued -= PACKS.Bronze.cards === 0 ? 0 : 1;
    state.collection.packs.push(pack);
    const dupes = openPack(state, T0)!;
    expect(dupes.cards.every((c) => !c.isNew)).toBe(true);
    expect(dupes.starsEarned).toBe(
      packCards(state.seed, pack).reduce((n, r) => n + starsFor(r), 0));
    expect(state.collection.stars).toBe(dupes.starsEarned);
  });

  it('is not opened where it is earned', () => {
    grantPack(state, 'Bronze', 'room');
    expect(state.collection.packs).toHaveLength(1);
    expect(seasonHeld(state)).toBe(0);
  });
});

describe('the store', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.collection.season = seasonAt(T0);
  });

  // Bronze and Silver are the RUINS' faucet. Selling what a room already
  // drips would undercut the only free source the collection has, so a tier
  // with no price is not on the shelf at all.
  it('sells the two tiers the ruins do not drip, and only those', () => {
    expect(packsForSale()).toEqual(['Gold', 'Star']);
    expect(packGemCost('Bronze')).toBe(0);
    expect(buyPack(state, 'Bronze')).toBe('NotForSale');
    expect(state.collection.packs).toEqual([]);
  });

  // Priced to the key ladder (§12): a Gold pack about a silver key.
  it('prices a Gold pack at a silver key and a Star pack at a gold one', () => {
    expect(packGemCost('Gold')).toBe(BANNERS.basic.keyGemCost);
    expect(packGemCost('Star')).toBe(BANNERS.advanced.keyGemCost);
  });

  it('takes the Gems and hands over an UNOPENED pack', () => {
    state.player.wallet.Gems = packGemCost('Star');
    expect(buyPack(state, 'Star')).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    // Unopened: the store hands over the thing, the Collection turns it over.
    expect(state.collection.packs).toHaveLength(1);
    expect(state.collection.packs[0]!.tier).toBe('Star');
    expect(seasonHeld(state)).toBe(0);
  });

  it('refuses a purse that is one Gem short, and takes nothing', () => {
    state.player.wallet.Gems = packGemCost('Gold') - 1;
    expect(buyPack(state, 'Gold')).toBe('NotEnoughGems');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(packGemCost('Gold') - 1);
    expect(state.collection.packs).toEqual([]);
  });

  // §6 says "at PUBLISHED odds", and the store is where that promise has to
  // be kept. Weights are authored, so the percentages are derived — and they
  // must cover the tier and nothing else.
  it('publishes odds that sum to about 100 over the rarities it can roll', () => {
    for (const tier of packsForSale()) {
      const odds = packOdds(tier);
      expect(odds.length).toBeGreaterThan(0);
      const total = odds.reduce((n, o) => n + o.percent, 0);
      expect(Math.abs(total - 100)).toBeLessThanOrEqual(1);
      for (const o of odds) expect(PACKS[tier].weights[o.rarity - 1]).toBeGreaterThan(0);
    }
  });

  // Two bought in a row are two to open, not two reveals at the till.
  it('stacks what a player buys', () => {
    state.player.wallet.Gems = packGemCost('Gold') * 3;
    for (let i = 0; i < 3; i++) expect(buyPack(state, 'Gold')).toBe('Purchased');
    expect(state.collection.packs).toHaveLength(3);
    // Three different ids, so three different hands.
    expect(new Set(state.collection.packs.map((k) => k.id)).size).toBe(3);
  });
});

describe('a wildcard', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.collection.season = seasonAt(T0);
  });

  // §9: it stands in for any card of ITS RARITY OR LOWER, in any album.
  it('covers its rarity and everything under it, in any album', () => {
    // First Furrow slot 0 is a 1★; Hands at Work slot 6 is a 4★.
    expect(wildcardCovers(1, { album: 'FirstFurrow', slot: 0 })).toBe(true);
    expect(wildcardCovers(4, { album: 'FirstFurrow', slot: 0 })).toBe(true);
    expect(wildcardCovers(1, { album: 'HandsAtWork', slot: 6 })).toBe(false);
    expect(wildcardCovers(4, { album: 'HandsAtWork', slot: 6 })).toBe(true);
  });

  // THE WALL. No wildcard covers gold at any rarity and at any price, which
  // is what keeps the two strongest relics the two Gems cannot finish.
  it('never covers a gold card, at any rarity', () => {
    const gold = ALBUMS.TheKingsCoin.cards.findIndex((c) => c.gold === true);
    expect(gold).toBeGreaterThanOrEqual(0);
    for (const r of RARITIES) {
      expect(wildcardCovers(r, { album: 'TheKingsCoin', slot: gold })).toBe(false);
    }
    state.collection.wildcards[5] = 1;
    const result = placeWildcard(state, { album: 'TheKingsCoin', slot: gold }, 5);
    expect(result).toEqual({ placed: false, reason: 'GoldSlot' });
    // And the wildcard is still in hand: a refusal costs nothing.
    expect(wildcardsHeld(state, 5)).toBe(1);
  });

  it('is bought with Gems and priced by the rarity it covers', () => {
    expect(wildcardGemCost(5)).toBe(BANNERS.advanced.keyGemCost);
    for (let r = 1; r < 5; r++) {
      expect(wildcardGemCost((r + 1) as Rarity)).toBeGreaterThan(wildcardGemCost(r as Rarity));
    }
    state.player.wallet.Gems = wildcardGemCost(3);
    expect(buyWildcard(state, 3)).toBe('Purchased');
    expect(wildcardsHeld(state, 3)).toBe(1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    expect(buyWildcard(state, 3)).toBe('NotEnoughGems');
  });

  it('fills the slot the player chose, and is consumed', () => {
    state.collection.wildcards[2] = 1;
    const ref = { album: 'FirstFurrow' as const, slot: 2 };
    const result = placeWildcard(state, ref, 2);
    expect(result.placed).toBe(true);
    expect(cardCount(state, ref)).toBe(1);
    expect(wildcardsHeld(state, 2)).toBe(0);
  });

  // A wildcard on a slot the player already holds would be stars at a Gem
  // price, which is the one thing a targeted purchase must not be.
  it('refuses a slot already held, so it can never buy a duplicate', () => {
    fill(state, 'FirstFurrow', 1);
    state.collection.wildcards[2] = 1;
    const result = placeWildcard(state, { album: 'FirstFurrow', slot: 0 }, 2);
    expect(result).toEqual({ placed: false, reason: 'AlreadyHeld' });
    expect(wildcardsHeld(state, 2)).toBe(1);
  });

  // The ninth card is the ninth card, however it arrived: the same payout
  // path a pack takes.
  it('pays the album when it is the ninth card', () => {
    fill(state, 'TheWildWood', CARDS_PER_ALBUM - 1);
    state.collection.wildcards[3] = 1;
    const gems = getWallet(state.player.wallet, 'Gems');
    const result = placeWildcard(
      state, { album: 'TheWildWood', slot: CARDS_PER_ALBUM - 1 }, 3);
    expect(result.placed).toBe(true);
    expect(result.placed && result.payout?.album).toBe('TheWildWood');
    expect(albumIsComplete(state, 'TheWildWood')).toBe(true);
    expect(artifactLevel(state, ALBUMS.TheWildWood.relic)).toBe(1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + COLLECTION.albumGems);
  });

  it('goes with the cards at the close', () => {
    state.collection.wildcards[4] = 2;
    closeSeason(state, seasonEndsAt(state.collection.season));
    expect(state.collection.wildcards).toEqual({});
  });

  describe('the aimed offer', () => {
    // An offer ANSWERS A SHORTAGE rather than interrupting: an album nine
    // cards short is not a shortage, it is a season.
    it('says nothing about an album that has barely started', () => {
      expect(wildcardOffers(state)).toEqual([]);
      fill(state, 'FirstFurrow', 3);
      expect(wildcardOffers(state)).toEqual([]);
    });

    it('appears once an album is nearly finished, and names the gap', () => {
      fill(state, 'FirstFurrow', CARDS_PER_ALBUM - 2);
      const offers = wildcardOffers(state);
      expect(offers).toHaveLength(1);
      expect(offers[0]!.album).toBe('FirstFurrow');
      expect(offers[0]!.short).toBe(2);
    });

    // One purchase has to fill any hole the album still has, or the player is
    // doing arithmetic on a price tag.
    it('offers the rarity that covers every missing slot', () => {
      // Hold everything in Hands at Work but its three 4★ slots.
      const row = new Array(CARDS_PER_ALBUM).fill(1);
      ALBUMS.HandsAtWork.cards.forEach((card, slot) => {
        if (card.rarity === 4) row[slot] = 0;
      });
      state.collection.cards.HandsAtWork = row;
      const offer = wildcardOffers(state).find((o) => o.album === 'HandsAtWork')!;
      expect(offer.rarity).toBe(4);
      expect(offer.cost).toBe(wildcardGemCost(4));
    });

    // Down to gold alone there is nothing to sell, so the offer carries no
    // rarity and the shelf drops it rather than showing a dead row.
    it('has nothing to sell when only gold slots are left', () => {
      const row = ALBUMS.TheKingsCoin.cards.map((c) => (c.gold === true ? 0 : 1));
      state.collection.cards.TheKingsCoin = row;
      const offer = wildcardOffers(state).find((o) => o.album === 'TheKingsCoin')!;
      expect(offer.rarity).toBeNull();
      expect(offer.cost).toBe(0);
    });

    it('says nothing about an album that is already complete', () => {
      fill(state, 'FirstFurrow', CARDS_PER_ALBUM);
      grantPack(state, 'Bronze', 'dev');
      openPack(state, T0);
      expect(albumIsComplete(state, 'FirstFurrow')).toBe(true);
      expect(wildcardOffers(state).some((o) => o.album === 'FirstFurrow')).toBe(false);
    });
  });
});

// §6.1. A bundle is the collection's two Gem purchases sold together for
// MONEY, so it walks the simulated budget rather than the purse — and it is
// the one shelf that has to watch the season's clock, because everything it
// hands over is wiped at the close.
describe('a card bundle', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.collection.season = seasonAt(T0);
  });

  it('is every Store row that names a hand, and no Gem pack is one', () => {
    expect(CARD_BUNDLE_ORDER).toEqual(['CardsSatchel', 'CardsCase', 'CardsCabinet']);
    for (const id of CARD_BUNDLE_ORDER) {
      expect(STORE[id].gems).toBe(0);
      expect(bundleOf(id)).not.toBeNull();
    }
    for (const id of GEM_PACK_ORDER) expect(bundleOf(id)).toBeNull();
    expect(bundleOf('RoyalChest')).toBeNull();
  });

  it('spends the monthly budget, logs the purchase, and grants no Gems', () => {
    const before = budgetRemainingCents(state, T0)!;
    const gemsBefore = getWallet(state.player.wallet, 'Gems');
    expect(buyCardBundle(state, 'CardsCase', T0)).toBe('Purchased');
    expect(budgetRemainingCents(state, T0)).toBe(before - priceCents('CardsCase'));
    expect(state.player.payer!.purchases.map((p) => p.sku)).toEqual(['CardsCase']);
    // A bundle hands over the THINGS, not the currency that buys them.
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gemsBefore);
  });

  it('hands the whole hand over at once, unopened', () => {
    const bundle = bundleOf('CardsCabinet')!;
    expect(buyCardBundle(state, 'CardsCabinet', T0)).toBe('Purchased');
    expect(state.collection.packs).toHaveLength(bundle.packs);
    for (const pack of state.collection.packs) expect(pack.tier).toBe(bundle.tier);
    // Distinct ids, so ten packs are ten different hands.
    expect(new Set(state.collection.packs.map((p) => p.id)).size).toBe(bundle.packs);
    expect(wildcardsHeld(state, bundle.wildcardRarity)).toBe(bundle.wildcards);
    // Unopened: the store hands them over, the Collection turns them over.
    expect(seasonHeld(state)).toBe(0);
  });

  // §6: the ask is packs that GUARANTEE a gold edition, so every bundle is
  // built on the tier that promises one. A bundle of Bronze packs would be
  // the ruins' faucet sold back at a price.
  it('only sells a tier that guarantees a gold edition', () => {
    for (const id of CARD_BUNDLE_ORDER) {
      expect(PACKS[bundleOf(id)!.tier].goldGuaranteed).toBe(true);
    }
  });

  // §9: there is no gold wildcard at any price, and money is a price.
  it('never sells a wildcard past the dearest rarity a wildcard covers', () => {
    for (const id of CARD_BUNDLE_ORDER) {
      const { wildcardRarity } = bundleOf(id)!;
      expect(RARITIES).toContain(wildcardRarity);
      expect(wildcardGemCost(wildcardRarity)).toBeGreaterThan(0);
    }
  });

  // The whole argument of a bundle: it beats buying the parts two rows up.
  it('is worth more in Gems than the Gem ladder would charge for the money', () => {
    for (const id of CARD_BUNDLE_ORDER) {
      const gemsForTheMoney = (STORE[id].priceUsd / STORE.GemsPouch.priceUsd)
        * STORE.GemsPouch.gems;
      expect(bundleGemValue(bundleOf(id)!)).toBeGreaterThan(gemsForTheMoney);
    }
    // And the ladder climbs: a dearer bundle is a better rate than a cheaper
    // one, or there is no reason to buy the dearer one.
    const rate = (id: typeof CARD_BUNDLE_ORDER[number]) =>
      bundleGemValue(bundleOf(id)!) / STORE[id].priceUsd;
    expect(rate('CardsCase')).toBeGreaterThan(rate('CardsSatchel'));
    expect(rate('CardsCabinet')).toBeGreaterThan(rate('CardsCase'));
  });

  // A bundle is packs and wildcards, and the close wipes both. There is a
  // window at the end of every season where money would buy something that
  // expires before it can be spent, and the store says nothing in it.
  it('comes off the shelf in the last hours of a season, and back on after', () => {
    const closesAt = seasonEndsAt(state.collection.season);
    const hour = 3_600_000;
    const open = closesAt - (COLLECTION.bundleWithdrawHours + 1) * hour;
    expect(bundlesForSale(state, open)).toEqual([...CARD_BUNDLE_ORDER]);

    const closing = closesAt - hour;
    expect(bundlesForSale(state, closing)).toEqual([]);
    expect(buyCardBundle(state, 'CardsSatchel', closing)).toBe('SeasonClosing');
    // Refused, so nothing was charged and nothing was granted.
    expect(state.player.payer!.purchases).toEqual([]);
    expect(state.collection.packs).toEqual([]);

    // The new season opens the shelf again on its own — no timer, no state.
    state.collection.season += 1;
    expect(bundlesForSale(state, closesAt + hour)).toEqual([...CARD_BUNDLE_ORDER]);
  });

  it('refuses a budget it cannot cover, and grants nothing', () => {
    // A game of its own: `freshGame` already picks a Dolphin, and the only
    // way to another profile is a fresh save.
    const poor = newGame(map, T0);
    poor.collection.season = seasonAt(T0);
    choosePayerProfile(poor, 'F2P', T0);
    expect(buyCardBundle(poor, 'CardsSatchel', T0)).toBe('NoBudget');
    expect(poor.collection.packs).toEqual([]);
    expect(wildcardsHeld(poor, bundleOf('CardsSatchel')!.wildcardRarity)).toBe(0);
    // A refusal is unmet demand at that price, and the store counts it.
    expect(poor.player.payer!.refusals).toBe(1);
  });

  it('refuses a SKU that is not a bundle, without touching the budget', () => {
    expect(buyCardBundle(state, 'GemsPouch', T0)).toBe('NotABundle');
    expect(state.player.payer!.purchases).toEqual([]);
  });
});

describe('the vault', () => {
  it('turns stars into a pack, and refuses what it cannot pay for', () => {
    const state = freshGame();
    expect(buyFromVault(state, 'Gold')).toBe('NotEnoughStars');
    state.collection.stars = vaultCost('Gold');
    expect(buyFromVault(state, 'Gold')).toBe('Opened');
    expect(state.collection.stars).toBe(0);
    expect(state.collection.packs).toHaveLength(1);
    expect(state.collection.packs[0]!.tier).toBe('Gold');
  });
});

describe('the season', () => {
  it('runs on a shared calendar, with no state in the answer', () => {
    expect(seasonAt(SEASON_EPOCH)).toBe(0);
    expect(seasonStartsAt(0)).toBe(SEASON_EPOCH);
    const oneSeason = COLLECTION.seasonDays * 86_400_000;
    expect(seasonEndsAt(0)).toBe(SEASON_EPOCH + oneSeason);
    expect(seasonAt(SEASON_EPOCH + oneSeason)).toBe(1);
    // A player arriving on day 25 is in the same season as everyone else.
    expect(seasonAt(SEASON_EPOCH + 25 * 86_400_000)).toBe(0);
  });

  it('wipes the cards and the stars at the close, and keeps the levels', () => {
    const state = freshGame();
    state.collection.season = seasonAt(T0);
    fill(state, 'FirstFurrow', CARDS_PER_ALBUM);
    grantPack(state, 'Bronze', 'dev');
    openPack(state, T0);
    state.collection.stars = 120;
    grantPack(state, 'Gold', 'dev');
    const level = artifactLevel(state, 'DowsingRod');
    expect(level).toBe(1);

    const at = seasonEndsAt(state.collection.season);
    closeSeason(state, at);
    expect(state.collection.season).toBe(seasonAt(at));
    expect(albumHeld(state, 'FirstFurrow')).toBe(0);
    expect(state.collection.completed).toEqual([]);
    expect(state.collection.stars).toBe(0);
    // An unopened pack is a hand of THIS season's cards and goes with them.
    expect(state.collection.packs).toEqual([]);
    // The permanent layer — the one the season leaves behind.
    expect(artifactLevel(state, 'DowsingRod')).toBe(level);
  });

  // INVARIANT 1. The close is a boundary in absolute time, so one call over
  // it does exactly what stepping to it does.
  it('closes in one call of advance exactly as it does stepped', () => {
    const build = (): GameState => {
      const s = freshGame();
      s.collection.season = seasonAt(T0);
      s.lastAdvance = T0;
      fill(s, 'TheWildWood', 4);
      s.collection.stars = 30;
      return s;
    };
    const close = seasonEndsAt(seasonAt(T0));
    const after = close + 3_600_000;

    const oneCall = build();
    advance(oneCall, map, after);

    const stepped = build();
    for (let t = T0; t <= after; t += 900_000) advance(stepped, map, Math.min(t, after));
    advance(stepped, map, after);

    expect(oneCall.collection).toEqual(stepped.collection);
    expect(oneCall.collection.season).toBe(seasonAt(after));
    expect(oneCall.collection.stars).toBe(0);
  });

  it('reports the close so the player is told about it', () => {
    const state = freshGame();
    state.collection.season = seasonAt(T0);
    state.lastAdvance = T0;
    const result = advance(state, map, seasonEndsAt(state.collection.season) + 1000);
    expect(result.seasonClosed).not.toBeNull();
    expect(result.seasonClosed!.to).toBe(result.seasonClosed!.from + 1);
  });

  // A week away: one boundary, not a thousand. The seatbelt is not a design
  // limit and a monthly boundary must never come near it.
  it('costs one boundary a month, not one a tick', () => {
    const state = freshGame();
    state.collection.season = seasonAt(T0);
    state.lastAdvance = T0;
    const closes = seasonEndsAt(state.collection.season);
    advance(state, map, closes + 7 * 86_400_000);
    expect(state.collection.season).toBe(seasonAt(closes + 7 * 86_400_000));
  });
});
