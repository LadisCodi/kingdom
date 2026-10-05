// THE UNLOCK SPLASH (Docs/features/23-tutorials.md §4.6): which doors and
// books announce themselves full-screen, in what order, once, and never over
// a reveal.
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import balance from '../src/sim/data/balance';
import { LANDMARKS, UNLOCKS } from '../src/sim/data/definitions';
import { validateData, type DataDoc } from '../src/sim/data/dataRules';
import { freshlyOpenBooks, markBookSeen } from '../src/sim/research';
import { addBuilt, firstGame, freshPresenter } from './helpers';

const doc = balance as unknown as DataDoc;

describe('the unlock splashes as data', () => {
  it('draws every icon from art that ships', () => {
    const art = new Set(readdirSync('src/render/assets').map((f) => f.replace(/\.png$/, '')));
    expect(Object.values(UNLOCKS).map((u) => u.icon).filter((i) => !art.has(i))).toEqual([]);
  });

  it('names a door or a book that exists', () => {
    const b = structuredClone(doc) as Record<string, any>;
    b.unlocks.heroes.target = 'Tavern';
    b.unlocks.bookSagas.target = 'heroes';
    const msgs = validateData(b, doc).filter((i) => i.collection === 'unlocks').map((i) => `${i.entry}: ${i.message}`);
    expect(msgs).toEqual(['heroes: "Tavern" is not a door', 'bookSagas: "heroes" is not a book']);
  });
});

describe('a book is announced once', () => {
  it('finds the kingdom\'s tree open from the first minute, then nothing until a book is found', () => {
    const state = firstGame();
    expect(freshlyOpenBooks(state)).toEqual(['Kingdom']);
    markBookSeen(state, 'Kingdom');
    expect(freshlyOpenBooks(state)).toEqual([]);
    // A landmark used to open the Book of Magic; magic is a lane of the one
    // tree now, so a claim opens nothing — a standing Tavern finds the Sagas.
    state.landmarks.claimed[LANDMARKS[1].id] = true;
    expect(freshlyOpenBooks(state)).toEqual([]);
    addBuilt(state, 'Tavern', { x: 3, y: 1 });
    expect(freshlyOpenBooks(state)).toEqual(['Sagas']);
  });

  it('announces nothing to a veteran', () => {
    const state = firstGame();
    state.tutorial.veteran = true;
    expect(freshlyOpenBooks(state)).toEqual([]);
  });
});

describe('the presenter', () => {
  it('queues nothing for a new kingdom: Civics has no splash', () => {
    const game = freshPresenter(firstGame());
    game.notify();
    expect(game.unlockQueue).toEqual([]);
  });

  it('shows the Tavern\'s two openings in list order, each once', () => {
    const game = freshPresenter(firstGame());
    // Any building opens Build too; it has been seen, as it would have been.
    game.state.tutorial.seen['door:build'] = true;
    game.notify();
    addBuilt(game.state, 'Tavern', { x: 3, y: 1 });
    game.notify();
    expect(game.unlockQueue).toEqual(['heroes', 'bookSagas']);
    expect(game.unlockOnScreen()).toBe('heroes');
    game.dismissUnlock();
    expect(game.unlockOnScreen()).toBe('bookSagas');
    game.dismissUnlock();
    game.notify();
    expect(game.unlockQueue).toEqual([]);
  });

  // The First Morning plays before the profile is asked (Docs/features/
  // 14-monetization.md §3.1): nothing it opens may wait on a profile, or the
  // morning stalls. Only the profile sheet, once owed, holds a splash back.
  it('shows a splash through the First Morning, with no profile chosen yet', () => {
    const state = firstGame();
    state.player.payer = null;
    const game = freshPresenter(state);
    expect(game.payerDue()).toBe(false);
    game.unlockQueue.push('relics');
    expect(game.unlockOnScreen()).toBe('relics');
    state.tutorial.veteran = true; // the morning is over, and the profile is owed
    expect(game.payerDue()).toBe(true);
    expect(game.unlockOnScreen()).toBeNull();
  });

  it('waits for a reveal on screen to be read', () => {
    const game = freshPresenter(firstGame());
    game.unlockQueue.push('relics');
    game.gachaReveal = { prizes: [], caption: 'Spoils' };
    expect(game.unlockOnScreen()).toBeNull();
    game.gachaReveal = null;
    expect(game.unlockOnScreen()).toBe('relics');
  });
});
