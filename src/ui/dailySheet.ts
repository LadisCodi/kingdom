// The daily chest: the ladder, drawn, and one button.
//
// The ladder is the feature. A step counter in a corner is a number; seven
// rungs with the ones behind you filled in is somewhere you got to — and
// because this ladder advances on days PLAYED and never resets
// (`sim/daily.ts`), what it shows is a possession rather than a warning.
// There is deliberately no "streak ends in 4h 12m" anywhere on it: that
// sentence is the whole mechanic this design refuses.
//
// Reached from a pill that glows and waits, never auto-opened — a daily
// reward that interrupts the first tap of a session is the single most
// disliked screen in the genre (habit-loop.md §1.4).

import type { Game } from '../game';
import type { CurrencyId, Wallet } from '../sim/state';
import { el } from './format';
import { btn, currencyIcon } from './kit';
import { sheet } from './kit/surface';

/** The reward as icon-and-number chips, in wallet order. */
function prize(reward: Wallet, size: 'sm' | 'md' = 'sm'): HTMLElement[] {
  return (Object.entries(reward) as Array<[CurrencyId, number]>).map(([c, n]) =>
    el('span', { class: 'dly-prize' },
      currencyIcon(c, size === 'sm' ? { size: 'sm' } : {}),
      el('b', {}, String(n))));
}

export function renderDailySheet(game: Game): HTMLElement {
  const chest = game.dailyChest();
  const close = () => game.setOverlay(null);

  // The overlay can outlive the chest for one frame after a claim; render an
  // empty shell rather than throwing, exactly as the ad offer sheet does.
  if (chest === null) {
    return sheet({ title: 'Daily chest', onClose: close, centred: true },
      el('div', { class: 'dly-note' }, 'Come back tomorrow.'));
  }

  const rungs = el('div', { class: 'dly-ladder' },
    ...chest.ladder.map((rung) => el('div', {
      class: `dly-rung${rung.claimed ? ' is-claimed' : ''}${rung.isToday ? ' is-today' : ''}`
        + (rung.step === chest.length ? ' is-marker' : ''),
    },
      el('div', { class: 'dly-rung-day' }, `Day ${rung.step}`),
      el('div', { class: 'dly-rung-prize' }, ...prize(rung.reward)))));

  const body = el('div', { class: 'dly' },
    // What the ladder IS, said once. Without this the seven rungs read as a
    // streak, which is the thing a player has learned to be anxious about.
    el('div', { class: 'dly-note' },
      'One step for every day you play — not for every day that passes. '
      + 'Miss a day and you lose nothing but that day’s chest.'),
    rungs,
    el('div', { class: 'dly-claim' },
      btn({
        label: `Take day ${chest.step}`,
        kind: 'primary',
        onClick: () => game.doClaimDailyChest(),
      })),
    el('div', { class: 'dly-today' }, ...prize(chest.reward, 'md')),
  );

  return sheet({ title: 'Daily chest', onClose: close, centred: true }, body);
}
