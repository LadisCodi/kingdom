// Speed-ups (Docs/plans/relics-and-bag.md, step 2): Bag items that take time
// off a running timer at `now`, never giving time away.

import { describe, expect, it } from 'vitest';
import { lineFor, trainUnit } from '../src/sim/army';
import { grantItem, itemCount } from '../src/sim/bag';
import { advance, changeWorkers } from '../src/sim/commands';
import { ITEMS } from '../src/sim/data/definitions';
import { getGood } from '../src/sim/goods';
import { deserialize, serialize } from '../src/sim/save';
import {
  autoPlan, jobRemainingSeconds, speedupsFor, useAuto, useSpeedup, type SpeedJob,
} from '../src/sim/speedups';
import { completesAt, townhall, type GameState, type ItemId } from '../src/sim/state';
import { queueGood } from '../src/sim/workshops';
import { rand } from '../src/sim/rng';
import { addBuilt, freshGame, freshPresenter, fund, map, T0 } from './helpers';
import { SEAT_INDICES } from '../src/sim/world/board';
import { boardNeighbors, PORTAL_INDEX } from '../src/sim/world/hex';
import { dispatchExplorer, homeIndex, readyAt, returnsAt } from '../src/sim/world/explorers';
import { homeboundMs } from '../src/sim/world/travel';
import { hasBit } from '../src/sim/world/fogBits';
import { claim, emptyWorld, hurry, join } from '../src/worldServer/core';

const MIN = 60_000;

/** A Housing being raised to level 2, started at `at`, `seconds` long. */
function raising(seconds = 3600, at = T0): { state: GameState; job: SpeedJob } {
  const state = freshGame();
  advance(state, map, at);
  addBuilt(state, 'Housing', { x: 2, y: 0 });
  const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
  state.city.queue.push({
    uniqueId: 'q1', kind: 'upgrade', districtUniqueId: house.uniqueId, targetLevel: 2,
    durationSeconds: seconds, startedAt: at,
  });
  return { state, job: { kind: 'queue', itemId: 'q1' } };
}

const levelOf = (state: GameState, id: string) =>
  state.city.districts.find((d) => d.uniqueId === id)!.level;

describe('a speed-up on a build', () => {
  it('moves the end, not the start, and leaves it running', () => {
    const { state, job } = raising(3600);
    grantItem(state, 'ConstructionSpeedup15m', 1);
    expect(useSpeedup(state, map, job, 'ConstructionSpeedup15m', 1, T0 + 10 * MIN)).toBe('Used');
    const item = state.city.queue[0];
    expect(item.startedAt).toBe(T0);
    expect(completesAt(item)).toBe(T0 + 45 * MIN);
    expect(jobRemainingSeconds(state, job, T0 + 10 * MIN)).toBe(35 * 60);
    expect(itemCount(state, 'ConstructionSpeedup15m')).toBe(0);
  });

  it('finishes it NOW when it is bigger than the wait, and the next build starts now', () => {
    const { state, job } = raising(3600);
    const house = state.city.queue[0].districtUniqueId;
    addBuilt(state, 'Housing', { x: 3, y: 0 });
    const second = state.city.districts.filter((d) => d.definitionId === 'Housing')[1];
    state.city.queue.push({
      uniqueId: 'q2', kind: 'upgrade', districtUniqueId: second.uniqueId, targetLevel: 2,
      durationSeconds: 600, startedAt: null,
    });
    grantItem(state, 'GeneralSpeedup1h', 1);
    const now = T0 + 20 * MIN;
    useSpeedup(state, map, job, 'GeneralSpeedup1h', 1, now);
    expect(levelOf(state, house)).toBe(2);
    expect(state.city.queue.map((q) => q.uniqueId)).toEqual(['q2']);
    expect(state.city.queue[0].startedAt).toBe(now);
  });

  it('refuses a speed-up of another kind, and a build that is not running', () => {
    const { state, job } = raising();
    grantItem(state, 'TrainingSpeedup1h', 1);
    expect(useSpeedup(state, map, job, 'TrainingSpeedup1h', 1, T0)).toBe('DoesNotFit');
    state.city.queue[0].startedAt = null;
    grantItem(state, 'GeneralSpeedup1m', 1);
    expect(useSpeedup(state, map, job, 'GeneralSpeedup1m', 1, T0)).toBe('NothingRunning');
    expect(itemCount(state, 'GeneralSpeedup1m')).toBe(1);
  });

  it('is offered typed first, then General, smallest first', () => {
    const { state, job } = raising();
    for (const id of ['GeneralSpeedup5m', 'ConstructionSpeedup1h', 'GeneralSpeedup1m', 'ConstructionSpeedup1m', 'WorkshopSpeedup1m'] as ItemId[]) {
      grantItem(state, id, 1);
    }
    expect(speedupsFor(state, job)).toEqual(
      ['ConstructionSpeedup1m', 'ConstructionSpeedup1h', 'GeneralSpeedup1m', 'GeneralSpeedup5m']);
  });

  // THE GATE: a speed-up is a command at `now`. Whatever the replay around it
  // does — one call, or a tick a minute — the build ends at the same instant.
  it('ends at the same instant whether the time around it is replayed in one call or stepped', () => {
    const run = (stepped: boolean) => {
      const { state, job } = raising(4 * 3600);
      const house = state.city.queue[0].districtUniqueId;
      grantItem(state, 'ConstructionSpeedup1h', 2);
      const useAt = T0 + 30 * MIN;
      if (stepped) for (let t = T0 + MIN; t <= useAt; t += MIN) advance(state, map, t);
      else advance(state, map, useAt);
      useSpeedup(state, map, job, 'ConstructionSpeedup1h', 2, useAt);
      const end = completesAt(state.city.queue[0]);
      const after = T0 + 3 * 3600_000;
      if (stepped) for (let t = useAt + MIN; t <= after; t += MIN) advance(state, map, t);
      else advance(state, map, after);
      return { end, level: levelOf(state, house), queue: state.city.queue.length, gold: state.city.wallet.Gold };
    };
    const live = run(true);
    const replay = run(false);
    expect(live.end).toBe(T0 + 2 * 3600_000);
    expect(replay).toEqual(live);
    expect(live.level).toBe(2);
  });
});

describe('a speed-up on a training line', () => {
  it('runs on through the line, delivering what it finishes now', () => {
    const state = freshGame();
    advance(state, map, T0);
    fund(state, { Food: 100_000, Gold: 100_000, Wood: 100_000 });
    townhall(state).level = 3;
    for (let x = 2; x <= 4; x++) addBuilt(state, 'Housing', { x, y: 0 });
    const hall = townhall(state).uniqueId;
    for (let i = 0; i < 3; i++) expect(trainUnit(state, 'Villager', T0, townhall(state))).toBe('Queued');
    advance(state, map, T0 + 1000);
    const job: SpeedJob = { kind: 'training', buildingId: hall };
    const before = state.city.population;
    const total = jobRemainingSeconds(state, job, T0 + 1000)!;
    grantItem(state, 'TrainingSpeedup24h', 1);
    expect(total).toBeLessThan(86_400);
    useSpeedup(state, map, job, 'TrainingSpeedup24h', 1, T0 + 1000);
    expect(state.city.population).toBe(before + 3);
    expect(lineFor(state, hall)).toEqual([]);
    expect(jobRemainingSeconds(state, job, T0 + 1000)).toBeNull();
  });
});

describe('a speed-up on a workshop', () => {
  it('adds the crew\'s work for that long, and hands a finished item over now', () => {
    const state = freshGame();
    advance(state, map, T0);
    addBuilt(state, 'Carpenter', { x: 3, y: 3 });
    const shop = state.city.districts.find((d) => d.definitionId === 'Carpenter')!;
    state.city.population = 1;
    expect(changeWorkers(state, map, shop.uniqueId, 1, T0)).toBe('Assigned');
    fund(state, { Wood: 10_000, Stone: 10_000, Gold: 100_000 });
    expect(queueGood(state, shop.uniqueId, T0)).toBe('Queued');
    const job: SpeedJob = { kind: 'workshop', districtId: shop.uniqueId };
    const left = jobRemainingSeconds(state, job, T0)!;
    grantItem(state, 'WorkshopSpeedup5m', 1);
    useSpeedup(state, map, job, 'WorkshopSpeedup5m', 1, T0);
    expect(jobRemainingSeconds(state, job, T0)).toBeCloseTo(left - 300, 0);
    grantItem(state, 'GeneralSpeedup24h', 1);
    useSpeedup(state, map, job, 'GeneralSpeedup24h', 1, T0);
    expect(getGood(state.city.goods, 'Planks')).toBe(1);
    expect(jobRemainingSeconds(state, job, T0)).toBeNull();
  });
});

describe('Auto', () => {
  it('takes the one item that covers the wait over a pile of small ones', () => {
    const { state, job } = raising(50 * 60);
    grantItem(state, 'GeneralSpeedup1h', 1);
    grantItem(state, 'ConstructionSpeedup15m', 3);
    expect(autoPlan(state, job, T0)).toEqual([{ id: 'GeneralSpeedup1h', n: 1 }]);
  });

  it('spends everything held when nothing finishes it', () => {
    const { state, job } = raising(8 * 3600);
    grantItem(state, 'ConstructionSpeedup1h', 2);
    expect(autoPlan(state, job, T0)).toEqual([{ id: 'ConstructionSpeedup1h', n: 2 }]);
    expect(useAuto(state, map, job, T0)).toBe('Used');
    expect(completesAt(state.city.queue[0])).toBe(T0 + 6 * 3600_000);
  });

  // THE GATE: whatever is held, Auto finishes the job when it can, and never
  // overshoots by as much as the smallest item it spends.
  it('never wastes more than the smallest item it uses', () => {
    const speedups = (Object.keys(ITEMS) as ItemId[]).filter((id) =>
      ITEMS[id].kind === 'speedup' && (ITEMS[id].speeds === 'General' || ITEMS[id].speeds === 'Construction'));
    for (let trial = 0; trial < 200; trial++) {
      const seconds = 60 + Math.floor(rand(7, trial, 'wait') * 2 * 86_400);
      const { state, job } = raising(seconds);
      for (const id of speedups) {
        const n = Math.floor(rand(7, trial, id) * 4);
        if (n > 0) grantItem(state, id, n);
      }
      const plan = autoPlan(state, job, T0);
      const spent = plan.reduce((s, p) => s + ITEMS[p.id].seconds * p.n, 0);
      const held = speedupsFor(state, job).reduce((s, id) => s + ITEMS[id].seconds * itemCount(state, id), 0);
      if (held < seconds) {
        expect(spent, `trial ${trial}`).toBe(held);
        continue;
      }
      expect(spent, `trial ${trial}`).toBeGreaterThanOrEqual(seconds);
      const smallest = Math.min(...plan.map((p) => ITEMS[p.id].seconds));
      expect(spent - seconds, `trial ${trial}`).toBeLessThan(smallest);
    }
  });
});

describe('a cut survives a save', () => {
  it('reads back the end it was moved to', () => {
    const { state, job } = raising(3600);
    grantItem(state, 'ConstructionSpeedup15m', 1);
    useSpeedup(state, map, job, 'ConstructionSpeedup15m', 1, T0);
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(completesAt(back.city.queue[0])).toBe(T0 + 45 * MIN);
  });
});

describe('the Speed-up picker', () => {
  it('opens over the card, spends in place, and closes back to it when the build is done', () => {
    const { state } = raising(3600);
    const game = freshPresenter(state);
    game.now = () => T0 + 10 * MIN;
    const house = state.city.queue[0].districtUniqueId;
    game.inspectedDistrictId = house;
    const job: SpeedJob = { kind: 'queue', itemId: 'q1' };
    expect(game.hasSpeedups(job)).toBe(false);
    grantItem(state, 'ConstructionSpeedup15m', 2);
    grantItem(state, 'GeneralSpeedup1h', 1);
    expect(game.hasSpeedups(job)).toBe(true);
    game.openSpeedup(job);
    expect(game.openOverlay).toBe('speedup');
    expect(game.inspectedDistrictId).toBe(house);
    const view = game.speedupScreen()!;
    expect(view.left).toBe(50 * 60);
    expect(view.rows.map((r) => r.id)).toEqual(['ConstructionSpeedup15m', 'GeneralSpeedup1h']);
    expect(view.auto).toEqual([{ id: 'GeneralSpeedup1h', n: 1 }]);
    game.doSpeedup('ConstructionSpeedup15m');
    expect(game.speedupScreen()!.left).toBe(35 * 60);
    game.doAutoSpeedup();
    expect(state.city.queue).toEqual([]);
    expect(game.openOverlay).toBeNull();
    expect(game.inspectedDistrictId).toBe(house);
  });

  it('goes back to the Bag when the Bag opened it', () => {
    const { state } = raising(3600);
    const game = freshPresenter(state);
    game.now = () => T0;
    grantItem(state, 'GeneralSpeedup5m', 1);
    game.setOverlay('bag');
    const job = game.firstJobFor('GeneralSpeedup5m')!;
    expect(job).toEqual({ kind: 'queue', itemId: 'q1' });
    game.openSpeedup(job);
    game.closeSpeedup();
    expect(game.openOverlay).toBe('bag');
  });

  it('goes back to a hex sheet with its hex still chosen', () => {
    const { state, job } = raising(3600);
    const game = freshPresenter(state);
    game.now = () => T0;
    game.selectedHex = 7;
    game.setOverlay('world');
    game.openSpeedup(job);
    expect(game.selectedHex).toBe(7);
    game.closeSpeedup();
    expect(game.openOverlay).toBe('world');
    expect(game.selectedHex).toBe(7);
  });
});

describe('a speed-up on the world', () => {
  it('moves a claim on the server, and one that covers it finishes it there', () => {
    const { board: b, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'r', seed: 3, seat: 0 } }, T0);
    for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
    const via = boardNeighbors(SEAT_INDICES[0])[0];
    const claimed = claim(b, seat, via, T0);
    expect(claimed.ok).toBe(true);
    const end = claimed.ok ? claimed.finishesAt : 0;
    const r = hurry(b, seat, via, 600, T0 + 1000);
    expect(r.ok && r.finishesAt).toBe(end - 600_000);
    expect(b.hexes[via].standsAt).toBe(end - 600_000);
    const done = hurry(b, seat, via, 86_400, T0 + 2000);
    expect(done.ok && done.finishesAt).toBe(T0 + 2000);
    expect(b.hexes[via].standsAt).toBe(T0 + 2000);
    expect(hurry(b, seat, via, 60, T0 + 3000)).toEqual({ ok: false, why: 'NothingBuilding' });
  });

  it('hurries an explorer\'s work — revealing its hex when it covers it — then its road home', () => {
    const state = freshGame();
    fund(state, { Gold: 1e9 });
    const target = boardNeighbors(homeIndex(state)).find((n) => n !== PORTAL_INDEX)!;
    const r = dispatchExplorer(state, target, T0);
    if (r.kind !== 'Sent') throw new Error(r.kind);
    const trip = state.world.explorers[0];
    const job: SpeedJob = { kind: 'explorer', tripId: r.trip.id };
    const done = readyAt(trip);
    grantItem(state, 'GeneralSpeedup1m', 2);
    grantItem(state, 'ConstructionSpeedup1h', 1);
    expect(useSpeedup(state, map, job, 'ConstructionSpeedup1h', 1, T0)).toBe('DoesNotFit');
    expect(useSpeedup(state, map, job, 'GeneralSpeedup1m', 1, T0)).toBe('Used');
    expect(readyAt(trip)).toBe(done - MIN);
    grantItem(state, 'GeneralSpeedup24h', 2);
    useSpeedup(state, map, job, 'GeneralSpeedup24h', 1, T0);
    expect(hasBit(state.world.revealed, target)).toBe(true);
    expect(trip.revealedAt).toBe(T0);
    // Finished, it is on its road home — and that can be hurried too.
    expect(useSpeedup(state, map, job, 'GeneralSpeedup1m', 1, T0)).toBe('Used');
    expect(returnsAt(trip)).toBe(T0 + homeboundMs(trip.stepMs) - MIN);
    useSpeedup(state, map, job, 'GeneralSpeedup24h', 1, T0);
    expect(state.world.explorers).toEqual([]);
  });
});
