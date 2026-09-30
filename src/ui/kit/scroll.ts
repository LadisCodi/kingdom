// A sideways row that scrolls the way a phone player expects it to, on every
// input: a finger drags it natively (the row is overflow-x: auto), and this
// adds the two a desktop browser leaves out — the wheel, which only scrolls
// vertically, and a mouse drag, which only selects.

/** Pixels a mouse must travel before a press becomes a drag, not a tap. */
const DRAG_SLOP = 6;

/**
 * Makes `row` scroll sideways under the wheel and a mouse drag. A drag that
 * moved swallows the click it ends in, so letting go over a card does not
 * pick it. Touch and pen are left to the browser's own scrolling.
 */
export function sideScroll(row: HTMLElement): HTMLElement {
  row.addEventListener('wheel', (e) => {
    // A trackpad's own sideways swipe already scrolls; only a vertical
    // wheel needs turning.
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (row.scrollWidth <= row.clientWidth) return;
    e.preventDefault();
    const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? row.clientWidth : 1;
    row.scrollLeft += e.deltaY * unit;
  }, { passive: false });

  let press: { id: number; x: number; left: number } | null = null;
  let dragged = false;
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    press = { id: e.pointerId, x: e.clientX, left: row.scrollLeft };
    dragged = false;
  });
  row.addEventListener('pointermove', (e) => {
    if (press === null || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    if (!dragged) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      dragged = true;
      row.setPointerCapture(e.pointerId);
      // Snap would fight the hand on every frame; it comes back on release
      // and settles the row on a card.
      row.classList.add('is-dragging');
    }
    row.scrollLeft = press.left - dx;
  });
  const release = (e: PointerEvent) => {
    if (press === null || e.pointerId !== press.id) return;
    press = null;
    row.classList.remove('is-dragging');
  };
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', release);
  // Capture phase, so the card's own click handler never hears it.
  row.addEventListener('click', (e) => {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  return row;
}
