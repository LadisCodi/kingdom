// Screen hosting: which screen occupies a mount point, and when it is torn
// down rather than merely re-rendered.
//
// The problem this solves: refreshScreens() used to empty #panel and #overlay
// and rebuild them on EVERY notify() — once a second from the tick, plus every
// tap. That makes an enter animation restart every second, an exit animation
// impossible, a CSS transition never run, and scroll position reset under the
// player's finger. researchMenu.ts already carries ~45 lines of module-level
// state working around exactly that.
//
// A slot fixes it by separating two questions the old code conflated: "is this
// still the same screen?" (keep the element, re-render inside it) from "is
// this a different screen?" (tear down, build, mount). Nothing about the
// rebuild gets cleverer — only the container becomes stable.

import { tr } from '../../i18n/tr';
import { releaseSprites } from '../../render/spritePool';

/** A mounted screen. `root` must be stable for the screen's whole lifetime. */
export interface Screen {
  root: HTMLElement;
  refresh(): void;
  /** Release anything that outlives the DOM — window listeners, timers. */
  destroy?(): void;
}

/**
 * Wraps a render-everything-from-scratch function as a Screen.
 *
 * This is what lets the host land before any screen is migrated: the rebuild
 * is byte-for-byte what refreshScreens() did, just inside a stable wrapper.
 * Screens shed it one at a time by holding their own nodes instead.
 *
 * `onClose` adds a floating dismiss knob. Every legacy screen needs one now
 * that the nav bar no longer turns into a Close button — without it they
 * would be unreachable to leave. Kit sheets carry their own and pass nothing.
 *
 * `signature` is the opt-out from rebuilding at all.
 *
 * The rebuild runs on every notify() — once a second from the tick — whether
 * or not anything the screen draws has moved. For most screens that is merely
 * wasteful. For one that draws IMAGES it is visible: an `<img>` created fresh
 * each second is a new element that has to decode before its first paint, so
 * a grid of portraits blinks once a second. (It also resets `:hover` under
 * the cursor and restarts any CSS transition.)
 *
 * A screen with no time-dependent content can hand over a cheap string of
 * everything it reads. Same string, no rebuild — so the DOM, and the decoded
 * images in it, simply stay.
 *
 * **The contract is one-directional and unforgiving**: anything the render
 * reads and the signature omits will go stale on screen. Prefer a signature
 * that is coarse and automatic (a whole state module stringified) to one that
 * lists fields and rots the next time the screen grows a line.
 */
/** What a scroller is matched by across rebuilds: its name, or — for the
 *  unnamed — its position among the unnamed. */
const keepKey = (n: Element, index: number): string =>
  n.getAttribute('data-keep-scroll') || `#${index}`;

export function legacy(
  render: () => HTMLElement,
  onClose?: () => void,
  signature?: () => string,
): Screen {
  const root = document.createElement('div');
  root.className = 'legacy-screen';
  let knob: HTMLElement | undefined;
  if (onClose) {
    const b = document.createElement('button');
    b.className = 'legacy-close';
    b.type = 'button';
    b.setAttribute('aria-label', tr('Close'));
    b.textContent = '✕';
    b.addEventListener('click', onClose);
    knob = b;
  }
  let lastSignature: string | null = null;
  let built = false;
  return {
    root,
    refresh: () => {
      if (signature !== undefined) {
        const now = signature();
        // `lastSignature` starts null, which no signature can equal, so the
        // first refresh always builds.
        if (now === lastSignature) return;
        lastSignature = now;
      }
      // Rebuilding the subtree throws away scroll position, once a second,
      // which makes a scrollable screen impossible to read — you get pulled
      // back to the top mid-scroll. Containers opt in with a NAMED
      // data-keep-scroll and are matched by that name, so a screen whose
      // shape changes between two builds (a section that appears) cannot
      // hand one container's position to another. An unnamed one falls back
      // to its order. (researchMenu.ts solves the same problem with
      // module-level state; this retires the need for that.)
      const kept = [...root.querySelectorAll<HTMLElement>('[data-keep-scroll]')]
        .map((n, i) => [keepKey(n, i), n.scrollTop, n.scrollLeft] as const);

      // The old subtree's sprite nodes go back to the pool BEFORE the render
      // that will ask for them again, so the same decoded <img> moves into
      // the new tree instead of a fresh one blinking in (render/sprites.ts).
      releaseSprites(root);
      const content = render();
      // The window's entrance is keyed to elements built WHILE the mount is
      // entering. A tick can rebuild the sheet mid-entrance; the rebuilt one
      // is marked too, and the slot's --enter-offset (the time since mount,
      // as a negative delay) makes its animation carry on from where the old
      // one was rather than start over.
      if (!built || root.parentElement?.hasAttribute('data-entering') === true) {
        built = true;
        content.setAttribute('data-fresh', '');
        for (const sheet of content.querySelectorAll('.k-sheet')) sheet.setAttribute('data-fresh', '');
      }
      // A migrated screen marks its own dismiss with data-own-close.
      // Detecting that, rather than listing which screens have migrated,
      // means the host's extra knob vanishes by itself as each one does.
      const hasOwnClose = content.hasAttribute('data-own-close')
        || content.querySelector('[data-own-close]') !== null;
      // The knob is the SAME node every refresh, so a press survives the
      // per-tick rebuild happening underneath it.
      root.replaceChildren(...(knob && !hasOwnClose ? [content, knob] : [content]));

      if (kept.length > 0) {
        const now = [...root.querySelectorAll<HTMLElement>('[data-keep-scroll]')];
        const byKey = new Map(now.map((n, i) => [keepKey(n, i), n] as const));
        for (const [key, top, left] of kept) {
          const n = byKey.get(key);
          if (!n) continue;
          // Written only when it differs, so a scroller resting at the top
          // costs nothing. A rebuilt scroller is a new node and always takes
          // the one write; what an iOS fling needs is for the NODE to
          // survive the tick, which is the district card's own migration
          // (build once, mutate) and not something the host can give it.
          if (n.scrollTop !== top) n.scrollTop = top;
          if (n.scrollLeft !== left) n.scrollLeft = left;
        }
      }
    },
  };
}

/** How long a scroller must be still before a held rebuild may run: long
 *  enough to span the gaps between a fling's or a snap's scroll events. */
const SETTLE_MS = 150;

/**
 * Holds a screen's rebuilds while one of its scrollers (`data-keep-scroll`)
 * is in a hand — pressed, dragged, or still coasting from a fling — and runs
 * the last one held once it is still. A rebuild replaces the scroller, and a
 * phone drops a drag along with the node it started on; resources landing
 * while the player browses must not cut the gesture.
 *
 * The listeners sit on the stable root (and on window for the release, which
 * may land outside it), so they outlive every rebuild.
 */
export function holdWhileScrolling(screen: Screen): Screen {
  const { root } = screen;
  let pressed = false;
  let touched = false;
  let settle: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  const busy = () => pressed || touched || settle !== null;
  const flush = () => {
    if (!pending || busy()) return;
    pending = false;
    screen.refresh();
  };
  const inScroller = (e: Event) =>
    (e.target as Element | null)?.closest?.('[data-keep-scroll]') != null;

  const onPointerDown = (e: PointerEvent) => {
    // A touch is followed by its own touch events, which keep going once the
    // browser takes the gesture over for scrolling (the pointer is cancelled).
    if (e.pointerType !== 'touch' && inScroller(e)) pressed = true;
  };
  const onTouchStart = (e: TouchEvent) => { if (inScroller(e)) touched = true; };
  const onScroll = (e: Event) => {
    if (!inScroller(e)) return;
    if (settle !== null) clearTimeout(settle);
    settle = setTimeout(() => { settle = null; flush(); }, SETTLE_MS);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !pressed) return;
    pressed = false;
    flush();
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!touched || e.touches.length > 0) return;
    touched = false;
    flush();
  };

  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  // Scroll does not bubble; the capture phase still sees it.
  root.addEventListener('scroll', onScroll, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  window.addEventListener('touchend', onTouchEnd, true);
  window.addEventListener('touchcancel', onTouchEnd, true);

  return {
    root,
    refresh: () => {
      if (busy()) { pending = true; return; }
      pending = false;
      screen.refresh();
    },
    destroy: () => {
      if (settle !== null) clearTimeout(settle);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchEnd, true);
      screen.destroy?.();
    },
  };
}

/**
 * How long `data-entering` stays on the container: the window's whole
 * entrance (the frame growing, then the contents fading in — kit.css's
 * `k-window-in`), so it is never cut off mid-flight.
 */
const ENTER_MS = 260;
/**
 * How long a closed window stays on screen to play its exit (`k-window-out`:
 * the contents fade, then the frame shrinks and fades) before it is removed.
 */
const LEAVE_MS = 220;

/** A window worth animating out: a kit sheet, or the district card. */
const hasWindow = (root: HTMLElement): boolean =>
  root.querySelector('.k-sheet, .dc') !== null || root.matches('.dc');

/** One mount point holding at most one Screen, identified by a key. */
export class ScreenSlot {
  private key: string | null = null;
  private screen: Screen | null = null;
  // Not `window.setTimeout`: this module has to import under node so the
  // slot stays testable without a DOM.
  private enterTimer: ReturnType<typeof setTimeout> | null = null;
  private mountedAt = 0;
  /** A closed window still playing its exit, and the timer that removes it. */
  private leaving: { root: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(private readonly container: HTMLElement) {}

  /** Show the screen identified by `key`, building it only if it changed. */
  show(key: string, create: () => Screen): void {
    if (key !== this.key) {
      // Another screen replaces this one outright — no exit, or two windows
      // would share the mount — and one still leaving goes at once.
      this.dropLeaving();
      this.teardown();
      this.key = key;
      this.screen = create();
      this.container.append(this.screen.root);
      this.markEntering();
    }
    // While entering, the time since mount, as a negative delay: an element
    // the refresh rebuilds picks the entrance up where the last one was.
    if (this.container.hasAttribute('data-entering')) {
      this.container.style.setProperty('--enter-offset', `${-(Date.now() - this.mountedAt)}ms`);
    }
    this.screen?.refresh();
  }

  /**
   * Nothing should occupy this mount point. A window leaves on its own
   * animation: its nodes stay, frozen and marked `data-leaving`, for LEAVE_MS,
   * then go. (The screen itself is destroyed at once — nothing refreshes it.)
   */
  clear(): void {
    if (this.key === null) return;
    const root = this.screen?.root ?? null;
    const animate = root !== null && hasWindow(root);
    if (!animate) {
      this.teardown();
      return;
    }
    this.dropLeaving();
    this.teardown(root);
    root.setAttribute('data-leaving', '');
    this.leaving = {
      root,
      timer: setTimeout(() => this.dropLeaving(), LEAVE_MS),
    };
  }

  private dropLeaving(): void {
    if (this.leaving === null) return;
    clearTimeout(this.leaving.timer);
    this.leaving.root.remove();
    this.leaving = null;
  }

  /**
   * Flag the container as freshly mounted, briefly, so CSS can run an enter
   * animation exactly once.
   *
   * The animation cannot live on the screen's own element: a legacy screen
   * rebuilds its whole subtree on every refresh — once a second from the
   * tick — so that element is new each time and its animation restarts,
   * which is precisely the "sheet keeps replaying its slide-in" bug. The
   * MOUNT is what this class knows about, so the mount is what carries the
   * flag. It self-clears, so a rebuild after the window is unaffected.
   */
  private markEntering(): void {
    this.mountedAt = Date.now();
    this.container.style.setProperty('--enter-offset', '0ms');
    this.container.setAttribute('data-entering', '');
    if (this.enterTimer !== null) clearTimeout(this.enterTimer);
    this.enterTimer = setTimeout(() => {
      this.container.removeAttribute('data-entering');
      this.enterTimer = null;
    }, ENTER_MS);
  }

  /** Tear the current screen down; `keep` is a node to leave in the mount. */
  private teardown(keep: HTMLElement | null = null): void {
    if (this.enterTimer !== null) {
      clearTimeout(this.enterTimer);
      this.enterTimer = null;
    }
    this.container.removeAttribute('data-entering');
    this.screen?.destroy?.();
    if (keep === null) this.container.replaceChildren();
    else for (const n of [...this.container.childNodes]) if (n !== keep) n.remove();
    this.screen = null;
    this.key = null;
  }
}
