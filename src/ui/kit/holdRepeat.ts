// HOLD TO REPEAT — a button that, held down, presses itself: slowly at first,
// then faster, up to a ceiling. A tap stays exactly one press.
//
// THE HOLD BELONGS TO A KEY, NOT TO A NODE. The press it repeats usually
// changes what the screen shows — a Train adds to the line, and the card is
// rebuilt with a fresh button under the finger. So the loop lives here, keyed
// by what the button does, and a button built while its key is held simply
// joins it: it is drawn pushed in, and the release that ends the hold is the
// window's, wherever the finger is by then.
//
// A finger that moves is scrolling, not holding: past a few pixels the hold
// ends. A press that is refused ends it too — the callback says so.

/** How a hold speeds up. UI feel, not balance: these never reach the sim. */
const DELAY_MS = 350; // a hold starts after this; shorter is a tap
const START_PER_SEC = 3; // presses a second as the hold starts
const MAX_PER_SEC = 15; // the ceiling it climbs to
const RAMP_MS = 2500; // how long the climb takes
const SLOP_PX = 12; // movement that turns a hold into a scroll

interface Hold {
  key: string;
  press: () => boolean;
  timer: number;
  /** When the repeating began (after the delay); 0 while still waiting. */
  started: number;
  fired: number;
  x: number;
  y: number;
}

let hold: Hold | null = null;
/** The click that ends a hold that fired must not press once more. */
let swallowClick = false;
const buttons = new Set<HTMLButtonElement>();

/** Presses a second, `elapsed` ms into the repeating. */
export const holdRate = (elapsed: number): number =>
  START_PER_SEC + (MAX_PER_SEC - START_PER_SEC) * Math.min(1, Math.max(0, elapsed) / RAMP_MS);

function paint(): void {
  for (const b of buttons) {
    if (!b.isConnected) { buttons.delete(b); continue; }
    b.classList.toggle('is-held', hold !== null && hold.fired > 0 && b.dataset.holdKey === hold.key);
  }
}

function stop(): void {
  if (hold === null) return;
  window.clearTimeout(hold.timer);
  if (hold.fired > 0) swallowClick = true;
  hold = null;
  window.removeEventListener('pointerup', stop);
  window.removeEventListener('pointercancel', stop);
  window.removeEventListener('pointermove', moved);
  window.removeEventListener('blur', stop);
  paint();
}

function moved(e: PointerEvent): void {
  if (hold === null) return;
  if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > SLOP_PX) stop();
}

function tick(): void {
  const h = hold;
  if (h === null) return;
  const now = performance.now();
  if (h.started === 0) h.started = now;
  h.fired += 1;
  const goOn = h.press();
  if (hold !== h) return; // the press itself ended the hold (a sheet, a blur)
  if (!goOn) { stop(); return; }
  paint();
  h.timer = window.setTimeout(tick, 1000 / holdRate(now - h.started));
}

/**
 * Make `b` repeat `press` while held. `key` names what it does (a building
 * and its trainee, say), so a rebuilt button carries on the same hold.
 * `press` returns false to stop — refused, or out of coin.
 */
export function holdToRepeat(b: HTMLButtonElement, key: string, press: () => boolean): HTMLButtonElement {
  b.dataset.holdKey = key;
  b.classList.add('is-holdable');
  buttons.add(b);
  if (hold !== null && hold.key === key && hold.fired > 0) b.classList.add('is-held');
  b.addEventListener('pointerdown', (e) => {
    if (b.disabled || e.button !== 0) return;
    stop();
    swallowClick = false;
    hold = { key, press, timer: 0, started: 0, fired: 0, x: e.clientX, y: e.clientY };
    hold.timer = window.setTimeout(tick, DELAY_MS);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('pointermove', moved);
    window.addEventListener('blur', stop);
  });
  // Capture runs before the button's own click on the same node, so a hold
  // that already pressed swallows the release's click.
  b.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopImmediatePropagation();
  }, { capture: true });
  // A long press on a phone opens the callout menu; a hold is not that.
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}
