// Things other things sit on: panels, sheets, planks, cards, grids.

import { el } from '../format';
import { knob } from './controls';
import { iconEl, type IconName } from './icon';

/** A parchment panel in a carved wooden frame. */
export const panel = (...children: Array<Node | string>): HTMLElement =>
  el('div', { class: 'k-panel' }, ...children);

/** The wooden header plank across the top of a panel. */
export const plank = (title: string, ...trailing: Array<Node | string>): HTMLElement =>
  el('div', { class: 'k-plank' }, el('span', {}, title), ...trailing);

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
  opts: { title: string; onClose: () => void },
  ...children: Array<Node | string>
): HTMLElement {
  const close = knob('✕', opts.onClose, { label: `Close ${opts.title}` });
  close.setAttribute('data-own-close', '');
  return el(
    'div',
    { class: 'k-sheet' },
    el(
      'div',
      { class: 'k-panel' },
      el('div', { class: 'k-grab' }),
      plank(opts.title, close),
      // The body scrolls; the plank and its close knob do not go with it.
      el('div', { class: 'k-sheet-body' }, ...children),
    ),
  );
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
