// ScreenSlot decides when a screen is re-rendered versus rebuilt — the
// distinction the old refreshScreens() could not make, and the one that
// bottom-sheet animations, scroll preservation and listener cleanup all
// depend on. Testable in node: the slot only appends to and clears its
// container, so a stub stands in for the DOM.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenSlot, type Screen } from '../src/ui/kit/host';

/** Minimal stand-in for the mount point, including the attribute the enter
 *  animation is keyed to. */
const stubContainer = () => {
  const children: unknown[] = [];
  const attrs = new Map<string, string>();
  const vars = new Map<string, string>();
  return {
    children,
    attrs,
    vars,
    get childNodes() { return children; },
    append: (n: unknown) => {
      children.push(n);
      // A root knows its mount, so it can take itself out of it.
      (n as { remove?: () => void }).remove = () => {
        const i = children.indexOf(n);
        if (i >= 0) children.splice(i, 1);
      };
    },
    replaceChildren: () => { children.length = 0; },
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
    removeAttribute: (k: string) => { attrs.delete(k); },
    hasAttribute: (k: string) => attrs.has(k),
    style: { setProperty: (k: string, v: string) => { vars.set(k, v); } },
  };
};

/** A screen root; `windowed` roots hold a sheet, so they animate out. */
const stubRoot = (name: string, windowed = false) => {
  const attrs = new Map<string, string>();
  return {
    attrs,
    toString: () => name,
    querySelector: () => (windowed ? {} : null),
    matches: () => false,
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
  };
};

/** A Screen that counts what happened to it. */
const spyScreen = (log: string[], name: string, windowed = false): Screen => ({
  root: stubRoot(name, windowed) as unknown as HTMLElement,
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
    const bare: Screen = { root: stubRoot('bare') as unknown as HTMLElement, refresh: () => {} };

    slot.show('a', () => bare);
    expect(() => slot.clear()).not.toThrow();
    expect(container.children).toHaveLength(0);
  });

  // A legacy screen rebuilds its whole subtree every tick, so an enter
  // animation keyed to the screen's own element replays once a second for as
  // long as the sheet is open — which is exactly what it looked like. The
  // flag belongs to the MOUNT, and has to clear itself.
  describe('the enter flag', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('is set on mount and clears itself', () => {
      vi.useFakeTimers();
      const container = stubContainer();
      const slot = slotWith(container);

      slot.show('a', () => spyScreen([], 'a'));
      expect(container.attrs.has('data-entering')).toBe(true);

      vi.advanceTimersByTime(800);
      expect(container.attrs.has('data-entering')).toBe(false);
    });

    it('is NOT re-set by a refresh of the same screen', () => {
      vi.useFakeTimers();
      const container = stubContainer();
      const slot = slotWith(container);
      const create = () => spyScreen([], 'a');

      slot.show('a', create);
      vi.advanceTimersByTime(800);
      slot.show('a', create); // the per-tick refresh
      slot.show('a', create);

      expect(container.attrs.has('data-entering')).toBe(false);
    });

    it('is set again for a genuinely different screen', () => {
      vi.useFakeTimers();
      const container = stubContainer();
      const slot = slotWith(container);

      slot.show('a', () => spyScreen([], 'a'));
      vi.advanceTimersByTime(800);
      slot.show('b', () => spyScreen([], 'b'));

      expect(container.attrs.has('data-entering')).toBe(true);
    });

    it('drops the flag when the slot is cleared mid-animation', () => {
      vi.useFakeTimers();
      const container = stubContainer();
      const slot = slotWith(container);

      slot.show('a', () => spyScreen([], 'a'));
      slot.clear();

      expect(container.attrs.has('data-entering')).toBe(false);
    });
  });

  // A window closing back to the map plays its exit before it goes: the
  // screen is destroyed at once (nothing refreshes it), but its nodes stay in
  // the mount, marked data-leaving, until the exit has run.
  describe('the exit', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('keeps a closed window in the mount, marked, until its exit has played', () => {
      vi.useFakeTimers();
      const log: string[] = [];
      const container = stubContainer();
      const slot = slotWith(container);
      slot.show('a', () => spyScreen(log, 'a', true));
      const root = container.children[0] as ReturnType<typeof stubRoot>;

      slot.clear();
      expect(log).toEqual(['refresh:a', 'destroy:a']);
      expect(container.children).toEqual([root]);
      expect(root.attrs.has('data-leaving')).toBe(true);

      vi.advanceTimersByTime(700);
      expect(container.children).toHaveLength(0);
    });

    it('goes at once when another screen takes the mount, so two never share it', () => {
      vi.useFakeTimers();
      const container = stubContainer();
      const slot = slotWith(container);
      slot.show('a', () => spyScreen([], 'a', true));
      slot.clear();
      slot.show('b', () => spyScreen([], 'b', true));

      expect(container.children.map(String)).toEqual(['b']);
    });

    it('leaves a screen with no window without an exit', () => {
      const container = stubContainer();
      const slot = slotWith(container);
      slot.show('a', () => spyScreen([], 'a'));
      slot.clear();
      expect(container.children).toHaveLength(0);
    });
  });

  // While the mount is entering, a refresh publishes how long ago it
  // mounted, as a negative delay: an element the refresh rebuilds then picks
  // the entrance up where its predecessor was instead of starting over.
  it('publishes the time since mount while entering', () => {
    vi.useFakeTimers();
    const container = stubContainer();
    const slot = slotWith(container);
    slot.show('a', () => spyScreen([], 'a', true));
    expect(container.vars.get('--enter-offset')).toBe('0ms');
    vi.advanceTimersByTime(250);
    slot.show('a', () => spyScreen([], 'a', true));
    expect(container.vars.get('--enter-offset')).toBe('-250ms');
    vi.useRealTimers();
  });

  // NOTE: legacy()'s scroll preservation is not unit-tested here — it calls
  // document.createElement, so it needs a real DOM, and stubbing that deeply
  // would test the stub rather than the code. Verified in the browser instead.
});
