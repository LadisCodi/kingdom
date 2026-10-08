// The Shrines (Docs/features/09-relics.md): one ruin in the province, then
// one built from the Build menu for its materials, then the rest for Gems —
// all behind a technology, and all moving freely.

import { describe, expect, it } from 'vitest';
import {
  advance, buildPremiumShrine, enqueueBuild, moveDistrict, repairAbandoned, shrineBuild,
} from '../src/sim/commands';
import { ABANDONED, DISTRICTS, LANDMARKS, SHRINE_RULES } from '../src/sim/data/definitions';
import { canMoveDistrict, placementBlock } from '../src/sim/districts';
import { manaCap } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import { cellsOfRect, type Coord, type GameState } from '../src/sim/state';
import { canGather, clearLair, completeTech, freshGame, fund, map, reveal, T0 } from './helpers';

/** A cell the city may put a Shrine on. */
function legal(state: GameState, movingId?: string): Coord {
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (placementBlock(state, map, 'Shrine', { x, y }, movingId) === null) return { x, y };
  }
  throw new Error('nowhere');
}

function openGround(): GameState {
  const state = canGather(freshGame());
  for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) state.fog.revealed[`${x},${y}`] = true;
  completeTech(state, 'SacredMasonry');
  return state;
}

/** The Thorned Shrine repaired: the Orcs gone, the price paid. */
function repairRuin(state: GameState): void {
  clearLair(state, 'Orcs');
  fund(state, { Gold: 1e6, Stone: 1e6 });
  expect(repairAbandoned(state, map, 'ThornedShrine')).toBe('Started');
}

describe('the Shrine', () => {
  it('is a ruin in the province, and built from the Build menu once researched', () => {
    expect(ABANDONED.filter((a) => a.districtId === 'Shrine').map((a) => a.id)).toEqual(['ThornedShrine']);
    expect(LANDMARKS.some((l) => (l.kind as string) === 'Shrine')).toBe(false);
    expect(DISTRICTS.Shrine.buildable).toBe(true);
    expect(DISTRICTS.Shrine.requiredTech).toBe('SacredMasonry');
    expect(DISTRICTS.Shrine.hostsRelic).toBe(true);
  });

  // A SHRINE HAS NO PASSIVE: it holds and wakes a relic, and nothing else.
  it('is repaired once the Orcs are gone, and adds no Mana and no Harmony', () => {
    const state = freshGame();
    const ruin = ABANDONED.find((a) => a.id === 'ThornedShrine')!;
    reveal(state, cellsOfRect(ruin.location, DISTRICTS.Shrine.size));
    clearLair(state, 'Orcs');
    fund(state, { Gold: 1e6, Stone: 1e6 });
    const cap = manaCap(state);
    expect(repairAbandoned(state, map, ruin.id)).toBe('Started');
    advance(state, map, T0 + 365 * 86_400_000);
    expect(state.city.districts.some((d) => d.definitionId === 'Shrine' && d.state === 'Built')).toBe(true);
    expect(manaCap(state)).toBe(cap);
    expect(DISTRICTS.Shrine.harmonySupply).toBe(0);
  });

  it('waits on the ruin, then sells its materials Shrines, then Gems, and the ladder ends', () => {
    const state = openGround();
    state.kingdom.builders = 9;
    state.player.wallet.Gems = 1e6;
    fund(state, { Gold: 1e7 });
    expect(shrineBuild(state).kind).toBe('ruinFirst');
    expect(enqueueBuild(state, map, 'Shrine', legal(state))).toBe('NotForMaterials');
    repairRuin(state);
    for (let i = 0; i < SHRINE_RULES.materialBuilds; i++) {
      expect(shrineBuild(state).kind).toBe('materials');
      expect(buildPremiumShrine(state, map, legal(state))).toBe('NotForGems');
      expect(enqueueBuild(state, map, 'Shrine', legal(state))).toBe('Started');
    }
    const prices: number[] = [];
    for (let i = 0; i < SHRINE_RULES.premiumGems.length; i++) {
      const offer = shrineBuild(state);
      expect(offer.kind).toBe('gems');
      prices.push(offer.kind === 'gems' ? offer.gems : 0);
      expect(enqueueBuild(state, map, 'Shrine', legal(state))).toBe('NotForMaterials');
      expect(buildPremiumShrine(state, map, legal(state))).toBe('Started');
    }
    expect(prices).toEqual(SHRINE_RULES.premiumGems);
    expect(shrineBuild(state).kind).toBe('none');
    expect(state.player.wallet.Gems).toBe(1e6 - prices.reduce((a, b) => a + b, 0));
  });

  it('allows as many as its ladder holds: the ruin, the material ones and the Gem ones', () => {
    expect(DISTRICTS.Shrine.maxCountPerTownhallLevel.every((n) => n === 1 + SHRINE_RULES.materialBuilds + SHRINE_RULES.premiumGems.length))
      .toBe(true);
  });

  it('moves, the ruin before its technology too', () => {
    const state = canGather(freshGame());
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) state.fog.revealed[`${x},${y}`] = true;
    repairRuin(state);
    advance(state, map, T0 + 86_400_000);
    const shrine = state.city.districts.find((d) => d.definitionId === 'Shrine')!;
    expect(canMoveDistrict(shrine)).toBe(true);
    const to = legal(state, shrine.uniqueId);
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
