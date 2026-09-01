// The quest chain: absolute goals are state predicates (pre-done work
// counts), relative goals count events only while active, claims pay the
// reward and advance the chain, and offline replay feeds relative progress.
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data/definitions';
import { revealTap } from '../src/sim/fog';
import { tapCell } from '../src/sim/harvest';
import {
  activeQuest, claimQuest, isQuestComplete, questValue, recordQuestEvent,
} from '../src/sim/quests';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, T0, tickAt } from './helpers';

const FOREST = { x: 2, y: 2 };

describe('the quest chain', () => {
  it('ships 17 quests, starting with the tap tutorial', () => {
    expect(QUESTS).toHaveLength(17);
    expect(QUESTS[0]).toMatchObject({ id: 'FirstSteps', goalType: 'CollectTaps', goalAmount: 5 });
    expect(QUESTS[1]).toMatchObject({ id: 'Timber', goalType: 'HoldResource', goalTarget: 'Wood' });
  });

  it('quests 1→2 overlap: tutorial taps count toward the wood stockpile', () => {
    const state = freshGame();
    for (let i = 0; i < 5; i++) expect(tapCell(state, map, FOREST, T0)).toBe('Harvested');
    expect(isQuestComplete(state, activeQuest(state)!)).toBe(true); // 5 taps
    expect(claimQuest(state)).toBe('Claimed');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(10); // reward

    // Timber! is ABSOLUTE (HoldResource): the 5 wood already tapped count.
    const timber = activeQuest(state)!;
    expect(questValue(state, timber)).toBe(5);
    for (let i = 0; i < 5; i++) tapCell(state, map, FOREST, T0);
    expect(isQuestComplete(state, timber)).toBe(true);
    expect(claimQuest(state)).toBe('Claimed');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(25);
  });

  it('absolute goals complete instantly when the work was already done', () => {
    const state = freshGame();
    addBuilt(state, 'Sawmill', { x: 1, y: 2 });
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TheSawmill');
    expect(isQuestComplete(state, activeQuest(state)!)).toBe(true); // never blocked
  });

  it('relative goals ignore everything before activation', () => {
    const state = freshGame();
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TaxDay'); // CollectResource Gold 30
    fund(state, { Gold: 1000 }); // riches on hand — but not COLLECTED while active
    expect(questValue(state, activeQuest(state)!)).toBe(0);
    recordQuestEvent(state, { kind: 'collect', currency: 'Wood', amount: 50 }); // wrong currency
    expect(state.quests.progress).toBe(0);
    recordQuestEvent(state, { kind: 'collect', currency: 'Gold', amount: 30 });
    expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
  });

  it('fog reveals feed the Explorer quest through the sim', () => {
    const state = freshGame();
    state.quests.index = QUESTS.findIndex((q) => q.id === 'Explorer');
    fund(state, { Gold: 100 });
    let r: string = 'Paid';
    while (r === 'Paid') r = revealTap(state, map, { x: 3, y: 0 });
    expect(r).toBe('Revealed');
    expect(state.quests.progress).toBe(1);
  });

  it('claiming needs completion; a finished chain has no quest', () => {
    const state = freshGame();
    expect(claimQuest(state)).toBe('NotComplete');
    state.quests.index = QUESTS.length;
    expect(activeQuest(state)).toBe(null);
    expect(claimQuest(state)).toBe('NoQuest');
  });

  it('progress survives the save and grows during offline replay', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1; // 30 gold/min in taxes
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TaxDay');
    state.quests.progress = 7;
    tickAt(state, T0); // anchor the tax clock
    const restored = deserialize(serialize(state, T0), map, T0 + 120_000)!;
    expect(restored.quests.index).toBe(state.quests.index);
    // 2 offline minutes × 30 gold/min flowed through the collect hook.
    expect(restored.quests.progress).toBe(7 + 60);
    expect(isQuestComplete(restored, activeQuest(restored)!)).toBe(true);
  });
});
