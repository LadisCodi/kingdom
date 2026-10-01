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
    b.unlocks.bookMagic.target = 'heroes';
    const msgs = validateData(b, doc).filter((i) => i.collection === 'unlocks').map((i) => `${i.entry}: ${i.message}`);
    expect(msgs).toEqual(['heroes: "Tavern" is not a door', 'bookMagic: "heroes" is not a book']);
  });
});

describe('a book is announced once', () => {
  it('finds Civics open from the first minute, then nothing until the world opens another', () => {
    const state = firstGame();
    expect(freshlyOpenBooks(state)).toEqual(['Civics']);
    markBookSeen(state, 'Civics');
    expect(freshlyOpenBooks(state)).toEqual([]);
    state.landmarks.claimed[LANDMARKS[1].id] = true;
    expect(freshlyOpenBooks(state)).toEqual(['Magic']);
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

  it('waits for a reveal on screen to be read', () => {
    const game = freshPresenter(firstGame());
    game.unlockQueue.push('relics');
    game.gachaReveal = { prizes: [], caption: 'Spoils' };
    expect(game.unlockOnScreen()).toBeNull();
    game.gachaReveal = null;
    expect(game.unlockOnScreen()).toBe('relics');
  });
});
