// Pressable things.
//
// The opinionated bit is `action()`: `disabled` is not separately settable.
// The only way to disable an action is to say WHY, because §6.3 makes
// "nothing is greyed out without a reason attached" a universal rule, and
// rules that live in prose get skipped. After this, a reviewer can grep for
// `disabled =` and find only legacy code.
//
// §6.4 adds the second half of that rule: WHAT AN ACTION COSTS LIVES INSIDE
// THE BUTTON THAT SPENDS IT. A price sitting beside a button is a caption; a
// price on the button is part of the thing you are pressing, and the player
// reads both in one glance instead of pairing them up. Any term they cannot
// pay turns clay — and that red is a reason, so a button blocked ONLY by
// affordability disables itself and needs no words. `cost` + `have` is
// therefore the whole affordability contract: pass both and the button gets
// its price, its red, and its disabled state together, or none of them.

import type { CurrencyId, Wallet } from '../../sim/state';
import { playSfx } from '../../audio/sfx';
import { el } from '../format';
import { iconEl, type IconName } from './icon';
import { costTerms, isShort, type CostTerm } from './stats';

export type ButtonKind = 'primary' | 'secondary' | 'destructive' | 'gem';

export interface ActionOpts {
  label: string;
  onClick: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  /** What pressing this spends. Rendered INSIDE the button, under the label
   *  (§6.4). Omit for an action that costs nothing. */
  cost?: Wallet;
  /** What the player holds, per currency — the affordability test for `cost`.
   *  Given both, a term they are short of turns clay and the button disables
   *  itself, so affordability never needs a `disabledReason` of its own. */
  have?: (c: CurrencyId) => number;
  /** Priced terms that are not wallet currencies — Fragments, chiefly. Each
   *  says for itself whether the player is short of it. */
  costExtra?: readonly CostTerm[];
  /** Present ⇒ the action is unavailable for a reason that is NOT simply the
   *  price, and this says so in plain words. */
  disabledReason?: string;
}

const wire = (b: HTMLButtonElement, onClick: () => void): HTMLButtonElement => {
  b.addEventListener('click', () => {
    playSfx('click'); // every button clicks audibly; disabled ones don't fire
    onClick();
  });
  return b;
};

/** Can this action be pressed at all — priced out, or blocked outright? */
export const isBlocked = (opts: ActionOpts): boolean =>
  opts.disabledReason !== undefined
  || (opts.cost !== undefined && isShort(opts.cost, opts.have))
  || (opts.costExtra ?? []).some((t) => t.short === true);

/** The button alone, without its reason line — but WITH its price, which is
 *  part of the button rather than a caption beside it (§6.4). */
export function btn(opts: ActionOpts): HTMLButtonElement {
  const kind = opts.kind ?? 'secondary';
  const blocked = isBlocked(opts);
  const terms = costTerms(opts.cost, opts.have, opts.costExtra);
  const b = el(
    'button',
    { class: `k-btn k-btn--${kind}${terms ? ' has-cost' : ''}`, type: 'button' },
    el(
      'span',
      { class: 'k-btn-label' },
      ...(opts.icon ? [iconEl(opts.icon, { size: 'sm' })] : []),
      opts.label,
    ),
    ...(terms ? [terms] : []),
  );
  if (blocked) {
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
  }
  return wire(b, opts.onClick);
}

/**
 * A button with its reason beside it: [reason ................ Verb].
 *
 * The left slot no longer carries the PRICE — that moved inside the button
 * (§6.4) — so it now carries only the consequence, or the padlock and an
 * explanation when something other than money is in the way. An action the
 * player merely cannot afford says nothing here: the red number in the button
 * has already said it, and repeating it is how a screen starts nagging.
 */
export function action(opts: ActionOpts & { info?: Node | string }): HTMLElement {
  const explained = opts.disabledReason !== undefined;
  const reason = el('span', { class: `k-reason${explained ? ' is-blocked' : ''}` });
  if (explained) reason.append(iconEl('padlock', { size: 'sm' }), opts.disabledReason!);
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
