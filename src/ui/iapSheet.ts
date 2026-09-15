// The confirmation (Docs/features/14-monetization.md §3): the one screen where
// a price meets the monthly budget.
//
// Two states, one sheet. With budget to spare it says what the purchase costs,
// what is left now and what would be left after, and asks. Without, it says
// the same numbers and refuses — the button is dead with its reason attached,
// because a store that lets you press "buy" and then fails is worse than one
// that says so first. Either way the tap is recorded: a refusal is unmet
// demand at that price, and it is data the store exists to collect.

import type { Game } from '../game';
import { STORE } from '../sim/data/definitions';
import type { StoreSkuId } from '../sim/state';
import { formatUsd, priceCents } from '../sim/store';
import { el } from './format';
import { btn, iconEl, sheet } from './kit';

export function renderIapSheet(game: Game, id: StoreSkuId): HTMLElement {
  const sku = STORE[id];
  const payer = game.payerInfo();
  const price = priceCents(id);
  const remaining = payer?.remainingCents ?? 0;
  const affordable = payer !== null && remaining >= price;
  // Back to wherever the price was tapped — the store for a pack, the daily
  // chest for the Royal one.
  const back = () => game.setOverlay(game.iapReturn());

  const row = (label: string, value: string, cls = '') =>
    el('div', { class: `iap-row ${cls}` }, el('span', {}, label), el('b', {}, value));

  // A BUNDLE is the one SKU whose grant is a list. Its whole argument is what
  // lands, so the sheet spells it out above the price: a player about to spend
  // twenty dollars is owed the hand, not a sentence about it.
  const grants = game.bundleLines(id);

  const body = el('div', { class: 'iap' },
    el('div', { class: 'iap-head' },
      iconEl(sku.gems > 0 ? 'Gems' : grants.length > 0 ? 'pack' : 'chest', { size: 'lg' }),
      el('div', {},
        el('div', { class: 'iap-name' }, sku.name),
        // A SKU that grants no Gems on purchase says what it DOES instead:
        // "0 Gems" would be a true sentence and a wrong one.
        el('div', { class: 'iap-grant' },
          sku.gems > 0 ? `${sku.gems} Gems` : sku.description))),
    ...(grants.length === 0 ? [] : [el('div', { class: 'iap-grants' },
      ...grants.map((line) => el('div', { class: 'iap-grant-line' },
        iconEl('tick', { size: 'sm' }), el('span', {}, line))))]),
    el('div', { class: 'iap-rows' },
      row('Price', formatUsd(price)),
      row('Left this month', payer === null ? '—' : formatUsd(remaining)),
      affordable
        ? row('After', formatUsd(remaining - price), 'is-ok')
        : row('Short by', payer === null ? '—' : formatUsd(price - remaining), 'is-short')),
    ...(affordable ? [] : [el('div', { class: 'iap-note' },
      iconEl('padlock', { size: 'sm' }),
      payer === null
        ? 'Pick a payer profile first.'
        : payer.budgetCents === 0
          ? 'You are playing as someone who never spends.'
          : `Your budget refills ${payer.resetsIn}.`)]),
    el('div', { class: 'iap-actions' },
      btn({ label: 'Not now', kind: 'secondary', onClick: back }),
      btn({
        label: `Buy for ${formatUsd(price)}`,
        kind: 'primary',
        onClick: () => game.confirmIap(),
        disabledReason: affordable ? undefined : 'Not enough budget this month',
      })),
    el('div', { class: 'store-simulated' }, 'SIMULADO — no real money changes hands.'),
  );

  return sheet({ title: 'Confirm purchase', onClose: back, centred: true }, body);
}
