// The Knowledge sheet (Docs/features/07-research.md §3.2, mockup M30 lower):
// the bar, and buying points of it with Gold or with Gems. Opened by the +
// on the Knowledge tab under the plank, and by tapping the tab itself.
//
// ONE COUNT, TWO PRICES. The stepper says how many points; the two tills
// under it are that many points at each price, side by side like the Mana
// sheet's — a player choosing between them is comparing them. Gold's price
// rises with every point ever bought and never resets, so its till says so.

import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl, knob, progress, sheet } from './kit';

/** How many points the stepper holds. Module-level so the per-tick
 *  re-render keeps it; null means "not chosen yet", which starts it at what
 *  fills the bar. */
let count: number | null = null;

const MAX_COUNT = 100;

export function renderKnowledgeSheet(game: Game): HTMLElement {
  const k = game.knowledgeInfo();
  const toFill = Math.max(1, k.cap - k.value);
  const n = Math.min(MAX_COUNT, Math.max(1, count ?? toFill));
  const set = (v: number): void => { count = Math.min(MAX_COUNT, Math.max(1, v)); game.notify(); };

  const bar = progress('blue');
  bar.set(Math.min(1, k.value / k.cap), `${k.value} / ${k.cap}`);

  const quote = game.knowledgeQuote(n);

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
        el('span', { class: 'mana-prize-copy' }, 'Buy Knowledge'),
        el('span', { class: 'knowledge-stepper' },
          knob('−', () => set(n - 1), { label: 'One fewer' }),
          el('b', { class: 'knowledge-count' }, String(n)),
          knob('+', () => set(n + 1), { label: 'One more' }))),
      el('div', { class: 'mana-tills' },
        el('div', { class: 'mana-till' },
          el('div', { class: 'mana-till-count' }, 'Dearer every point'),
          btn({
            label: 'Gold',
            kind: 'secondary',
            onClick: () => { game.doBuyKnowledge(n, 'Gold'); count = null; },
            cost: { Gold: quote.gold },
            have: (c) => game.walletValue(c),
          })),
        el('div', { class: 'mana-till' },
          el('div', { class: 'mana-till-count' }, 'Always the same'),
          btn({
            label: 'Gems',
            kind: 'gem',
            onClick: () => { game.doBuyKnowledge(n, 'Gems'); count = null; },
            cost: { Gems: quote.gems },
            have: (c) => game.walletValue(c),
          })))),
  );

  return sheet({
    title: 'Knowledge',
    onClose: () => { count = null; game.dismiss(); },
    centred: true,
  }, body);
}
