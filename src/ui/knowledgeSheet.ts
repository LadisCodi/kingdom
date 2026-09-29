// The Knowledge sheet (Docs/features/07-research.md §3.2, mockup M30 lower):
// the bar, and buying points of it with Gold or with Gems. Opened by the +
// on the Knowledge tab under the plank, and by tapping the tab itself.
//
// THREE OFFERS, SIDE BY SIDE: one point for Gold, one for Gems, ten for Gems,
// as three upright cards in the store's own shape (the Gem packs, M5) — the
// amount on top as the book and a number, a line under it, then the price. Gold's price rises with every point ever bought and never resets, so
// its till says so; the Gem price never moves.

import type { Game } from '../game';
import { el } from './format';
import { btn, currencyIcon, iconEl, progress, sheet } from './kit';

/** One offer: the amount over a line over the button that buys it. */
const offer = (count: number, note: string, button: HTMLElement): HTMLElement =>
  el('div', { class: 'store-pack knowledge-offer' },
    el('div', { class: 'store-pack-count knowledge-offer-count' },
      currencyIcon('Knowledge', { size: 'md' }), el('span', {}, String(count))),
    el('div', { class: 'knowledge-offer-note' }, note),
    button);

export function renderKnowledgeSheet(game: Game): HTMLElement {
  const k = game.knowledgeInfo();
  const bar = progress('blue');
  bar.set(Math.min(1, k.value / k.cap), `${k.value} / ${k.cap}`);

  const buy = (count: number, till: 'Gold' | 'Gems', note: string): HTMLElement => {
    const quote = game.knowledgeQuote(count);
    return offer(count, note, btn({
      label: 'Buy',
      kind: till === 'Gold' ? 'secondary' : 'gem',
      onClick: () => game.doBuyKnowledge(count, till),
      cost: till === 'Gold' ? { Gold: quote.gold } : { Gems: quote.gems },
      have: (c) => game.walletValue(c),
    }));
  };

  const body = el('div', { class: 'mana-sheet knowledge-sheet' },
    el('div', { class: 'mana-head' },
      iconEl('Knowledge', { size: 'lg' }),
      el('div', { class: 'mana-title' }, 'Knowledge'),
      el('div', { class: 'mana-hint' },
        k.full ? (k.over ? `${k.value - k.cap} past the bar — nothing is dripping` : 'Full — nothing is dripping')
          : k.fullIn ?? '')),
    bar.root,
    el('div', { class: 'mana-note' },
      `${k.perHour === 1 ? 'One' : k.perHour} an hour while under ${k.cap}. `
      + 'Landmarks, ruins and quests pay it in lumps, over the bar if they must.'),

    el('div', { class: 'mana-refills' },
      el('div', { class: 'mana-prize' },
        el('span', { class: 'mana-prize-copy' }, 'Buy Knowledge')),
      el('div', { class: 'store-packs knowledge-offers' },
        buy(1, 'Gold', 'Dearer every time'),
        buy(1, 'Gems', 'Always the same'),
        buy(10, 'Gems', 'Always the same'))),
  );

  return sheet({ title: 'Knowledge', onClose: () => game.dismiss(), centred: true }, body);
}
