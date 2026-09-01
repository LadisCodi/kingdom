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
 */
export function legacy(render: () => HTMLElement, onClose?: () => void): Screen {
  const root = document.createElement('div');
  root.className = 'legacy-screen';
  let knob: HTMLElement | undefined;
  if (onClose) {
    const b = document.createElement('button');
    b.className = 'legacy-close';
    b.type = 'button';
    b.setAttribute('aria-label', 'Close');
    b.textContent = '✕';
    b.addEventListener('click', onClose);
    knob = b;
  }
  return {
    root,
    refresh: () => {
      const content = render();
      // A migrated screen marks its own dismiss with data-own-close.
      // Detecting that, rather than listing which screens have migrated,
      // means the host's extra knob vanishes by itself as each one does.
      const hasOwnClose = content.hasAttribute('data-own-close')
        || content.querySelector('[data-own-close]') !== null;
      // The knob is the SAME node every refresh, so a press survives the
      // per-tick rebuild happening underneath it.
      root.replaceChildren(...(knob && !hasOwnClose ? [content, knob] : [content]));
    },
  };
}

/**
 * How long `data-entering` stays on the container. Slightly longer than
 * --motion-sheet so the animation is never cut off mid-flight.
 */
const ENTER_MS = 240;

/** One mount point holding at most one Screen, identified by a key. */
export class ScreenSlot {
  private key: string | null = null;
  private screen: Screen | null = null;
  // Not `window.setTimeout`: this module has to import under node so the
  // slot stays testable without a DOM.
  private enterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly container: HTMLElement) {}

  /** Show the screen identified by `key`, building it only if it changed. */
  show(key: string, create: () => Screen): void {
    if (key !== this.key) {
      this.teardown();
      this.key = key;
      this.screen = create();
      this.container.append(this.screen.root);
      this.markEntering();
    }
    this.screen?.refresh();
  }

  /** Nothing should occupy this mount point. */
  clear(): void {
    if (this.key === null) return;
    this.teardown();
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
    this.container.setAttribute('data-entering', '');
    if (this.enterTimer !== null) clearTimeout(this.enterTimer);
    this.enterTimer = setTimeout(() => {
      this.container.removeAttribute('data-entering');
      this.enterTimer = null;
    }, ENTER_MS);
  }

  private teardown(): void {
    if (this.enterTimer !== null) {
      clearTimeout(this.enterTimer);
      this.enterTimer = null;
    }
    this.container.removeAttribute('data-entering');
    this.screen?.destroy?.();
    this.container.replaceChildren();
    this.screen = null;
    this.key = null;
  }
}
