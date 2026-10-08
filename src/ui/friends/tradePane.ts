// THE WISH BOARD (Docs/features/15-social.md §2.4): the friends screen's
// Trade tab. The player's own wishes on top — what they need, what they
// give for it, the time left, a ✕ to take it down — and a dashed card to
// make another; under them, every friend's open wish, the ones the player
// can fill first and lit, with the fills left today in the head.

import type { Game } from '../../game';
import { tr } from '../../i18n/tr';
import { FILL_WORDS } from '../../friendsClient';
import { TRADE } from '../../sim/data/definitions';
import { fillProblem } from '../../sim/trade';
import type { WishView } from '../../socialServer/types';
import { el, formatCountdown, formatExact } from '../format';
import { btn, iconEl, knob, sectionHead } from '../kit';
import { crestEl, roundKnob } from './kingdomBits';
import { lotTile } from './lotArt';

export function tradePane(game: Game): HTMLElement[] {
  const f = game.friends;
  const snap = f.snap!;
  const now = game.now();
  const left = (w: WishView) => formatCountdown(Math.max(0, (w.expiresAt - now) / 1000));

  const mine = snap.wishes.map((w) => el('div', { class: 'wb-wish' },
    el('div', { class: 'wb-side' }, el('span', { class: 'wb-head' }, tr('I need')), lotTile(w.need)),
    el('span', { class: 'wb-arrow', 'aria-hidden': 'true' }, '→'),
    el('div', { class: 'wb-side' }, el('span', { class: 'wb-head' }, tr('I give')), lotTile(w.give)),
    el('div', { class: 'wb-end' },
      el('span', { class: 'wb-left' }, iconEl('clock', { size: 'sm' }), tr('{time} left', { time: left(w) })),
      roundKnob(knob('✕', () => void f.withdrawWish(w.id), {
        label: tr('Take this wish down'), kind: 'destructive', disabled: f.busy.has(w.id),
      })))));
  const make = el('button', { class: 'wb-make', type: 'button' }, el('span', { class: 'wb-plus' }, '+'), tr('Make a wish'));
  make.addEventListener('click', () => f.openWishNeed());

  // Fillable first, then the rest, each newest first as the server sent them.
  const problems = new Map(snap.friendWishes.map((w) => [w.id, fillProblem(game.state, w.need, w.give)]));
  const theirs = [...snap.friendWishes].sort((a, b) => Number(problems.get(a.id) !== null) - Number(problems.get(b.id) !== null));
  const friendRows = theirs.map((w) => {
    const problem = problems.get(w.id) ?? null;
    const can = problem === null && snap.fillsLeft > 0;
    return el('div', { class: `wb-friend${can ? ' is-fillable' : problem !== null ? ' is-out' : ''}` },
      crestEl(w.owner.nickname, w.owner.crest),
      el('div', { class: 'wb-friend-body' },
        el('div', { class: 'fr-name' }, w.owner.nickname),
        el('div', { class: 'wb-trade' },
          el('div', { class: 'wb-side' }, el('span', { class: 'wb-head' }, tr('Needs')), lotTile(w.need)),
          el('span', { class: 'wb-arrow', 'aria-hidden': 'true' }, '→'),
          el('div', { class: 'wb-side' }, el('span', { class: 'wb-head' }, tr('Gives')), lotTile(w.give)))),
      el('div', { class: 'wb-end' },
        problem === null
          ? el('span', { class: 'wb-tag is-have' }, tr('You have it'))
          : el('span', { class: 'wb-tag' }, FILL_WORDS[problem]),
        ...(problem === null ? [btn({
          label: tr('Fill'), kind: 'primary', onClick: () => void f.fillWish(w),
          ...(f.busy.has(w.id) ? { disabledReason: tr('Sending') } : snap.fillsLeft <= 0 ? { disabledReason: tr('No fills left today') } : {}),
        })] : [])));
  });

  return [
    el('section', { class: 'wb-mine' },
      sectionHead(tr('Your wishes {n}/{max}', { n: formatExact(snap.wishes.length), max: formatExact(TRADE.wishes) })),
      el('div', { class: 'fr-rows' }, ...mine, ...(snap.wishes.length < TRADE.wishes ? [make] : []))),
    el('section', { class: 'wb-theirs' },
      el('div', { class: 'wb-theirs-head' },
        sectionHead(tr('Friends need')),
        el('span', { class: 'wb-fills' }, tr('Fills {n}/{max}', { n: formatExact(snap.fillsLeft), max: formatExact(TRADE.fillsPerDay) }))),
      el('div', { class: 'fr-rows' }, ...(friendRows.length > 0
        ? friendRows
        : [el('p', { class: 'fr-empty' }, tr('Your friends have no wishes just now.'))]))),
  ];
}
