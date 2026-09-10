// The district card is built ONCE per building (ui/districtCard.ts): its
// signature says what the card draws that does not tick, and the live parts
// carry the clock. Same signature on a tick; a new one on the things a
// rebuild is for.
import { describe, expect, it } from 'vitest';
import { LiveParts } from '../src/ui/kit/live';
import { districtCardSignature } from '../src/ui/districtCardSignature';
import { enqueueBuild } from '../src/sim/commands';
import { DISTRICTS } from '../src/sim/data/definitions';
import { townhall } from '../src/sim/state';
import { addBuilt, freshGame, freshPresenter, fund, map } from './helpers';

describe('the district card signature', () => {
  it('holds still on a tick that changed nothing the card draws', () => {
    const game = freshPresenter();
    const th = townhall(game.state);
    const before = districtCardSignature(game, th);
    game.tick();
    expect(districtCardSignature(game, th)).toBe(before);
  });

  it('holds still while a villager trains — the queue is a live part', () => {
    const game = freshPresenter();
    fund(game.state, { Food: 1000 });
    const th = townhall(game.state);
    addBuilt(game.state, 'Housing', { x: 2, y: 0 });
    game.doTrain('Villager', th);
    const before = districtCardSignature(game, th);
    game.tick();
    expect(districtCardSignature(game, th)).toBe(before);
  });

  it('moves on a level, a crew, a build in the queue and a price crossing the purse', () => {
    const state = freshGame(); // an empty purse: the upgrade starts out short
    addBuilt(state, 'Sawmill', { x: 2, y: 0 });
    const game = freshPresenter(state);
    const mill = game.state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    const seen = new Set<string>([districtCardSignature(game, mill)]);

    mill.assignedWorkers = 1;
    seen.add(districtCardSignature(game, mill));

    mill.level = 2;
    seen.add(districtCardSignature(game, mill));

    // A rebuild the purse asks for: the upgrade turns affordable.
    fund(game.state, { Gold: 1_000_000, Wood: 1_000_000, Stone: 1_000_000 });
    seen.add(districtCardSignature(game, mill));

    // A build landing in the queue swaps the footer for scaffolding.
    expect(enqueueBuild(game.state, map, 'Housing', { x: -1, y: 0 })).toBe('Started');
    const house = game.state.city.districts.find((d) => d.definitionId === 'Housing')!;
    const queued = districtCardSignature(game, house);
    expect(queued).toContain(game.state.city.queue[0].uniqueId);

    expect(seen.size).toBe(4);
    expect(DISTRICTS.Sawmill.maxLevel).toBeGreaterThan(2); // the level move was real
  });
});

// A node small enough for the one thing LiveParts does with it.
interface FakeNode { id: number; replaced: FakeNode | null; replaceWith(n: FakeNode): void; querySelectorAll(): never[] }
let ids = 0;
const fake = (): FakeNode => {
  const n: FakeNode = {
    id: ids++,
    replaced: null,
    replaceWith(next) { n.replaced = next; },
    querySelectorAll: () => [],
  };
  return n;
};

describe('live parts', () => {
  it('rebuild a part only when its reading moves, and leave the others alone', () => {
    let clock = 0;
    let builds = 0;
    const live = new LiveParts();
    const ticking = live.add(() => String(clock), () => { builds++; return fake() as unknown as HTMLElement; });
    const still = live.add(() => 'same', () => { builds++; return fake() as unknown as HTMLElement; });
    expect(builds).toBe(2);

    live.refresh(); // nothing moved
    expect(builds).toBe(2);
    expect((ticking as unknown as FakeNode).replaced).toBeNull();

    clock = 1;
    live.refresh();
    expect(builds).toBe(3);
    expect((ticking as unknown as FakeNode).replaced).not.toBeNull();
    expect((still as unknown as FakeNode).replaced).toBeNull();

    // The swapped-in node is what the next reading compares against.
    const second = (ticking as unknown as FakeNode).replaced!;
    clock = 2;
    live.refresh();
    expect(second.replaced).not.toBeNull();
    expect(builds).toBe(4);
  });
});
