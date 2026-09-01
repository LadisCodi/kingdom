// ScreenSlot decides when a screen is re-rendered versus rebuilt — the
// distinction the old refreshScreens() could not make, and the one that
// bottom-sheet animations, scroll preservation and listener cleanup all
// depend on. Testable in node: the slot only appends to and clears its
// container, so a stub stands in for the DOM.
import { describe, expect, it } from 'vitest';
import { ScreenSlot, type Screen } from '../src/ui/kit/host';

/** Minimal stand-in for the mount point. */
const stubContainer = () => {
  const children: unknown[] = [];
  return {
    children,
    append: (n: unknown) => { children.push(n); },
    replaceChildren: () => { children.length = 0; },
  };
};

/** A Screen that counts what happened to it. */
const spyScreen = (log: string[], name: string): Screen => ({
  root: { toString: () => name } as unknown as HTMLElement,
  refresh: () => log.push(`refresh:${name}`),
  destroy: () => log.push(`destroy:${name}`),
});

const slotWith = (container: ReturnType<typeof stubContainer>) =>
  new ScreenSlot(container as unknown as HTMLElement);

describe('ScreenSlot', () => {
  it('builds once, then only re-renders while the key holds', () => {
    const log: string[] = [];
    const container = stubContainer();
    const slot = slotWith(container);
    let built = 0;
    const create = () => { built += 1; return spyScreen(log, 'a'); };

    slot.show('a', create);
    slot.show('a', create);
    slot.show('a', create);

    expect(built).toBe(1); // the whole point: no rebuild per tick
    expect(log).toEqual(['refresh:a', 'refresh:a', 'refresh:a']);
    expect(container.children).toHaveLength(1);
  });

  it('tears the old screen down before mounting a new key', () => {
    const log: string[] = [];
    const container = stubContainer();
    const slot = slotWith(container);

    slot.show('a', () => spyScreen(log, 'a'));
    slot.show('b', () => spyScreen(log, 'b'));

    expect(log).toEqual(['refresh:a', 'destroy:a', 'refresh:b']);
    expect(container.children).toHaveLength(1); // never two at once
  });

  it('clear() destroys and empties, and is idempotent', () => {
    const log: string[] = [];
    const container = stubContainer();
    const slot = slotWith(container);

    slot.show('a', () => spyScreen(log, 'a'));
    slot.clear();
    slot.clear(); // must not destroy twice

    expect(log).toEqual(['refresh:a', 'destroy:a']);
    expect(container.children).toHaveLength(0);
  });

  it('re-shows a key after clearing by building fresh', () => {
    const log: string[] = [];
    const slot = slotWith(stubContainer());
    let built = 0;

    slot.show('a', () => { built += 1; return spyScreen(log, 'a'); });
    slot.clear();
    slot.show('a', () => { built += 1; return spyScreen(log, 'a'); });

    expect(built).toBe(2); // closing a sheet and reopening it is a remount
  });

  it('tolerates a screen with no destroy()', () => {
    const container = stubContainer();
    const slot = slotWith(container);
    const bare: Screen = { root: {} as HTMLElement, refresh: () => {} };

    slot.show('a', () => bare);
    expect(() => slot.clear()).not.toThrow();
    expect(container.children).toHaveLength(0);
  });
});
