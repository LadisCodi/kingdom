// What a fight's pay on the world board hands over in relic fragments
// (Docs/features/09-relics.md §5–§6). A camp is told by the hours of
// production it pays, not by `from`, and it opens no world relic's door.

import { describe, expect, it } from 'vitest';
import { ARTIFACT_ORDER, relicDoor } from '../src/sim/data/definitions';
import { isMet } from '../src/sim/relics';
import { lootFragments } from '../src/sim/world/loot';
import type { WorldEffect } from '../src/worldServer/types';
import { freshGame, T0 } from './helpers';

type Loot = Extract<WorldEffect, { kind: 'loot' }>;
const base: Loot = { kind: 'loot', at: T0, gold: 100, knowledge: 1, heroXp: 50, stardust: 2, seq: 1 } as Loot;
const behind = (door: string) => ARTIFACT_ORDER.filter((id) => relicDoor(id) === door);

describe('fragments from world loot', () => {
  it('a camp opens no door and pays no fragment', () => {
    const state = freshGame();
    expect(lootFragments(state, { ...base, hours: 2 })).toEqual([]);
    for (const id of behind('room')) expect(isMet(state, id)).toBe(false);
  });

  it('a dungeon room opens the room door', () => {
    const state = freshGame();
    const drops = lootFragments(state, base);
    expect(behind('room').length).toBeGreaterThan(0);
    for (const id of behind('room')) expect(isMet(state, id)).toBe(true);
    expect(drops.map((d) => d.relic)).toEqual(behind('room'));
  });

  it('a boss opens the boss door and pays one fragment', () => {
    const state = freshGame();
    const drops = lootFragments(state, { ...base, from: 'boss' });
    for (const id of behind('boss')) expect(isMet(state, id)).toBe(true);
    expect(drops).toHaveLength(behind('boss').length + 1);
  });
});
