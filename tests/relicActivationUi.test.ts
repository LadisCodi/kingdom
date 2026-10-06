// The relic activation as the presenter shows it (Docs/features/09-relics.md
// §2.1, §11; mockups M80–M85): where a relic stands on its card, the Mana
// bubble over a sleeping Shrine, the badges over the roofs an awake aura
// pays, and the tab that asks for a relic to be woken again.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISTRICTS } from '../src/sim/data/definitions';
import { hostRelic } from '../src/sim/hosts';
import { mana } from '../src/sim/mana';
import { clearShrineBubbles, markShrineBubble } from '../src/render/shrineBubbles';
import type { Game } from '../src/game';
import type { GameState } from '../src/sim/state';
import { addBuilt, freshGame, freshPresenter, fund, reveal, T0 } from './helpers';

const WINDOW_MS = DISTRICTS.Shrine.relicWindowMinutesPerLevel[0]! * 60_000;

/** A Tribute Crown hosted beside one house with residents, and the Mana to
 *  wake it — in a Shrine clear of the Townhall. */
function crowned(): { state: GameState; game: Game } {
  const state = freshGame();
  state.lastAdvance = T0;
  state.artifacts.levels.GildedLedger = 3;
  fund(state, { Mana: 200 });
  reveal(state, [{ x: 3, y: 3 }, { x: 4, y: 3 }]);
  state.city.districts.push({
    uniqueId: 'shrine_a', definitionId: 'Shrine', ordinal: 1, level: 1, assignedWorkers: 0,
    location: { x: 3, y: 3 }, state: 'Built', visualVariant: 1,
  });
  addBuilt(state, 'Housing', { x: 4, y: 3 });
  state.city.population = 8;
  expect(hostRelic(state, 'GildedLedger', 'shrine_a', T0)).toBe('Hosted');
  return { state, game: freshPresenter(state) };
}

describe('the relic activation on screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('says where a relic stands on its card', () => {
    const { state, game } = crowned();
    expect(game.relicCard('GildedLedger').status).toBe('asleep');
    expect(game.relicCard('DowsingRod').status).toBe('broken');
    state.artifacts.levels.DowsingRod = 1;
    expect(game.relicCard('DowsingRod').status).toBe('bag');
    game.doActivateRelic('GildedLedger');
    expect(game.relicCard('GildedLedger').status).toBe('awake');
  });

  // M84: the sleeping Shrine carries the price; the awake one carries none,
  // and the house its aura pays wears what it pays.
  it('puts a Mana bubble over a sleeping Shrine and badges under an awake aura', () => {
    const { game } = crowned();
    let layer = game.markers();
    expect(layer.shrineRelics).toEqual([expect.objectContaining({
      relic: 'GildedLedger', awake: false, cost: 20, affordable: true,
    })]);
    expect(layer.auraBadges).toEqual([]);
    game.doActivateRelic('GildedLedger');
    layer = game.markers();
    expect(layer.shrineRelics[0]!.awake).toBe(true);
    expect(layer.auraBadges).toEqual([expect.objectContaining({ location: { x: 4, y: 3 }, text: '+30%' })]);
    expect(layer.relicBursts).toHaveLength(1);
  });

  // A TAP ON A BUILDING NEVER COSTS MANA: the bubble opens the Shrine's card,
  // and Activate there is what pays.
  it('opens the Shrine card from its Mana bubble, and spends nothing', () => {
    const { state, game } = crowned();
    const before = mana(state);
    markShrineBubble('GildedLedger', { x: 10, y: 10, w: 40, h: 30 });
    game.handleTap(20, 20);
    clearShrineBubbles();
    expect(game.inspectedDistrictId).toBe('shrine_a');
    expect(mana(state)).toBe(before);
    expect(game.relicCard('GildedLedger').status).toBe('asleep');
  });

  // M85: a window that closes raises the tab; waking the relic lowers it.
  it('asks for a relic to be woken once its window closes', () => {
    const { game } = crowned();
    game.doActivateRelic('GildedLedger');
    expect(game.asleepNotice()).toBeNull();
    vi.setSystemTime(T0 + WINDOW_MS + 1000);
    game.tick();
    expect(game.asleepNotice()).toEqual(expect.objectContaining({ relic: 'GildedLedger', count: 1 }));
    game.doActivateRelic('GildedLedger');
    expect(game.asleepNotice()).toBeNull();
  });

  // M83: short of the price, the card says when the pool will hold it.
  it('says how soon the Mana is there when it is short', () => {
    const { state, game } = crowned();
    fund(state, { Mana: 5 });
    const a = game.relicActivation('GildedLedger')!;
    expect(a.affordable).toBe(false);
    expect(a.regenPerHour).toBeGreaterThan(0);
    expect(a.readyInMs).toBe(Math.ceil((15 / a.regenPerHour) * 3_600_000));
  });
});
