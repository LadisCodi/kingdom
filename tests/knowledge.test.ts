// The Knowledge bar (Docs/features/07-research.md §3): a fixed drip that stops
// at the cap, lumps that land over it, and two ways to buy it.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { KNOWLEDGE, LAIRS } from '../src/sim/data/definitions';
import { attackLair, claimLair } from '../src/sim/expeditions';
import {
  accrueKnowledge, buyKnowledge, knowledgeCap, knowledgeGemPrice, knowledgeGoldPrice,
  firstClearLump, knowledgeHeld, knowledgePerHour, msToFullKnowledge, msToNextKnowledge,
  payKnowledge,
} from '../src/sim/knowledge';
import { pourKnowledge } from '../src/sim/research';
import { getWallet, type GameState, type UnitId } from '../src/sim/state';
import {
  addAllTrainers, completeTech, freshGame, fund, map, reveal, T0,
} from './helpers';

const HOUR = 3_600_000;

/** A kingdom with an empty bar, its drip anchored at T0. */
const empty = (): GameState => {
  const state = freshGame();
  fund(state, { Knowledge: 0 });
  state.kingdom.lastKnowledgeAt = T0;
  state.lastAdvance = T0;
  return state;
};

describe('the drip', () => {
  it('is one an hour, from zero, and the cap is ten', () => {
    expect(knowledgePerHour()).toBe(1);
    expect(knowledgePerHour()).toBe(KNOWLEDGE.basePerHour);
    expect(knowledgeCap()).toBe(10);
    const state = empty();
    advance(state, map, T0 + HOUR - 1);
    expect(knowledgeHeld(state)).toBe(0);
    advance(state, map, T0 + HOUR);
    expect(knowledgeHeld(state)).toBe(1);
    advance(state, map, T0 + 3 * HOUR + HOUR / 2);
    expect(knowledgeHeld(state)).toBe(3);
  });

  it('stops at the cap, and resumes once Knowledge is poured below it', () => {
    const state = empty();
    advance(state, map, T0 + 30 * HOUR);
    expect(knowledgeHeld(state)).toBe(10);

    // Pour some into a technology: the bar drops below the cap and fills again.
    // Forestry: the tree's first card, workable from the first minute.
    expect(pourKnowledge(state, 'Forestry').poured).toBeGreaterThan(0);
    const after = knowledgeHeld(state);
    expect(after).toBeLessThan(10);
    // The clock ran while the bar was full, and banked nothing: the next point
    // is one period from the anchor, not a backlog.
    advance(state, map, T0 + 31 * HOUR);
    expect(knowledgeHeld(state)).toBe(after + 1);
    advance(state, map, T0 + 60 * HOUR);
    expect(knowledgeHeld(state)).toBe(10);
  });

  it('never pays a backlog for the hours the bar was full', () => {
    const state = empty();
    accrueKnowledge(state, T0 + 100 * HOUR);
    expect(knowledgeHeld(state)).toBe(10);
    // The anchor moved with the clock, so draining the bar does not refill it
    // on the spot.
    expect(state.kingdom.lastKnowledgeAt).toBe(T0 + 100 * HOUR);
    fund(state, { Knowledge: 0 });
    accrueKnowledge(state, T0 + 100 * HOUR);
    expect(knowledgeHeld(state)).toBe(0);
  });

  it('lets a lump or a purchase land over the cap, and stays stopped while over it', () => {
    const state = empty();
    fund(state, { Knowledge: 9 });
    payKnowledge(state, 15); // a first clear, say
    expect(knowledgeHeld(state)).toBe(24);
    advance(state, map, T0 + 5 * HOUR);
    expect(knowledgeHeld(state), 'the drip stays stopped over the cap').toBe(24);

    fund(state, { Gold: 1_000_000, Knowledge: 10 });
    expect(buyKnowledge(state, 3, 'Gold')).toBe('Bought');
    expect(knowledgeHeld(state)).toBe(13);
    advance(state, map, T0 + 10 * HOUR);
    expect(knowledgeHeld(state)).toBe(13);
  });

  // Invariant 1, across a window that fills the bar and runs past it.
  it('one-call replay equals stepped ticking across the cap', () => {
    const setup = (): GameState => {
      const s = empty();
      fund(s, { Knowledge: 4 });
      // Mid-period anchor, so the boundaries do not line up with the steps.
      s.kingdom.lastKnowledgeAt = T0 - 17 * 60_000;
      return s;
    };
    const END = T0 + 9 * HOUR + 123_456;
    const oneCall = setup();
    advance(oneCall, map, END);
    const stepped = setup();
    for (let t = T0 + 60_000; t < END; t += 60_000) advance(stepped, map, t);
    advance(stepped, map, END);

    expect(knowledgeHeld(oneCall)).toBe(10);
    expect(knowledgeHeld(stepped)).toBe(knowledgeHeld(oneCall));
    expect(stepped.kingdom.lastKnowledgeAt).toBe(oneCall.kingdom.lastKnowledgeAt);
    // …and they stay in step once the bar is drained and fills again.
    fund(oneCall, { Knowledge: 0 });
    fund(stepped, { Knowledge: 0 });
    const END2 = END + 3 * HOUR + 1;
    advance(oneCall, map, END2);
    for (let t = END + 60_000; t < END2; t += 60_000) advance(stepped, map, t);
    advance(stepped, map, END2);
    expect(knowledgeHeld(stepped)).toBe(knowledgeHeld(oneCall));
    expect(knowledgeHeld(oneCall)).toBe(3);
  });
});

describe('how long until the bar moves', () => {
  it('counts to the next point and to a full bar', () => {
    const state = empty();
    expect(msToNextKnowledge(state, T0)).toBe(HOUR);
    expect(msToNextKnowledge(state, T0 + HOUR / 4)).toBe(3 * HOUR / 4);
    expect(msToFullKnowledge(state, T0)).toBe(10 * HOUR);
    fund(state, { Knowledge: 7 });
    expect(msToFullKnowledge(state, T0 + HOUR / 4)).toBe(3 * HOUR / 4 + 2 * HOUR);
  });

  it('has no next point on a full bar, and a full bar is zero away', () => {
    const state = empty();
    fund(state, { Knowledge: 10 });
    expect(msToNextKnowledge(state, T0)).toBeNull();
    expect(msToFullKnowledge(state, T0)).toBe(0);
    fund(state, { Knowledge: 25 });
    expect(msToNextKnowledge(state, T0)).toBeNull();
    expect(msToFullKnowledge(state, T0)).toBe(0);
  });
});

describe('buying Knowledge', () => {
  it('prices the nth point ever bought with Gold at base × n²', () => {
    const state = empty();
    const base = KNOWLEDGE.goldPriceBase;
    expect(base).toBe(100);
    expect(KNOWLEDGE.goldPriceExponent).toBe(2);
    expect(knowledgeGoldPrice(state, 0)).toBe(0);
    expect(knowledgeGoldPrice(state, 1)).toBe(base);
    expect(knowledgeGoldPrice(state, 3)).toBe(base * (1 + 4 + 9));
  });

  it('keeps the count: a second purchase continues the ladder', () => {
    const state = empty();
    const base = KNOWLEDGE.goldPriceBase;
    fund(state, { Gold: 100_000 });
    expect(buyKnowledge(state, 2, 'Gold')).toBe('Bought');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(100_000 - base * (1 + 4));
    expect(state.kingdom.knowledgeBoughtWithGold).toBe(2);
    expect(knowledgeHeld(state)).toBe(2);
    // The third point costs 3² × base, whatever happened in between.
    fund(state, { Knowledge: 0 });
    expect(knowledgeGoldPrice(state, 1)).toBe(base * 9);
    const gold = getWallet(state.city.wallet, 'Gold');
    expect(buyKnowledge(state, 2, 'Gold')).toBe('Bought');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - base * (9 + 16));
    expect(state.kingdom.knowledgeBoughtWithGold).toBe(4);
  });

  it('prices Gems at a fixed rate a point, and Gems never move the Gold ladder', () => {
    const state = empty();
    expect(knowledgeGemPrice(1)).toBe(KNOWLEDGE.gemsPerPoint);
    expect(knowledgeGemPrice(5)).toBe(5 * KNOWLEDGE.gemsPerPoint);
    fund(state, { Gems: 5 * KNOWLEDGE.gemsPerPoint });
    expect(buyKnowledge(state, 4, 'Gems')).toBe('Bought');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(KNOWLEDGE.gemsPerPoint);
    expect(knowledgeHeld(state)).toBe(4);
    expect(state.kingdom.knowledgeBoughtWithGold).toBe(0);
    expect(knowledgeGemPrice(1)).toBe(KNOWLEDGE.gemsPerPoint);
  });

  it('refuses what it cannot pay for, and takes nothing', () => {
    const state = empty();
    fund(state, { Gold: KNOWLEDGE.goldPriceBase * 3 - 1, Gems: KNOWLEDGE.gemsPerPoint * 2 - 1 });
    expect(buyKnowledge(state, 2, 'Gold')).toBe('NotEnoughGold');
    expect(buyKnowledge(state, 2, 'Gems')).toBe('NotEnoughGems');
    expect(buyKnowledge(state, 0, 'Gold')).toBe('NothingToBuy');
    expect(buyKnowledge(state, -1, 'Gems')).toBe('NothingToBuy');
    expect(buyKnowledge(state, 1.5, 'Gold')).toBe('NothingToBuy');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(KNOWLEDGE.goldPriceBase * 3 - 1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(KNOWLEDGE.gemsPerPoint * 2 - 1);
    expect(state.kingdom.knowledgeBoughtWithGold).toBe(0);
    expect(knowledgeHeld(state)).toBe(0);
  });
});

describe('a lair teaches something, once', () => {
  const ORCS = 'Orcs' as const;

  it('pays its first-clear lump into the KINGDOM wallet, never the city', () => {
    const state = freshGame();
    addAllTrainers(state);
    completeTech(state, 'Warrior');
    fund(state, { Gold: 5000, Food: 2000, Wood: 2000, Stone: 500, Knowledge: 0 });
    reveal(state, [LAIRS[ORCS].location]);
    state.lairs[ORCS] = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: false, cleared: false };
    for (let i = 0; i < 60; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' as UnitId });
    }
    const expected = firstClearLump(state);
    const report = attackLair(state, map, ORCS, ['Warden'], [{ unitId: 'Warrior', count: 60 }]);
    expect(report.result).toBe('Cleared');
    expect(report.knowledge).toBe(expected);
    claimLair(state, ORCS);
    expect(knowledgeHeld(state)).toBe(expected);
    expect(getWallet(state.city.wallet, 'Knowledge')).toBe(0);
  });
});
