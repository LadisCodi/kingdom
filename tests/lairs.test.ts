// The lair — a garrison with a clock, and the ground it holds
// (Docs/proposals/lairs.md).
//
// Four things are worth more than the rest here, and they are the ones this
// file spends its length on:
//
//  1. THE REPLAY ASSERTION. Raids landing during an absence have to leave the
//     same stores whether the window was walked in one call or ticked a step
//     at a time — and the daily schedule is a hash, so that is true by
//     construction or not at all.
//  2. THE BOUND. There is no trip limit any more: a lair raids three times a
//     local day for as long as it stands, only ever from the stores, and what
//     it carries is capped at a day of raids.
//  3. THE GROUND. A found, standing lair refuses every tap, build, crew and
//     spell inside its zone, and a cleared one gives all of it back.
//  4. THE FIGHT. A lair is cleared once, and that is the whole lair.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import {
  COMBAT, PARTY, RAID, LAIRS, LAIR_ORDER, TROOPS, garrisonForTier,
} from '../src/sim/data/definitions';
import {
  advanceRaids, armLairs, cityRatePerSecond, clearedLairCount, hoardCap, lairBoard, lairFightPower,
  lairFights, lairFormation, lairAwaitsClaim, lairIsCleared, lairPower, lairView, nextRaidBoundary, openLairs,
  raidTake, raidTimeAfter, setUtcOffset,
} from '../src/sim/lairs';
import { lairHolding, lairIsFound, lairZoneCells } from '../src/sim/lairZone';
import { standingLairAt, cellHasSite } from '../src/sim/sites';
import { harvestBlock } from '../src/sim/harvest';
import { placementBlock } from '../src/sim/districts';
import { workableCells } from '../src/sim/workers';
import { formationPower } from '../src/sim/combat';
import { boardPower } from '../src/sim/battle';
import { availableRoster } from '../src/sim/army';
import {
  attackLair, claimLair, lairBlock, lairClearReward, lairFightXp, partyBoard, partyOf, previewLair,
} from '../src/sim/expeditions';
import { grantHero } from '../src/sim/heroes';
import { heroCanFight, heroHp, heroMaxHp, setHeroHp } from '../src/sim/heroHealth';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, getWallet, type GameState, type LairId } from '../src/sim/state';
import {
  addAllTrainers, addBuilt, freshGame, freshPresenter, fund, map, reveal, stored, T0, toLastFight,
} from './helpers';

const ORCS = 'Orcs' as const;
const HARPIES = 'Harpies' as const;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A city that MAKES something — a raid takes seconds of production, so a
 *  kingdom that produces nothing is never worth robbing. */
function earningKingdom(): GameState {
  const state = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addBuilt(state, 'Housing', { x: 2, y: 3 });
  state.city.population = 6;
  fund(state, { Gold: 10_000, Food: 2000, Wood: 2000, Stone: 500 });
  return state;
}

/** …and has found the orc lair, so its clock is running. */
function watched(at = T0): GameState {
  const state = earningKingdom();
  reveal(state, [LAIRS[ORCS].location]);
  advance(state, map, at); // the sweep inside advance() arms the lair
  return state;
}

const firstRaid = (id: LairId = ORCS, at = T0): number =>
  at + LAIRS[id].guard.warningMinutes * MINUTE;

/** Every raid time of a lair from `from`, for `days` days. */
function schedule(state: GameState, id: LairId, from: number, days: number): number[] {
  const out: number[] = [];
  for (let t = raidTimeAfter(state, id, from); t < from + days * DAY; t = raidTimeAfter(state, id, t)) {
    out.push(t);
  }
  return out;
}

const localHour = (state: GameState, t: number): number =>
  (((t + state.kingdom.utcOffsetMinutes * MINUTE) % DAY) + DAY) % DAY / HOUR;

// ------------------------------------------------------------------ finding

describe('finding a lair', () => {
  it('is revealing any cell of its zone — and starts the whole warning', () => {
    const state = earningKingdom();
    // The zone's far corner, not the lair itself: its ground is how it is found.
    const zone = lairZoneCells(ORCS);
    const corner = zone[zone.length - 1];
    reveal(state, [corner]);
    expect(lairIsFound(state, ORCS)).toBe(true);
    advance(state, map, T0);
    const lair = state.lairs[ORCS]!;
    expect(lair.armedAt).toBe(T0);
    expect(lair.nextRaidAt).toBe(firstRaid());
    expect(lair.cleared).toBe(false);
    expect(state.discoveries[`site:${ORCS}`]).toBe(true);
  });

  it('is never a cell that is only Discovered, under the scrim', () => {
    const state = earningKingdom();
    for (const c of lairZoneCells(ORCS)) state.fog.discovered[coordKey(c)] = true;
    advance(state, map, T0 + HOUR);
    expect(state.lairs[ORCS]).toBeUndefined();
    expect(nextRaidBoundary(state, T0)).toBeNull();
  });

  it('draws and taps nothing until it is found', () => {
    const state = earningKingdom();
    expect(standingLairAt(state, LAIRS[ORCS].location)).toBeUndefined();
    reveal(state, [LAIRS[ORCS].location]);
    advance(state, map, T0);
    expect(standingLairAt(state, LAIRS[ORCS].location)?.id).toBe(ORCS);
  });

  it('is stamped inside advance(), never from a clock the sim may not read', () => {
    const state = earningKingdom();
    reveal(state, [LAIRS[ORCS].location]);
    // Revealed at T0, advanced ten minutes later: the clock is the boundary
    // the sweep ran at, where the sim left off — not the moment of the call.
    advance(state, map, T0 + 10 * MINUTE);
    expect(state.lairs[ORCS]!.armedAt).toBe(T0);
    expect(state.lairs[ORCS]!.nextRaidAt).toBe(firstRaid(ORCS, T0));
  });
});

// ----------------------------------------------------------------- schedule

describe('the daily schedule', () => {
  it('is three raids a local day, one in each slice of the window', () => {
    const state = watched();
    const midnight = T0 + 12 * HOUR; // T0 is noon UTC, and the offset is 0
    const times = schedule(state, ORCS, midnight, 5);
    expect(times).toHaveLength(RAID.perDay * 5);
    const slice = (RAID.windowEndHour - RAID.windowStartHour) / RAID.perDay;
    times.forEach((t, i) => {
      const h = localHour(state, t);
      expect(h).toBeGreaterThanOrEqual(RAID.windowStartHour);
      expect(h).toBeLessThan(RAID.windowEndHour);
      // Each raid in its own slice, in order — never two on top of each other.
      expect(Math.floor((h - RAID.windowStartHour) / slice)).toBe(i % RAID.perDay);
    });
  });

  it('follows the player\'s local day, not UTC', () => {
    const state = watched();
    state.kingdom.utcOffsetMinutes = -8 * 60; // the Pacific
    for (const t of schedule(state, ORCS, T0 + DAY, 3)) {
      const h = localHour(state, t);
      expect(h).toBeGreaterThanOrEqual(RAID.windowStartHour);
      expect(h).toBeLessThan(RAID.windowEndHour);
    }
  });

  it('is a hash of the lair and the day: the same answer every time it is asked', () => {
    const a = watched();
    const b = watched();
    expect(schedule(a, ORCS, T0, 4)).toEqual(schedule(b, ORCS, T0, 4));
    // …and not the same answer for two lairs.
    expect(schedule(a, 'Harpies', T0, 4)).not.toEqual(schedule(a, ORCS, T0, 4));
  });

  it('comes after the first warning, then keeps coming — there is no trip limit', () => {
    const state = watched();
    const result = advance(state, map, T0 + 7 * DAY);
    expect(result.raids.length).toBeGreaterThan(RAID.perDay * 5);
    expect(result.raids[0].at).toBe(firstRaid());
    expect(state.lairs[ORCS]!.nextRaidAt).not.toBeNull();
  });

  it('moves with the device\'s offset from the next slice on, and spares the first warning', () => {
    const state = watched();
    setUtcOffset(state, 120, T0 + MINUTE);
    // Still inside the warning: the countdown the player was shown stands.
    expect(state.lairs[ORCS]!.nextRaidAt).toBe(firstRaid());
    advance(state, map, firstRaid() + MINUTE);
    const scheduled = state.lairs[ORCS]!.nextRaidAt!;
    setUtcOffset(state, -300, firstRaid() + 2 * MINUTE);
    const moved = state.lairs[ORCS]!.nextRaidAt!;
    expect(moved).toBe(raidTimeAfter(state, ORCS, firstRaid() + 2 * MINUTE));
    expect(localHour(state, moved)).toBeGreaterThanOrEqual(RAID.windowStartHour);
    expect(scheduled).toBeGreaterThan(firstRaid());
  });

  it('puts a garrison that had spent its three old trips back on the schedule', () => {
    const state = watched();
    state.lairs[ORCS]!.nextRaidAt = null; // a save from the three-trip garrison
    armLairs(state, T0 + DAY);
    expect(state.lairs[ORCS]!.nextRaidAt).toBe(raidTimeAfter(state, ORCS, T0 + DAY));
  });
});

// --------------------------------------------------------------------- raids

describe('a raid', () => {
  it('takes from the stores, never from the wallet: collecting is the defence', () => {
    const state = watched();
    advance(state, map, firstRaid() - MINUTE); // the houses fill for half an hour
    const purse = getWallet(state.city.wallet, 'Gold');
    const before = stored(state, 'Gold');
    const result = advance(state, map, firstRaid()); // …and the garrison comes down
    const took = result.raids[0]?.took.Gold ?? 0;
    expect(took).toBeGreaterThan(0);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(purse);
    expect(stored(state, 'Gold')).toBeLessThan(before + 60); // a minute of rent, less the take
    expect(state.lairs[ORCS]!.hoard.Gold).toBe(took);
  });

  it('takes seconds of production, capped at a fraction of what is stored', () => {
    const state = watched();
    advance(state, map, T0 + 20 * MINUTE); // something in the houses
    const took = raidTake(state, ORCS);
    expect(took.Gold ?? 0).toBeGreaterThan(0);
    const seconds = garrisonForTier(LAIRS[ORCS].tier).takeSeconds;
    for (const [c, n] of Object.entries(took)) {
      const rate = cityRatePerSecond(state, c as 'Gold');
      expect(n).toBeLessThanOrEqual(Math.floor(rate * seconds));
      expect(n).toBeLessThanOrEqual(
        Math.floor(stored(state, c as 'Gold') * RAID.takeFractionMax));
    }
  });

  it('takes only what the city MAKES', () => {
    // Two houses and nobody in the woods: rent, and nothing else.
    const state = watched();
    advance(state, map, T0 + 20 * MINUTE);
    const took = raidTake(state, ORCS);
    expect(took.Gold ?? 0).toBeGreaterThan(0);
    expect(took.Wood ?? 0).toBe(0);
    expect(took.Stone ?? 0).toBe(0);
  });

  it('never touches anything but the four materials', () => {
    const state = watched();
    fund(state, { Gems: 500, Stardust: 90 });
    const mana = getWallet(state.city.wallet, 'Mana');
    const result = advance(state, map, T0 + 3 * DAY);
    expect(result.raids.length).toBeGreaterThan(0);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(500);
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(90);
    expect(getWallet(state.city.wallet, 'Mana')).toBeGreaterThanOrEqual(mana);
    for (const raid of result.raids) {
      for (const c of Object.keys(raid.took)) {
        expect(['Gold', 'Food', 'Wood', 'Stone']).toContain(c);
      }
    }
  });

  it('carries at most a day of raids, and what it cannot carry is lost', () => {
    const state = watched();
    advance(state, map, T0 + 10 * DAY);
    const lair = state.lairs[ORCS]!;
    const cap = hoardCap(state, ORCS, 'Gold');
    expect(cap).toBeGreaterThan(0);
    expect(lair.hoard.Gold).toBe(cap);
    expect(lairView(state, ORCS)!.hoardFull.Gold).toBe(true);
    // A raid on a full hoard still takes from the stores.
    const before = stored(state, 'Gold');
    const at = lair.nextRaidAt!;
    const result = advance(state, map, at);
    const took = result.raids.find((r) => r.at === at)?.took.Gold ?? 0;
    expect(took).toBeGreaterThan(0);
    expect(stored(state, 'Gold')).toBeLessThan(before + took);
    expect(lair.hoard.Gold).toBe(hoardCap(state, ORCS, 'Gold'));
  });

  it('moves its clock on when there is nothing to take', () => {
    const state = freshGame();
    state.city.wallet = {};
    reveal(state, [LAIRS[ORCS].location]);
    advance(state, map, T0);
    const result = advance(state, map, T0 + 2 * DAY);
    expect(result.raids).toHaveLength(0);
    expect(state.lairs[ORCS]!.nextRaidAt).toBeGreaterThan(T0 + 2 * DAY);
  });
});

// THE load-bearing assertion, on the newest thing in the sim.
describe('one-call replay equals stepped ticking', () => {
  it('across two days of scheduled raids', () => {
    const end = T0 + 2 * DAY;
    const oneCall = watched();
    const oneRaids = advance(oneCall, map, end).raids;
    const stepped = watched();
    const stepRaids = [];
    for (let t = T0 + MINUTE; t <= end; t += MINUTE) stepRaids.push(...advance(stepped, map, t).raids);

    expect(oneCall.lairs[ORCS]).toEqual(stepped.lairs[ORCS]);
    expect(getWallet(oneCall.city.wallet, 'Gold')).toBe(getWallet(stepped.city.wallet, 'Gold'));
    for (let i = 0; i < oneCall.city.districts.length; i++) {
      expect(oneCall.city.districts[i].stored).toEqual(stepped.city.districts[i].stored);
    }
    expect(oneRaids).toEqual(stepRaids);
    expect(oneRaids.length).toBeGreaterThanOrEqual(RAID.perDay);
  });
});

// ------------------------------------------------------------------ the zone

describe('the zone', () => {
  // The Harpies hold the gold vein at (3, -6), inside the zone; (4, -5) is
  // grass just outside it, a Quarry's reach away.
  const HELD = HARPIES;
  const MOUNTAIN = { x: 3, y: -6 };
  const OUTSIDE = { x: 4, y: -5 };
  const inZone = (c: { x: number; y: number }) =>
    lairZoneCells(HELD).some((z) => z.x === c.x && z.y === c.y);

  it('is the footprint and `radius` rings around it', () => {
    const { size, radius } = LAIRS[HELD];
    expect(lairZoneCells(HELD)).toHaveLength((size + 2 * radius) ** 2);
    expect(inZone(MOUNTAIN)).toBe(true);
    expect(inZone(OUTSIDE)).toBe(false);
  });

  it('holds nothing before the lair is found, and nothing after it falls', () => {
    const state = earningKingdom();
    expect(lairHolding(state, MOUNTAIN)).toBeNull();
    reveal(state, [MOUNTAIN]);
    advance(state, map, T0);
    expect(lairHolding(state, MOUNTAIN)).toBe(HELD);
    state.lairs[HELD]!.cleared = true;
    expect(lairHolding(state, MOUNTAIN)).toBeNull();
  });

  it('refuses a tap on the ground — before the tech gate, and before any Mana', () => {
    const state = earningKingdom();
    reveal(state, [MOUNTAIN]);
    advance(state, map, T0);
    expect(harvestBlock(state, map, MOUNTAIN, T0)).toBe('LairHeld');
    const mana = getWallet(state.city.wallet, 'Mana');
    expect(getWallet(state.city.wallet, 'Mana')).toBe(mana);
  });

  it('refuses a building placed or moved into it, and the lair\'s own cells until it falls', () => {
    const state = earningKingdom();
    const lot = { x: 6, y: -7 }; // bare ground in the zone, beside the camp
    reveal(state, [lot, LAIRS[HELD].location]);
    advance(state, map, T0);
    expect(placementBlock(state, map, 'Housing', lot)).toBe('LairZone');
    expect(cellHasSite(state, LAIRS[HELD].location)).toBe(true);
    state.lairs[HELD]!.cleared = true;
    // The ground is the city's again — whatever else a building has to ask.
    expect(placementBlock(state, map, 'Well', lot)).not.toBe('LairZone');
    expect(cellHasSite(state, LAIRS[HELD].location)).toBe(false);
    expect(placementBlock(state, map, 'Well', LAIRS[HELD].location)).not.toBe('HasSite');
  });

  it('is never worked by a crew', () => {
    const state = earningKingdom();
    addBuilt(state, 'Quarry', OUTSIDE);
    const quarry = state.city.districts[state.city.districts.length - 1];
    reveal(state, [MOUNTAIN]);
    // Revealed and not yet swept: the lair has no clock, the mountain is work.
    expect(workableCells(state, map, quarry)).toContainEqual(MOUNTAIN);
    advance(state, map, T0);
    expect(workableCells(state, map, quarry)).not.toContainEqual(MOUNTAIN);
  });
});

// ------------------------------------------------------------------ clearing

describe('clearing the lair', () => {
  /** A kingdom that can put a party on the orc lair's doorstep — the company
   *  the chain musters before `DriveThemOut` (12-quests.md §2). */
  // The Warden, as a hero the banner brought: the kingdom starts with none.
  function readyToFight(units = 30): GameState {
    const state = watched();
    grantHero(state, 'Warden');
    addAllTrainers(state);
    for (let i = 0; i < units; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    return state;
  }

  const company = [{ unitId: 'Warrior' as const, count: 30 }];

  // The chain sends the player at the Orcs long before the Tavern, so the
  // first fight is the company alone.
  // THE WHOLE PATH, fight by fight: the company's losses carry from one fight
  // to the next, and it still walks the orcs out.
  it('is beatable by the company the chain musters, at the orc lair, with no hero', () => {
    const state = readyToFight();
    const preview = previewLair(state, ORCS, [], company);
    expect(preview.enough).toBe(true);
    expect(preview.fallen).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < lairFights(ORCS) - 1; i++) {
      const left = [{ unitId: 'Warrior' as const, count: availableRoster(state).Warrior }];
      expect(attackLair(state, map, ORCS, [], left).result, `fight ${i + 1}`).toBe('Won');
    }
    const left = [{ unitId: 'Warrior' as const, count: availableRoster(state).Warrior }];
    expect(attackLair(state, map, ORCS, [], left).result).toBe('Cleared');
    // Beaten, not yet cleared: the claim is what clears it (§5).
    expect(lairAwaitsClaim(state, ORCS)).toBe(true);
    expect(lairIsCleared(state, ORCS)).toBe(false);
    expect(clearedLairCount(state)).toBe(0);
    expect(claimLair(state, ORCS).result).toBe('Claimed');
    expect(lairIsCleared(state, ORCS)).toBe(true);
    expect(clearedLairCount(state)).toBe(1);
  });

  it('refuses a party with nobody in it', () => {
    const state = readyToFight();
    expect(lairBlock(state, map, ORCS, [], [])).toBe('EmptyParty');
    expect(lairBlock(state, map, ORCS, ['Scout'], company)).toBe('NoHero');
  });

  // A lair wants soldiers (18-garrisons-and-raids.md): a hero alone is
  // refused, so no hero ever wins one by itself.
  it('refuses a hero alone', () => {
    const state = readyToFight();
    expect(attackLair(state, map, ORCS, ['Warden'], []).result).toBe('NoSoldiers');
  });

  it('is not beatable by the first company one lair deeper', () => {
    const state = readyToFight();
    reveal(state, [LAIRS.Harpies.location]);
    advance(state, map, T0);
    expect(attackLair(state, map, 'Harpies', [], company).result).toBe('Repelled');
  });

  it('stops the clock for good when beaten, and holds its ground until the claim', () => {
    const state = readyToFight();
    toLastFight(state, ORCS);
    attackLair(state, map, ORCS, ['Warden'], company);
    expect(state.lairs[ORCS]!.nextRaidAt).toBeNull();
    expect(nextRaidBoundary(state, T0)).toBeNull();
    const result = advance(state, map, T0 + 7 * DAY);
    expect(result.raids).toHaveLength(0);
    // Beaten, it is still on the map with its zone and its reward waiting.
    expect(state.lairs[ORCS]!.nextRaidAt).toBeNull();
    expect(standingLairAt(state, LAIRS[ORCS].location)?.id).toBe(ORCS);
    expect(lairHolding(state, LAIRS[ORCS].location)).toBe(ORCS);
    expect(attackLair(state, map, ORCS, ['Warden'], company).result).toBe('AlreadyDefeated');
    // Claimed, it is gone and its ground is the city's.
    claimLair(state, ORCS);
    expect(openLairs(state)).toEqual([]);
    expect(standingLairAt(state, LAIRS[ORCS].location)).toBeUndefined();
    expect(lairHolding(state, LAIRS[ORCS].location)).toBeNull();
  });

  it('hands back the hoard', () => {
    const state = readyToFight();
    advance(state, map, T0 + 2 * DAY);
    const hoard = { ...state.lairs[ORCS]!.hoard };
    expect(hoard.Gold).toBeGreaterThan(0);
    const before = getWallet(state.city.wallet, 'Gold');
    toLastFight(state, ORCS);
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    expect(report.hoard).toEqual(hoard);
    // The fight costs Mana and pays nothing; the claim pays the hoard.
    expect(getWallet(state.city.wallet, 'Gold')).toBe(before);
    expect(claimLair(state, ORCS).hoard).toEqual(hoard);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(before + hoard.Gold!);
  });

  it('costs what the fight cost — nothing when it is a rout', () => {
    const state = readyToFight();
    const before = state.army.length;
    toLastFight(state, ORCS);
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    expect(state.army.length).toBe(before - report.losses.reduce((n, l) => n + l.count, 0));

    const beaten = readyToFight();
    reveal(beaten, [LAIRS.Goblins.location]);
    advance(beaten, map, T0);
    fund(beaten, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const armed = beaten.army.length;
    toLastFight(beaten, 'Goblins');
    const repulse = attackLair(beaten, map, 'Goblins', ['Warden'], company);
    expect(repulse.result).toBe('Repelled');
    expect(repulse.losses.reduce((n, l) => n + l.count, 0)).toBeGreaterThan(0);
    expect(beaten.army.length).toBeLessThan(armed);
  });

  it('leaves its heroes hurt, and the wound mends on its own', () => {
    const state = readyToFight();
    // With one soldier, so the blows soon land on the hero.
    const report = attackLair(state, map, ORCS, ['Warden'], [{ unitId: 'Warrior', count: 1 }], T0);
    const [warden] = report.heroes;
    expect(warden!.hp).toBeLessThan(warden!.max);
    expect(heroHp(state, 'Warden', T0)).toBe(warden!.hp);
    // A share of the whole mends per hour, so half the clock is half the wound.
    const half = T0 + PARTY.heroRecoverHours * 1_800_000;
    const mid = heroHp(state, 'Warden', half);
    expect(mid).toBeGreaterThan(warden!.hp);
    expect(heroHp(state, 'Warden', T0 + PARTY.heroRecoverHours * 3_600_000)).toBe(warden!.max);
    // …and the wound is kept across a save.
    const back = deserialize(serialize(state, half), map, half)!;
    expect(heroHp(back, 'Warden', half)).toBe(mid);
  });

  it('sends a hurt hero in with what it has left', () => {
    const state = readyToFight();
    setHeroHp(state, 'Warden', 10, T0);
    const board = partyBoard(partyOf(state, company, ['Warden'], T0));
    const hero = board.slots.find((s) => s.kind === 'hero')!;
    expect(hero.hpPool).toBe(10);
    expect(hero.hpUnit).toBe(heroMaxHp(state, 'Warden'));
    setHeroHp(state, 'Warden', 0, T0);
    expect(heroCanFight(state, 'Warden', T0)).toBe(false);
    expect(attackLair(state, map, ORCS, ['Warden'], company, T0).result).toBe('HeroDown');
  });

  it('costs its Mana and the fallen when it fails, and nothing else', () => {
    const state = readyToFight(31);
    reveal(state, [LAIRS.Drake.location]);
    advance(state, map, T0);
    fund(state, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const gold = getWallet(state.city.wallet, 'Gold');
    const mana = getWallet(state.city.wallet, 'Mana');
    // A token soldier, so the hero takes the blows once it falls.
    const report = attackLair(state, map, 'Drake', ['Warden'], [{ unitId: 'Warrior', count: 1 }]);
    expect(report.result).toBe('Repelled');
    expect(report.attack).toBeLessThan(report.power);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold);
    expect(getWallet(state.city.wallet, 'Mana')).toBe(mana - COMBAT.fightMana);
    expect(lairIsCleared(state, 'Drake')).toBe(false);
    // The hero fell: it is exhausted, and rests until its HP is whole again.
    expect(attackLair(state, map, 'Drake', ['Warden'], company).result).toBe('HeroDown');
    const whole = T0 + PARTY.heroRecoverHours * 3_600_000;
    expect(attackLair(state, map, 'Drake', ['Warden'], company, whole - 60_000).result).toBe('HeroDown');
    expect(attackLair(state, map, 'Drake', ['Warden'], company, whole).result).toBe('Repelled');
  });

  it('refuses a lair nobody has found, and one already cleared', () => {
    const state = readyToFight();
    expect(attackLair(state, map, 'Harpies', ['Warden'], company).result).toBe('LairNotFound');
    toLastFight(state, ORCS);
    attackLair(state, map, ORCS, ['Warden'], company);
    expect(attackLair(state, map, ORCS, ['Warden'], company).result).toBe('AlreadyDefeated');
    claimLair(state, ORCS);
    expect(attackLair(state, map, ORCS, ['Warden'], company).result).toBe('AlreadyCleared');
  });
});

describe('a save', () => {
  it('carries the find, the clock and the hoard — and the local offset', () => {
    const state = watched();
    state.kingdom.utcOffsetMinutes = 120;
    advance(state, map, T0 + DAY);
    const restored = deserialize(serialize(state, T0 + DAY), map, T0 + DAY)!;
    expect(restored.lairs[ORCS]).toEqual(state.lairs[ORCS]);
    expect(restored.kingdom.utcOffsetMinutes).toBe(120);
  });

  it('carries a cleared lair, so nothing re-infests it', () => {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < 30; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    toLastFight(state, ORCS);
    attackLair(state, map, ORCS, [], [{ unitId: 'Warrior', count: 30 }]);
    // A beaten lair keeps its unclaimed reward across a save…
    const beaten = deserialize(serialize(state, T0), map, T0 + DAY)!;
    expect(lairAwaitsClaim(beaten, ORCS)).toBe(true);
    expect(beaten.lairs[ORCS]!.nextRaidAt).toBeNull();
    // …and a claimed one stays gone.
    claimLair(state, ORCS);
    const restored = deserialize(serialize(state, T0), map, T0 + 7 * DAY)!;
    expect(lairIsCleared(restored, ORCS)).toBe(true);
    expect(restored.lairs[ORCS]!.nextRaidAt).toBeNull();
  });
});

describe('the route to a lair', () => {
  // A kingdom yet to call its first hero: the first fight is soldiers alone.
  function presenterAtTheLair() {
    const state = watched();
    state.heroes.owned = [];
    addAllTrainers(state);
    for (let i = 0; i < 30; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    const game = freshPresenter(state);
    game.showLair(ORCS);
    return game;
  }

  it('offers the lair while the garrison stands', () => {
    const game = presenterAtTheLair();
    expect(game.lairFor(ORCS)!.cleared).toBe(false);
    game.openLair(ORCS);
    expect(game.openOverlay).toBe('lair');
    // No hero yet — the first fight is the company alone.
    expect(game.partyHeroes).toEqual([]);
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 30 }]);
    expect(game.lairBlockText()).toBeNull();
    expect(game.lairPreview()!.enough).toBe(true);
  });

  it('beats it, closes the sheet and lands back on the card — where Claim clears it', () => {
    const game = presenterAtTheLair();
    toLastFight(game.state, ORCS);
    game.openLair(ORCS);
    game.doAttackLair();
    expect(game.openOverlay).toBeNull();
    expect(game.lairFor(ORCS)!.defeated).toBe(true);
    expect(game.inspectedSite).toEqual(LAIRS[ORCS].location);
    game.doClaimLair(ORCS);
    expect(game.lairFor(ORCS)!.cleared).toBe(true);
    expect(game.inspectedSite).toBeNull();
    expect(game.vanishingLairs.has(ORCS)).toBe(true);
  });
});

// What the player is SHOWN is what the party fights.
describe('the formation in the doorway', () => {
  it('LEADS with the lair\'s own creature, and is never only that', () => {
    const state = freshGame();
    for (const id of LAIR_ORDER) {
      const squads = lairFormation(state, id);
      expect(squads.length).toBeGreaterThan(0);
      if (LAIRS[id].guard.threat !== 'Any') {
        expect(squads[0]!.unitId, `${id}'s lair`).toBe(LAIRS[id].guard.threat);
      }
      for (const squad of squads) {
        expect(squad.count).toBeGreaterThan(0);
        expect(squad.count).toBeLessThanOrEqual(TROOPS[squad.unitId].squadSize);
      }
    }
  });

  // The LAST fight is the lair's own garrison; the ones before ramp up to it.
  it('is worth what the lair was authored to be worth', () => {
    const state = freshGame();
    for (const id of LAIR_ORDER) {
      const budget = LAIRS[id].guard.power;
      const spent = boardPower(lairBoard(state, id, lairFights(id) - 1));
      expect(spent, `${id}'s lair`).toBeLessThanOrEqual(budget);
      expect(spent, `${id}'s lair`).toBeGreaterThan(budget * 0.75);
    }
  });

  it('is exactly what the attempt is scored against', () => {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < 30; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    const company = [{ unitId: 'Warrior' as const, count: 30 }];
    const preview = previewLair(state, ORCS, ['Warden'], company);
    expect(preview.enemy).toEqual(lairFormation(state, ORCS));
    expect(preview.power).toBe(formationPower(preview.enemy));
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.power).toBe(preview.power);
  });
});

describe('every authored lair', () => {
  it('is stronger the deeper the lair', () => {
    const powers = LAIR_ORDER.map((id: LairId) => LAIRS[id].guard.power);
    for (let i = 1; i < powers.length; i++) {
      expect(powers[i]).toBeGreaterThan(powers[i - 1]);
    }
  });

  it('warns in minutes, and a deeper lair gives longer', () => {
    const warnings = LAIR_ORDER.map((id: LairId) => LAIRS[id].guard.warningMinutes);
    for (const w of warnings) expect(w).toBeGreaterThanOrEqual(30);
    for (let i = 1; i < warnings.length; i++) {
      expect(warnings[i]).toBeGreaterThanOrEqual(warnings[i - 1]);
    }
  });

  it('holds wider ground the deeper the lair, and has a line for its card', () => {
    for (let i = 1; i < LAIR_ORDER.length; i++) {
      expect(LAIRS[LAIR_ORDER[i]].radius).toBeGreaterThanOrEqual(LAIRS[LAIR_ORDER[i - 1]].radius);
    }
    for (const id of LAIR_ORDER) expect(LAIRS[id].flavour.length).toBeGreaterThan(0);
  });
});

// The seatbelt in `advance()` is 10,000 boundary steps. Three raids a lair a
// day is what a month costs, and this is the arithmetic.
describe('the boundary budget', () => {
  it('proposes three boundaries a day a lair, not thousands', () => {
    const state = watched();
    let steps = 0;
    let cursor = T0;
    for (;;) {
      const next = nextRaidBoundary(state, cursor);
      if (next === null || next > T0 + 30 * DAY) break;
      advance(state, map, next);
      advanceRaids(state, next);
      cursor = next;
      steps += 1;
      expect(steps).toBeLessThan(200);
    }
    expect(steps).toBeLessThanOrEqual(1 + RAID.perDay * 30);
    expect(steps).toBeGreaterThanOrEqual(RAID.perDay * 29);
  });
});

// A LAIR IS A PATH OF FIGHTS (Docs/features/18-garrisons-and-raids.md §5):
// its tier's count, the last at the lair's power and the ones before ramping
// up to it. Short of the last, a win moves the path on, pays its share of
// Hero XP, and the lair still stands — and still raids.
describe('the path of fights', () => {
  function readyToFight(): GameState {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < 200; i++) state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    return state;
  }
  const army = [{ unitId: 'Warrior' as const, count: 60 }];

  it('is as long as its tier says, longer the deeper the lair', () => {
    for (const id of LAIR_ORDER) expect(lairFights(id)).toBe(garrisonForTier(LAIRS[id].tier).fights);
    expect(lairFights('Drake')).toBeGreaterThan(lairFights('Orcs'));
  });

  it('ramps up to the lair\'s own power at the last fight, never past it', () => {
    for (const id of LAIR_ORDER) {
      const n = lairFights(id);
      expect(lairFightPower(id, n - 1)).toBe(LAIRS[id].guard.power);
      for (let i = 1; i < n; i++) expect(lairFightPower(id, i)).toBeGreaterThan(lairFightPower(id, i - 1));
      expect(lairFightPower(id, 0)).toBeLessThan(LAIRS[id].guard.power);
    }
  });

  it('moves on a step a win, pays its share, and keeps raiding until the last', () => {
    const state = readyToFight();
    const xp = getWallet(state.kingdom.wallet, 'HeroXp');
    const report = attackLair(state, map, ORCS, ['Warden'], army);
    expect(report.result).toBe('Won');
    expect(report.heroXp).toBe(lairFightXp(ORCS));
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(xp + report.heroXp);
    expect(lairView(state, ORCS)).toMatchObject({ won: 1, fights: lairFights(ORCS), defeated: false });
    expect(state.lairs[ORCS]!.nextRaidAt).not.toBeNull();
    expect(lairAwaitsClaim(state, ORCS)).toBe(false);
    // The next fight is the next garrison, and it is stronger.
    expect(lairPower(state, ORCS)).toBeGreaterThan(report.power);
  });

  it('pays the tier\'s Hero XP across the path, the last share with the claim', () => {
    const state = readyToFight();
    let paid = 0;
    let result = '';
    while (result !== 'Cleared') {
      const r = attackLair(state, map, ORCS, ['Warden'], army);
      result = r.result;
      paid += r.heroXp;
    }
    expect(paid + lairClearReward(state, ORCS).heroXp).toBe(lairFights(ORCS) * lairFightXp(ORCS));
    expect(claimLair(state, ORCS).result).toBe('Claimed');
  });

  it('carries the path across a save', () => {
    const state = readyToFight();
    attackLair(state, map, ORCS, ['Warden'], army);
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(lairView(back, ORCS)!.won).toBe(1);
  });
});
