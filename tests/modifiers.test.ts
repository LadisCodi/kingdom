// The modifier layer (Docs/implementation-plan.md §1).
//
// Two clients exist on day one, and both shapes are exercised here: artifact
// PASSIVES are permanent modifiers, artifact ACTIVES are timed ones. The
// property that let this land without touching a single existing assertion is
// the first test: an empty stack is the bit-exact identity.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { HARVEST, TAXES } from '../src/sim/data/definitions';
import {
  addModifier, isActive, resolve, type Modifier,
} from '../src/sim/modifiers';
import { cityGoldPerMinute } from '../src/sim/population';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type GameState } from '../src/sim/state';
import {
  effectiveTapYield, effectiveTaxRate, effectiveWorkerYield,
} from '../src/sim/upgrades';
import { addBuilt, freshGame, map, T0 } from './helpers';

const mod = (over: Partial<Modifier> = {}): Modifier => ({
  id: 'mod_1',
  source: 'artifact',
  stat: 'tapYield',
  scope: null,
  op: 'add',
  value: 1,
  expiresAt: null,
  ...over,
});

describe('resolution', () => {
  it('an empty stack is the bit-exact identity', () => {
    const state = freshGame();
    for (const base of [0, 1, 3, 0.1, 1 / 3, 1e-9]) {
      expect(resolve(state, 'taxRate', base)).toBe(base);
    }
  });

  it('sums every add, then multiplies every mul', () => {
    const state = freshGame();
    addModifier(state, mod({ id: 'a', stat: 'taxRate', op: 'add', value: 2 }));
    addModifier(state, mod({ id: 'b', stat: 'taxRate', op: 'add', value: 3 }));
    addModifier(state, mod({ id: 'c', stat: 'taxRate', op: 'mul', value: 2 }));
    addModifier(state, mod({ id: 'd', stat: 'taxRate', op: 'mul', value: 0.5 }));
    expect(resolve(state, 'taxRate', 10)).toBe((10 + 5) * 1);
  });

  it('folds in id order, so array order cannot change the last bit', () => {
    const build = (ids: string[]): GameState => {
      const state = freshGame();
      for (const id of ids) {
        addModifier(state, mod({ id, stat: 'taxRate', op: 'mul', value: 1 / 3 }));
      }
      return state;
    };
    const forwards = resolve(build(['a', 'b', 'c']), 'taxRate', 7);
    const backwards = resolve(build(['c', 'b', 'a']), 'taxRate', 7);
    expect(forwards).toBe(backwards);
  });

  it('narrows by scope; a null scope reaches everything', () => {
    const state = freshGame();
    addModifier(state, mod({ id: 'a', stat: 'workerYield', scope: 'Stone', value: 5 }));
    expect(resolve(state, 'workerYield', 1, 'Stone')).toBe(6);
    expect(resolve(state, 'workerYield', 1, 'Wood')).toBe(1);
    addModifier(state, mod({ id: 'b', stat: 'workerYield', scope: null, value: 1 }));
    expect(resolve(state, 'workerYield', 1, 'Wood')).toBe(2);
  });

  it('ignores modifiers for other stats', () => {
    const state = freshGame();
    addModifier(state, mod({ stat: 'manaRegen', value: 99 }));
    expect(resolve(state, 'taxRate', 4)).toBe(4);
  });
});

describe('expiry', () => {
  it('is half-open — active while t < expiresAt, matching cell recovery', () => {
    const m = mod({ expiresAt: T0 + 1000 });
    expect(isActive(m, T0 + 999)).toBe(true);
    expect(isActive(m, T0 + 1000)).toBe(false);
  });

  it('is read off the sim clock, not a now parameter', () => {
    const state = freshGame();
    addModifier(state, mod({ stat: 'taxRate', op: 'add', value: 10, expiresAt: T0 + 5_000 }));
    state.lastAdvance = T0;
    expect(resolve(state, 'taxRate', 1)).toBe(11);
    state.lastAdvance = T0 + 5_000; // the sim moved past it
    expect(resolve(state, 'taxRate', 1)).toBe(1);
  });

  it('is a boundary, so an accrual never straddles it at the wrong rate', () => {
    // A taxRate x2 that lapses at 60s inside a 120s window. Get it wrong and
    // the whole window is priced at one rate or the other.
    const earn = (withBuff: boolean): number => {
      const state = freshGame();
      addBuilt(state, 'Housing', { x: 3, y: 2 });
      state.city.population = 2;
      state.city.wallet.Gold = 0;
      state.city.lastTaxAt = T0;
      state.lastAdvance = T0;
      if (withBuff) {
        addModifier(state, mod({
          id: 'haste', stat: 'taxRate', op: 'mul', value: 2, expiresAt: T0 + 60_000,
        }));
      }
      advance(state, map, T0 + 120_000);
      return getWallet(state.city.wallet, 'Gold');
    };
    const plain = earn(false);          // 120s at 1x
    const buffed = earn(true);          // 60s at 2x + 60s at 1x
    expect(buffed).toBe(Math.round(plain * 1.5));
  });

  it('reports what lapsed, and one-call replay agrees with stepped ticking', () => {
    const build = (): GameState => {
      const state = freshGame();
      addBuilt(state, 'Housing', { x: 3, y: 2 });
      state.city.population = 2;
      state.city.wallet.Gold = 0;
      state.city.lastTaxAt = T0;
      state.lastAdvance = T0;
      addModifier(state, mod({
        id: 'haste', stat: 'taxRate', op: 'mul', value: 2, expiresAt: T0 + 60_000,
      }));
      return state;
    };
    const oneCall = build();
    const report = advance(oneCall, map, T0 + 120_000);
    expect(report.expiredModifiers.map((m) => m.id)).toEqual(['haste']);
    expect(oneCall.modifiers).toHaveLength(0);

    const stepped = build();
    for (let t = 1000; t <= 120_000; t += 1000) advance(stepped, map, T0 + t);
    expect(getWallet(stepped.city.wallet, 'Gold'))
      .toBe(getWallet(oneCall.city.wallet, 'Gold'));
  });

  it('keeps a permanent passive forever', () => {
    const state = freshGame();
    addModifier(state, mod({ id: 'sigil', stat: 'workerYield', value: 1 }));
    advance(state, map, T0 + 30 * 86_400_000);
    expect(state.modifiers).toHaveLength(1);
  });
});

describe('the effectiveX pipeline', () => {
  it('rounds integer stats once, at the boundary', () => {
    const state = freshGame();
    // Base Forest tap is 1; x1.5 must become 2, not 1.5 in the wallet.
    addModifier(state, mod({ id: 'a', stat: 'tapYield', op: 'mul', value: 1.5 }));
    const yielded = effectiveTapYield(state, HARVEST.Forest);
    expect(Number.isInteger(yielded)).toBe(true);
    expect(yielded).toBe(Math.round(HARVEST.Forest.yieldPerTap * 1.5));
  });

  it('never lets a stat go negative', () => {
    const state = freshGame();
    addModifier(state, mod({ id: 'a', stat: 'workerYield', op: 'add', value: -99 }));
    expect(effectiveWorkerYield(state, HARVEST.Stone)).toBe(0);
  });

  it('reaches the tax rate, and therefore the city income', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 3, y: 2 });
    state.city.population = 2;
    const before = cityGoldPerMinute(state);
    expect(effectiveTaxRate(state)).toBe(TAXES.goldPerPopulationPerMinute);
    addModifier(state, mod({ id: 'ledger', stat: 'taxRate', op: 'mul', value: 1.2 }));
    expect(cityGoldPerMinute(state)).toBeCloseTo(before * 1.2, 6);
  });
});

describe('persistence', () => {
  it('survives a save round-trip, expiry included', () => {
    const state = freshGame();
    addModifier(state, mod({ id: 'rod', stat: 'revealCost', op: 'mul', value: 0.85 }));
    addModifier(state, mod({
      id: 'haste', source: 'artifact', stat: 'workerYield', scope: 'Wood',
      op: 'mul', value: 2, expiresAt: T0 + 3_600_000,
    }));
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.modifiers).toEqual(state.modifiers);
  });
});
