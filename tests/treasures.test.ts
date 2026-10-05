import { describe, expect, it } from 'vitest';
import { FOG, TREASURE } from '../src/sim/data/definitions';
import { explorationGate, fogState, isPayable, revealTap } from '../src/sim/fog';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, getWallet, parseCoordKey, type Coord, type GameState } from '../src/sim/state';
import { pickUpTreasure, treasureAt, treasureDue } from '../src/sim/treasures';
import { firstGame, fund, map, T0 } from './helpers';

/** Every cell the player could pay for right now, on ground no technology
 *  gates, in reading order. */
const frontier = (state: GameState): Coord[] =>
  [...map.terrain.keys()].map(parseCoordKey)
    .filter((c) => fogState(state, map, c) === 'Discovered' && isPayable(state, map, c))
    .filter((c) => explorationGate(map, c) === null)
    .sort((a, b) => a.y - b.y || a.x - b.x);

/** Pay a cell clear. */
function payReveal(state: GameState, cell: Coord): void {
  fund(state, { Gold: 1_000_000 });
  for (let i = 0; i < FOG.tapsToReveal; i++) {
    if (revealTap(state, map, cell) === 'Revealed') return;
  }
  throw new Error(`could not reveal ${coordKey(cell)}`);
}

const treasureCells = (state: GameState): Coord[] =>
  Object.keys(state.fog.treasures).map(parseCoordKey);

describe('the fog\'s treasures', () => {
  it('places the first beside the very first paid reveal, as a chest in the fog', () => {
    const state = firstGame();
    expect(treasureDue(state)).toBe(false);
    const first = frontier(state)[0];
    payReveal(state, first);
    expect(state.fog.paidReveals).toBe(1);
    expect(state.fog.treasuresPlaced).toBe(1);
    const [at] = treasureCells(state);
    expect(at).toBeDefined();
    // Beside the ground just revealed, Discovered, and one the player can pay for.
    expect(Math.abs(at.x - first.x) + Math.abs(at.y - first.y)).toBe(1);
    expect(fogState(state, map, at)).toBe('Discovered');
    expect(isPayable(state, map, at)).toBe(true);
    expect(treasureAt(state, at)?.coin).toBe(TREASURE.firstCoin);
  });

  it('is due every `everyReveals` paid cells after the first', () => {
    const state = firstGame();
    for (let i = 0; i < 1 + TREASURE.everyReveals * 2; i++) {
      const next = frontier(state).find((c) => treasureAt(state, c) === undefined);
      if (next === undefined) throw new Error('ran out of frontier');
      payReveal(state, next);
    }
    expect(state.fog.paidReveals).toBe(1 + TREASURE.everyReveals * 2);
    expect(state.fog.treasuresPlaced).toBe(3);
  });

  it('cannot be picked up through the fog, and pays the first one free once revealed', () => {
    const state = firstGame();
    payReveal(state, frontier(state)[0]);
    const [at] = treasureCells(state);
    expect(pickUpTreasure(state, map, at).kind).toBe('Hidden');
    payReveal(state, at);
    const gold = getWallet(state.city.wallet, 'Gold');
    const mana = getWallet(state.city.wallet, 'Mana');
    const picked = pickUpTreasure(state, map, at);
    expect(picked).toEqual({ kind: 'PickedUp', reward: { [TREASURE.firstCoin]: TREASURE.firstAmount }, item: null, fragments: [] });
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold + TREASURE.firstAmount);
    expect(getWallet(state.city.wallet, 'Mana')).toBe(mana);
    expect(treasureAt(state, at)).toBeUndefined();
    expect(pickUpTreasure(state, map, at).kind).toBe('None');
  });

  it('lands in the same cell for the same kingdom, whatever came before', () => {
    const a = firstGame();
    const b = firstGame();
    const first = frontier(a)[0];
    payReveal(a, first);
    payReveal(b, first);
    expect(treasureCells(a)).toEqual(treasureCells(b));
  });

  it('survives a save', () => {
    const state = firstGame();
    payReveal(state, frontier(state)[0]);
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.fog.paidReveals).toBe(state.fog.paidReveals);
    expect(back.fog.treasuresPlaced).toBe(state.fog.treasuresPlaced);
    expect(back.fog.treasures).toEqual(state.fog.treasures);
  });
});
