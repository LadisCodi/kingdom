// The delve (Docs/features/19-world-map.md §8.1–§8.2): a dungeon's name and
// creature, what a room pays in precious material, the race every player
// sees, and what the camped army shows its owner.
import { describe, expect, it } from 'vitest';
import { LAIRS, VILLAINS, WORLD_DUNGEON, type VillainId } from '../src/sim/data/definitions';
import { buildBoard, generateEnemy, villainFighter } from '../src/sim/battle';
import { generateBoard } from '../src/sim/world/board';
import { snapshotWorld } from '../src/sim/world/source';
import { hexActions } from '../src/ui/world/worldActions';
import {
  delveRoom, drainEffects, dungeonInfo, emptyWorld, floorReward, join, resolveTo, roomReward, sendArmy, snapshotOf,
} from '../src/worldServer/core';
import { WORLD_PORTAL } from '../src/sim/data/definitions';

const T0 = Date.parse('2026-08-20T12:00:00Z');

let seed = 1;
while (!generateBoard('d', seed).hexes.some((h) => h.features.includes('Dungeon'))) seed += 1;
const dungeon = generateBoard('d', seed).hexes.find((h) => h.features.includes('Dungeon'))!;

function delving() {
  const { board: b, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'd', seed, seat: 0 } }, T0);
  for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
  return { b, seat };
}
const army = (power: number, key: string) => {
  const plan = generateEnemy({ seed: 2, parts: ['delver', key], budget: power, affinity: 'Any' });
  return buildBoard(plan.squads, [...plan.fighters, villainFighter(Object.keys(VILLAINS)[0] as VillainId)]);
};

describe('a dungeon', () => {
  it('is named, held by a creature, and has a boss per depth — the same every time it is read', () => {
    const { b } = delving();
    const info = dungeonInfo(b, dungeon.index);
    expect(info.name).toMatch(/^The \w+ \w+$/);
    expect(Object.keys(LAIRS)).toContain(info.creature);
    expect(info.bosses).toHaveLength(WORLD_DUNGEON.depths);
    expect(dungeonInfo(b, dungeon.index)).toEqual(info);
  });

  it('never shares a name with another standing at the same time', () => {
    const { b, seat } = delving();
    const names = snapshotOf(b, seat, T0).dungeonInfo!.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('pays precious material in every room, more deeper down', () => {
    expect(roomReward(0, 1).precious).toBeGreaterThanOrEqual(1);
    expect(roomReward(2, 1).precious).toBeGreaterThan(roomReward(0, 1).precious);
    expect(roomReward(0, WORLD_DUNGEON.roomsPerDepth).precious).toBeGreaterThan(roomReward(0, 1).precious);
  });
});

describe('fighting a room', () => {
  it('pays its precious lump, says what the fight cost, and shows the race', () => {
    const { b, seat } = delving();
    const r = sendArmy(b, seat, { purpose: 'delve', target: dungeon.index, heroes: [], board: army(20_000, 's') }, T0);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    const camped = snapshotOf(b, seat, r.arrivesAt).armies.find((a) => a.id === r.army)!;
    expect(camped.slots?.some((s) => s.kind === 'hero')).toBe(true);
    expect(snapshotOf(b, 1, r.arrivesAt).armies.find((a) => a.id === r.army)?.slots).toBeUndefined();
    const fight = delveRoom(b, seat, r.army, r.arrivesAt);
    if (!fight.ok) throw new Error(fight.why);
    expect(fight.won).toBe(true);
    expect(fight.lost).toBeGreaterThanOrEqual(0);
    const loot = drainEffects(b, seat).find((e) => e.kind === 'loot');
    expect(loot?.kind === 'loot' && loot.precious?.amount).toBe(roomReward(0, 1).precious);
    const view = snapshotOf(b, 1, r.arrivesAt).dungeonInfo?.find((d) => d.index === dungeon.index);
    expect(view?.race).toEqual([{ seat, cleared: 1 }]);
    expect(view?.key).toBeTruthy();
  });

  it('is reached from the hex through the delve screen only', () => {
    const { b, seat } = delving();
    const source = snapshotWorld(snapshotOf(b, seat, T0));
    expect(hexActions(source, seat, source.board().hexes[dungeon.index], { revealed: true })).toEqual([{ kind: 'openDelve' }]);
  });
});

describe('the Dark Portal', () => {
  it('pays a lump of precious material every few floors, more deeper down', () => {
    const every = WORLD_PORTAL.preciousEvery;
    expect(floorReward(1).precious).toBe(0);
    expect(floorReward(every).precious).toBeGreaterThan(0);
    expect(floorReward(every * 2).precious).toBeGreaterThan(floorReward(every).precious);
    expect(floorReward(every + 1).precious).toBe(0);
  });
});
