// THE WORLD RANKING (Docs/features/19-world-map.md §12, mockup m101): the
// kingdoms of the player's world, most hexes first. Each is a friends-list
// row — its place on a ribbon, its crest, its name and Townhall — with its
// hexes at the right. The list scrolls; the player's own row is warmed
// toward gold in it and pinned again at the foot, with how far the next
// place up is. A tap on a row glides to that city. It pays nothing.

import type { Game } from '../../game';
import { SEAT_INDICES } from '../../sim/world/board';
import { behind, type RankedSeat } from '../../sim/world/ranking';
import { el, formatCount, formatExact } from '../format';
import { iconEl, sheet } from '../kit';
import { crestEl, rankRibbon, townhallTag } from '../friends/kingdomBits';
import { tr, trn } from '../../i18n/tr';

export function renderRankingSheet(game: Game): HTMLElement {
  const rows = game.worldRanking() ?? [];
  const me = rows.find((r) => r.you);
  // The whole screen (`is-panes`, kit.css): the heading and the player's
  // own row stay put, and the list between them is what scrolls.
  const surface = sheet({ title: tr('Ranking'), onClose: () => game.dismiss(), tall: true },
    el('div', { class: 'rk-top' },
      el('p', { class: 'rk-where' }, trn(rows.length, '{n} kingdom in this world', '{n} kingdoms in this world', { n: formatExact(rows.length) })),
      el('div', { class: 'rk-head', 'aria-hidden': 'true' },
        el('span', {}, tr('Kingdom')), el('span', {}, tr('Hexes')))),
    el('div', { class: 'rk-list', 'data-keep-scroll': 'ranking' },
      el('div', { class: 'fr-rows' }, ...rows.map((r) => row(game, r, null)))),
    ...(me === undefined ? [] : [el('div', { class: 'rk-mine' }, row(game, me, gapWords(behind(rows))))]));
  surface.classList.add('is-panes');
  return surface;
}

/** The line under the player's name. */
function gapWords(gap: { hexes: number; rank: number } | null): string {
  if (gap === null) return tr('First in this world');
  return trn(gap.hexes, '{n} hex behind #{rank}', '{n} hexes behind #{rank}', { n: formatCount(gap.hexes), rank: formatExact(gap.rank) });
}

function row(game: Game, r: RankedSeat, note: string | null): HTMLElement {
  const b = el('button', {
    class: `fr-row is-tappable rk-row${r.you ? ' is-you' : ''}`, type: 'button',
    'aria-label': tr('{who}, place {rank}, {n} hexes. Show their city', { who: r.you ? tr('You') : r.name, rank: formatExact(r.rank), n: formatCount(r.hexes) }),
  },
  rankRibbon(r.rank),
  crestEl(r.name, r.crest),
  el('div', { class: 'fr-who' },
    el('div', { class: 'fr-name rk-name' }, r.you ? tr('You') : r.name,
      ...(r.friend ? [el('span', { class: 'rk-friend', title: tr('A friend') }, iconEl('friends', { size: 'sm' }))] : [])),
    ...(r.townhall === null ? [] : [el('div', { class: 'fr-sub' }, townhallTag(r.townhall))]),
    ...(note === null ? [] : [el('div', { class: 'fr-note rk-gap' }, note)])),
  el('span', { class: 'rk-hexes' }, iconEl('hex', { size: 'md' }), formatCount(r.hexes)));
  b.addEventListener('click', () => {
    game.dismiss();
    game.showHex(SEAT_INDICES[r.seat]);
  });
  return b;
}
