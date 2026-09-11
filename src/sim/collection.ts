// The card collection (Docs/features/09-relics.md).
//
// Five albums of nine cards, one album per relic, on a 30-day season every
// player shares. Finishing an album levels its relic for ever, pays a chest of
// production, keys and Gems; at the close the cards and the stars are wiped
// and the levels stay.
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
//     for a week comes back to the wiped album and the new season.
//  4. STARS ARE A COUNTER IN THIS SCREEN, not a wallet row — the Fragments
//     precedent (CLAUDE.md, "Money and identity are different things").

import { COLLECTION, CURRENCIES, PACKS, type PackTier } from './data/definitions';
import {
  ALBUMS, ALBUM_ORDER, CARDS_PER_ALBUM, cardAt, RARITIES, SEASON_EPOCH, seasonContent,
  type AlbumId, type CardRef, type Rarity, type SeasonDef,
} from './data/seasons';
import { rand } from './rng';
import { addToWallet, type ArtifactId, type CurrencyId, type GameState, type Wallet } from './state';
import { grantArtifactLevel } from './artifacts';
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

/** Stars a duplicate of this card is worth (§7). */
export function starsFor(ref: CardRef): number {
  const card = cardAt(ref);
  const base = COLLECTION.starsPerRarity[card.rarity - 1] ?? 1;
  return card.gold === true ? base * COLLECTION.starGoldMultiplier : base;
}

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

/** Every slot in the season that a rarity (and gold-ness) can land on.
 *  `rarity` null = any, which is what the Star pack's guarantee asks for. */
function slotsMatching(rarity: Rarity | null, gold: boolean): CardRef[] {
  const out: CardRef[] = [];
  for (const album of ALBUM_ORDER) {
    ALBUMS[album].cards.forEach((card, slot) => {
      if (rarity !== null && card.rarity !== rarity) return;
      if ((card.gold === true) !== gold) return;
      out.push({ album, slot });
    });
  }
  return out;
}

/** Which rarity a roll in `[0,1)` lands on, by the tier's weights. */
function rarityFromRoll(tier: PackTier, roll: number): Rarity {
  const weights = PACKS[tier].weights;
  const total = RARITIES.reduce((n, r) => n + (weights[r - 1] ?? 0), 0);
  if (total <= 0) return 1;
  let acc = 0;
  const target = roll * total;
  for (const r of RARITIES) {
    acc += weights[r - 1] ?? 0;
    if (target < acc) return r;
  }
  return RARITIES[RARITIES.length - 1];
}

/**
 * The cards a pack holds — a PURE function of its id, so it can be asked
 * before, during and after the reveal and always answers the same.
 *
 * `parts` identify THE EVENT (this pack, this card index) and never the moment
 * of the query, which is the whole of invariant 4 in CLAUDE.md.
 */
export function packCards(seed: number, pack: PendingPack): CardRef[] {
  const def = PACKS[pack.tier];
  const out: CardRef[] = [];
  for (let i = 0; i < def.cards; i++) {
    // A Star pack guarantees one gold, and it is the LAST card dealt — the
    // reveal turns them worst to best, so the guarantee lands on the beat the
    // screen is built around.
    const forceGold = def.goldGuaranteed && i === def.cards - 1;
    const rarity = rarityFromRoll(pack.tier, rand(seed, pack.id, 'rarity', i));
    const wantsGold = forceGold
      || (def.goldChance > 0 && rand(seed, pack.id, 'gold', i) < def.goldChance);
    // A GUARANTEE IGNORES THE RARITY ROLL. Gold is an edition of the late
    // rarities only, so asking for "gold at 3★" would find nothing and quietly
    // hand back a plain card — which is how the Star pack's one promise gets
    // broken. When it is guaranteed, the gold slots ARE the pool.
    let pool = forceGold
      ? slotsMatching(null, true)
      : slotsMatching(rarity, wantsGold);
    if (pool.length === 0) pool = slotsMatching(rarity, false);
    if (pool.length === 0) {
      // A tier whose weights name a rarity the season has no slot for. Walk
      // down rather than deal nothing.
      for (let r = rarity - 1; r >= 1 && pool.length === 0; r--) {
        pool = slotsMatching(r as Rarity, false);
      }
    }
    if (pool.length === 0) continue;
    const pick = Math.floor(rand(seed, pack.id, 'slot', i) * pool.length) % pool.length;
    out.push(pool[pick]);
  }
  // Worst first, best last.
  return out.sort((a, b) => rankOf(a) - rankOf(b));
}

/**
 * How good a card is, for the order the reveal deals them in.
 *
 * GOLD OUTRANKS EVERY PLAIN CARD, whatever its rarity: a gold edition falls
 * only from the best packs, cannot be sent and no wildcard covers it (§4), so
 * a gold 4★ is a bigger moment than a plain 5★ — and it is what makes the
 * Star pack's guaranteed gold land on the last beat rather than the
 * second-to-last.
 */
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
  if (payout !== null) opening.payouts.push(payout);
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
  /** Hours of production the chest held, and what that came to. */
  hours: number;
  chest: Wallet;
  silverKeys: number;
  goldKeys: number;
  gems: number;
}

/** What an album at this index pays. A TOTAL, banded easy → hard (§5). */
export function albumRewards(album: AlbumId): {
  hours: number; silverKeys: number; goldKeys: number; gems: number;
} {
  const i = ALBUM_ORDER.indexOf(album);
  return {
    hours: COLLECTION.albumHours[i] ?? COLLECTION.albumHours[0] ?? 2,
    silverKeys: COLLECTION.albumSilverKeys[i] ?? 0,
    goldKeys: COLLECTION.albumGoldKeys[i] ?? 0,
    gems: COLLECTION.albumGems,
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
  state.collection.completed.push(album);

  const relic = ALBUMS[album].relic;
  const found = grantArtifactLevel(state, relic) === 'Granted';
  const rewards = albumRewards(album);
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
export function productionChest(state: GameState, hours: number): Wallet {
  const out: Wallet = {};
  const seconds = hours * 3600;
  const gold = Math.round(
    (cityGoldPerMinute(state) / 60 + cityGatherPerSecond(state, 'Gold')) * seconds);
  const floor = Math.round(COLLECTION.chestFloorPerHour * hours);
  out.Gold = Math.max(floor, gold);
  for (const c of ['Food', 'Wood', 'Stone'] as const) {
    if (CURRENCIES[c] === undefined) continue;
    out[c] = Math.max(floor, Math.round(cityGatherPerSecond(state, c) * seconds));
  }
  return out;
}

/** Every album finished, so the collection prize is owed (§5). */
export const seasonIsComplete = (state: GameState): boolean =>
  state.collection.completed.length >= ALBUM_ORDER.length;

// --------------------------------------------------------------- the vault

export type VaultTier = 'Gold' | 'Star';

export const vaultCost = (tier: VaultTier): number =>
  tier === 'Gold' ? COLLECTION.vaultGoldStars : COLLECTION.vaultStarStars;

/** The next threshold the header line points at — Gold until it is affordable
 *  twice over, then Star. */
export const vaultNext = (state: GameState): VaultTier =>
  state.collection.stars >= vaultCost('Star') ? 'Star' : 'Gold';

export type VaultResult = 'Opened' | 'NotEnoughStars';

/** Spend stars on a pack. The vault is what makes a duplicate worth something
 *  to a player with nobody to send it to (§7). */
export function buyFromVault(state: GameState, tier: VaultTier): VaultResult {
  const cost = vaultCost(tier);
  if (state.collection.stars < cost) return 'NotEnoughStars';
  state.collection.stars -= cost;
  grantPack(state, tier === 'Gold' ? 'Gold' : 'Star', 'vault');
  return 'Opened';
}

// ---------------------------------------------------------------- the close

/**
 * Roll the season over: the cards and the stars are wiped, the relic levels
 * stay, and the packs go with the cards — an unopened pack is a hand of THIS
 * season's cards and cannot be dealt into the next one.
 *
 * Idempotent in the only way that matters: it is driven by `applyDueAt` at an
 * absolute boundary, and `season` moving is what stops it firing twice.
 */
export function closeSeason(state: GameState, at: number): { from: number; to: number } {
  const from = state.collection.season;
  const to = seasonAt(at);
  state.collection = freshCollection(to);
  return { from, to };
}

export const freshCollection = (season: number): GameState['collection'] => ({
  season,
  cards: {},
  completed: [],
  stars: 0,
  packs: [],
  packsIssued: 0,
  prizePaid: false,
});
