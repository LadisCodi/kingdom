// A NOTICE'S CARD (Docs/features/26-notices.md §5, mockups m103 and m104):
// the parchment window a bubble opens. One news or a state: a paragraph, its
// picture wide, Go and its second button. A group: a row each, with its own
// Go. The +N: every notice as a row, each opening its own card.

import type { Game } from '../../game';
import { el } from '../format';
import { btn, sheet } from '../kit';
import { noticeCardOf, type Notice, type NoticeRow } from './model';

export function renderNoticeCard(game: Game): HTMLElement {
  const n = noticeCardOf(game);
  if (n === null) return sheet({ title: 'Notices', onClose: () => game.dismiss(), centred: true },
    el('p', { class: 'nt-body' }, 'Nothing new.'));
  return sheet({ title: n.title, onClose: () => game.dismiss(), centred: true },
    ...(n.rows.length > 0 ? [rows(game, n)] : single(n)));
}

/** A news or a state on its own. */
function single(n: Notice): HTMLElement[] {
  const buttons = [
    ...(n.go === null ? [] : [btn({ label: 'Go', kind: 'primary', icon: 'compass', onClick: n.go })]),
    ...(n.action === null ? [] : [n.action.make?.() ?? btn({ label: n.action.label, kind: n.go === null ? 'primary' : 'blue', onClick: n.action.run })]),
  ];
  return [
    ...(n.body === '' ? [] : [el('p', { class: 'nt-body' }, n.body)]),
    ...(n.picture === null ? [] : [el('div', { class: `nt-picture${n.view === 'world' ? ' is-world' : ''}` }, n.picture.make())]),
    ...(buttons.length === 0 ? [] : [el('div', { class: 'nt-actions' }, ...buttons)]),
  ];
}

/** A group, or the +N: one row each. */
function rows(game: Game, n: Notice): HTMLElement {
  return el('div', { class: 'nt-rows' }, ...n.rows.map((r) => row(game, r)));
}

function row(game: Game, r: NoticeRow): HTMLElement {
  const go = r.opens !== undefined
    ? btn({ label: 'Open', kind: 'primary', onClick: () => game.openNotice(r.opens!) })
    : r.go === null ? null : btn({ label: 'Go', kind: 'primary', onClick: r.go });
  return el('div', { class: 'nt-row' },
    el('span', { class: 'nt-row-art' }, r.art.make()),
    el('span', { class: 'nt-row-words' },
      el('b', { class: 'nt-row-name' }, r.name),
      ...(r.line === '' ? [] : [el('span', { class: 'nt-row-line' }, r.line)])),
    ...(go === null ? [] : [go]));
}
