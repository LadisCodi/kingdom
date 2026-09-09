// The daily chest: a season of fourteen rungs, two tracks wide.
//
// THE LADDER ADVANCES ON DAYS PLAYED, NEVER ON CALENDAR DAYS. Rung 1 the first
// day you open the game inside the window, rung 2 the second, whether that is
// tomorrow or in three weeks. A rung reached is paid and never retracted;
// what expires is the chance to earn more, at the end of the twenty-day
// window (Docs/features/12-quests.md §3.1).
//
// The window is the one deadline in the game. It is deliberate: the Royal
// chest is a season product and a season needs an end. Everything inside it
// still keeps promise 1 — missing a day costs that day's rung and nothing
// else, there is no streak to break, and there is no repair to sell.
//
// EVERY CELL IS ITS OWN CLAIM. The free cell of the day's rung is what
// advances the ladder; each Royal cell of a rung already reached is a separate
// tap. So buying the chest on rung 9 does not rain nine rewards at once — it
// leaves nine cells waiting to be taken, which is the same promise (nothing is
// lost by buying late) delivered as nine taps instead of one payout.
//
// WHY THIS IS NOT A BOUNDARY SOURCE, and the argument is `adOffers.ts`'s
// verbatim: a daily timer registered in `advance()` would propose a boundary
// per day across a long absence for no simulation benefit, and the tail
// advance in save.ts is uncapped. Nothing in the sim reads the chest; claiming
// is always a live player command. So `advance()` never touches it. The
// season turns the same way — it is DERIVED from the instant, never ticked.
//
// Docs/features/12-quests.md §3.

import { COLLECTION, DAILY, RUINS } from './data/definitions';
import { addToWallet, getWallet, type GameState, type RuinId, type Wallet } from './state';
import { addHeroXp } from './heroes';
import { manaCap } from './mana';
import { buySku, type BuySkuResult } from './store';

const DAY_MS = 86_400_000;

/**
 * Which day an instant falls in.
 *
 * Derived from the instant every time, never stored as a counter that
 * something has to remember to increment — the same pull-based rule as
 * `isActive(m, state.lastAdvance)` and `recoverIfDue`, so a throttled tab or a
 * three-week absence resolves to the right number instead of drifting.
 *
 * UTC, deliberately. A local-midnight rollover would make the ladder depend on
 * where the device thinks it is, so a player crossing a timezone could claim
 * twice in a day or lose one — and the sim is not allowed to read anything
 * that is not passed in.
 */
export const dayIndex = (t: number): number => Math.floor(t / DAY_MS);

/** How long a season lasts, in ms. */
export const seasonMs = (): number => DAILY.seasonDays * DAY_MS;

/**
 * Which season an instant falls in.
 *
 * Anchored at the epoch rather than at each player's start, so every player is
 * inside the same window at the same time — the same argument the event
 * timeline makes for its fixed Monday. A whole number of days, so a season
 * boundary is always a day boundary and can never split a claim in half.
 */
export const seasonIndex = (t: number): number => Math.floor(t / seasonMs());

/** When the current season closes — absolute, so a countdown derives from it
 *  rather than being decremented (Docs/README.md: countdowns come from a
 *  timestamp). */
export const seasonEndsAt = (t: number): number => (seasonIndex(t) + 1) * seasonMs();

/** How long the ladder is, from the authored data rather than a constant. */
export const ladderLength = (): number => DAILY.manaFractions.length;

/** Rungs already taken THIS season. A stale season reads as none, which is
 *  what turns the season over with nothing scheduled. */
export const rungsClaimed = (state: GameState, now: number): number =>
  state.kingdom.daily.season === seasonIndex(now) ? state.kingdom.daily.rung : 0;

/** The rung a claim right now would pay — 1-based. */
export const nextRung = (state: GameState, now: number): number =>
  Math.min(ladderLength(), rungsClaimed(state, now) + 1);

/** Every rung of this season taken. The ladder does not cycle: what follows a
 *  finished season is the next season, not rung 1 again. */
export const seasonComplete = (state: GameState, now: number): boolean =>
  rungsClaimed(state, now) >= ladderLength();

/** Is the Royal track unlocked for the season `now` falls in? */
export const royalOwned = (state: GameState, now: number): boolean =>
  state.kingdom.daily.royalSeason === seasonIndex(now);

export const chestAvailable = (state: GameState, now: number): boolean =>
  state.kingdom.daily.lastClaimedDay !== dayIndex(now) && !seasonComplete(state, now);

/**
 * The season is still worth opening: a rung waiting, a Royal cell waiting, or
 * a Royal chest still on the table. The last one is what keeps the purchase
 * reachable after the final claim (§3.4).
 */
export const chestSheetOpen = (state: GameState, now: number): boolean =>
  chestAvailable(state, now) || anyRoyalPending(state, now) || !royalOwned(state, now);

// ---------------------------------------------------------------- the rewards

/**
 * The completed-depth Hero XP trickle, per hour
 * (Docs/features/10-heroes.md §5): `rate × tier × depth`.
 *
 * Zero for a city that has never delved, which is most of them — the Royal
 * track's floor is what pays those, and this is what makes the same grant grow
 * with a player who does delve.
 */
export function heroXpPerHour(state: GameState): number {
  const tier = (Object.keys(state.ruinsCleared) as RuinId[])
    .reduce((best, id) => Math.max(best, RUINS[id]?.tier ?? 0), 0);
  return COLLECTION.xpTricklePerTierDepth * tier * state.deepestDepth;
}

/**
 * What rung `rung` pays on the FREE track.
 *
 * Mana is a FRACTION of the pool for the reason `tap.workSeconds` exists: a
 * reward priced in the player's own production is worth the same fraction of
 * progress at every stage of the game, with nothing re-derived per era. The
 * Gems are absolute — Gems have no production rate to be a fraction of — and
 * they are the recurring F2P faucet (Docs/features/12-quests.md §3.2).
 */
export function freeReward(state: GameState, rung: number): Wallet {
  const i = clampRung(rung);
  const reward: Wallet = {};

  const manaFraction = DAILY.manaFractions[i] ?? 0;
  if (manaFraction > 0) reward.Mana = Math.round(manaCap(state) * manaFraction);

  const gems = DAILY.gems[i] ?? 0;
  if (gems > 0) reward.Gems = gems;

  return reward;
}

/**
 * What rung `rung` pays on the ROYAL track — paid only to a player who owns
 * the season's Royal chest.
 *
 * Hero XP is priced in HOURS of the player's own trickle with an authored
 * floor, the same rule the free track's Mana follows. An absolute XP number
 * goes stale by era three; the floor is what makes the grant real for a city
 * that has never delved.
 */
export function royalReward(state: GameState, rung: number): Wallet {
  const i = clampRung(rung);
  const reward: Wallet = {};

  const gems = DAILY.premiumGems[i] ?? 0;
  if (gems > 0) reward.Gems = gems;

  const hours = DAILY.premiumXpHours[i] ?? 0;
  if (hours > 0) {
    reward.HeroXp = Math.max(DAILY.premiumXpFloor, Math.round(heroXpPerHour(state) * hours));
  }

  const keys = DAILY.premiumGoldKeys[i] ?? 0;
  if (keys > 0) reward.GoldKey = keys;

  return reward;
}

const clampRung = (rung: number): number =>
  Math.max(0, Math.min(ladderLength() - 1, rung - 1));

// ----------------------------------------------------------------- the claim

/** Which Royal cells are already taken this season. A stale season reads as
 *  none, the same pull rule the rung count follows. */
export const royalClaimedRungs = (state: GameState, now: number): readonly number[] =>
  state.kingdom.daily.season === seasonIndex(now) ? state.kingdom.daily.royalClaimed : [];

/** Is the Royal cell of `rung` waiting to be tapped? Owned, reached, untaken. */
export function royalPending(state: GameState, rung: number, now: number): boolean {
  if (!royalOwned(state, now)) return false;
  if (rung < 1 || rung > rungsClaimed(state, now)) return false;
  return !royalClaimedRungs(state, now).includes(rung);
}

/** Any Royal cell at all waiting. Drives the pill's glow and keeps the sheet
 *  open past the last rung. */
export const anyRoyalPending = (state: GameState, now: number): boolean =>
  royalClaimedRungs(state, now).length < rungsClaimed(state, now) && royalOwned(state, now);

export type ClaimChestResult = 'Claimed' | 'AlreadyClaimed' | 'SeasonComplete';

/**
 * Take the day's rung on the FREE track — the tap that advances the ladder.
 *
 * `lastClaimedDay` is stamped with today rather than incremented, which is
 * what makes a second claim on the same day impossible however the clock
 * moves — including backwards.
 */
export function claimFreeRung(state: GameState, now: number): ClaimChestResult {
  if (seasonComplete(state, now)) return 'SeasonComplete';
  if (state.kingdom.daily.lastClaimedDay === dayIndex(now)) return 'AlreadyClaimed';

  const rung = nextRung(state, now);
  pay(state, freeReward(state, rung));
  const daily = normalise(state, now);
  daily.rung = rung;
  daily.lastClaimedDay = dayIndex(now);
  return 'Claimed';
}

export type ClaimRoyalResult = 'Claimed' | 'NotOwned' | 'NotReached' | 'AlreadyClaimed';

/**
 * Take ONE Royal cell.
 *
 * Out of order and at the player's pace: the cells behind a late purchase are
 * all open at once, and nothing expires before the window does.
 */
export function claimRoyalRung(state: GameState, rung: number, now: number): ClaimRoyalResult {
  if (!royalOwned(state, now)) return 'NotOwned';
  if (rung < 1 || rung > rungsClaimed(state, now)) return 'NotReached';
  if (royalClaimedRungs(state, now).includes(rung)) return 'AlreadyClaimed';

  pay(state, royalReward(state, rung));
  const daily = normalise(state, now);
  daily.royalClaimed = [...daily.royalClaimed, rung].sort((a, b) => a - b);
  return 'Claimed';
}

export type BuyRoyalChestResult = BuySkuResult | 'AlreadyOwned';

/**
 * Buy the season's Royal chest.
 *
 * BUYING OPENS EVERY RUNG ALREADY CLIMBED THIS SEASON. Without that, buying
 * late costs the player rewards they earned by showing up, which is a reason
 * to buy early — and a deadline that also punishes deliberating is the
 * demand-shaped design the rest of this feature refuses. It grants nothing on
 * the spot: what it hands over is a column of cells to tap.
 *
 * The price goes through `buySku`, so the monthly budget, the purchase log and
 * the refusal counter all see it exactly as they see a Gem pack.
 */
export function buyRoyalChest(state: GameState, now: number): BuyRoyalChestResult {
  if (royalOwned(state, now)) return 'AlreadyOwned';
  const result = buySku(state, 'RoyalChest', now);
  if (result !== 'Purchased') return result;
  normalise(state, now).royalSeason = seasonIndex(now);
  return 'Purchased';
}

/**
 * Bring the stored block onto the current season before writing to it.
 *
 * READS never do this — they report a stale season as rung 0 and no cells, so
 * nothing has to run at a boundary. A WRITE has to land in the right season,
 * and this is the one place that decides which.
 */
function normalise(state: GameState, now: number): GameState['kingdom']['daily'] {
  const daily = state.kingdom.daily;
  const season = seasonIndex(now);
  if (daily.season !== season) {
    daily.season = season;
    daily.rung = 0;
    daily.royalClaimed = [];
  }
  return daily;
}

/** Where each coin of a rung lands. Mana is CITY, Gems and keys are PLAYER,
 *  Hero XP is KINGDOM — the scopes the wallets already have. */
function pay(state: GameState, reward: Wallet): void {
  // Mana lands ON TOP of the cap, like the ad reward and for the same reason:
  // a grant clamped to a ceiling the player is already near would pay nothing
  // and read as broken.
  if (reward.Mana) {
    state.city.wallet.Mana = Math.max(0, getWallet(state.city.wallet, 'Mana') + reward.Mana);
  }
  if (reward.Gems) addToWallet(state.player.wallet, 'Gems', reward.Gems);
  if (reward.GoldKey) addToWallet(state.player.wallet, 'GoldKey', reward.GoldKey);
  // Through `addHeroXp`, not the wallet, so the Drillmaster bonus and the
  // resource discovery both fire exactly as they do for a cleared room.
  if (reward.HeroXp) addHeroXp(state, reward.HeroXp);
}
