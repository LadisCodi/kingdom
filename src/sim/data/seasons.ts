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

import type { ArtifactId } from '../state';

/** 1★ to 5★. `gold` is a separate flag on the slot, not a sixth rarity. */
export type Rarity = 1 | 2 | 3 | 4 | 5;

export const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5];

export type AlbumId =
  | 'FirstFurrow' | 'TheWildWood' | 'HandsAtWork' | 'TheKingsCoin' | 'TheStarRoad';

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
  /** The relic this album levels. One relic, one album, one level a season. */
  relic: ArtifactId;
  /** Exactly nine, in the order they sit on the 3×3 grid. */
  cards: readonly CardSlot[];
}

export const ALBUM_ORDER: readonly AlbumId[] = [
  'FirstFurrow', 'TheWildWood', 'HandsAtWork', 'TheKingsCoin', 'TheStarRoad',
];

export const ALBUMS: Record<AlbumId, AlbumDef> = {
  FirstFurrow: {
    id: 'FirstFurrow', name: 'First Furrow', relic: 'DowsingRod',
    cards: [
      { name: 'Ploughshare', rarity: 1 },
      { name: 'Seed Sack', rarity: 1 },
      { name: 'Scarecrow', rarity: 2 },
      { name: 'Watering Can', rarity: 1 },
      { name: 'Hedgerow', rarity: 2 },
      { name: 'Threshing Floor', rarity: 2 },
      { name: 'The Old Oak', rarity: 2 },
      { name: 'Harvest Moon', rarity: 2 },
      { name: 'Millstone', rarity: 1 },
    ],
  },
  TheWildWood: {
    id: 'TheWildWood', name: 'The Wild Wood', relic: 'VerdantSeal',
    cards: [
      { name: 'Bramble Patch', rarity: 1 },
      { name: 'Fox Den', rarity: 2 },
      { name: 'Mossy Log', rarity: 1 },
      { name: 'Beehive', rarity: 2 },
      { name: 'Stag Trail', rarity: 3 },
      { name: 'Woodcock', rarity: 2 },
      { name: 'Salmon Run', rarity: 3 },
      { name: 'The Wolf Pack', rarity: 3 },
      { name: 'Heart of the Wood', rarity: 3 },
    ],
  },
  HandsAtWork: {
    id: 'HandsAtWork', name: 'Hands at Work', relic: 'ForemansSigil',
    cards: [
      { name: 'Hod and Trowel', rarity: 2 },
      { name: 'Water Wheel', rarity: 3 },
      { name: 'Rope Walk', rarity: 2 },
      { name: 'Sawpit', rarity: 3 },
      { name: 'Scaffold', rarity: 2 },
      { name: 'The Kiln', rarity: 3 },
      { name: 'Crane Yard', rarity: 4 },
      { name: 'Master Mason', rarity: 4 },
      { name: 'Guild Charter', rarity: 4 },
    ],
  },
  TheKingsCoin: {
    // The order of these nine is the one M22 draws.
    id: 'TheKingsCoin', name: 'The King’s Coin', relic: 'GildedLedger',
    cards: [
      { name: 'Market Day', rarity: 3 },
      { name: 'Tax Ledger', rarity: 4 },
      { name: 'The Mint', rarity: 4 },
      { name: 'Toll Bridge', rarity: 3 },
      { name: 'Tithe Barn', rarity: 3 },
      { name: 'Merchant’s Seal', rarity: 4, gold: true },
      { name: 'Counting House', rarity: 5 },
      { name: 'The Royal Purse', rarity: 5, gold: true },
      { name: 'The Treasury', rarity: 5 },
    ],
  },
  TheStarRoad: {
    id: 'TheStarRoad', name: 'The Star Road', relic: 'WanderersCompass',
    cards: [
      { name: 'Milestone', rarity: 3 },
      { name: 'Star Chart', rarity: 4 },
      { name: 'Lantern Post', rarity: 3 },
      { name: 'Ferry Crossing', rarity: 3 },
      { name: 'Astrolabe', rarity: 4 },
      { name: 'The North Wind', rarity: 4, gold: true },
      { name: 'Comet Fall', rarity: 5 },
      { name: 'The Long Road', rarity: 5 },
      { name: 'The Wanderer', rarity: 5, gold: true },
    ],
  },
};

/** Nine, always. A season that authored eight would pay its album for ever. */
export const CARDS_PER_ALBUM = 9;

/** The 45 cards of a season, as (album, slot) pairs — the identity a pack
 *  rolls and the state counts. */
export interface CardRef {
  album: AlbumId;
  slot: number;
}

export const cardAt = (ref: CardRef): CardSlot => ALBUMS[ref.album].cards[ref.slot];

/** Which album levels a relic. Derived: the pairing is authored once, above. */
export const albumOfRelic = (relic: ArtifactId): AlbumId =>
  ALBUM_ORDER.find((id) => ALBUMS[id].relic === relic) ?? 'FirstFurrow';

/** Where an album sits in the season, 1-based — its band for the rewards and
 *  the number the album page prints (§5, §11.3). */
export const albumIndex = (id: AlbumId): number => ALBUM_ORDER.indexOf(id);

// ------------------------------------------------------------ the seasons

/**
 * A season's own content. The list CYCLES: occurrence n is
 * `SEASONS[n % SEASONS.length]`, so the calendar never runs out and a live-ops
 * drop is one more entry here.
 */
export interface SeasonDef {
  /** Shown on the pill, the header plank and the frame. */
  name: string;
  /** The hero rated up on the golden banner while it runs (§10). */
  hero: string;
  /** A css hook for the frame — the season's colour, not its layout. */
  frame: string;
}

export const SEASONS: readonly SeasonDef[] = [
  { name: 'Sowing Season', hero: 'Warden', frame: 'sowing' },
  { name: 'Season of Lanterns', hero: 'Emberwright', frame: 'lanterns' },
];

/**
 * THE SHARED CALENDAR. Seasons run back to back from this instant, every
 * player in the same one at the same time — a player who arrives on day 25
 * has five days, like everyone else (§3).
 *
 * 2026-01-05T00:00:00Z, a Monday, so a season always opens on one.
 */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);

export const seasonContent = (occurrence: number): SeasonDef =>
  SEASONS[((occurrence % SEASONS.length) + SEASONS.length) % SEASONS.length];
