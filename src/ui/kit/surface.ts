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
export const windowHead = (
  title: string, buttons: readonly Node[], sub?: string,
): HTMLElement =>
  el('div', { class: 'k-head' },
    // `sub` is a small word after the title, in the same letters a size
    // down — the district card's level, *Housing #3 Lv 2*.
    el('h2', { class: 'k-head-title' }, title,
      ...(sub === undefined ? [] : [' ', el('span', { class: 'k-head-sub' }, sub)])),
    el('div', { class: 'k-head-actions' }, ...buttons));

/**
 * A bottom sheet: a panel with a header — its title and a close
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
     * Drop the header.
     *
     * For a sheet whose CONTENT already names it — a hero's card carries the
     * portrait and the name, so a header repeating the name above them spends
     * a band of the screen saying it twice. `title` is still required and
     * still labels the sheet for a screen reader.
     *
     * The caller then owns the way out. `onClose` is not wired to anything
     * here, so a bare sheet must carry its own affordance or it is a room
     * with no door.
     */
    bare?: boolean;
    /**
     * Buttons for the header's row, before the window's close (which is
     * always there and always last), in order — a move, an info button.
     */
    actions?: readonly Node[];
  },
  ...children: Array<Node | string>
): HTMLElement {
  // The close is the last button on the header's band.
  const close = closeKnob(opts.onClose, `Close ${opts.title}`);
  return el(
    'div',
    {
      class: `k-sheet${opts.centred ? ' is-centred' : ''}`
        + `${opts.bare ? ' is-bare' : ''}${opts.tall ? ' is-tall' : ''}`
        + `${opts.bare ? '' : ' has-head'}`,
    },
    el(
      'div',
      { class: 'k-panel' },
      // The window's painted frame, its own layer behind everything else, so
      // it can grow and shrink on the way in and out without distorting or
      // reflowing the contents (kit.css, `k-window-*`).
      el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
      // THE HEADER: the title centred on the wooden band across the top of
      // the frame, the buttons anchored to its right, the close last.
      ...(opts.bare ? [] : [windowHead(opts.title, [...(opts.actions ?? []), close])]),
      // The body scrolls; the header and its close do not go with it.
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

/** What a head panel's header is painted: the four the art comes in. */
export type HeadTone = 'red' | 'blue' | 'wood' | 'green';

/**
 * A PANEL WITH A HEADER (kit.css `.k-headpanel`): a painted plank across the
 * top — red, blue, wood or green — over a parchment body, one nine-sliced
 * piece of art (assets/panel-head-*.png) so it takes any size. The title sits
 * on the plank at the left, in the plank's own cream; `trailing` is anchored
 * to its right — a total, a timer, a button.
 */
export function headPanel(
  opts: { tone: HeadTone; title: string; trailing?: Array<Node | string>; cls?: string },
  ...children: Array<Node | string>
): HTMLElement {
  return el('section', { class: `k-headpanel is-${opts.tone}${opts.cls ? ` ${opts.cls}` : ''}` },
    el('div', { class: 'k-headpanel-head' },
      el('span', { class: 'k-headpanel-title' }, opts.title),
      ...(opts.trailing ? [el('span', { class: 'k-headpanel-trail' }, ...opts.trailing)] : [])),
    el('div', { class: 'k-headpanel-body' }, ...children));
}

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
