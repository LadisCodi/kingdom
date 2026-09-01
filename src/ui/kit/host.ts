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
      // A kit sheet carries its own dismiss in its plank. Detecting that
      // rather than listing which screens have migrated means the extra knob
      // vanishes by itself as each one does.
      const hasOwnClose = content.classList.contains('k-sheet')
        || content.querySelector('.k-sheet') !== null;
      // The knob is the SAME node every refresh, so a press survives the
      // per-tick rebuild happening underneath it.
      root.replaceChildren(...(knob && !hasOwnClose ? [content, knob] : [content]));
    },
  };
}

/** One mount point holding at most one Screen, identified by a key. */
export class ScreenSlot {
  private key: string | null = null;
  private screen: Screen | null = null;

  constructor(private readonly container: HTMLElement) {}

  /** Show the screen identified by `key`, building it only if it changed. */
  show(key: string, create: () => Screen): void {
    if (key !== this.key) {
      this.teardown();
      this.key = key;
      this.screen = create();
      this.container.append(this.screen.root);
    }
    this.screen?.refresh();
  }

  /** Nothing should occupy this mount point. */
  clear(): void {
    if (this.key === null) return;
    this.teardown();
  }

  private teardown(): void {
    this.screen?.destroy?.();
    this.container.replaceChildren();
    this.screen = null;
    this.key = null;
  }
}
