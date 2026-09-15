// The seasons file (Docs/features/09-relics.md §3, §4).
//
// HAND-WRITTEN, beside the events catalogue in `definitions.ts`, because a
// season is CONTENT — its name, its frame, its hero and its dates — and not a
// balance number. Every number it leans on (Gems, hours, stars, odds) lives on
// the `Collection` sheet and the `Packs` sheet instead.
//
// WHAT IS FIXED AND WHAT IS PER-SEASON. The five albums, their nine cards and
// which relic each one levels are FIXED: one album per relic, in the same
// order, for ever, so a player learns where their relic lives once. A season
// carries only its name, its frame and its hero — the same 45 cards behind a
// new frame. New card art is a decision a season may take, never a
// requirement.
//
// THE ORDER OF THE FIVE IS THE LADDER OF WHAT A RELIC IS WORTH. The two
// harvest clocks are the cheap levels a first-season player will actually
// close; the tax rate and the Stardust yield sit behind the gold cards.

import type { HeroId } from '../state';

/** 1★ to 5★. `gold` is a separate flag on the slot, not a sixth rarity. */
export type Rarity = 1 | 2 | 3 | 4 | 5;

export const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5];

export type AlbumId =
  | 'FirstFurrow' | 'TheWildWood' | 'HandsAtWork' | 'MarketDay'
  | 'TheKingsCoin' | 'UnderTheHill' | 'TheLongMarch' | 'TheStarRoad';

/** One of the nine slots on an album's page. Its identity is its INDEX in the
 *  album — so renaming a card, or redrawing it, migrates nothing. */
export interface CardSlot {
  name: string;
  rarity: Rarity;
  /** A gold edition: it falls only from the best packs, cannot be sent, and
   *  no wildcard stands in for it (§4). */
  gold?: true;
}

export interface AlbumDef {
  id: AlbumId;
  name: string;
  /** Exactly nine, in the order they sit on the 3×3 grid. */
  cards: readonly CardSlot[];
}

/**
 * THE LADDER, easiest first. An album's composition is its difficulty, and the
 * eight rungs climb from a page of 1★ to a page of gold — so which album a
 * player can close says what they have been able to open.
 *
 * WHICH RELIC AN ALBUM LEVELS IS NOT HERE. It rotates a step a season
 * (`relicOfAlbum`), because a fixed pairing on a fixed ladder means the two
 * dearest relics never level for anybody who does not buy packs.
 */
export const ALBUM_ORDER: readonly AlbumId[] = [
  'FirstFurrow', 'TheWildWood', 'HandsAtWork', 'MarketDay',
  'TheKingsCoin', 'UnderTheHill', 'TheLongMarch', 'TheStarRoad',
];

export const ALBUMS: Record<AlbumId, AlbumDef> = {
  // 1 — the soil. Eight 1★ and one 2★: the page a player closes in their
  // first week, from the packs the game hands them for nothing.
  FirstFurrow: {
    id: 'FirstFurrow', name: 'First Furrow',
    cards: [
      { name: 'Ploughshare', rarity: 1 },
      { name: 'Seed Sack', rarity: 1 },
      { name: 'Watering Can', rarity: 1 },
      { name: 'Millstone', rarity: 1 },
      { name: 'Scarecrow', rarity: 1 },
      { name: 'Hedgerow', rarity: 1 },
      { name: 'Threshing Floor', rarity: 1 },
      { name: 'The Old Oak', rarity: 1 },
      { name: 'Harvest Moon', rarity: 2 },
    ],
  },
  // 2 — the woods.
  TheWildWood: {
    id: 'TheWildWood', name: 'The Wild Wood',
    cards: [
      { name: 'Bramble Patch', rarity: 1 },
      { name: 'Mossy Log', rarity: 1 },
      { name: 'Fox Den', rarity: 1 },
      { name: 'Beehive', rarity: 1 },
      { name: 'Woodcock', rarity: 1 },
      { name: 'Stag Trail', rarity: 2 },
      { name: 'Salmon Run', rarity: 2 },
      { name: 'The Wolf Pack', rarity: 2 },
      { name: 'Heart of the Wood', rarity: 2 },
    ],
  },
  // 3 — the trade. The first album that asks for a 3★, so the first that a
  // Green pack alone will not finish.
  HandsAtWork: {
    id: 'HandsAtWork', name: 'Hands at Work',
    cards: [
      { name: 'Hod and Trowel', rarity: 1 },
      { name: 'Rope Walk', rarity: 1 },
      { name: 'Scaffold', rarity: 1 },
      { name: 'Sawpit', rarity: 2 },
      { name: 'The Kiln', rarity: 2 },
      { name: 'Water Wheel', rarity: 2 },
      { name: 'Crane Yard', rarity: 2 },
      { name: 'Master Mason', rarity: 3 },
      { name: 'Guild Charter', rarity: 3 },
    ],
  },
  // 4 — the market. The bridge: it wants a 1★ and a 4★, so no single pack
  // can close it.
  MarketDay: {
    id: 'MarketDay', name: 'Market Day',
    cards: [
      { name: 'Weigh House', rarity: 1 },
      { name: 'Salt Barrel', rarity: 1 },
      { name: 'Pedlar\u2019s Pack', rarity: 2 },
      { name: 'Toll Bridge', rarity: 2 },
      { name: 'Tithe Barn', rarity: 2 },
      { name: 'Market Cross', rarity: 3 },
      { name: 'The Caravan', rarity: 3 },
      { name: 'Guild Scales', rarity: 3 },
      { name: 'Charter of Fairs', rarity: 4 },
    ],
  },
  // 5 — the money, and the first gold edition on the ladder.
  TheKingsCoin: {
    id: 'TheKingsCoin', name: 'The King\u2019s Coin',
    cards: [
      { name: 'Tally Stick', rarity: 2 },
      { name: 'Coin Press', rarity: 2 },
      { name: 'Tax Ledger', rarity: 2 },
      { name: 'Strongbox', rarity: 2 },
      { name: 'The Mint', rarity: 3 },
      { name: 'Counting House', rarity: 3 },
      { name: 'Tithe Chest', rarity: 3 },
      { name: 'The Treasury', rarity: 4 },
      { name: 'Merchant\u2019s Seal', rarity: 4, gold: true },
    ],
  },
  // 6 — the deep. Two gold editions and a 5★: a Purple pack’s page.
  UnderTheHill: {
    id: 'UnderTheHill', name: 'Under the Hill',
    cards: [
      { name: 'Pit Lantern', rarity: 3 },
      { name: 'Rope Descent', rarity: 3 },
      { name: 'Cold Seam', rarity: 3 },
      { name: 'Bone Ladder', rarity: 3 },
      { name: 'The Deep Vein', rarity: 4 },
      { name: 'Warden\u2019s Key', rarity: 4 },
      { name: 'Crown of Roots', rarity: 4, gold: true },
      { name: 'The Sealed Door', rarity: 4, gold: true },
      { name: 'What Sleeps Below', rarity: 5 },
    ],
  },
  // 7 — the war.
  TheLongMarch: {
    id: 'TheLongMarch', name: 'The Long March',
    cards: [
      { name: 'Muster Roll', rarity: 4 },
      { name: 'Field Forge', rarity: 4 },
      { name: 'Siege Ladder', rarity: 4 },
      { name: 'Winter Camp', rarity: 4 },
      { name: 'Broken Shield', rarity: 4 },
      { name: 'The Standard', rarity: 4 },
      { name: 'The Last Redoubt', rarity: 5 },
      { name: 'Banner of the Nine', rarity: 5 },
      { name: 'The Field of Crowns', rarity: 5, gold: true },
    ],
  },
  // 8 — the heavens. Five 5★ and four gold editions: the trophy, and a page
  // no faucet closes without the store or a very long vault.
  TheStarRoad: {
    id: 'TheStarRoad', name: 'The Star Road',
    cards: [
      { name: 'Astrolabe', rarity: 5 },
      { name: 'Comet Fall', rarity: 5 },
      { name: 'The Long Road', rarity: 5 },
      { name: 'The Hollow Moon', rarity: 5 },
      { name: 'Seafire', rarity: 5 },
      { name: 'The Pole Star', rarity: 4, gold: true },
      { name: 'The North Wind', rarity: 4, gold: true },
      { name: 'The Wanderer', rarity: 5, gold: true },
      { name: 'The Door in the Sky', rarity: 5, gold: true },
    ],
  },
};

export const CARDS_PER_ALBUM = 9;

/** The 72 cards of a season, as (album, slot) pairs — the identity a pack
 *  rolls and the state counts. */
export interface CardRef {
  album: AlbumId;
  slot: number;
}

export const cardAt = (ref: CardRef): CardSlot => ALBUMS[ref.album].cards[ref.slot];

/** Where an album sits in the season, 1-based — its band for the rewards and
 *  the number the album page prints (§5, §11.3). */
export const albumIndex = (id: AlbumId): number => ALBUM_ORDER.indexOf(id);

// ------------------------------------------------------------ the seasons

/** A season's own content. */
export interface SeasonDef {
  /** Shown on the pill, the header plank and the frame. */
  name: string;
  /** The hero rated up on the golden banner while it runs, and the one the
   *  collection prize's golden call is guaranteed to be (§5, §10). A real
   *  `HeroId`, so a season cannot name a hero the roster has not got — and it
   *  must be one THE GOLDEN CALL CAN GIVE, because that is what the prize is:
   *  a Common would be a guarantee of something that banner never deals. */
  hero: HeroId;
  /** A css hook for the frame — the season's colour, not its layout. */
  frame: string;
}

/**
 * The seasons, in the order they run. THE LIST CYCLES rather than running out:
 * the last one is followed by the first again, for ever, so the calendar is
 * always open and a live-ops drop is one more entry here — never a rewrite of
 * the clock.
 *
 * Two is the minimum that PROVES the cycle: one would never wrap, and a third
 * would say nothing the second does not.
 */
export const SEASONS: readonly SeasonDef[] = [
  { name: 'Sowing Season', hero: 'ElvenPrincess', frame: 'sowing' },
  { name: 'Season of Lanterns', hero: 'GoldenDragon', frame: 'lanterns' },
];

/**
 * THE SHARED CALENDAR. Seasons run back to back from this instant, every
 * player in the same one at the same time — a player who arrives on the last
 * day has one day, like everyone else (§3).
 *
 * 2026-01-05T00:00:00Z, a Monday, so a season always opens on one — which is
 * why the length is a whole number of weeks.
 */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);

export const seasonContent = (occurrence: number): SeasonDef =>
  SEASONS[((occurrence % SEASONS.length) + SEASONS.length) % SEASONS.length];
