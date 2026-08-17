import { describe, expect, it } from 'vitest';
import { advanceQueue } from '../src/sim/queue';
import type { QueueItem } from '../src/sim/state';

const NOW = Date.parse('2026-08-17T12:00:00Z');

const item = (id: string, durationSeconds: number, startedAt: number | null = null): QueueItem => ({
  uniqueId: id, kind: 'build', districtUniqueId: id, durationSeconds, startedAt,
});

describe('Advance algorithm (Docs/06)', () => {
  it('completes nothing while the active item is still running', () => {
    const queue = [item('a', 60, NOW - 30_000)];
    expect(advanceQueue(queue, NOW, 1)).toEqual([]);
    expect(queue.length).toBe(1);
  });

  it('stamps an unstarted head item with now', () => {
    const queue = [item('a', 60)];
    advanceQueue(queue, NOW, 1);
    expect(queue[0].startedAt).toBe(NOW);
  });

  it('offline gap: a chain completes in true chronological order, promoted items stamped at slot-free time', () => {
    // a started 10 min ago (60s), b and c waited behind it (30s and 45s).
    const queue = [item('a', 60, NOW - 600_000), item('b', 30), item('c', 45)];
    const completed = advanceQueue(queue, NOW, 1);
    expect(completed.map((i) => i.uniqueId)).toEqual(['a', 'b', 'c']);
    const aDone = NOW - 600_000 + 60_000;
    expect(completed[1].startedAt).toBe(aDone); // b started the moment a's slot freed
    expect(completed[2].startedAt).toBe(aDone + 30_000); // c the moment b finished
    expect(queue.length).toBe(0);
  });

  it('an item promoted mid-gap that has NOT finished stays with its slot-free start time', () => {
    const queue = [item('a', 60, NOW - 70_000), item('b', 3600)];
    const completed = advanceQueue(queue, NOW, 1);
    expect(completed.map((i) => i.uniqueId)).toEqual(['a']);
    expect(queue[0].uniqueId).toBe('b');
    expect(queue[0].startedAt).toBe(NOW - 70_000 + 60_000); // slot freed 10s ago
  });

  it('duration 0 (instant Townhall upgrade) completes on the tick it starts', () => {
    const queue = [item('th', 0)];
    const completed = advanceQueue(queue, NOW, 1);
    expect(completed.map((i) => i.uniqueId)).toEqual(['th']);
  });

  it('respects the concurrency window (maxConcurrent = 2)', () => {
    const queue = [item('a', 60, NOW - 61_000), item('b', 60, NOW - 61_000), item('c', 60)];
    const completed = advanceQueue(queue, NOW, 2);
    // a and b both complete; c was promoted and is still running.
    expect(completed.map((i) => i.uniqueId).sort()).toEqual(['a', 'b']);
    expect(queue[0].uniqueId).toBe('c');
    expect(queue[0].startedAt).not.toBeNull();
  });
});
