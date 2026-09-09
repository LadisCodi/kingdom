// The Mana sheet (Docs/features/08-magic.md §6): the pool, what fills it, and
// the two ways to fill it now.
//
// It is the old ad popup, grown. The offer tab still opens it, and so does the
// header gauge — which is why the Mana arithmetic moved here out of the
// Reliquary (2026-09-08). The Reliquary's job is the SOCKET; a pool it neither
// spends nor fills was the one panel on that screen with no relic in it, and
// splitting "what my pool is doing" from "how I get more of it" across two
// screens meant the player read half the story on each.
//
// ONE REWARD, TWO PRICES. A refill is a whole pool on top of whatever is
// banked, whether the video pays for it or the Gems do — so the prize is
// stated ONCE, above both buttons, and each button carries only its own price
// and its own allowance. Two prize lines would read as two different offers.
//
// THE TWO TILLS SIT SIDE BY SIDE, Gems left and the video right, at equal
// widths — two prices for one pool, so a player choosing between them is
// comparing them, and a price under a price would read as a list. Each button
// carries `Left today: n/5` directly above it, which is where the day's
// allowance belongs: over the button it limits.
//
// EVERY REFUSAL SAYS WHICH ONE IT IS. A video can be short of four different
// things (the day's five, the cooldown, a full pool, a pool still over half)
// and the Gems of two, so `manaRefills()` returns a reason per route. A spent
// allowance is said by the count above its own button; the rest are printed
// under the pair — once when both routes share one, which a full pool does.
//
// The way out is the X on the plank. Closing never consumes a standing offer —
// only claiming does — so a mis-tap costs nothing and the tab is still on the
// map afterwards.

import type { Game, RefillBlock } from '../game';
import { el, formatDuration } from './format';
import { btn, iconEl, progress, sheet } from './kit';

/** Why a route is dead, in words. Every state but `Ready` has one. */
function refusal(block: RefillBlock, perDay: number): string | undefined {
  switch (block) {
    case 'Ready': return undefined;
    case 'PoolFull': return 'Your pool is already full';
    case 'AboveHalf': return 'The video is offered once you are below half a pool';
    case 'Cooling': return 'The next video is on its way';
    case 'NoneLeftToday': return `All ${perDay} taken today — back at midnight`;
  }
}

/**
 * The same reason, filtered to what is worth PRINTING under the pair.
 *
 * A spent allowance is not printed: `Left today: 0/5` sits directly over its
 * own button, which is a reason attached to the control exactly as §6.3 asks,
 * and saying it twice would be a wall rather than an explanation.
 */
const printedRefusal = (block: RefillBlock, perDay: number): string | undefined =>
  (block === 'NoneLeftToday' ? undefined : refusal(block, perDay));

/** The day's count, over the button it belongs to. */
const leftToday = (left: number, perDay: number): HTMLElement =>
  el('div', { class: `mana-till-count${left <= 0 ? ' is-spent' : ''}` },
    `Left today: ${left}/${perDay}`);

/** One till: the count, then the button it counts for. */
const till = (count: HTMLElement, button: HTMLElement): HTMLElement =>
  el('div', { class: 'mana-till' }, count, button);

export function renderManaSheet(game: Game): HTMLElement {
  const m = game.manaInfo();
  const r = game.manaRefills();

  const bar = progress('sky');
  bar.set(m.cap === 0 ? 0 : m.value / m.cap, `${m.value} / ${m.cap}`);

  // A full pool stops both tills with the same sentence, so it is said once.
  const gemsBlocked = printedRefusal(r.gems, r.boughtPerDay);
  const videoBlocked = printedRefusal(r.video, r.watchedPerDay);
  const reasons = [gemsBlocked, videoBlocked === gemsBlocked ? undefined : videoBlocked]
    .filter((text): text is string => text !== undefined);

  // One line, not three. The breakdown existed to reconcile production
  // against relic upkeep; nothing draws against the pool any more, so a
  // subtraction that always reads "−0/h" is exactly the spreadsheet chrome
  // the HUD refuses to carry.
  const body = el('div', { class: 'mana-sheet' },
    el('div', { class: 'mana-head' },
      iconEl('Mana', { size: 'lg' }),
      el('div', { class: 'mana-title' }, 'Mana'),
      el('div', { class: 'mana-hint' }, m.over
        ? `Overcharged — ${m.value - m.cap} past the ceiling`
        : m.value >= m.cap
          ? 'Full — anything more is spilling'
          : `Full in about ${formatDuration(((m.cap - m.value) / Math.max(1, m.net)) * 3600)}`)),
    bar.root,
    el('div', { class: 'mana-line' },
      el('span', {}, 'Drawn from the land'),
      el('b', {}, `+${m.production}/h`)),
    el('div', { class: 'mana-note' },
      'Every tap is paid from the pool.'),

    // The prize, once, above both tills.
    el('div', { class: 'mana-refills' },
      el('div', { class: 'mana-prize' },
        el('span', { class: 'mana-prize-copy' }, 'Refill now — a whole pool, on top of what you have'),
        el('span', { class: 'mana-prize-amount' },
          iconEl('Mana', { size: 'lg' }),
          el('b', {}, `+${r.reward}`))),

      // Side by side, equal widths: two prices for the same pool, and a
      // player choosing between them is comparing them. Gems on the left,
      // the video on the right — the free one is the one you land on last and
      // press, and neither reads as the afterthought.
      el('div', { class: 'mana-tills' },
        till(
          leftToday(r.boughtLeft, r.boughtPerDay),
          btn({
            label: 'Refill',
            kind: 'gem',
            onClick: () => game.doRefillMana(),
            // The rung, not a discount: the price rises with each refill
            // bought today, and the button says which one this is so the
            // number is never a surprise.
            note: r.gemCost === null ? undefined : `the ${ordinal(r.rung)} today`,
            cost: r.gemCost === null ? undefined : { Gems: r.gemCost },
            have: (c) => game.walletValue(c),
            disabledReason: refusal(r.gems, r.boughtPerDay),
          }),
        ),
        till(
          leftToday(r.watchedLeft, r.watchedPerDay),
          btn({
            label: 'Watch',
            kind: 'primary',
            onClick: () => game.startAdWatch(),
            note: 'a short ad',
            disabledReason: refusal(r.video, r.watchedPerDay),
          }),
        ),
      ),

      // The reasons under the pair, never inside the count. A reason both
      // routes share is printed once — two buttons with the same sentence
      // between them is a wall, not an explanation.
      ...reasons.map((text) => el('div', { class: 'mana-blocked' },
        iconEl('padlock', { size: 'sm' }), text)),
    ),
  );

  return sheet({ title: 'Mana', onClose: () => game.dismiss(), centred: true }, body);
}

/** 1st, 2nd, 3rd… — five rungs deep at most, so the small cases are enough. */
const ordinal = (n: number): string => {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st'
    : n % 10 === 2 && n % 100 !== 12 ? 'nd'
      : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
};
