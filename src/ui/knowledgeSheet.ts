// The Knowledge sheet (Docs/features/07-research.md §3.2, mockup M30 lower):
// the bar, and buying points of it with Gold or with Gems. Opened by the +
// on the Knowledge tab under the plank, and by tapping the tab itself.
//
// THREE OFFERS, SIDE BY SIDE: one point for Gold, one for Gems, ten for Gems,
// as three upright cards in the store's own shape (the Gem packs, M5) — the
// amount on top as the book and a number, and the price IS the button, as a
// pack's is. No box around the three and no title over them: the sheet is
// already the frame, and the cards say what they sell. Gold's price rises with every point ever bought and never resets, so
// its till says so; the Gem price never moves.

import type { Game } from '../game';
import { el, formatExact } from './format';
import { btn, currencyIcon, iconEl, progress, sheet } from './kit';

/** One offer: the amount over the button that buys it, priced on its face. */
const offer = (count: number, button: HTMLElement): HTMLElement =>
  el('div', { class: 'store-pack knowledge-offer' },
    el('div', { class: 'store-pack-count knowledge-offer-count' },
      currencyIcon('Knowledge', { size: 'md' }), el('span', {}, String(count))),
    button);

export function renderKnowledgeSheet(game: Game): HTMLElement {
  const k = game.knowledgeInfo();
  const bar = progress('blue');
  bar.set(Math.min(1, k.value / k.cap), `${k.value} / ${k.cap}`);

  const buy = (count: number, till: 'Gold' | 'Gems'): HTMLElement => {
    const quote = game.knowledgeQuote(count);
    const price = till === 'Gold' ? quote.gold : quote.gems;
    const short = game.walletValue(till) < price;
    return offer(count, btn({
      label: formatExact(price),
      icon: till,
      kind: till === 'Gold' ? 'secondary' : 'gem',
      onClick: () => game.doBuyKnowledge(count, till),
      // The price is the label, so a till the player cannot pay is said by
      // the button going dark, and the reason is its screen-reader label.
      disabledReason: short ? `Not enough ${till}` : undefined,
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

    el('div', { class: 'store-packs knowledge-offers' },
      buy(1, 'Gold'),
      buy(1, 'Gems'),
      buy(10, 'Gems')),
  );

  return sheet({ title: 'Knowledge', onClose: () => game.dismiss(), centred: true }, body);
}
