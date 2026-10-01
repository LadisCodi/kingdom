// The upgrade popup's Improvements: only what the level moves, as a delta.

import { describe, expect, it } from 'vitest';
import { DISTRICTS, FOG, levelIndexed } from '../src/sim/data/definitions';
import { formatNumber } from '../src/ui/format';
import { townhall } from '../src/sim/state';
import { statChanges, statsAt } from '../src/ui/upgradeStats';
import { freshGame, freshPresenter } from './helpers';

describe('statChanges', () => {
  it("lists only the stats the next level moves, each with the difference in its own words", () => {
    const state = freshGame();
    const game = freshPresenter(state);
    const th = townhall(state);
    const next = th.level + 1;
    const changes = statChanges(game, th, next);

    // Everything listed moved, and everything that moved is listed.
    const now = statsAt(game, th, th.level);
    const then = new Map(statsAt(game, th, next).map((s) => [s.key, s.n]));
    expect(changes.map((c) => c.key)).toEqual(now.filter((s) => then.get(s.key) !== s.n).map((s) => s.key));
    expect(changes.some((c) => c.key === 'train-time')).toBe(false);

    const taxes = changes.find((c) => c.key === 'taxes');
    const income = DISTRICTS.Townhall.goldPerMinutePerLevel;
    const dTax = (levelIndexed(income, next) - levelIndexed(income, th.level)) * 60;
    if (dTax !== 0) expect(taxes?.delta).toBe(`+${formatNumber(dTax, 2)}`);

    const fog = changes.find((c) => c.key === 'fog');
    const dFog = levelIndexed(FOG.reachPerTownhallLevel, next) - levelIndexed(FOG.reachPerTownhallLevel, th.level);
    if (dFog !== 0) expect(fog?.delta).toBe(`+${dFog} ring${dFog === 1 ? '' : 's'}`);

    expect(changes.every((c) => c.better)).toBe(true);
    expect(changes.length).toBeGreaterThan(0);
  });
});
