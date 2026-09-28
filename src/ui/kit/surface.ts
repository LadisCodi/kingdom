// Things other things sit on: panels, sheets, planks, cards, grids.

import { el } from '../format';
import { closeKnob } from './controls';
import { iconEl, type IconName } from './icon';

/** A parchment panel in a carved wooden frame. */
export const panel = (...children: Array<Node | string>): HTMLElement =>
  el('div', { class: 'k-panel' }, ...children);

/** The wooden header plank across the top of a panel. */
export const plank = (title: string, ...trailing: Array<Node | string>): HTMLElement =>
  el('div', { class: 'k-plank' }, el('span', {}, title), ...trailing);

/** A window's header bar: the title on the left, the buttons on the right,
 *  the close last (sheets/ui-window3-header.png, three-sliced so it takes
 *  any width). `sheet({ header })` builds one; a window that is not a kit
 *  sheet — the district card — places it as the first thing in its frame. */
export const windowHead = (title: string, buttons: readonly Node[]): HTMLElement =>
  el('div', { class: 'k-head' },
    el('h2', { class: 'k-head-title' }, title),
    el('div', { class: 'k-head-actions' }, ...buttons));

/**
 * A bottom sheet: a panel with a grab handle, a titled plank and a close
 * knob of its own.
 *
 * The close knob is why this exists. Today the whole nav bar turns into one
 * Close button whenever anything is open, which means the player cannot go
 * Build → Research without a detour through the map. Giving each sheet its
 * own dismiss lets the nav stay put (§5.4).
 */
export function sheet(
  opts: {
    title: string;
    onClose: () => void;
    /** Centre it in the play area instead of anchoring it to the bottom.
     *  For a short, modal, one-decision sheet — an offer or a confirmation —
     *  where the bottom-sheet idiom (a drawer you pull up over a screen you
     *  are still using) is the wrong metaphor. */
    centred?: boolean;
    /**
     * Take the whole height the frame has, rather than only as much as the
     * content needs.
     *
     * For a screen the player WORKS in — the battle board, where the room and
     * the party have to be read against each other — because a drawer that
     * grows and shrinks as squads are added moves its own buttons around, and
     * because the space is what pays for slots big enough to tap.
     */
    tall?: boolean;
    /**
     * Drop the grab handle and the plank.
     *
     * For a sheet whose CONTENT already names it — a hero's card carries the
     * portrait and the name, so a plank repeating the name above them spends
     * a band of the screen saying it twice. `title` is still required and
     * still labels the sheet for a screen reader.
     *
     * The caller then owns the way out. `onClose` is not wired to anything
     * here, so a bare sheet must carry its own affordance or it is a room
     * with no door.
     */
    bare?: boolean;
    /**
     * A HEADER instead of the plank: a wooden bar across the top of the
     * window with the title on its left and a row of buttons anchored to its
     * right, the window's close always last. `actions` are the buttons before
     * it, in order — a knob, an info button — and may be empty.
     */
    header?: { actions?: readonly Node[] };
  },
  ...children: Array<Node | string>
): HTMLElement {
  // The close sits on the window's frame, at its top-right corner — part of
  // the window, not of the title plank.
  const close = closeKnob(opts.onClose, `Close ${opts.title}`);
  return el(
    'div',
    {
      class: `k-sheet${opts.centred ? ' is-centred' : ''}`
        + `${opts.bare ? ' is-bare' : ''}${opts.tall ? ' is-tall' : ''}`
        + `${opts.header && !opts.bare ? ' has-head' : ''}`,
    },
    el(
      'div',
      { class: 'k-panel' },
      // The window's painted frame, its own layer behind everything else, so
      // it can grow and shrink on the way in and out without distorting or
      // reflowing the contents (kit.css, `k-window-*`).
      el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
      ...(opts.bare ? []
        : opts.header ? [windowHead(opts.title, [...(opts.header.actions ?? []), close])]
          : [el('div', { class: 'k-grab' }), plank(opts.title), close]),
      // The body scrolls; the plank and its close knob do not go with it.
      // data-keep-scroll asks the host to carry the scroll position across
      // the per-tick rebuild, so reading a long sheet is possible at all.
      el(
        'div',
        { class: 'k-sheet-body', 'data-keep-scroll': 'sheet-body', 'aria-label': opts.title },
        ...children,
      ),
    ),
  );
}

/** A SECTION'S HEADING inside a menu: a short rule, the label in small
 *  uppercase wood, then a rule to the edge (kit.css `.k-section-head`). */
export const sectionHead = (label: string): HTMLElement =>
  el('div', { class: 'k-section-head' }, label);

/** The warm dim behind an open sheet. It MUST cover the map: #ui is
 *  pointer-events:none with children auto, so anything the scrim doesn't
 *  cover passes taps straight through to the canvas and fires a harvest. */
export const scrim = (onTap: () => void): HTMLElement => {
  const s = el('div', { class: 'k-scrim' });
  s.addEventListener('pointerdown', onTap);
  return s;
};

export interface CardOpts {
  /** Art for the left slot — a sprite image, or an icon name. */
  icon?: IconName;
  art?: HTMLElement;
  name: string;
  desc?: string;
  locked?: boolean;
}

/** A list row / tile. The left slot always holds art, never a bare glyph. */
export function card(opts: CardOpts, ...trailing: Array<Node | string>): HTMLElement {
  const slotContent = opts.art ?? (opts.icon ? iconEl(opts.icon, { size: 'lg' }) : undefined);
  const body = el('div', { class: 'k-body' }, el('div', { class: 'k-name' }, opts.name));
  if (opts.desc !== undefined) body.append(el('div', { class: 'k-desc' }, opts.desc));
  return el(
    'div',
    { class: `k-card${opts.locked ? ' is-locked' : ''}` },
    el('div', { class: 'k-slot' }, ...(slotContent ? [slotContent] : [])),
    body,
    ...trailing,
  );
}

/** Two-column tile grid. */
export const grid = (...children: Array<Node | string>): HTMLElement =>
  el('div', { class: 'k-grid' }, ...children);
