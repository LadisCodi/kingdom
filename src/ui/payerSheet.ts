// "Who are you playing as?" — the first thing a new save asks, once its
// First Morning is played; or never, when the link set it (`?payer=`).
//
// The simulated store (Docs/features/14-monetization.md §3) only measures
// anything if the money is scarce, and the money is scarce only if the player
// has declared how much of it there is. So this sheet is MODAL in the strong
// sense: it has no close knob, the scrim does not dismiss it, and nothing else
// opens until a profile is picked. It is the one place in the game that makes
// a demand of the player, and the copy says why.
//
// The choice is final for this save. That is stated on the sheet rather than
// discovered afterwards, and the way out — start over from Settings — is
// named here too, so nobody has to go looking for it.

import type { Game } from '../game';
import { tr } from '../i18n/tr';
import { PAYER_PROFILES, monthlyBudgetCents } from '../sim/store';
import type { PayerProfile } from '../sim/state';
import { el, formatUsd } from './format';
import { btn, currencyIcon, iconEl, panel, windowHead } from './kit';

/** What the player sees a profile called, in their language (the sim's
 *  `PROFILE_LABEL` is the English, for the server's bundle). */
export const PAYER_LABEL: Record<PayerProfile, string> = {
  F2P: 'F2P', Minnow: tr('Minnow'), Dolphin: tr('Dolphin'), Whale: tr('Whale'), SuperWhale: tr('Super Whale'),
};

const BLURB: Record<PayerProfile, string> = {
  F2P: tr('Never spends. The store is open to look at, and every price is refused.'),
  Minnow: tr('A pack or two a month, when something is worth it.'),
  Dolphin: tr('Buys what saves time. A chest of Gems most weeks.'),
  Whale: tr('Buys what they want, when they want it.'),
  SuperWhale: tr('The store is not a constraint. Buys everything, and then buys it again.'),
};

export function renderPayerSheet(game: Game): HTMLElement {
  const options = PAYER_PROFILES.map((profile) => {
    const cents = monthlyBudgetCents(profile);
    return el('div', { class: 'payer-option' },
      el('div', { class: 'payer-copy' },
        el('div', { class: 'payer-name' }, PAYER_LABEL[profile]),
        el('div', { class: 'payer-budget' },
          cents === 0 ? tr('No purchases') : tr('{price} a month', { price: formatUsd(cents) })),
        el('div', { class: 'payer-blurb' }, BLURB[profile])),
      btn({
        label: tr('Play as this'),
        kind: profile === 'F2P' ? 'secondary' : 'gem',
        onClick: () => game.doChoosePayerProfile(profile),
      }));
  });

  const body = el('div', { class: 'payer' },
    el('div', { class: 'payer-lede' },
      currencyIcon('Gems', { size: 'lg' }),
      el('div', {},
        el('p', {}, tr('This prototype has a store, and nothing in it charges real money.')),
        el('p', {}, tr('Pick how much you would spend a month and the game will hold you to it. Prices come out of that budget, and it refills on the first of the month.')))),
    el('div', { class: 'payer-options' }, ...options),
    el('div', { class: 'payer-fine' },
      iconEl('padlock', { size: 'sm' }),
      tr('The choice is final for this kingdom. To play as someone else, start over from Settings.')),
  );

  // The window's header with no close, on purpose: there is nothing to go
  // back to.
  return el('div', { class: 'k-sheet is-centred has-head payer-sheet' },
    panel(el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
      windowHead(tr('Who are you playing as?'), []),
      el('div', { class: 'k-sheet-body', 'data-keep-scroll': 'payer-body' }, body)));
}
