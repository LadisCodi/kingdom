// The Knowledge sheet (Docs/features/07-research.md §3.2, mockup M30 lower):
// the bar, and buying points of it with Gold or with Gems. Opened by the +
// on the Knowledge tab under the plank, and by tapping the tab itself.
//
// THREE OFFERS, SIDE BY SIDE: one point for Gold, one for Gems, ten for Gems,
// each on a tile of darker paper — the building card's stat tiles (kit
// .k-section) — with the amount on top as the book and a number, and the
// price IS the button, as a Gem pack's is. No box around the three and no title over them: the sheet is
// already the frame, and the cards say what they sell. Gold's price rises with every point ever bought and never resets, so
// its till says so; the Gem price never moves.

import type { Game } from '../game';
import { el, formatExact } from './format';
import { btn, currencyIcon, iconEl, progress, sheet } from './kit';
import { tr } from '../i18n/tr';

/** One offer: the amount over the button that buys it, priced on its face. */
const offer = (count: number, button: HTMLElement): HTMLElement =>
  el('div', { class: 'k-section knowledge-offer' },
    el('div', { class: 'knowledge-offer-count' },
      currencyIcon('Knowledge', { size: 'md' }), el('span', {}, formatExact(count))),
    button);

export function renderKnowledgeSheet(game: Game): HTMLElement {
  const k = game.knowledgeInfo();
  const bar = progress('blue');
  bar.set(Math.min(1, k.value / k.cap), `${formatExact(k.value)} / ${formatExact(k.cap)}`);

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
      disabledReason: short ? (till === 'Gold' ? tr('Not enough Gold') : tr('Not enough Gems')) : undefined,
    }));
  };

  const body = el('div', { class: 'mana-sheet knowledge-sheet' },
    el('div', { class: 'mana-head' },
      iconEl('Knowledge', { size: 'lg' }),
      el('div', { class: 'mana-title' }, tr('Knowledge')),
      el('div', { class: 'mana-hint' },
        k.full ? (k.over ? tr('{n} past the bar — nothing is dripping', { n: formatExact(k.value - k.cap) }) : tr('Full — nothing is dripping'))
          : k.fullIn ?? '')),
    bar.root,
    // When the next point drips in. A full bar drips nothing, and the line
    // stays, blank, so the sheet does not change size.
    el('div', { class: 'mana-note' }, k.nextIn ?? '\u00a0'),

    el('div', { class: 'knowledge-offers' },
      buy(1, 'Gold'),
      buy(1, 'Gems'),
      buy(10, 'Gems')),
  );

  return sheet({ title: tr('Knowledge'), onClose: () => game.dismiss(), centred: true }, body);
}
