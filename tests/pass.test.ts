// The season pass: the ladder, the two columns, and what a mission pays.
//
// `daily.test.ts` is the sibling. What is tested here is what DIFFERS from the
// chest: the ladder advances on XP rather than on days played, the board is
// wiped with the season while the chest's rungs are not, and the paid column
// is bought against the collection's twenty-eight-day clock rather than the
// chest's twenty-day one.

import { describe, expect, it } from 'vitest';
import { MISSIONS, PASS } from '../src/sim/data/definitions';
import { seasonAt, seasonEndsAt } from '../src/sim/collection';
import { recordEvent } from '../src/sim/events';
import {
  anyCellPending, boardMissions, buyPass, cellPending, claimCell, claimMission,
  finishMissionWithGems, freeCell, ladderLength, levelCost, levelForXp,
  levelProgress, missionGemCost, paidCell, passEndsAt, passLevel, passOwned,
  passXp, rollMissionsIfDue,
} from '../src/sim/pass';
import { missionComplete, windowIndex } from '../src/sim/missions';
import { choosePayerProfile } from '../src/sim/store';
import { advance } from '../src/sim/commands';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type GameState } from '../src/sim/state';
import { grantPack } from '../src/sim/collection';
import {
  addAllTrainers, addBuilt, freshGame, freshPresenter, fund, map, T0,
} from './helpers';

const WINDOW = MISSIONS.windowHours * 3_600_000;

function kingdom(): GameState {
  const state = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addAllTrainers(state);
  fund(state, { Gold: 100_000, Food: 100_000, Wood: 100_000, Stone: 100_000 });
  return state;
}

/** Bank XP the way the game does — by finishing missions. */
function earn(state: GameState, xp: number, now = T0): void {
  state.kingdom.pass.season = seasonAt(now);
  state.kingdom.pass.xp += xp;
}

describe('the ladder', () => {
  it('is as long as the columns are', () => {
    expect(ladderLength()).toBe(PASS.freePacks.length);
    expect(ladderLength()).toBe(PASS.paidPacks.length);
    expect(PASS.freeGems.length).toBe(ladderLength());
    expect(PASS.paidGems.length).toBe(ladderLength());
  });

  it('costs more the higher it goes, and never less', () => {
    for (let l = 2; l <= ladderLength(); l++) {
      expect(levelCost(l)).toBeGreaterThanOrEqual(levelCost(l - 1));
    }
  });

  it('turns XP into levels, and stops at the top', () => {
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(levelCost(1))).toBe(1);
    expect(levelForXp(levelCost(1) - 1)).toBe(0);
    let all = 0;
    for (let l = 1; l <= ladderLength(); l++) all += levelCost(l);
    expect(levelForXp(all)).toBe(ladderLength());
    expect(levelForXp(all * 10)).toBe(ladderLength());
  });

  it('reports the bar the player is filling', () => {
    const { into, need } = levelProgress(levelCost(1) + 10);
    expect(into).toBe(10);
    expect(need).toBe(levelCost(2));
  });
});

describe('the season is the collection s', () => {
  it('ends when the collection s season does, never on a clock of its own', () => {
    expect(passEndsAt(T0)).toBe(seasonEndsAt(seasonAt(T0)));
  });

  it('reads a stale season as an empty pass, without writing anything', () => {
    const state = kingdom();
    earn(state, 5000);
    expect(passLevel(state, T0)).toBeGreaterThan(0);
    const later = seasonEndsAt(seasonAt(T0)) + 1;
    expect(passXp(state, later)).toBe(0);
    expect(passLevel(state, later)).toBe(0);
    // The READ wrote nothing — the stored block is untouched.
    expect(state.kingdom.pass.xp).toBeGreaterThan(0);
    expect(state.kingdom.pass.season).toBe(seasonAt(T0));
  });

  it('wipes the board when the season turns', () => {
    const state = kingdom();
    rollMissionsIfDue(state, T0);
    expect(boardMissions(state, T0).length).toBe(MISSIONS.perWindow);
    const later = seasonEndsAt(seasonAt(T0)) + WINDOW;
    rollMissionsIfDue(state, later);
    // A fresh board, not last season's plus two: the targets were rolled
    // against a city that no longer exists.
    expect(boardMissions(state, later).length).toBe(MISSIONS.perWindow);
  });
});

describe('the cells', () => {
  it('opens one per level reached, and not one above', () => {
    const state = kingdom();
    earn(state, levelCost(1) + levelCost(2));
    expect(passLevel(state, T0)).toBe(2);
    expect(cellPending(state, 1, 'free', T0)).toBe(true);
    expect(cellPending(state, 2, 'free', T0)).toBe(true);
    expect(cellPending(state, 3, 'free', T0)).toBe(false);
  });

  it('keeps the paid column shut until it is bought', () => {
    const state = kingdom();
    earn(state, levelCost(1));
    expect(cellPending(state, 1, 'paid', T0)).toBe(false);
    expect(claimCell(state, 1, 'paid', T0)).toBe('NotOwned');
  });

  it('opens every level already reached the moment it is bought', () => {
    const state = kingdom();
    choosePayerProfile(state, 'Whale', T0);
    let xp = 0;
    for (let l = 1; l <= 5; l++) xp += levelCost(l);
    earn(state, xp);
    expect(buyPass(state, T0)).toBe('Purchased');
    expect(passOwned(state, T0)).toBe(true);
    for (let l = 1; l <= 5; l++) expect(cellPending(state, l, 'paid', T0)).toBe(true);
    // And it granted nothing on the spot: what it handed over is five cells.
    expect(state.kingdom.pass.claimedPaid).toEqual([]);
  });

  it('is bought once a season, and once only', () => {
    const state = kingdom();
    choosePayerProfile(state, 'Whale', T0);
    expect(buyPass(state, T0)).toBe('Purchased');
    expect(buyPass(state, T0)).toBe('AlreadyOwned');
    // Next season it is on the table again.
    const later = seasonEndsAt(seasonAt(T0)) + 1;
    expect(passOwned(state, later)).toBe(false);
  });

  it('pays a cell once, and refuses the second tap', () => {
    const state = kingdom();
    earn(state, levelCost(1));
    const gems = getWallet(state.player.wallet, 'Gems');
    const dust = getWallet(state.kingdom.wallet, 'Stardust');
    const packs = state.collection.packs.length;
    expect(claimCell(state, 1, 'free', T0)).toBe('Claimed');
    expect(claimCell(state, 1, 'free', T0)).toBe('AlreadyClaimed');
    const cell = freeCell(1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + (cell.wallet.Gems ?? 0));
    expect(getWallet(state.kingdom.wallet, 'Stardust'))
      .toBe(dust + (cell.wallet.Stardust ?? 0));
    expect(state.collection.packs.length).toBe(packs + (cell.pack === null ? 0 : 1));
  });

  it('refuses a level not reached', () => {
    const state = kingdom();
    expect(claimCell(state, 1, 'free', T0)).toBe('NotReached');
  });

  it('knows when something is waiting', () => {
    const state = kingdom();
    expect(anyCellPending(state, T0)).toBe(false);
    earn(state, levelCost(1));
    expect(anyCellPending(state, T0)).toBe(true);
    claimCell(state, 1, 'free', T0);
    expect(anyCellPending(state, T0)).toBe(false);
  });

  it('leaves no rung empty on either column', () => {
    // An empty cell on a ladder reads as a bug, and a free track with holes
    // in it is a worse advert for the paid one than a thin free track is.
    for (let l = 1; l <= ladderLength(); l++) {
      for (const cell of [freeCell(l), paidCell(l)]) {
        expect(cell.pack !== null || Object.keys(cell.wallet).length > 0).toBe(true);
      }
    }
  });

  it('pays the free track all the way to the grand prize', () => {
    // 13-events.md §2.4 binds: the free column reaches the top rung.
    const top = freeCell(ladderLength());
    expect(top.pack !== null || Object.keys(top.wallet).length > 0).toBe(true);
    // And the two columns never pay the same pack at the same rung.
    for (let l = 1; l <= ladderLength(); l++) {
      const f = freeCell(l); const p = paidCell(l);
      if (f.pack !== null && p.pack !== null) expect(f.pack).not.toBe(p.pack);
    }
  });
});

describe('a mission pays twice', () => {
  const complete = (state: GameState) => {
    rollMissionsIfDue(state, T0);
    const m = boardMissions(state, T0)[0];
    state.tallies[m.meter] = m.base + m.target;
    return m;
  };

  it('a currency into the purse and XP onto the ladder', () => {
    const state = kingdom();
    const m = complete(state);
    expect(missionComplete(state, m)).toBe(true);
    const gold = getWallet(state.city.wallet, 'Gold');
    const gems = getWallet(state.player.wallet, 'Gems');
    expect(claimMission(state, m.uniqueId, T0)).toBe('Claimed');
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThan(gold);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + MISSIONS.rewardGems);
    expect(passXp(state, T0)).toBe(PASS.missionXp);
  });

  it('leaves the board when it is claimed, which is what frees a slot', () => {
    const state = kingdom();
    const m = complete(state);
    const before = boardMissions(state, T0).length;
    claimMission(state, m.uniqueId, T0);
    expect(boardMissions(state, T0).length).toBe(before - 1);
    expect(claimMission(state, m.uniqueId, T0)).toBe('NotFound');
  });

  it('refuses one that is not finished', () => {
    const state = kingdom();
    rollMissionsIfDue(state, T0);
    const m = boardMissions(state, T0)[0];
    expect(claimMission(state, m.uniqueId, T0)).toBe('NotComplete');
  });
});

describe('the Gem shortcut', () => {
  it('costs less the closer the mission is to done', () => {
    const state = kingdom();
    rollMissionsIfDue(state, T0);
    const m = boardMissions(state, T0)[0];
    const cold = missionGemCost(state, m);
    state.tallies[m.meter] = m.base + Math.floor(m.target * 0.9);
    expect(missionGemCost(state, m)).toBeLessThanOrEqual(cold);
    expect(missionGemCost(state, m)).toBeGreaterThanOrEqual(MISSIONS.gemFloor);
  });

  it('pays what the mission would have, and unclogs the board', () => {
    const state = kingdom();
    rollMissionsIfDue(state, T0);
    const m = boardMissions(state, T0)[0];
    const cost = missionGemCost(state, m);
    state.player.wallet.Gems = cost + 10;
    expect(finishMissionWithGems(state, m.uniqueId, T0)).toBe('Finished');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(10 + MISSIONS.rewardGems);
    expect(passXp(state, T0)).toBe(PASS.missionXp);
    expect(boardMissions(state, T0).find((x) => x.uniqueId === m.uniqueId)).toBeUndefined();
  });

  it('refuses a purse that cannot cover it, and one already finished', () => {
    const state = kingdom();
    rollMissionsIfDue(state, T0);
    const m = boardMissions(state, T0)[0];
    state.player.wallet.Gems = 0;
    expect(finishMissionWithGems(state, m.uniqueId, T0)).toBe('NotEnoughGems');
    state.tallies[m.meter] = m.base + m.target;
    state.player.wallet.Gems = 100_000;
    expect(finishMissionWithGems(state, m.uniqueId, T0)).toBe('AlreadyComplete');
  });
});

describe('it is not a boundary source', () => {
  it('issues nothing across thirty days in one advance', () => {
    // Ninety eight-hour windows pass inside one call. If the pass registered
    // a boundary they would all fire; nothing in the sim reads the board, so
    // none of them exists. `MAX_BOUNDARY_STEPS` is 10,000 and this is the
    // shape of thing that eats it (sim/adOffers.ts).
    const state = kingdom();
    rollMissionsIfDue(state, T0);
    const issued = state.kingdom.pass.live.length;
    expect(issued).toBe(MISSIONS.perWindow);
    advance(state, map, T0 + 30 * 86_400_000);
    expect(state.kingdom.pass.live.length).toBe(issued);
    expect(state.kingdom.pass.lastWindow).toBe(windowIndex(T0));
  });
});

describe('a pack opens itself', () => {
  /**
   * A presenter on a kingdom standing at `level`.
   *
   * The XP is stamped against the PRESENTER's own clock, not `T0`: a presenter
   * reads `Date.now()`, and a pass stamped with a season that is not the
   * running one reads as empty — correctly, which is what every other test
   * here relies on.
   */
  const presenterAt = (level: number) => {
    const game = freshPresenter(kingdom());
    let xp = 0;
    for (let l = 1; l <= level; l++) xp += levelCost(l);
    game.state.kingdom.pass.season = seasonAt(game.now());
    game.state.kingdom.pass.xp = xp;
    return game;
  };

  it('turns over a pack the player watched land', () => {
    // The first rung that pays a pack, so the claim is the only thing that
    // could have put one in the queue.
    const level = PASS.freePacks.findIndex((p) => p !== '') + 1;
    const game = presenterAt(level);
    expect(game.state.collection.packs).toEqual([]);
    expect(game.gachaReveal).toBeNull();

    game.doClaimPassCell(level, 'free');

    // It did NOT go into the queue to be fetched from a screen two taps away.
    expect(game.gachaReveal).not.toBeNull();
    expect(game.gachaReveal!.caption).toContain('pack');
    expect(game.gachaReveal!.prizes.length).toBeGreaterThan(0);
    expect(game.state.collection.packs).toEqual([]);
  });

  it('deals them one at a time, and only into a free screen', () => {
    const level = 10;
    const game = presenterAt(level);
    let owed = 0;
    for (let l = 1; l <= level; l++) {
      if (freeCell(l).pack !== null) owed += 1;
      game.doClaimPassCell(l, 'free');
    }
    expect(owed).toBeGreaterThan(1);
    // One on screen; the rest are WAITING, not lost and not all dealt at once.
    expect(game.gachaReveal).not.toBeNull();
    let seen = 1;
    while (game.gachaReveal !== null && seen < owed + 2) {
      game.dismissGachaReveal();
      if (game.gachaReveal !== null) seen += 1;
    }
    expect(seen).toBe(owed);
    expect(game.state.collection.packs).toEqual([]);
  });

  it('does not owe an opening for a pack that arrived while nobody looked', () => {
    // The presenter is seeded from the state it is GIVEN, which is what draws
    // the offline line: a pack already in the queue at load is not news.
    const state = kingdom();
    grantPack(state, 'Green', 'dev');
    const game = freshPresenter(state);
    game.notify();
    expect(game.gachaReveal).toBeNull();
    expect(game.state.collection.packs).toHaveLength(1);
    // And the button in the Collection still turns it over.
    game.doOpenPack();
    expect(game.gachaReveal).not.toBeNull();
    expect(game.state.collection.packs).toEqual([]);
  });

  it('never opens two into the same screen', () => {
    const state = kingdom();
    grantPack(state, 'Green', 'dev');
    grantPack(state, 'Green', 'dev');
    const game = freshPresenter(state);
    game.doOpenPack();
    const first = game.gachaReveal;
    game.doOpenPack();
    expect(game.gachaReveal).toBe(first);
    expect(game.state.collection.packs).toHaveLength(1);
  });
});

describe('the save', () => {
  it('carries the board, the bases and the odometer', () => {
    const state = kingdom();
    choosePayerProfile(state, 'Whale', T0);
    rollMissionsIfDue(state, T0);
    earn(state, levelCost(1));
    buyPass(state, T0);
    claimCell(state, 1, 'free', T0);
    recordEvent(state, { kind: 'packOpened' });

    const loaded = deserialize(serialize(state, T0), map, T0)!;
    expect(loaded.tallies).toEqual(state.tallies);
    expect(loaded.kingdom.pass.xp).toBe(state.kingdom.pass.xp);
    expect(loaded.kingdom.pass.claimedFree).toEqual([1]);
    expect(loaded.kingdom.pass.paidSeason).toBe(seasonAt(T0));
    expect(loaded.kingdom.pass.live.map((m) => [m.kind, m.meter, m.base, m.target]))
      .toEqual(state.kingdom.pass.live.map((m) => [m.kind, m.meter, m.base, m.target]));
    // `replaying` is transient and must never come back set, or the odometer
    // would be frozen for the rest of the session.
    expect(loaded.replaying).toBe(false);
  });
});
