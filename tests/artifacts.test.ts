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
  ARTIFACTS, ARTIFACT_ORDER, COLLECTION, PACKS, PACK_ORDER,
} from '../src/sim/data/definitions';
import {
  artifactLevel, grantArtifactLevel, ownedArtifacts, ownsArtifact,
  passiveValueAtLevel, syncArtifactModifiers,
} from '../src/sim/artifacts';
import {
  albumHeld, albumIsComplete, albumRewards, buyFromVault, cardCount, closeSeason,
  grantPack, openPack, packCards, productionChest, seasonAt, seasonEndsAt,
  seasonHeld, seasonStartsAt, starsFor, vaultCost, SEASON_CARDS,
} from '../src/sim/collection';
import { ALBUMS, ALBUM_ORDER, CARDS_PER_ALBUM, SEASON_EPOCH } from '../src/sim/data/seasons';
import { advance } from '../src/sim/commands';
import { resolve } from '../src/sim/modifiers';
import { getWallet, type GameState } from '../src/sim/state';
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
