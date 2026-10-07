// The director (src/ui/stage/director.ts; Docs/features/23-tutorials.md §1):
// a scene plays where it belongs, one that cannot start here does not hold
// the others back, and what the player already did is not taught.

import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/sim/data/definitions';
import { pickScene, sceneKey, settleScene } from '../src/ui/stage/director';
import type { Game } from '../src/game';
import { completeTech, firstGame, freshPresenter } from './helpers';

/** A presenter past the First Morning with every scene played but `only`. */
function onlyOwed(...only: string[]): Game {
  const state = firstGame();
  for (const s of SCENES) if (!only.includes(s.id)) state.tutorial.seen[sceneKey(s.id)] = true;
  state.quests.index = 40;
  const game = freshPresenter(state);
  game.payerDue = () => false;
  return game;
}

/** The Orcs found: a lair with a clock, as `armLairs` leaves one. */
const orcsFound = (game: Game): void => {
  game.state.lairs.Orcs = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: false, cleared: false };
};

describe('the director', () => {
  it('starts a scene about the city only on the province', () => {
    const game = onlyOwed('firstLair');
    orcsFound(game);
    game.scene = 'world';
    expect(pickScene(game, false).scene).toBeNull();
    game.scene = 'province';
    expect(pickScene(game, false).scene?.id).toBe('firstLair');
  });

  it('lets the next scene that fits go first, rather than holding it behind one that does not', () => {
    const game = onlyOwed('firstLair', 'builders');
    orcsFound(game);
    // The builder sheet is open: the camp's scene waits for the map, and the
    // sheet's own scene — which may play over it — goes first.
    game.openOverlay = 'builder';
    expect(pickScene(game, false).scene?.id).toBe('builders');
  });

  it('waits for the breath after the last scene, and for a splash', () => {
    const game = onlyOwed('firstLair');
    orcsFound(game);
    expect(pickScene(game, true).scene).toBeNull();
    game.unlockQueue.push({ kind: 'door', id: 'relics' } as never);
    expect(pickScene(game, false).scene).toBeNull();
  });

  it('settles a scene the player has already done, without playing it', () => {
    const game = onlyOwed('orcs');
    orcsFound(game);
    completeTech(game.state, 'Warrior');
    const pick = pickScene(game, false);
    expect(pick.scene).toBeNull();
    expect(pick.settled.map((s) => s.id)).toEqual(['orcs']);
  });

  it('still hands over what a settled scene gives', () => {
    const game = onlyOwed('shrineRelic');
    const scene = SCENES.find((s) => s.id === 'shrineRelic')!;
    expect(scene.lines.some((l) => l.restores === 'DowsingRod')).toBe(true);
    settleScene(game, scene);
    expect(game.state.artifacts.levels.DowsingRod).toBe(1);
    expect(game.state.tutorial.seen[sceneKey('shrineRelic')]).toBe(true);
  });

  it('plays one the player has not done', () => {
    const game = onlyOwed('orcs');
    orcsFound(game);
    expect(pickScene(game, false).scene?.id).toBe('orcs');
  });
});

describe('every scene says where it plays', () => {
  it('names a place, and only the province for one that points at the city map', () => {
    const map = /^(abandoned|lair|feature|district|cell|landmark):/;
    for (const s of SCENES) {
      expect(['province', 'world', 'any'], s.id).toContain(s.where);
      if (s.lines.some((l) => map.test(l.point))) expect(s.where, s.id).toBe('province');
    }
  });

  it('says what makes each introduction about a thing to do needless', () => {
    // An introduction that points the player at a technology to research, a
    // ruin to repair or a lair to beat is settled once they have done it.
    for (const id of ['farm', 'sawmill', 'picks', 'orcs', 'firstLair', 'tavern', 'shrineSeen',
      'shrineRelic', 'watchtowerRepair', 'world', 'huntSeen', 'ironSeen', 'goldSeen', 'fishSeen', 'harpies']) {
      expect(SCENES.find((s) => s.id === id)!.doneWhen, id).not.toBe('');
    }
  });
});
