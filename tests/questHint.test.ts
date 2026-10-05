// The quest pill's hint for exploring points at a cell the next tap can buy.
//
// It used to point at the nearest DISCOVERED cell — dark, but not always on
// the cleared ground's edge — and the tap that followed it was refused with
// "Clear a path to it first", on the quest's own say-so.
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data/definitions';
import { explorationGate, fogState, isPayable } from '../src/sim/fog';
import { firstGame, freshPresenter, map } from './helpers';

describe('the hint for an exploring quest', () => {
  for (const id of QUESTS.filter((q) => q.goalType === 'DiscoverCells').map((q) => q.id).slice(0, 3)) {
    it(`points ${id} at a cell the next tap can buy`, () => {
      const game = freshPresenter(firstGame());
      game.state.quests.index = QUESTS.findIndex((q) => q.id === id);
      game.focusQuest();
      const cell = game.hintCell();
      expect(cell, 'the hint names a cell').not.toBeNull();
      expect(fogState(game.state, map, cell!)).toBe('Discovered');
      expect(isPayable(game.state, map, cell!)).toBe(true);
      expect(explorationGate(map, cell!)).toBeNull();
    });
  }
});
