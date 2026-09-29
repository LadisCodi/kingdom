// The Knowledge sheet (Docs/features/07-research.md §3.2, mockup M30 lower):
// the bar, and buying points of it with Gold or with Gems. Opened by the +
// on the Knowledge tab under the plank, and by tapping the tab itself.
//
// THREE OFFERS, ONE A ROW: one point for Gold, one for Gems, ten for Gems —
// a list rather than three tills side by side, which a phone cannot fit. Gold's price rises with every point ever bought and never resets, so
// its till says so; the Gem price never moves.

import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl, progress, sheet } from './kit';

/** One offer: what it is at the left, the button that buys it at the right. */
const offer = (title: string, note: string, button: HTMLElement): HTMLElement =>
  el('div', { class: 'knowledge-offer' },
    el('div', { class: 'knowledge-offer-copy' }, el('b', {}, title), el('span', {}, note)),
    button);

export function renderKnowledgeSheet(game: Game): HTMLElement {
  const k = game.knowledgeInfo();
  const bar = progress('blue');
  bar.set(Math.min(1, k.value / k.cap), `${k.value} / ${k.cap}`);

  const buy = (count: number, till: 'Gold' | 'Gems', note: string): HTMLElement => {
    const quote = game.knowledgeQuote(count);
    return offer(`${count} Knowledge`, note, btn({
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
      el('div', { class: 'knowledge-offers' },
        buy(1, 'Gold', 'Dearer every time'),
        buy(1, 'Gems', 'Always the same'),
        buy(10, 'Gems', 'Always the same'))),
  );

  return sheet({ title: 'Knowledge', onClose: () => game.dismiss(), centred: true }, body);
}
