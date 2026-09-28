// The line under each coin on the plank: how fast it is coming in. It must be
// the SAME number a raid measures (cityRatePerSecond), read per minute, and
// it must say nothing for a coin nothing produces.
import { describe, expect, it } from 'vitest';
import { cityRatePerSecond } from '../src/sim/gates';
import { addBuilt, freshGame, freshPresenter } from './helpers';

describe('coin rates on the plank', () => {
  it('reads Gold per minute, from the rate a raid takes from', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 3, y: 1 });
    state.city.population = 4; // residents are what pay rent
    const game = freshPresenter(state);
    const perMinute = cityRatePerSecond(game.state, 'Gold') * 60;
    expect(perMinute, 'a house pays rent').toBeGreaterThan(0);
    const expected = perMinute < 10 ? Math.max(0.1, Math.round(perMinute * 10) / 10) : Math.round(perMinute);
    expect(game.coinRate('Gold')).toBe(`+${expected}`);
  });

  it('says nothing for a coin nothing is producing', () => {
    const game = freshPresenter();
    for (const c of ['Food', 'Wood', 'Stone'] as const) {
      if (cityRatePerSecond(game.state, c) === 0) expect(game.coinRate(c)).toBeNull();
    }
    expect(game.coinRate('Gems')).toBeNull();
    expect(game.coinRate('Knowledge'), 'Knowledge reads only on the research screen').toBeNull();
  });
});
