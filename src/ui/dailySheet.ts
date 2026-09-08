// The daily chest: a season, drawn as fourteen rungs two tracks wide.
//
// The ladder is the feature. A rung counter in a corner is a number; fourteen
// rungs with the ones behind you filled in is somewhere you got to. The two
// columns sit on the SAME rows on purpose (Docs/features/13-events.md §2.4,
// OQ-20): a free player reads the Royal column as the same ladder they are
// already climbing, which is what makes the price legible without a sales
// pitch anywhere on the sheet.
//
// EVERY CELL IS ITS OWN BUTTON. You take the day by tapping the day, not by
// tapping a bar at the foot of the sheet that pays whatever it decides — the
// reward and the thing you press are the same object, so what you got is never
// a line of text you have to go and reconcile with the ladder. It also lets
// the two tracks come apart: buy the chest on rung 9 and nine Royal cells are
// sitting there lit, to be taken one at a time and in any order.
//
// The countdown at the head is the one clock in this feature, and it is here
// because the window is real: the season ends, and a rung not taken is gone
// (Docs/features/12-quests.md §3.1). Nothing else on the sheet counts down,
// nothing greys out behind the player, and there is no streak to lose.
//
// Reached from a pill that glows and waits, never auto-opened — a daily
// reward that interrupts the first tap of a session is the single most
// disliked screen in the genre (Docs/features/12-quests.md §3.4).

import type { Game } from '../game';
import type { CurrencyId, Wallet } from '../sim/state';
import { el, formatCount } from './format';
import { currencyIcon, iconEl } from './kit';
import { sheet } from './kit/surface';

/** The reward as icon-and-number chips, in wallet order. */
function prize(reward: Wallet): HTMLElement[] {
  return (Object.entries(reward) as Array<[CurrencyId, number]>).map(([c, n]) =>
    el('span', { class: 'dly-prize' },
      currencyIcon(c, { size: 'sm' }),
      el('b', {}, formatCount(n))));
}

export function renderDailySheet(game: Game): HTMLElement {
  const season = game.dailySeason();
  const close = () => game.setOverlay(null);
  const price = `€${season.royalPriceUsd.toFixed(2)}`;

  // ---- the two column headers. The right one IS the buy button while the
  // season is unbought: the price belongs on the thing it buys, not in a
  // banner above it or a card in a store two taps away (§3.3).
  const heads = el('div', { class: 'dly-heads' },
    el('div', { class: 'dly-head is-free' }, 'Free'),
    el('div', { class: 'dly-head-rung' }, ''),
    season.royal
      ? el('div', { class: 'dly-head is-royal is-owned' },
          iconEl('tick', { size: 'sm' }), 'Royal chest')
      : el('button', {
          class: 'dly-head is-royal is-buy', type: 'button',
          'aria-label': `Unlock the Royal chest for ${price}`,
        },
          iconEl('padlock', { size: 'sm' }),
          el('span', {}, 'Royal chest'),
          el('b', { class: 'dly-price' }, price)));
  if (!season.royal) {
    heads.querySelector('.dly-head.is-buy')!
      .addEventListener('click', () => game.doBuyRoyalChest());
  }

  // ---- the rungs. A cell is a <button> exactly when it can be taken, and a
  // plain <div> otherwise: a dead button is a worse affordance than no button.
  const cell = (
    kind: 'free' | 'royal',
    reward: Wallet,
    st: { claimed: boolean; claimable: boolean; locked?: boolean },
    onClick: () => void,
  ): HTMLElement => {
    const classes = `dly-cell is-${kind}`
      + (st.claimed ? ' is-taken' : '')
      + (st.claimable ? ' is-claimable' : '')
      + (st.locked ? ' is-locked' : '');
    const bits = [
      ...prize(reward),
      // One mark per cell, never one per prize: three padlocks on a row of
      // three rewards is a fence, and the lock is a property of the track.
      ...(st.claimed ? [iconEl('tick', { size: 'sm' })] : []),
      ...(st.locked ? [iconEl('padlock', { size: 'sm' })] : []),
    ];
    if (!st.claimable) return el('div', { class: classes }, ...bits);
    const b = el('button', { class: classes, type: 'button' }, ...bits);
    b.addEventListener('click', onClick);
    return b;
  };

  const rows = season.ladder.map((rung) => el('div', {
    class: `dly-row${rung.free.claimed ? ' is-climbed' : ''}`,
  },
    cell('free', rung.free.reward, rung.free, () => game.doClaimFreeRung()),
    // The rung number lives BETWEEN the columns, so it reads as belonging to
    // the row rather than to either track.
    el('div', { class: 'dly-rung' }, String(rung.rung)),
    cell('royal', rung.royal.reward, rung.royal, () => game.doClaimRoyalRung(rung.rung))));

  // No claim bar. The foot says only where the season stands — pressing it
  // does nothing, because pressing the day is what takes the day.
  const foot = el('div', { class: 'dly-note' }, season.available
    ? `Tap day ${season.rung} to take it.`
    : season.complete
      ? 'Every day of this season is taken. The next season starts when this one ends.'
      : 'Come back tomorrow for the next day.');

  const body = el('div', { class: 'dly' },
    el('div', { class: 'dly-clock' },
      iconEl('hourglass', { size: 'sm' }),
      el('span', {}, `Season ends in ${season.endsIn}`),
      el('span', { class: 'dly-progress' }, `${season.claimed} of ${season.length}`)),
    // What the ladder IS, said once. Without this the rungs read as a streak,
    // which is the thing a player has learned to be anxious about.
    el('div', { class: 'dly-note' },
      'One rung for every day you play — not for every day that passes. '
      + 'Miss a day and you lose nothing but that day.'),
    heads,
    el('div', { class: 'dly-ladder' }, ...rows),
    el('div', { class: 'dly-foot' }, foot),
  );

  return sheet({ title: 'Daily chest', onClose: close }, body);
}
