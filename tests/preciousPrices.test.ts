// What precious materials buy (Docs/features/19-world-map.md §7.6): a few of
// any at level 5, named and more at levels 8–10 and the Fortress — and never
// anything while the world is shut.
import { describe, expect, it } from 'vitest';
import { DISTRICTS, LANDMARKS, TECHNOLOGIES, WORLD_BUILD } from '../src/sim/data/definitions';
import { techGoodsCost } from '../src/sim/research';
import { upgradeGoodsCost } from '../src/sim/districts';
import { addGood } from '../src/sim/goods';
import { preciousAsked, resolvePrice, worldUpgradeGoods } from '../src/sim/precious';
import { PRECIOUS, type GameState, type TechId } from '../src/sim/state';
import { freshGame } from './helpers';

const worldOpen = (): GameState => {
  const state = freshGame();
  const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;
  state.landmarks.claimed[tower.id] = true;
  return state;
};

describe('a precious price', () => {
  it('is never asked while the world is shut', () => {
    const state = freshGame();
    expect(preciousAsked(state)).toBe(false);
    expect(resolvePrice(state, { Planks: 2, Starmetal: 5 }, 10)).toEqual({ Planks: 2 });
    expect(Object.keys(upgradeGoodsCost(state, 'Townhall', 10)).some((g) => (PRECIOUS as readonly string[]).includes(g))).toBe(false);
  });

  it('takes "any" from what the player holds most of', () => {
    const state = worldOpen();
    addGood(state.city.goods, 'Heartwood', 8);
    addGood(state.city.goods, 'Moonglass', 3);
    expect(resolvePrice(state, {}, 5)).toEqual({ Heartwood: 5 });
    expect(resolvePrice(state, {}, 10)).toEqual({ Heartwood: 8, Moonglass: 2 });
    // After what the named terms take.
    // After what the named terms take: Heartwood has 2 to spare, Moonglass 3.
    expect(resolvePrice(state, { Heartwood: 6 }, 4)).toEqual({ Heartwood: 6 + 1, Moonglass: 3 });
  });

  it('asks the shortfall of the most-held, so the price shows short', () => {
    const state = worldOpen();
    addGood(state.city.goods, 'Starmetal', 2);
    expect(resolvePrice(state, {}, 5)).toEqual({ Starmetal: 5 });
  });

  it('asks a few of one by name at levels 4 and 5, the three alike, and each of the three late on', () => {
    const state = worldOpen();
    const early: Record<string, number> = {};
    for (const def of Object.values(DISTRICTS)) {
      if (def.maxLevel < 5) continue;
      for (const level of [4, 5]) {
        const asked = PRECIOUS.filter((p) => (upgradeGoodsCost(state, def.id, level)[p] ?? 0) > 0);
        if (asked.length === 0) continue;
        expect(asked, `${def.id} level ${level}`).toHaveLength(1);
        const n = upgradeGoodsCost(state, def.id, level)[asked[0]]!;
        expect(n).toBeLessThanOrEqual(5);
        early[asked[0]] = (early[asked[0]] ?? 0) + n;
      }
    }
    const totals = PRECIOUS.map((p) => early[p] ?? 0);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(5);
    for (const id of ['Sawmill', 'Barracks', 'Townhall'] as const) {
      const ten = upgradeGoodsCost(state, id, 10);
      for (const p of PRECIOUS) expect(ten[p] ?? 0).toBeGreaterThan(0);
    }
    expect(PRECIOUS.some((p) => (upgradeGoodsCost(state, 'Housing', 10)[p] ?? 0) > 0)).toBe(false);
  });

  it('prices the Fortress’s later levels', () => {
    const state = worldOpen();
    expect(worldUpgradeGoods(state, 'Fortress', 1)).toEqual({});
    const two = worldUpgradeGoods(state, 'Fortress', 2);
    expect(PRECIOUS.reduce((s, p) => s + (two[p] ?? 0), 0)).toBe(WORLD_BUILD.upgrades.Fortress.levels[1].anyPrecious);
    for (const p of PRECIOUS) expect(worldUpgradeGoods(state, 'Fortress', 3)[p]).toBeGreaterThan(0);
  });

  it('asks research from the middle of the tree on — more technologies a chapter, and dearer', () => {
    const shut = freshGame();
    const open = worldOpen();
    const asked = (tech: TechId) => PRECIOUS.reduce((n, p) => n + (techGoodsCost(open, tech)[p] ?? 0), 0);
    const byChapter = new Map<number, number[]>();
    for (const id of Object.keys(TECHNOLOGIES) as TechId[]) {
      const def = TECHNOLOGIES[id];
      // Never while the world is shut.
      expect(PRECIOUS.some((p) => (techGoodsCost(shut, id)[p] ?? 0) > 0)).toBe(false);
      const n = asked(id);
      if (n === 0 || def.tome !== 'Kingdom') continue;
      byChapter.set(def.era, [...(byChapter.get(def.era) ?? []), n]);
    }
    const chapters = [...byChapter.keys()].sort((a, b) => a - b);
    expect(chapters[0]).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < chapters.length; i++) {
      const [was, now] = [byChapter.get(chapters[i - 1])!, byChapter.get(chapters[i])!];
      expect(now.length).toBeGreaterThanOrEqual(was.length);
      expect(Math.max(...now)).toBeGreaterThanOrEqual(Math.max(...was));
    }
  });
});
