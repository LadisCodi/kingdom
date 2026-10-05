// One slip per message (ui/toasts.ts, Docs/plans/ux-pass.md §2.11): the same
// message twice restarts the slip on screen rather than stacking a second.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastShelf, type Slip } from '../src/ui/toasts';

const LIFE = 2600;

const shelf = () => {
  const log: string[] = [];
  const toasts = new ToastShelf((msg): Slip => {
    log.push(`put ${msg}`);
    return { restart: () => log.push(`restart ${msg}`), remove: () => log.push(`remove ${msg}`) };
  }, LIFE);
  return { toasts, log };
};

describe('the toast shelf', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('restarts a message already on screen instead of adding another', () => {
    const { toasts, log } = shelf();
    toasts.show('Not enough Gold');
    toasts.show('Not enough Gold');
    expect(toasts.count).toBe(1);
    expect(log).toEqual(['put Not enough Gold', 'restart Not enough Gold']);
  });

  it('keeps a restarted slip for a whole life from the restart', () => {
    const { toasts, log } = shelf();
    toasts.show('Not enough Gold');
    vi.advanceTimersByTime(LIFE - 100);
    toasts.show('Not enough Gold');
    vi.advanceTimersByTime(LIFE - 1);
    expect(log).not.toContain('remove Not enough Gold');
    vi.advanceTimersByTime(1);
    expect(log).toContain('remove Not enough Gold');
    expect(toasts.count).toBe(0);
  });

  it('stacks different messages, and puts a gone one up afresh', () => {
    const { toasts, log } = shelf();
    toasts.show('Not enough Gold');
    toasts.show('Clear a path to it first');
    expect(toasts.count).toBe(2);
    vi.advanceTimersByTime(LIFE);
    toasts.show('Not enough Gold');
    expect(log.filter((l) => l === 'put Not enough Gold')).toHaveLength(2);
  });
});
