// Pressable things.
//
// The opinionated bit is `action()`: `disabled` is not separately settable.
// The only way to disable an action is to say WHY, because §6.3 makes
// "nothing is greyed out without a reason attached" a universal rule, and
// rules that live in prose get skipped. After this, a reviewer can grep for
// `disabled =` and find only legacy code.

import { playSfx } from '../../audio/sfx';
import { el } from '../format';
import { iconEl, type IconName } from './icon';

export type ButtonKind = 'primary' | 'secondary' | 'destructive' | 'gem';

export interface ActionOpts {
  label: string;
  onClick: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  /** Present ⇒ the action is unavailable, and this says so in plain words. */
  disabledReason?: string;
}

const wire = (b: HTMLButtonElement, onClick: () => void): HTMLButtonElement => {
  b.addEventListener('click', () => {
    playSfx('click'); // every button clicks audibly; disabled ones don't fire
    onClick();
  });
  return b;
};

/** The button alone, without its reason line. */
export function btn(opts: ActionOpts): HTMLButtonElement {
  const kind = opts.kind ?? 'secondary';
  const blocked = opts.disabledReason !== undefined;
  const b = el(
    'button',
    { class: `k-btn k-btn--${kind}`, type: 'button' },
    ...(opts.icon ? [iconEl(opts.icon, { size: 'sm' })] : []),
    opts.label,
  );
  if (blocked) {
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
  }
  return wire(b, opts.onClick);
}

/**
 * A button with its reason beside it: [reason ................ Verb].
 * When the action is available the left slot carries the cost or the
 * consequence; when it isn't, it carries the padlock and the explanation.
 */
export function action(opts: ActionOpts & { info?: Node | string }): HTMLElement {
  const blocked = opts.disabledReason !== undefined;
  const reason = el('span', { class: `k-reason${blocked ? ' is-blocked' : ''}` });
  if (blocked) reason.append(iconEl('padlock', { size: 'sm' }), opts.disabledReason!);
  else if (opts.info !== undefined) reason.append(opts.info);
  return el('div', { class: 'k-action' }, reason, btn(opts));
}

/** A round wooden knob — worker steppers, close, zoom. */
export function knob(
  glyph: string,
  onClick: () => void,
  opts: { label?: string; disabled?: boolean } = {},
): HTMLButtonElement {
  const b = el('button', { class: 'k-btn k-btn--secondary k-knob', type: 'button' }, glyph);
  if (opts.label) b.setAttribute('aria-label', opts.label);
  // A stepper at its limit has nothing to explain — the number beside it
  // already says why, so this one may be plainly disabled.
  if (opts.disabled) b.disabled = true;
  return wire(b, onClick);
}

/** An on/off switch (music, sound effects, ambience). */
export function switchCtl(on: boolean, onToggle: () => void, label: string): HTMLButtonElement {
  const b = el('button', {
    class: `k-btn k-switch${on ? ' is-on' : ''}`,
    type: 'button',
    role: 'switch',
    'aria-checked': String(on),
    'aria-label': label,
  });
  return wire(b, onToggle);
}

/** Segmented choice — the market's x1 / x10 / x100 / All. */
export function toggleGroup<T>(
  options: ReadonlyArray<{ label: string; value: T }>,
  selected: T,
  onSelect: (value: T) => void,
): HTMLElement {
  return el(
    'div',
    { class: 'k-toggles' },
    ...options.map((o) => {
      const b = btn({ label: o.label, onClick: () => onSelect(o.value) });
      if (o.value === selected) b.classList.add('is-selected');
      return b;
    }),
  );
}
