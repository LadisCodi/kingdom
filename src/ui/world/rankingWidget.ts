// The world ranking's widget (Docs/features/19-world-map.md §12, mockup
// m100): the Survey widget's parchment card, under the explorers chip on the
// world board — a brass medallion with a laurel round a hex, "Ranking", the
// player's place and their hexes. A tap opens the ranking. Absent off the
// board, before the server has described it, and behind any sheet.
//
// Built once and mutated, like the explorers chip.

import type { Game } from '../../game';
import { el, formatCount, formatExact } from '../format';
import { iconEl } from '../kit';
import { setAttr, setHidden, setText } from '../domWrite';
import { tr, trn } from '../../i18n/tr';

export function mountRankingWidget(game: Game, root: HTMLElement): void {
  const place = el('b', { class: 'rkw-place' }, '');
  const hexes = el('span', {}, '');
  const widget = el('button', { class: 'svw rkw', type: 'button', 'aria-label': tr('Ranking') },
    el('span', { class: 'rkw-medal', 'aria-hidden': 'true' }),
    el('span', { class: 'svw-body' },
      el('span', { class: 'svw-name' }, tr('Ranking')),
      el('span', { class: 'rkw-line' }, place, el('span', { class: 'rkw-hexes' }, iconEl('hex', { size: 'sm' }), hexes))));
  widget.addEventListener('click', () => game.setOverlay('ranking'));
  root.replaceChildren(widget);

  const refresh = (): void => {
    const me = game.scene === 'world' && !game.hasOpenSheet() ? game.worldRanking()?.find((r) => r.you) : undefined;
    setHidden(root, me === undefined);
    if (me === undefined) return;
    setText(place, `#${formatExact(me.rank)}`);
    setText(hexes, trn(me.hexes, '{n} hex', '{n} hexes', { n: formatCount(me.hexes) }));
    setAttr(widget, 'aria-label', tr('Ranking: place {rank}, {n} hexes', { rank: formatExact(me.rank), n: formatCount(me.hexes) }));
  };
  game.onChange(refresh);
  refresh();
}
