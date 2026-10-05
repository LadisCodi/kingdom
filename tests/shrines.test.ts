// The Shrines (Docs/plans/relics-and-bag.md, step 6): one ruin in the
// province, four more for Gems, each adding max Mana and moving freely.

import { describe, expect, it } from 'vitest';
import { advance, buildPremiumShrine, moveDistrict, premiumShrinePrice, repairAbandoned } from '../src/sim/commands';
import { ABANDONED, DISTRICTS, LANDMARKS, SHRINE_RULES } from '../src/sim/data/definitions';
import { canMoveDistrict, placementBlock } from '../src/sim/districts';
import { manaCap } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import { cellsOfRect, type Coord, type GameState } from '../src/sim/state';
import { canGather, clearLair, freshGame, fund, map, reveal, T0 } from './helpers';

/** A cell the city may put a Shrine on. */
function legal(state: GameState): Coord {
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (placementBlock(state, map, 'Shrine', { x, y }) === null) return { x, y };
  }
  throw new Error('nowhere');
}

function openGround(): GameState {
  const state = canGather(freshGame());
  for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) state.fog.revealed[`${x},${y}`] = true;
  return state;
}

describe('the Shrine', () => {
  it('is a ruin in the province, and no longer a landmark or a Gold build', () => {
    expect(ABANDONED.filter((a) => a.districtId === 'Shrine').map((a) => a.id)).toEqual(['ThornedShrine']);
    expect(LANDMARKS.some((l) => (l.kind as string) === 'Shrine')).toBe(false);
    expect(DISTRICTS.Shrine.buildable).toBe(false);
    expect(DISTRICTS.Shrine.hostsRelic).toBe(true);
  });

  it('is repaired once the Orcs are gone, and adds max Mana once it stands', () => {
    const state = freshGame();
    const ruin = ABANDONED.find((a) => a.id === 'ThornedShrine')!;
    reveal(state, cellsOfRect(ruin.location, DISTRICTS.Shrine.size));
    clearLair(state, 'Orcs');
    fund(state, { Gold: 1e6, Stone: 1e6 });
    const cap = manaCap(state);
    expect(repairAbandoned(state, map, ruin.id)).toBe('Started');
    advance(state, map, T0 + 365 * 86_400_000);
    expect(manaCap(state)).toBe(cap + SHRINE_RULES.manaCap);
  });

  it('is built anywhere for Gems, each dearer than the last, and the ladder ends', () => {
    const state = openGround();
    state.kingdom.builders = 9;
    state.player.wallet.Gems = 1e6;
    const prices: number[] = [];
    for (let i = 0; i < SHRINE_RULES.premiumGems.length; i++) {
      prices.push(premiumShrinePrice(state)!);
      expect(buildPremiumShrine(state, map, legal(state))).toBe('Started');
    }
    expect(prices).toEqual(SHRINE_RULES.premiumGems);
    expect(premiumShrinePrice(state)).toBeNull();
    expect(buildPremiumShrine(state, map, legal(state))).toBe('NoneLeft');
    expect(state.player.wallet.Gems).toBe(1e6 - prices.reduce((a, b) => a + b, 0));
  });

  it('moves, though it is never built for Gold', () => {
    const state = openGround();
    state.player.wallet.Gems = 1e6;
    buildPremiumShrine(state, map, legal(state));
    advance(state, map, T0 + 86_400_000);
    const shrine = state.city.districts.find((d) => d.definitionId === 'Shrine')!;
    expect(canMoveDistrict(shrine)).toBe(true);
    const to = legal(state);
    expect(moveDistrict(state, map, shrine.uniqueId, to, T0 + 86_400_000)).toBe('Moved');
  });

  it('drops a claim on a Shrine landmark from an old save', () => {
    const state = freshGame();
    state.landmarks.claimed.WhisperingStones = true;
    const file = serialize(state, T0);
    file.SaveVersion = 92;
    (file.Modules['kingdom.landmarks'] as { Claimed: string[] }).Claimed = ['ThornedShrine', 'CliffShrine', 'WhisperingStones'];
    const back = deserialize(file, map, T0)!;
    expect(Object.keys(back.landmarks.claimed)).toEqual(['WhisperingStones']);
  });
});
