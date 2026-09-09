// The daily chest season (Docs/features/12-quests.md §3), and the promises it
// is built to keep.
//
// The season is the one deadline in the game, so what these tests defend is
// the line between the pressure that is DELIBERATE and the pressure that is
// forbidden. Deliberate: fourteen rungs inside a twenty-day window, and a rung
// not taken is gone. Forbidden: a streak that resets, a rung that is retracted,
// a backlog that pays twice, and any reason to buy the Royal chest EARLY
// rather than at all — which is why buying pays back everything already
// climbed.
import { describe, expect, it } from 'vitest';
import {
  anyRoyalPending, buyRoyalChest, chestAvailable, chestSheetOpen, claimFreeRung,
  claimRoyalRung, dayIndex, freeReward, heroXpPerHour, ladderLength, nextRung,
  royalClaimedRungs, royalOwned, royalPending, royalReward, rungsClaimed,
  seasonComplete, seasonEndsAt, seasonIndex, seasonMs,
} from '../src/sim/daily';
import { advance } from '../src/sim/commands';
import { manaCap } from '../src/sim/mana';
import { DAILY, STORE } from '../src/sim/data/definitions';
import { deserialize, migrate, serialize } from '../src/sim/save';
import { choosePayerProfile } from '../src/sim/store';
import { getWallet } from '../src/sim/state';
import { newGame } from '../src/sim/newGame';
import { addBuilt, freshGame, map, T0 } from './helpers';
import type { GameState } from '../src/sim/state';

const DAY = 86_400_000;
const LEN = ladderLength();
/** T0 sits 14.5 days from the end of its season, so a full ladder of
 *  consecutive claims fits inside one window — which is what the twenty-day
 *  length is FOR (six missable days). */
const SEASON_END = seasonEndsAt(T0);

const claimOn = (state: GameState, t: number) => claimFreeRung(state, t);

/** A player who can afford the Royal chest. `freshGame` already picks Dolphin,
 *  which has budget enough — the purchase goes through `buySku` like every
 *  other SKU. */
const payer = (): GameState => freshGame();

/** F2P: a real profile with a budget of zero, which is how the store refuses
 *  rather than a "no store" flag. A profile is chosen ONCE, so this cannot use
 *  `freshGame`. */
function brokePayer(): GameState {
  const state = newGame(map, T0);
  choosePayerProfile(state, 'F2P', T0);
  return state;
}

describe('the ladder advances on days played, never on days elapsed', () => {
  it('gives rung 1 on the first day the game is opened', () => {
    const state = freshGame();
    expect(nextRung(state, T0)).toBe(1);
    expect(claimOn(state, T0)).toBe('Claimed');
    expect(rungsClaimed(state, T0)).toBe(1);
  });

  it('gives rung 2 on the NEXT day played, whenever that is inside the window', () => {
    const state = freshGame();
    claimOn(state, T0);
    // Ten days later. A calendar ladder would be at rung 11.
    expect(claimOn(state, T0 + 10 * DAY)).toBe('Claimed');
    expect(nextRung(state, T0 + 10 * DAY)).toBe(3);
  });

  it('keeps the rung across an absence INSIDE the season', () => {
    const state = freshGame();
    for (let d = 0; d < 4; d++) claimOn(state, T0 + d * DAY);
    expect(rungsClaimed(state, T0 + 4 * DAY)).toBe(4);
    advance(state, map, T0 + 12 * DAY); // gone a week and a half
    expect(rungsClaimed(state, T0 + 12 * DAY)).toBe(4);
    expect(nextRung(state, T0 + 12 * DAY)).toBe(5);
  });

  it('pays once a day, however many times it is asked', () => {
    const state = freshGame();
    expect(claimOn(state, T0)).toBe('Claimed');
    expect(claimOn(state, T0 + 60_000)).toBe('AlreadyClaimed');
    // T0 is noon UTC, so +11 h is still the same day; +13 h would not be.
    expect(claimOn(state, T0 + 11 * 3_600_000)).toBe('AlreadyClaimed');
    expect(rungsClaimed(state, T0)).toBe(1);
  });

  it('rolls over at UTC midnight, not at whatever the device thinks', () => {
    const noon = Date.parse('2026-08-20T12:00:00Z');
    expect(dayIndex(noon)).toBe(dayIndex(Date.parse('2026-08-20T23:59:59Z')));
    expect(dayIndex(noon)).not.toBe(dayIndex(Date.parse('2026-08-21T00:00:01Z')));
  });

  // `lastClaimedDay` is STAMPED rather than incremented, so this holds even
  // if the device clock goes backwards.
  it('cannot be farmed by winding the clock back', () => {
    const state = freshGame();
    claimOn(state, T0 + 5 * DAY);
    expect(claimOn(state, T0)).toBe('Claimed'); // a genuinely different day
    expect(claimOn(state, T0)).toBe('AlreadyClaimed');
    expect(rungsClaimed(state, T0)).toBe(2);
  });

  it('ENDS at the last rung rather than cycling', () => {
    const state = freshGame();
    for (let d = 0; d < LEN; d++) claimOn(state, T0 + d * DAY);
    expect(seasonComplete(state, T0 + LEN * DAY)).toBe(true);
    // The old seven-rung ladder wrapped to rung 1. This one does not: what
    // follows a finished season is the next season.
    expect(claimOn(state, T0 + LEN * DAY)).toBe('SeasonComplete');
    expect(chestAvailable(state, T0 + LEN * DAY)).toBe(false);
  });
});

describe('the season window', () => {
  it('is a whole number of days, so a boundary never splits a claim', () => {
    expect(seasonMs() % DAY).toBe(0);
    expect(seasonEndsAt(T0) % DAY).toBe(0);
  });

  // Anchored at the epoch, not at each player's start: every player is inside
  // the same window at the same time.
  it('is the same window for everyone, derived from the instant', () => {
    expect(seasonIndex(T0)).toBe(seasonIndex(SEASON_END - 1));
    expect(seasonIndex(SEASON_END)).toBe(seasonIndex(T0) + 1);
  });

  it('starts the next season at rung 1 with nothing owed', () => {
    const state = freshGame();
    for (let d = 0; d < 4; d++) claimOn(state, T0 + d * DAY);
    expect(rungsClaimed(state, T0 + 4 * DAY)).toBe(4);
    // Over the boundary. The rung count is stale, so it reads as zero — no
    // tick, no reset, nothing scheduled.
    expect(rungsClaimed(state, SEASON_END)).toBe(0);
    expect(nextRung(state, SEASON_END)).toBe(1);
    expect(chestAvailable(state, SEASON_END)).toBe(true);
  });

  it('does not pay a backlog of missed days', () => {
    const state = freshGame();
    claimOn(state, T0);
    advance(state, map, T0 + 7 * DAY);
    // Seven days gone; one rung waiting, not seven.
    expect(claimOn(state, T0 + 7 * DAY)).toBe('Claimed');
    expect(claimOn(state, T0 + 7 * DAY)).toBe('AlreadyClaimed');
    expect(rungsClaimed(state, T0 + 7 * DAY)).toBe(2);
  });

  // The argument adOffers.ts makes for itself: a daily timer registered in
  // advance() would propose a boundary per day across a long absence, for no
  // simulation benefit, against an uncapped tail advance.
  it('is never advanced by the sim — only a live claim moves it', () => {
    const state = freshGame();
    advance(state, map, T0 + 30 * DAY);
    expect(state.kingdom.daily.rung).toBe(0);
    expect(chestAvailable(state, T0 + 30 * DAY)).toBe(true);
  });
});

describe('the free track', () => {
  it('prices Mana as a fraction of the pool, so it grows with the city', () => {
    const small = freshGame();
    const large = freshGame();
    // A Sanctum raises the cap, which must raise the chest with it — that is
    // the reason the table holds fractions and not amounts.
    addBuilt(large, 'Sanctum', { x: 4, y: 4 });
    expect(manaCap(large)).toBeGreaterThan(manaCap(small));
    expect(freeReward(large, 1).Mana!).toBeGreaterThan(freeReward(small, 1).Mana!);
  });

  it('pays Mana on every rung and Gems on the authored ones only', () => {
    const state = freshGame();
    for (let rung = 1; rung <= LEN; rung++) {
      expect(freeReward(state, rung).Mana).toBeGreaterThan(0);
      expect(freeReward(state, rung).Gems ?? 0).toBe(DAILY.gems[rung - 1]);
    }
  });

  // The recurring F2P Gem faucet, and the number the monetisation doc quotes.
  it('is the whole recurring Gem faucet, at 3,000 a season', () => {
    const state = freshGame();
    let total = 0;
    for (let rung = 1; rung <= LEN; rung++) total += freeReward(state, rung).Gems ?? 0;
    expect(total).toBe(3000);
  });

  it('lands Mana on top of the cap rather than clamping it away', () => {
    const state = freshGame();
    state.city.wallet.Mana = manaCap(state); // already full
    const before = state.city.wallet.Mana;
    claimOn(state, T0);
    expect(state.city.wallet.Mana!).toBeGreaterThan(before);
  });
});

describe('the Royal track', () => {
  it('pays 25,000 Gems and ten gold keys across a season', () => {
    const state = freshGame();
    let gems = 0;
    let keys = 0;
    for (let rung = 1; rung <= LEN; rung++) {
      gems += royalReward(state, rung).Gems ?? 0;
      keys += royalReward(state, rung).GoldKey ?? 0;
    }
    expect(gems).toBe(25_000);
    expect(keys).toBe(10);
  });

  // XP is priced in hours of the player's own trickle, floored — the same rule
  // the Mana is priced by. A city that has never delved has no trickle at all,
  // so the floor is what pays it.
  it('floors Hero XP for a city that has never delved', () => {
    const state = freshGame();
    expect(heroXpPerHour(state)).toBe(0);
    const rung = DAILY.premiumXpHours.findIndex((h: number) => h > 0) + 1;
    expect(royalReward(state, rung).HeroXp).toBe(DAILY.premiumXpFloor);
  });

  it('pays NOTHING to a player who does not own the season', () => {
    const state = freshGame();
    expect(royalOwned(state, T0)).toBe(false);
    const before = getWallet(state.player.wallet, 'Gems');
    claimOn(state, T0);
    // Rung 1 pays Royal Gems and no free ones, so an unowned season must leave
    // the purse exactly where it was.
    expect(getWallet(state.player.wallet, 'Gems')).toBe(before);
    expect(getWallet(state.player.wallet, 'GoldKey')).toBe(0);
  });

  // Two taps, not one: the free cell takes the day, the Royal cell is its own
  // button (§3.2). Claiming the day must not quietly pay the paid track too.
  it('is a SEPARATE tap from the free cell of the same rung', () => {
    const state = payer();
    buyRoyalChest(state, T0);
    const before = getWallet(state.player.wallet, 'Gems');

    claimOn(state, T0);
    expect(getWallet(state.player.wallet, 'Gems'))
      .toBe(before + (freeReward(state, 1).Gems ?? 0));
    expect(royalPending(state, 1, T0)).toBe(true);

    expect(claimRoyalRung(state, 1, T0)).toBe('Claimed');
    expect(getWallet(state.player.wallet, 'Gems'))
      .toBe(before + (freeReward(state, 1).Gems ?? 0) + royalReward(state, 1).Gems!);
    expect(royalPending(state, 1, T0)).toBe(false);
  });

  it('refuses a cell that is unowned, unreached or already taken', () => {
    const free = freshGame();
    claimOn(free, T0);
    expect(claimRoyalRung(free, 1, T0)).toBe('NotOwned');

    const state = payer();
    buyRoyalChest(state, T0);
    claimOn(state, T0);
    // Rung 2 has not been climbed yet, so its cell is not on the table.
    expect(claimRoyalRung(state, 2, T0)).toBe('NotReached');
    expect(claimRoyalRung(state, 1, T0)).toBe('Claimed');
    expect(claimRoyalRung(state, 1, T0)).toBe('AlreadyClaimed');
  });

  // Nothing about the paid track is rationed by the day: the free cell is
  // one-a-day, the Royal cells are as many as are open.
  it('takes its cells in any order, as many in a day as are open', () => {
    const state = payer();
    for (let d = 0; d < 5; d++) claimOn(state, T0 + d * DAY);
    buyRoyalChest(state, T0 + 4 * DAY);
    const t = T0 + 4 * DAY;
    for (const rung of [4, 1, 5, 2, 3]) {
      expect(claimRoyalRung(state, rung, t)).toBe('Claimed');
    }
    expect(royalClaimedRungs(state, t)).toEqual([1, 2, 3, 4, 5]);
    expect(anyRoyalPending(state, t)).toBe(false);
  });
});

describe('buying the Royal chest', () => {
  it('spends the monthly budget and grants nothing on the spot', () => {
    const state = payer();
    const before = getWallet(state.player.wallet, 'Gems');
    expect(buyRoyalChest(state, T0)).toBe('Purchased');
    // What it hands over is a column of cells, not a payout.
    expect(getWallet(state.player.wallet, 'Gems')).toBe(before);
    expect(state.player.payer!.spentCentsThisMonth)
      .toBe(Math.round(STORE.RoyalChest.priceUsd * 100));
    expect(state.player.payer!.purchases.map((p) => p.sku)).toEqual(['RoyalChest']);
  });

  // The rule that removes every reason to buy EARLY. A deadline that also
  // punishes deliberating is the demand-shaped design this feature refuses.
  it('OPENS every rung already climbed this season', () => {
    const state = payer();
    for (let d = 0; d < 5; d++) claimOn(state, T0 + d * DAY);
    const t = T0 + 5 * DAY;
    expect(buyRoyalChest(state, t)).toBe('Purchased');

    for (const rung of [1, 2, 3, 4, 5]) expect(royalPending(state, rung, t)).toBe(true);
    // …and nothing beyond the ladder the player actually climbed.
    expect(royalPending(state, 6, t)).toBe(false);

    const before = getWallet(state.player.wallet, 'Gems');
    const owed = [1, 2, 3, 4, 5]
      .reduce((sum, rung) => sum + royalReward(state, rung).Gems!, 0);
    const keysOwed = [1, 2, 3, 4, 5]
      .reduce((sum, rung) => sum + (royalReward(state, rung).GoldKey ?? 0), 0);
    for (const rung of [1, 2, 3, 4, 5]) claimRoyalRung(state, rung, t);

    expect(getWallet(state.player.wallet, 'Gems')).toBe(before + owed);
    expect(getWallet(state.player.wallet, 'GoldKey')).toBe(keysOwed);
    // And the rung count is untouched: taking a Royal cell is not a day.
    expect(rungsClaimed(state, t)).toBe(5);
  });

  it('cannot be bought twice in one season', () => {
    const state = payer();
    expect(buyRoyalChest(state, T0)).toBe('Purchased');
    expect(buyRoyalChest(state, T0)).toBe('AlreadyOwned');
    expect(state.player.payer!.purchases).toHaveLength(1);
  });

  it('does not carry into the next season', () => {
    const state = payer();
    buyRoyalChest(state, T0);
    expect(royalOwned(state, T0)).toBe(true);
    expect(royalOwned(state, SEASON_END)).toBe(false);
  });

  it('is refused, and counted, when the budget cannot cover it', () => {
    const state = brokePayer();
    expect(buyRoyalChest(state, T0)).toBe('NoBudget');
    expect(royalOwned(state, T0)).toBe(false);
    expect(state.player.payer!.refusals).toBe(1);
  });

  // The sheet has to stay reachable after the last rung, because the purchase
  // is still on the table until the window closes.
  it('keeps the sheet open after the last rung, until every cell is taken', () => {
    const state = payer();
    for (let d = 0; d < LEN; d++) claimOn(state, T0 + d * DAY);
    const t = T0 + LEN * DAY;
    expect(chestAvailable(state, t)).toBe(false);
    // Unbought: open, because the chest is still on the table.
    expect(chestSheetOpen(state, t)).toBe(true);
    buyRoyalChest(state, t);
    // Bought: still open, because fourteen Royal cells are now waiting.
    expect(chestSheetOpen(state, t)).toBe(true);
    for (let rung = 1; rung <= LEN; rung++) claimRoyalRung(state, rung, t);
    expect(chestSheetOpen(state, t)).toBe(false);
  });
});

describe('persistence', () => {
  it('carries the season, the rung, the purchase and the taken cells', () => {
    const state = payer();
    claimOn(state, T0);
    claimOn(state, T0 + DAY);
    buyRoyalChest(state, T0 + DAY);
    claimRoyalRung(state, 2, T0 + DAY); // out of order, on purpose
    const back = deserialize(serialize(state, T0 + DAY), map, T0 + DAY)!;
    expect(rungsClaimed(back, T0 + DAY)).toBe(2);
    expect(back.kingdom.daily.lastClaimedDay).toBe(dayIndex(T0 + DAY));
    expect(royalOwned(back, T0 + DAY)).toBe(true);
    expect(royalClaimedRungs(back, T0 + DAY)).toEqual([2]);
    expect(royalPending(back, 1, T0 + DAY)).toBe(true);
    expect(royalPending(back, 2, T0 + DAY)).toBe(false);
  });

  // The cells belong to the season, so a stale one reads as none rather than
  // leaking a taken mark into the next window.
  it('forgets the taken cells when the season turns', () => {
    const state = payer();
    claimOn(state, T0);
    buyRoyalChest(state, T0);
    claimRoyalRung(state, 1, T0);
    expect(royalClaimedRungs(state, T0)).toEqual([1]);
    expect(royalClaimedRungs(state, SEASON_END)).toEqual([]);
  });

  it('starts a save with no Daily block at the bottom of the running season', () => {
    const state = freshGame();
    const file = serialize(state, T0);
    delete (file.Modules['kingdom.kingdoms'] as Record<string, unknown>).Daily;
    const back = deserialize(file, map, T0)!;
    expect(rungsClaimed(back, T0)).toBe(0);
    expect(back.kingdom.daily.lastClaimedDay).toBeNull();
    expect(chestAvailable(back, T0)).toBe(true);
  });

  // v35: `LadderStep` counted days played on a seven-rung cycle that never
  // ended, and `Rung` counts them inside a window — the two do not mean the
  // same thing, so the old block is dropped rather than reinterpreted.
  it('drops a pre-season ladder rather than reading it as a rung', () => {
    const state = freshGame();
    const file = serialize(state, T0);
    file.SaveVersion = 34;
    (file.Modules['kingdom.kingdoms'] as Record<string, unknown>).Daily = {
      LadderStep: 11, LastClaimedDay: dayIndex(T0),
    };
    expect(migrate(file)).toBe(true);
    const back = deserialize(file, map, T0)!;
    expect(rungsClaimed(back, T0)).toBe(0);
    expect(back.kingdom.daily.lastClaimedDay).toBeNull();
    expect(royalOwned(back, T0)).toBe(false);
  });
});
