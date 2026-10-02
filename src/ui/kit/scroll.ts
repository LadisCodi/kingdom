// Everything in the UI that scrolls, scrolls the way a phone player expects
// it to, on every input. A finger drags it natively — every scroller is
// `overflow: auto`, and nothing above the map sets `touch-action` — so this
// adds the two a desktop browser leaves out: a MOUSE DRAG, which would only
// select (`dragToScroll`, once, over the whole UI), and the WHEEL on a
// sideways row, which would only scroll vertically (`sideScroll`).

/** Pixels a mouse must travel before a press becomes a drag, not a tap. */
const DRAG_SLOP = 6;

/** Presses that are never a drag: they mean what they say. */
const NOT_A_DRAG = 'input, textarea, select, [contenteditable], [data-no-drag-scroll]';

type Axis = 'x' | 'y';

/** Can `node` scroll along `axis` right now — styled to, with somewhere to go? */
function scrolls(node: HTMLElement, axis: Axis): boolean {
  const style = getComputedStyle(node);
  return axis === 'x'
    ? /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1
    : /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
}

/** The nearest scroller along `axis` from `from` up to `root`, if any. */
function scrollerAlong(from: Element, root: HTMLElement, axis: Axis): HTMLElement | null {
  for (let n: Element | null = from; n !== null; n = n.parentElement) {
    if (n instanceof HTMLElement && scrolls(n, axis)) return n;
    if (n === root) break;
  }
  return null;
}

/**
 * A MOUSE DRAG SCROLLS whatever it starts in, inside `root` — a list, a
 * sheet's body, a row of cards. The scroller is the nearest one along the
 * way the hand first moves (a row inside a list goes sideways, the list
 * up and down), else the nearest along the other. A press that never
 * travels is a tap, untouched; one that dragged swallows the click it ends
 * in, so letting go over a card does not pick it. Touch and pen are left to
 * the browser's own scrolling.
 */
export function dragToScroll(root: HTMLElement): void {
  let press: { id: number; x: number; y: number; from: Element } | null = null;
  let held: { node: HTMLElement; left: number; top: number; x: boolean; y: boolean } | null = null;
  let dragged = false;

  root.addEventListener('pointerdown', (e) => {
    dragged = false;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const from = e.target;
    if (!(from instanceof Element) || from.closest(NOT_A_DRAG) !== null) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, from };
    held = null;
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (press === null || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (held === null) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      const first: Axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      const node = scrollerAlong(press.from, root, first)
        ?? scrollerAlong(press.from, root, first === 'x' ? 'y' : 'x');
      // Nothing to scroll under it: the press stays whatever it was.
      if (node === null) { press = null; return; }
      held = { node, left: node.scrollLeft, top: node.scrollTop, x: scrolls(node, 'x'), y: scrolls(node, 'y') };
      dragged = true;
      node.setPointerCapture(e.pointerId);
      // A snap would fight the hand on every frame; it comes back on release
      // and settles the row on a card.
      node.classList.add('is-dragging');
    }
    if (held.x) held.node.scrollLeft = held.left - dx;
    if (held.y) held.node.scrollTop = held.top - dy;
  });

  const release = (e: PointerEvent): void => {
    if (press === null || e.pointerId !== press.id) return;
    press = null;
    held?.node.classList.remove('is-dragging');
    held = null;
    // The click that ends a drag fires straight after this; a drag released
    // where no click follows must not eat the next one.
    if (dragged) setTimeout(() => { dragged = false; }, 0);
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Capture phase, so the card's own click handler never hears it.
  window.addEventListener('click', (e) => {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // A picture under the press would otherwise be picked up and dragged.
  root.addEventListener('dragstart', (e) => { if (press !== null) e.preventDefault(); });
}

/**
 * Makes `row` scroll sideways under a vertical wheel. A trackpad's own
 * sideways swipe already scrolls; the mouse drag is `dragToScroll`'s.
 */
export function sideScroll(row: HTMLElement): HTMLElement {
  row.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (row.scrollWidth <= row.clientWidth) return;
    e.preventDefault();
    const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? row.clientWidth : 1;
    row.scrollLeft += e.deltaY * unit;
  }, { passive: false });
  return row;
}
