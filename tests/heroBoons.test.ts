// The legendary boon (Docs/proposals/legendary-boons.md).
//
// One KINGDOM passive per Legendary, on while the hero is owned, in the same
// modifier stack a relic uses. Three rules do all the work here and every one
// of them is a test below:
//
//  1. ONLY A LEGENDARY HAS ONE. The moment every rarity does, the boon is a
//     hero property and the Legendary is a bigger number again.
//  2. IT POINTS UP, ALWAYS. A boon is a multiplier above 1 — a flat bonus is
//     worth less every hour the kingdom grows, and a falling number has a
//     floor, which is a ceiling on a passive that never ends.
//  3. IT IS COLLECTED WHERE IT IS DECLARED. A stat nothing reads is a bonus
//     nobody collects, so every boon's stat is resolved at a live call site —
//     with one named exception the world map has not built yet.
import { describe, expect, it } from 'vitest';
import { HEROES, HERO_ORDER, SAVE_VERSION } from '../src/sim/data/definitions';
import {
  activeBoons, boonText, grantHero, syncHeroBoons,
} from '../src/sim/heroes';
import { resolve } from '../src/sim/modifiers';
import { effectiveBuildTimeMultiplier, effectiveResearchTimeMultiplier } from '../src/sim/upgrades';
import { manaProduction } from '../src/sim/mana';
import { drillOf } from '../src/sim/expeditions';
import { buildBoard } from '../src/sim/battle';
import { deserialize, serialize } from '../src/sim/save';
import { freshGame, map, T0 } from './helpers';
import type { GameState, HeroId } from '../src/sim/state';

const LEGENDARIES = HERO_ORDER.filter((id) => HEROES[id].rarity === 'Legendary');

/** Own a hero outright, boons rebuilt. */
const own = (state: GameState, id: HeroId): void => { grantHero(state, id); };

describe('who has a boon', () => {
  it('is every Legendary and nobody else', () => {
    for (const id of HERO_ORDER) {
      const has = HEROES[id].boon !== null;
      expect(has).toBe(HEROES[id].rarity === 'Legendary');
    }
    expect(LEGENDARIES.length).toBeGreaterThan(0);
  });

  it('gives each of them a different number to move', () => {
    const stats = LEGENDARIES.map((id) => HEROES[id].boon!.stat);
    expect(new Set(stats).size).toBe(stats.length);
  });

  // The relics own those five, and a Legendary that moved one would be a
  // relic the player pulled instead of collected.
  it('never moves a stat a relic already moves', () => {
    const relicStats = new Set(['cellRecovery', 'cellRespawn', 'workerYield', 'taxRate',
      'stardustYield']);
    for (const id of LEGENDARIES) expect(relicStats.has(HEROES[id].boon!.stat)).toBe(false);
  });
});

describe('a boon points up', () => {
  it('is a multiplier above 1, on every one of them', () => {
    for (const id of LEGENDARIES) expect(HEROES[id].boon!.value).toBeGreaterThan(1);
  });

  // The rule the whole shape exists for. A discount dies at 100%; a multiplier
  // only ever approaches its limit, so a boon is worth having for ever.
  it('never reaches the wait it is shortening', () => {
    const state = freshGame();
    const base = effectiveBuildTimeMultiplier(state);
    let last = base;
    for (const speed of [1.2, 2, 5, 50, 5000]) {
      state.modifiers = [{
        id: 'test:speed', source: 'hero', stat: 'buildSpeed', scope: null,
        op: 'mul', value: speed, expiresAt: null,
      }];
      const now = effectiveBuildTimeMultiplier(state);
      expect(now).toBeLessThan(last);
      expect(now).toBeGreaterThan(0);
      last = now;
    }
  });

  it('says what it is worth as a percent', () => {
    for (const id of LEGENDARIES) {
      const text = boonText(HEROES[id].boon!);
      expect(text, `${id} has a boon nobody can read`).not.toBeNull();
      expect(text).toMatch(/\d+%/);
    }
  });
});

describe('a boon is on while the hero is owned', () => {
  it('arrives with the hero and not before', () => {
    const state = freshGame();
    expect(state.modifiers.filter((m) => m.source === 'hero')).toEqual([]);
    own(state, 'Pharao');
    const mods = state.modifiers.filter((m) => m.source === 'hero');
    expect(mods).toHaveLength(1);
    expect(mods[0]!.stat).toBe('buildSpeed');
    expect(mods[0]!.expiresAt).toBeNull();
  });

  // Idempotent and total, the rule `syncArtifactModifiers` set: several calls
  // must not stack the same hero's boon twice.
  it('is rebuilt rather than added to', () => {
    const state = freshGame();
    own(state, 'Pharao');
    syncHeroBoons(state);
    syncHeroBoons(state);
    expect(state.modifiers.filter((m) => m.source === 'hero')).toHaveLength(1);
  });

  it('adds nothing for a duplicate', () => {
    const state = freshGame();
    own(state, 'Necromancer');
    grantHero(state, 'Necromancer', 40);
    expect(state.modifiers.filter((m) => m.source === 'hero')).toHaveLength(1);
  });

  // Two Legendaries are two heroes, not two quartermasters in one party: the
  // stack sums them. (A party TRAIT is best-of; a boon is not a party thing.)
  it('stacks with another Legendary', () => {
    const state = freshGame();
    own(state, 'Pharao');
    const one = effectiveBuildTimeMultiplier(state);
    state.modifiers.push({
      id: 'hero:Twin', source: 'hero', stat: 'buildSpeed', scope: null,
      op: 'mul', value: 1.2, expiresAt: null,
    });
    expect(effectiveBuildTimeMultiplier(state)).toBeLessThan(one);
  });

  it('comes back from a save without a migrator, because it is derived', () => {
    const state = freshGame();
    own(state, 'ElvenPrincess');
    const before = manaProduction(state);
    const loaded = deserialize(serialize(state, T0), map, T0)!;
    expect(loaded).not.toBeNull();
    expect(loaded.modifiers.filter((m) => m.source === 'hero')).toHaveLength(1);
    expect(manaProduction(loaded)).toBeCloseTo(before, 6);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(45);
  });

  it('lists what the player is collecting', () => {
    const state = freshGame();
    own(state, 'Pharao');
    own(state, 'GoldenDragon');
    expect(activeBoons(state).map((b) => b.id)).toEqual(['Pharao', 'GoldenDragon']);
    // The free starting hero is a Common and brings none.
    expect(activeBoons(freshGame())).toEqual([]);
  });
});

// EVERY BOON IS COLLECTED. A stat nothing reads is a bonus nobody collects, so
// each one is asserted at the call site that owns its number.
describe('each boon reaches the number it names', () => {
  it('the Pharaoh — the builders work faster', () => {
    const state = freshGame();
    const before = effectiveBuildTimeMultiplier(state);
    own(state, 'Pharao');
    expect(effectiveBuildTimeMultiplier(state)).toBeLessThan(before);
    expect(effectiveBuildTimeMultiplier(state))
      .toBeCloseTo(before / HEROES.Pharao.boon!.value, 6);
  });

  it('the Necromancer — research runs faster', () => {
    const state = freshGame();
    const before = effectiveResearchTimeMultiplier(state);
    own(state, 'Necromancer');
    expect(effectiveResearchTimeMultiplier(state))
      .toBeCloseTo(before / HEROES.Necromancer.boon!.value, 6);
  });

  it('the Elven Princess — the kingdom makes more Mana', () => {
    const state = freshGame();
    const before = manaProduction(state);
    own(state, 'ElvenPrincess');
    expect(manaProduction(state)).toBeCloseTo(before * HEROES.ElvenPrincess.boon!.value, 6);
  });

  it('the Vampire Lord — every room teaches the heroes more', () => {
    const state = freshGame();
    own(state, 'VampireLord');
    expect(resolve(state, 'heroXp', 100))
      .toBeCloseTo(100 * HEROES.VampireLord.boon!.value, 6);
  });

  // The estimate AND the resolver, because a bonus the launch screen shows and
  // the fight does not keep is a promise on the sheet.
  it('the Golden Dragon — every unit has more health, on the board too', () => {
    const state = freshGame();
    const squads = [{ unitId: 'Warrior' as const, count: 10 }];
    const plain = buildBoard(squads, [], {
      dmg: () => 0, def: () => 0, hpMult: () => drillOf(state).hpMult,
    });
    own(state, 'GoldenDragon');
    const buffed = buildBoard(squads, [], {
      dmg: () => 0, def: () => 0, hpMult: () => drillOf(state).hpMult,
    });
    expect(drillOf(state).hpMult).toBeCloseTo(HEROES.GoldenDragon.boon!.value, 6);
    expect(buffed.slots[0]!.hpPool).toBeGreaterThan(plain.slots[0]!.hpPool);
  });

  // THE ONE THAT IS NOT COLLECTED YET, and it is named rather than forgotten:
  // the world map is designed and unbuilt, so the Scout's boon is declared and
  // waits for the timer that reads it. Delete this test when it lands.
  it('the Scout — waits on the world map, deliberately', () => {
    expect(HEROES.Scout.boon!.stat).toBe('worldRevealSpeed');
    const state = freshGame();
    own(state, 'Scout');
    // It is in the stack and ready; nothing resolves it yet.
    expect(state.modifiers.some((m) => m.stat === 'worldRevealSpeed')).toBe(true);
    expect(resolve(state, 'worldRevealSpeed', 1))
      .toBeCloseTo(HEROES.Scout.boon!.value, 6);
  });
});
