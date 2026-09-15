// The card collection (Docs/features/09-relics.md).
//
// Five albums of nine cards, one album per relic, on a season every player
// shares. Finishing an album levels its relic for ever, pays a chest of
// production, keys and Gems; at the close the cards melt into Gold by their
// rarity, the stars are wiped and the levels stay.
//
// FOUR RULES THIS FILE EXISTS TO KEEP:
//
//  1. A PACK IS ROLLED BY HASH ON ITS OWN ID — the season, the source and its
//     ordinal — never on the moment it is opened. An offline replay deals the
//     same hand, and a new consumer of `rand` cannot shift a pack that was
//     already earned.
//  2. AN ALBUM PAYS ONCE A SEASON. `completed` is the guard; a tenth copy of
//     the ninth card is a duplicate, not a second payout.
//  3. THE CLOSE IS A TIMER, NOT PRODUCTION. It resolves in the uncapped tail
//     of the offline advance at its absolute timestamp (§3), so a player away
//     for a week comes back to the wiped album and the new season. The seasons
//     CYCLE: the content list is read modulo its own length, so the calendar
//     never runs out of seasons to open.
//  4. STARS ARE A COUNTER IN THIS SCREEN, not a wallet row — the Fragments
//     precedent (CLAUDE.md, "Money and identity are different things").

import {
  ARTIFACT_ORDER, CARD_BUNDLE_ORDER, CHEST_ORDER, COLLECTION, CURRENCIES, FACE_ORDER, PACKS,
  SOBRE_ORDER, STORE, faceOf,
  type BannerId, type CardBundleDef, type FaceId, type PackTier,
} from './data/definitions';
import {
  ALBUMS, ALBUM_ORDER, CARDS_PER_ALBUM, cardAt, RARITIES, SEASON_EPOCH, seasonContent,
  type AlbumId, type CardRef, type Rarity, type SeasonDef,
} from './data/seasons';
import { rand } from './rng';
import {
  addToWallet, getWallet, type ArtifactId, type CurrencyId, type GameState,
  type HeroId, type StoreSkuId, type Wallet,
} from './state';
import { buySku, type BuySkuResult } from './store';
import { grantArtifactLevel } from './artifacts';
import { callGuaranteed } from './heroes';
import { cityGatherPerSecond } from './upgrades';
import { cityGoldPerMinute } from './population';

// ---------------------------------------------------------------- the season

export const SEASON_MS = (): number => COLLECTION.seasonDays * 86_400_000;

/** Which occurrence of the shared calendar `t` falls in. Floor division from
 *  the epoch: no state, so two clients never disagree about the season. */
export const seasonAt = (t: number): number =>
  Math.max(0, Math.floor((t - SEASON_EPOCH) / SEASON_MS()));

export const seasonStartsAt = (occurrence: number): number =>
  SEASON_EPOCH + occurrence * SEASON_MS();

/** The absolute instant this season ends — and the next one opens. */
export const seasonEndsAt = (occurrence: number): number =>
  seasonStartsAt(occurrence + 1);

export const seasonDef = (occurrence: number): SeasonDef => seasonContent(occurrence);

/** Milliseconds left in the live season, floored at 0. */
export const seasonLeftMs = (state: GameState, now: number): number =>
  Math.max(0, seasonEndsAt(state.collection.season) - now);

// ------------------------------------------------- which relic an album levels

/**
 * WHICH RELIC AN ALBUM LEVELS, THIS SEASON.
 *
 * Rotated a step an occurrence rather than authored, for two reasons. The
 * difficulty ladder is fixed and the reward is not — every album pays exactly
 * one relic level — so a FIXED pairing means a player who closes the bottom
 * four every season has four relics at level N and four at zero, for ever.
 * And it is DERIVED rather than written into the seasons file because that
 * list CYCLES: with two seasons authored, a hand-written pairing would only
 * ever show two of the eight arrangements.
 *
 * A full rotation is eight seasons, so a player who never buys a pack has
 * levelled all eight relics — one at a time — inside eight months.
 *
 * It lives here rather than in `seasons.ts` because the album set and the
 * relic roster are declared in two files that already point one way, and a
 * pairing that imported both would close the loop.
 */
export const relicOfAlbum = (album: AlbumId, occurrence: number): ArtifactId => {
  const n = ALBUM_ORDER.length;
  const i = (((ALBUM_ORDER.indexOf(album) + occurrence) % n) + n) % n;
  return ARTIFACT_ORDER[i] ?? ARTIFACT_ORDER[0]!;
};

/** The other way round: the album that levels this relic, this season. */
export const albumOfRelic = (relic: ArtifactId, occurrence: number): AlbumId =>
  ALBUM_ORDER.find((id) => relicOfAlbum(id, occurrence) === relic) ?? ALBUM_ORDER[0]!;

// ----------------------------------------------------------------- the cards

/** How many copies of one slot the player holds. */
export const cardCount = (state: GameState, ref: CardRef): number =>
  state.collection.cards[ref.album]?.[ref.slot] ?? 0;

export const holdsCard = (state: GameState, ref: CardRef): boolean =>
  cardCount(state, ref) >= 1;

/** Distinct cards held in an album — the `7/9` every screen prints. */
export const albumHeld = (state: GameState, album: AlbumId): number =>
  (state.collection.cards[album] ?? []).reduce((n, c) => n + (c >= 1 ? 1 : 0), 0);

export const albumIsComplete = (state: GameState, album: AlbumId): boolean =>
  state.collection.completed.includes(album);

/** Distinct cards held across the season — the `12/45` on the pill. */
export const seasonHeld = (state: GameState): number =>
  ALBUM_ORDER.reduce((n, a) => n + albumHeld(state, a), 0);

export const SEASON_CARDS = ALBUM_ORDER.length * CARDS_PER_ALBUM;

/** The face a card wears — what prices its stars and what a pack rolls for. */
export const faceOfCard = (ref: CardRef): FaceId => {
  const card = cardAt(ref);
  return `${card.rarity}${card.gold === true ? 'gold' : 'star'}` as FaceId;
};

/** Stars a duplicate of this card is worth (§7). AUTHORED per face rather
 *  than derived, so a gold edition need not be exactly twice its rarity. */
export const starsFor = (ref: CardRef): number =>
  COLLECTION.starsPerFace[faceOfCard(ref)] ?? 1;

// ----------------------------------------------------------------- the packs

/** Where a pack came from. Part of its id, so two sources can never collide
 *  on an ordinal and deal the same hand. */
export type PackSource = 'room' | 'boss' | 'daily' | 'quest' | 'vault' | 'store' | 'dev';

export interface PendingPack {
  /** `<season>:<source>:<ordinal>` — what the roll hashes on. */
  id: string;
  tier: PackTier;
}

/**
 * Put a pack in the player's lap. It is NOT opened here: opening is a screen
 * (the gacha reveal), and a pack earned during an absence has to survive until
 * the player is looking.
 */
export function grantPack(state: GameState, tier: PackTier, source: PackSource): PendingPack {
  const pack: PendingPack = {
    id: `${state.collection.season}:${source}:${state.collection.packsIssued}`,
    tier,
  };
  state.collection.packsIssued += 1;
  state.collection.packs.push(pack);
  return pack;
}

/** Every slot in the season wearing this face. */
function slotsWearing(face: FaceId): CardRef[] {
  const { rarity, gold } = faceOf(face);
  const out: CardRef[] = [];
  for (const album of ALBUM_ORDER) {
    ALBUMS[album].cards.forEach((card, slot) => {
      if (card.rarity !== rarity) return;
      if ((card.gold === true) !== gold) return;
      out.push({ album, slot });
    });
  }
  return out;
}

/** Which face a roll in `[0,1)` lands on, by the pack's weights. */
function faceFromRoll(tier: PackTier, roll: number): FaceId {
  const { weights } = PACKS[tier];
  const total = weights.reduce((n, w) => n + Math.max(0, w), 0);
  if (total <= 0) return FACE_ORDER[0];
  let acc = 0;
  const target = roll * total;
  for (let i = 0; i < FACE_ORDER.length; i++) {
    acc += Math.max(0, weights[i] ?? 0);
    if (target < acc) return FACE_ORDER[i]!;
  }
  return FACE_ORDER[FACE_ORDER.length - 1]!;
}

/**
 * A face the season can actually deal. A pack may weight a face this season's
 * albums hold no slot for — walk DOWN the ladder rather than deal nothing, and
 * a gold edition falls back to its own plain rarity first.
 */
function dealableFace(face: FaceId): FaceId | null {
  const order = FACE_ORDER.indexOf(face);
  const tries: FaceId[] = [face];
  const { rarity, gold } = faceOf(face);
  if (gold) tries.push(`${rarity}star` as FaceId);
  for (let i = order - 1; i >= 0; i--) tries.push(FACE_ORDER[i]!);
  return tries.find((f) => slotsWearing(f).length > 0) ?? null;
}

/**
 * The cards a pack holds — a PURE function of its id, so it can be asked
 * before, during and after the reveal and always answers the same.
 *
 * GUARANTEES FIRST, then the filler. A pack is `cards` slots of which some are
 * promised at a named face and the rest roll one seven-way distribution that
 * already contains the gold editions — so a guarantee needs no special case in
 * the roll, and no pack has a face it can never reach.
 *
 * `parts` identify THE EVENT (this pack, this slot index) and never the moment
 * of the query, which is the whole of invariant 4 in CLAUDE.md.
 */
export function packCards(seed: number, pack: PendingPack): CardRef[] {
  const def = PACKS[pack.tier];
  const out: CardRef[] = [];
  const promised: FaceId[] = [];
  for (const face of FACE_ORDER) {
    for (let n = 0; n < (def.guarantees[face] ?? 0); n++) promised.push(face);
  }
  for (let i = 0; i < def.cards; i++) {
    // The promised slots are dealt first so the roll's `parts` stay stable if
    // a guarantee is ever added or removed: a filler slot keeps its index.
    const wanted = i < promised.length
      ? promised[i]!
      : faceFromRoll(pack.tier, rand(seed, pack.id, 'face', i));
    const face = dealableFace(wanted);
    if (face === null) continue;
    const pool = slotsWearing(face);
    const pick = Math.floor(rand(seed, pack.id, 'slot', i) * pool.length) % pool.length;
    out.push(pool[pick]!);
  }
  // Worst first, best last — the reveal turns them in this order.
  return out.sort((a, b) => rankOf(a) - rankOf(b));
}

const rankOf = (ref: CardRef): number => {
  const card = cardAt(ref);
  return (card.gold === true ? 100 : 0) + card.rarity;
};

export interface RevealedCard {
  ref: CardRef;
  /** A first copy, or the count after a duplicate landed. */
  isNew: boolean;
  count: number;
  /** Stars the duplicate paid (0 on a first copy). */
  stars: number;
}

export interface PackOpening {
  pack: PendingPack;
  cards: RevealedCard[];
  /** Albums this pack finished, in the order their ninth card landed — with
   *  everything each one paid, for the sheet that follows the reveal. */
  payouts: AlbumPayout[];
  starsEarned: number;
}

/**
 * Open the pack at the front of the queue, banking its cards.
 *
 * Album completion is checked per card rather than once at the end, so the
 * album that a pack's third card finishes is the one the sheet follows the
 * reveal with (§11.5).
 */
export function openPack(state: GameState, now: number): PackOpening | null {
  const pack = state.collection.packs.shift();
  if (!pack) return null;
  const opening: PackOpening = { pack, cards: [], payouts: [], starsEarned: 0 };
  void now;
  for (const ref of packCards(state.seed, pack)) {
    opening.cards.push(addCard(state, ref, opening));
  }
  return opening;
}

function addCard(
  state: GameState, ref: CardRef, opening: PackOpening,
): RevealedCard {
  const row = state.collection.cards[ref.album] ?? emptyAlbum();
  state.collection.cards[ref.album] = row;
  const before = row[ref.slot] ?? 0;
  row[ref.slot] = before + 1;
  // Completion is checked on EVERY card, new or not, because it is a question
  // about the ALBUM and not about the card: a page filled by a wildcard or by
  // a gift has to pay the same way a page filled by a pack does. The guard
  // inside `completeIfDue` is what keeps it once a season.
  const payout = completeIfDue(state, ref.album);
  if (payout !== null) {
    opening.payouts.push(payout);
    rollLapIfDue(state);
  }
  if (before >= 1) {
    const stars = starsFor(ref);
    state.collection.stars += stars;
    opening.starsEarned += stars;
    return { ref, isNew: false, count: row[ref.slot], stars };
  }
  return { ref, isNew: true, count: 1, stars: 0 };
}

export const emptyAlbum = (): number[] => new Array(CARDS_PER_ALBUM).fill(0);

// -------------------------------------------------------------- the payout

export interface AlbumPayout {
  album: AlbumId;
  /** The relic it levels, and what that level is now. */
  relic: ArtifactId;
  level: number;
  /** True the first time ever — the relic ARRIVES rather than rises. */
  found: boolean;
  /** Which lap of the eight this payout belonged to, 0-based. */
  lap: number;
  /** Hours of production the chest held, and what that came to. */
  hours: number;
  chest: Wallet;
  silverKeys: number;
  goldKeys: number;
  gems: number;
  /** THE FIFTH ALBUM, and only the fifth: what the five together paid (§5).
   *  Null on the other four, and null on the fifth in a season that has
   *  already paid it. */
  prize: CollectionPrize | null;
}

/**
 * What an album at this index pays. A TOTAL, banded easy → hard (§5).
 *
 * THE GEMS ARE THE FIRST LAP'S ONLY. Five albums at 2,000 each is most of a
 * season's Gem budget, and a player running the cycle two or three times would
 * mint it over again. A repeat pays the production chest, the keys and the
 * relic level — the chest is safe to repeat by construction, because it is
 * priced in hours of what the city makes rather than in coins.
 */
export function albumRewards(album: AlbumId, lap = 0): {
  hours: number; silverKeys: number; goldKeys: number; gems: number;
} {
  const i = ALBUM_ORDER.indexOf(album);
  return {
    hours: COLLECTION.albumHours[i] ?? COLLECTION.albumHours[0] ?? 2,
    silverKeys: COLLECTION.albumSilverKeys[i] ?? 0,
    goldKeys: COLLECTION.albumGoldKeys[i] ?? 0,
    gems: lap === 0 ? COLLECTION.albumGems : 0,
  };
}

/**
 * THE NINTH CARD. Marks the album complete and pays all three things at once.
 *
 * Paid HERE, synchronously, rather than queued: an album can only complete
 * while a pack is being opened, and a pack is only ever opened by a player who
 * is looking at it. Nothing about completion is a timer, so nothing about it
 * needs to survive an absence.
 */
function completeIfDue(state: GameState, album: AlbumId): AlbumPayout | null {
  if (albumIsComplete(state, album)) return null;
  if (albumHeld(state, album) < CARDS_PER_ALBUM) return null;

  // THE NINE CARDS ARE SPENT. Without this the loop does not terminate: a
  // reset that left the cards in hand would re-complete every album on the
  // same tick, for ever. Duplicates survive — a tenth copy fills its slot the
  // moment the album empties, which is what makes a hoard worth holding.
  const row = state.collection.cards[album];
  if (row !== undefined) {
    state.collection.cards[album] = row.map((n) => Math.max(0, n - 1));
  }
  state.collection.completed.push(album);

  const lap = state.collection.cycle;
  const relic = relicOfAlbum(album, state.collection.season);
  const found = grantArtifactLevel(state, relic) === 'Granted';
  const rewards = albumRewards(album, lap);
  const chest = productionChest(state, rewards.hours);
  for (const [c, n] of Object.entries(chest)) {
    addToWallet(state.city.wallet, c as CurrencyId, n);
  }
  if (rewards.silverKeys > 0) addToWallet(state.player.wallet, 'SilverKey', rewards.silverKeys);
  if (rewards.goldKeys > 0) addToWallet(state.player.wallet, 'GoldKey', rewards.goldKeys);
  if (rewards.gems > 0) addToWallet(state.player.wallet, 'Gems', rewards.gems);

  return {
    album,
    relic,
    level: state.artifacts.levels[relic] ?? 1,
    found,
    chest,
    ...rewards,
    // The last card of the LAST album is also the season's 72nd.
    prize: payCollectionPrize(state),
    lap,
  };
}

/**
 * THE LAP CLOSES. All eight albums are in `completed`, so they reset and the
 * eight may be run again on the same season's cards.
 *
 * BREADTH BEFORE DEPTH: an album cannot be completed twice until all eight
 * have been completed once, which is what keeps a player's eight relic levels
 * reading the same. Only the REPEAT is gated — a player who closes three of
 * eight still takes those three relic levels, exactly as before.
 *
 * Called after the payout so the album that finished the lap is paid at the
 * lap it belonged to.
 */
function rollLapIfDue(state: GameState): void {
  if (state.collection.completed.length < ALBUM_ORDER.length) return;
  state.collection.completed = [];
  state.collection.cycle += 1;
}

// --------------------------------------------------------------- the prize

/** The golden call — the collection prize is a call on it, not a roll (§5). */
export const PRIZE_BANNER: BannerId = 'advanced';

export interface CollectionPrize {
  gems: number;
  /** The season's hero, handed over rather than rolled for (§10). */
  hero: HeroId;
  /** They already had them, so the call paid Fragments. */
  duplicate: boolean;
  fragments: number;
  stardust: number;
}

/**
 * WHAT THE FIVE ALBUMS TOGETHER PAY: a golden call guaranteed to be the
 * season's hero, and 25,000 Gems (§5).
 *
 * ONCE A SEASON, and `prizePaid` is the guard — the same guard `completed` is
 * for an album. It cannot be reached twice anyway (the fifth album completes
 * once), but the close resets both together and a prize is far too large to
 * leave that to the shape of the caller.
 *
 * A GOLDEN CALL, not a Legendary: the season names the hero, and what the call
 * is worth to a player who already has them is the Fragments a duplicate pays
 * on that banner — which §10 says is half the point of a rate-up.
 */
export function payCollectionPrize(state: GameState): CollectionPrize | null {
  if (!seasonIsComplete(state)) return null;
  if (state.collection.prizePaid) return null;
  state.collection.prizePaid = true;

  const gems = COLLECTION.prizeGems;
  if (gems > 0) addToWallet(state.player.wallet, 'Gems', gems);
  const call = callGuaranteed(state, PRIZE_BANNER, seasonDef(state.collection.season).hero);
  return {
    gems,
    hero: call.heroId,
    duplicate: call.duplicate,
    fragments: call.fragments,
    stardust: call.stardust,
  };
}

/**
 * N HOURS OF EVERYTHING THE CITY MAKES RIGHT NOW (§5).
 *
 * Priced in production so it is the same fraction of a day at every stage and
 * spent as fast as it lands — the `tap.workSeconds` rule, applied to a city
 * instead of to a cell. It reads the city's NOMINAL throughput
 * (`cityGatherPerSecond`, travel and all), so a shed nobody works pays
 * nothing and a maxed Sawmill pays a Sawmill's worth.
 *
 * The FLOOR is what makes the chest real for a city that has barely started:
 * an early album lands in a city with two workers, and a chest of almost
 * nothing would read as a bug rather than as a reward.
 */
/** Gold a second, taxes and gatherers together — what every reward priced in
 *  production reads, so the chest and the close never disagree about what an
 *  hour of this city is worth. */
export const cityGoldPerSecond = (state: GameState): number =>
  cityGoldPerMinute(state) / 60 + cityGatherPerSecond(state, 'Gold');

export function productionChest(state: GameState, hours: number): Wallet {
  const out: Wallet = {};
  const seconds = hours * 3600;
  const gold = Math.round(cityGoldPerSecond(state) * seconds);
  const floor = Math.round(COLLECTION.chestFloorPerHour * hours);
  out.Gold = Math.max(floor, gold);
  for (const c of ['Food', 'Wood', 'Stone'] as const) {
    if (CURRENCIES[c] === undefined) continue;
    out[c] = Math.max(floor, Math.round(cityGatherPerSecond(state, c) * seconds));
  }
  return out;
}

/**
 * Every album of THIS LAP finished, so the collection prize is owed (§5).
 *
 * Not exported, and deliberately: `completed` empties the instant the lap
 * rolls, so this is true for exactly as long as it takes `completeIfDue` to
 * ask it. What outlives the lap is `prizePaid` — that is the fact anything
 * outside this file wants.
 */
const seasonIsComplete = (state: GameState): boolean =>
  state.collection.completed.length >= ALBUM_ORDER.length;

// ------------------------------------------------------------- the wildcard

/**
 * A WILDCARD stands in for any card of ITS RARITY OR LOWER, in any album
 * (§9). It is placed by the player, in the slot they choose, and consumed.
 *
 * THERE IS NO GOLD WILDCARD, at any price: the gold slots of the last two
 * albums are earned or sent, which is what keeps the two strongest relics the
 * two Gems cannot finish.
 */
export const wildcardsHeld = (state: GameState, rarity: Rarity): number =>
  state.collection.wildcards[rarity] ?? 0;

export const wildcardGemCost = (rarity: Rarity): number =>
  COLLECTION.wildcardGemCosts[rarity - 1] ?? 0;

/** Whether a wildcard of `rarity` may be placed on this slot. */
export function wildcardCovers(rarity: Rarity, ref: CardRef): boolean {
  const card = cardAt(ref);
  if (card.gold === true) return false;
  return card.rarity <= rarity;
}

/** The cheapest wildcard the player holds that could fill this slot, or null.
 *  Cheapest, because a 5★ wildcard spent on a 1★ hole is a waste the screen
 *  should not make for them. */
export function heldWildcardFor(state: GameState, ref: CardRef): Rarity | null {
  for (const r of RARITIES) {
    if (wildcardsHeld(state, r) > 0 && wildcardCovers(r, ref)) return r;
  }
  return null;
}

export type BuyWildcardResult = 'Purchased' | 'NoGoldWildcard' | 'NotEnoughGems';

export function buyWildcard(state: GameState, rarity: Rarity): BuyWildcardResult {
  const cost = wildcardGemCost(rarity);
  if (cost <= 0) return 'NoGoldWildcard';
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.collection.wildcards[rarity] = wildcardsHeld(state, rarity) + 1;
  return 'Purchased';
}

export type PlaceWildcardResult =
  | { placed: true; payout: AlbumPayout | null }
  | { placed: false; reason: 'NoWildcard' | 'AlreadyHeld' | 'GoldSlot' | 'AlbumComplete' };

/**
 * Spend a wildcard on a slot.
 *
 * The card it becomes is a FIRST COPY, never a duplicate — a wildcard that
 * landed on a slot the player already holds would be stars at a Gem price,
 * which is the one thing a targeted purchase must not be. So the slot has to
 * be empty, and the screen only offers the ones that are.
 */
export function placeWildcard(
  state: GameState, ref: CardRef, rarity: Rarity,
): PlaceWildcardResult {
  if (cardAt(ref).gold === true) return { placed: false, reason: 'GoldSlot' };
  if (albumIsComplete(state, ref.album)) return { placed: false, reason: 'AlbumComplete' };
  if (holdsCard(state, ref)) return { placed: false, reason: 'AlreadyHeld' };
  if (wildcardsHeld(state, rarity) <= 0 || !wildcardCovers(rarity, ref)) {
    return { placed: false, reason: 'NoWildcard' };
  }
  state.collection.wildcards[rarity] = wildcardsHeld(state, rarity) - 1;
  const row = state.collection.cards[ref.album] ?? emptyAlbum();
  state.collection.cards[ref.album] = row;
  row[ref.slot] = 1;
  // The same completion path a pack's ninth card takes, which is why
  // `completeIfDue` is a question about the ALBUM and not about the card.
  const payout = completeIfDue(state, ref.album);
  if (payout !== null) rollLapIfDue(state);
  return { placed: true, payout };
}

/**
 * THE AIMED OFFER (§9). One per album the player has nearly finished, naming
 * the album, how many cards it is short and the wildcard that fills any of
 * them.
 *
 * An offer ANSWERS A SHORTAGE rather than interrupting
 * ([`14-monetization.md`] §6), which is why it is keyed on the gap: an album
 * nine cards short is not a shortage, it is a season, and the store says
 * nothing about it.
 *
 * The rarity offered is the DEAREST missing slot's, so one purchase can fill
 * any hole the album still has — a cheaper wildcard that covers only some of
 * them would be an offer the player has to do arithmetic on.
 */
export interface WildcardOffer {
  album: AlbumId;
  /** Cards the album is short, gold slots included. */
  short: number;
  /** The rarity the offer sells, or null when only gold slots are left — no
   *  wildcard covers those, so there is nothing to sell. */
  rarity: Rarity | null;
  cost: number;
}

export function wildcardOffers(state: GameState): WildcardOffer[] {
  const out: WildcardOffer[] = [];
  for (const album of ALBUM_ORDER) {
    if (albumIsComplete(state, album)) continue;
    const missing = ALBUMS[album].cards
      .map((card, slot) => ({ card, slot }))
      .filter(({ slot }) => !holdsCard(state, { album, slot }));
    if (missing.length === 0 || missing.length > COLLECTION.wildcardOfferAt) continue;
    const fillable = missing.filter(({ card }) => card.gold !== true);
    const rarity = fillable.length === 0
      ? null
      : (Math.max(...fillable.map(({ card }) => card.rarity)) as Rarity);
    out.push({
      album,
      short: missing.length,
      rarity,
      cost: rarity === null ? 0 : wildcardGemCost(rarity),
    });
  }
  return out;
}

// ---------------------------------------------------------------- the store

/**
 * THE PUBLISHED ODDS (§6): what one SLOT of this pack lands on, as percentages
 * over the seven faces, guarantees and filler together.
 *
 * Weights are authored rather than percentages so a row can be retuned without
 * rebalancing it to 100 — but a player is owed the percentage, and a pack whose
 * first card is promised is not honestly described by its filler alone. So a
 * guarantee counts as its whole slot and the filler shares the rest.
 */
export function packOdds(tier: PackTier): Array<{ face: FaceId; percent: number }> {
  const def = PACKS[tier];
  const given = FACE_ORDER.reduce((n, f) => n + (def.guarantees[f] ?? 0), 0);
  const rolled = Math.max(0, def.cards - given);
  const total = def.weights.reduce((n, w) => n + Math.max(0, w), 0);
  const share = (f: FaceId, i: number): number =>
    (def.guarantees[f] ?? 0) + (total > 0 ? (rolled * Math.max(0, def.weights[i] ?? 0)) / total : 0);
  return FACE_ORDER
    .map((f, i) => ({ face: f, percent: (share(f, i) / def.cards) * 100 }))
    .filter((row) => row.percent > 0);
}

/** Sobres the store sells, cheapest first. One with no price is not for sale —
 *  which is how the free three stay the faucet and the chests the vault's. */
export const packsForSale = (): PackTier[] =>
  SOBRE_ORDER.filter((tier) => PACKS[tier].gemCost > 0);

export const packGemCost = (tier: PackTier): number => PACKS[tier].gemCost;

export type BuyPackResult = 'Purchased' | 'NotForSale' | 'NotEnoughGems';

/**
 * Buy a pack with Gems.
 *
 * It lands UNOPENED, like every other pack: the store hands over the thing,
 * and the Collection is where a pack is turned over (§11.5). So a player who
 * buys three in a row has three to open rather than three reveals they have
 * to sit through at the till.
 */
export function buyPack(state: GameState, tier: PackTier): BuyPackResult {
  const cost = packGemCost(tier);
  if (cost <= 0) return 'NotForSale';
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  grantPack(state, tier, 'store');
  return 'Purchased';
}

// -------------------------------------------------------------- the bundles

/**
 * A CARD BUNDLE (§6.1). Star packs and wildcards for MONEY rather than for
 * Gems — the two things the collection already sells, handed over together at
 * a price the Gem ladder cannot match.
 *
 * It is a `Store` row, so it walks the simulated budget like every other
 * real-money SKU: the purchase is logged, a refusal is counted, and the
 * monthly allowance is what decides. It grants no Gems, on the Royal chest's
 * precedent — a bundle hands over the THINGS, not the currency that buys them.
 */
export const bundleOf = (sku: StoreSkuId): CardBundleDef | null => STORE[sku].bundle;

/** What the bundle would cost at the Gem prices of its parts. The shelf prints
 *  it, because a bundle's whole argument is that it beats buying the pieces. */
export function bundleGemValue(bundle: CardBundleDef): number {
  return bundle.packs * packGemCost(bundle.tier)
    + bundle.wildcards * wildcardGemCost(bundle.wildcardRarity);
}

/**
 * WHETHER THE SHELF IS OPEN. A bundle is packs and wildcards, and the close
 * wipes both — so there is a window at the end of every season where money
 * would buy something that expires before it can be spent. The store says
 * nothing in that window rather than sell it.
 *
 * Read off `seasonLeftMs`, so it is a fact about the clock rather than a
 * timer: nothing is scheduled, nothing expires, and a player who comes back
 * after the close finds the shelf open again on its own.
 */
export const bundlesWithdrawn = (state: GameState, now: number): boolean =>
  seasonLeftMs(state, now) <= COLLECTION.bundleWithdrawHours * 3_600_000;

/** The bundles the store will sell right now, cheapest first. */
export const bundlesForSale = (state: GameState, now: number): StoreSkuId[] =>
  bundlesWithdrawn(state, now) ? [] : [...CARD_BUNDLE_ORDER];

export type BuyBundleResult = BuySkuResult | 'NotABundle' | 'SeasonClosing';

/**
 * Buy a bundle. The hand lands at once and UNOPENED, like every pack: the
 * store hands over the things and the Collection is where they are turned
 * over. Ten packs bought together are ten to open, not ten reveals at the
 * till.
 *
 * The budget is spent LAST of the checks and FIRST of the effects, so a
 * refusal — no profile, no allowance — grants nothing and a grant is never
 * unpaid.
 */
export function buyCardBundle(
  state: GameState, sku: StoreSkuId, now: number,
): BuyBundleResult {
  const bundle = bundleOf(sku);
  if (bundle === null) return 'NotABundle';
  if (bundlesWithdrawn(state, now)) return 'SeasonClosing';
  const paid = buySku(state, sku, now);
  if (paid !== 'Purchased') return paid;
  // Wildcards first, packs second: the packs are what the player is sent to
  // open, so they are what the toast counts.
  if (bundle.wildcards > 0) {
    state.collection.wildcards[bundle.wildcardRarity] =
      wildcardsHeld(state, bundle.wildcardRarity) + bundle.wildcards;
  }
  for (let i = 0; i < bundle.packs; i++) grantPack(state, bundle.tier, 'store');
  return 'Purchased';
}

// --------------------------------------------------------------- the vault

/** The three chests, cheapest first. A chest is a `PackTier` like any other —
 *  what makes it a chest is that only the vault hands one out. */
export type VaultTier = typeof CHEST_ORDER[number];

export const vaultCost = (tier: VaultTier): number =>
  (COLLECTION.chestStars as Record<string, number>)[tier] ?? 0;

/** The dearest chest the player can already afford, or the cheapest one if
 *  they can afford none — which is the one the knob points at. */
export const vaultNext = (state: GameState): VaultTier => {
  const afford = CHEST_ORDER.filter((t) => state.collection.stars >= vaultCost(t));
  return (afford[afford.length - 1] ?? CHEST_ORDER[0]) as VaultTier;
};

export type VaultResult = 'Opened' | 'NotEnoughStars';

/**
 * Spend stars on a chest. The vault is what makes a duplicate worth something
 * to a player with nobody to send it to (§7).
 *
 * A CHEST MUST COST MORE THAN ITS OWN CONTENTS RETURN as duplicates, or the
 * vault pays for itself and the loop never ends. That is arithmetic rather
 * than balance, so `tests/artifacts.test.ts` holds the line rather than a
 * comment here.
 */
export function buyFromVault(state: GameState, tier: VaultTier): VaultResult {
  const cost = vaultCost(tier);
  if (cost <= 0 || state.collection.stars < cost) return 'NotEnoughStars';
  state.collection.stars -= cost;
  grantPack(state, tier, 'vault');
  return 'Opened';
}

/**
 * TEN AT ONCE, and no discount. A completionist cashes the vault scores of
 * times a season for a card or two each, and the problem is the screens rather
 * than the chests — the ten-call made this argument first
 * (Docs/features/10-heroes.md §6.4): buying in bulk buys TIME, not a better
 * price. All or nothing, so nobody spends nine chests' worth and is told the
 * tenth is short.
 */
export function buyFromVaultMany(
  state: GameState, tier: VaultTier, count = 10,
): { result: VaultResult; bought: number } {
  const cost = vaultCost(tier);
  if (cost <= 0 || state.collection.stars < cost * count) {
    return { result: 'NotEnoughStars', bought: 0 };
  }
  for (let i = 0; i < count; i++) buyFromVault(state, tier);
  return { result: 'Opened', bought: count };
}

// ---------------------------------------------------------------- the close

export interface SeasonClose {
  from: number;
  to: number;
  /** Distinct cards the wipe took, and what they paid back. */
  cards: number;
  gold: number;
}

/**
 * WHAT THE WIPE PAYS BACK (§3). An album is emptied rather than confiscated:
 * every card in it melts into Gold by its RARITY, on the same stars ladder a
 * duplicate is worth, so a gold edition melts for double here exactly as it
 * does in the vault.
 *
 * Priced in SECONDS OF THE CITY'S GOLD PRODUCTION rather than in coins, on the
 * `tap.workSeconds` rule (CLAUDE.md): a flat number would be a fortune to a
 * city with two workers and a rounding error to a city with twenty, and it
 * would go stale on its own as the kingdom grows.
 *
 * ONE COPY OF EACH CARD, never every copy. A duplicate already paid its stars
 * the moment it landed, and paying for it again at the close would pay it
 * twice — what melts is the card in the slot.
 */
export function closeGold(state: GameState): { cards: number; stars: number; gold: number } {
  let cards = 0;
  let stars = 0;
  for (const album of ALBUM_ORDER) {
    const row = state.collection.cards[album] ?? [];
    for (let slot = 0; slot < CARDS_PER_ALBUM; slot++) {
      if ((row[slot] ?? 0) < 1) continue;
      cards += 1;
      stars += starsFor({ album, slot });
    }
  }
  const seconds = stars * COLLECTION.closeGoldSecondsPerStar;
  const floor = Math.round((COLLECTION.chestFloorPerHour * seconds) / 3600);
  const gold = Math.max(floor, Math.round(cityGoldPerSecond(state) * seconds));
  return { cards, stars, gold: cards === 0 ? 0 : gold };
}

/**
 * Roll the season over: the cards melt into Gold and the stars are wiped, the
 * relic levels stay, and the packs go with the cards — an unopened pack is a
 * hand of THIS season's cards and cannot be dealt into the next one.
 *
 * THE NEXT SEASON IS WHATEVER THE CALENDAR SAYS, not the one after this one:
 * `seasonAt` is a floor division from the epoch, so a player away for three
 * seasons lands in the live one in a single call rather than walking to it.
 * The content cycles under it (`seasonContent`), so the list never runs out.
 *
 * Idempotent in the only way that matters: it is driven by `applyDueAt` at an
 * absolute boundary, and `season` moving is what stops it firing twice.
 */
export function closeSeason(state: GameState, at: number): SeasonClose {
  const from = state.collection.season;
  const to = seasonAt(at);
  const melted = closeGold(state);
  if (melted.gold > 0) addToWallet(state.city.wallet, 'Gold', melted.gold);
  state.collection = freshCollection(to);
  return { from, to, cards: melted.cards, gold: melted.gold };
}

export const freshCollection = (season: number): GameState['collection'] => ({
  season,
  cards: {},
  completed: [],
  stars: 0,
  // A wildcard is a card in waiting, so it goes with the cards at the close:
  // one held over would be a slot filled in a season whose album it was never
  // bought for.
  wildcards: {},
  packs: [],
  packsIssued: 0,
  prizePaid: false,
  cycle: 0,
});
