// THE FRIENDS LIST (Docs/features/15-social.md §2.1), opened from its knob
// under the header.
//
// Top to bottom, as the player meets it: the player's own kingdom, pinned
// under the title with the pencil that opens the shield editor; then, in
// the one scroller, the requests (received, sent, suggested), a search, the
// invitation with the player's code, and the friends ranked by how far each
// has come. The door opens only once the kingdom has a name, so the screen
// never asks for one: the world board's is taken over on the first hello.
//
// Everything here reads `game.friends` (friendsClient.ts) and calls it.

import type { Game } from '../../game';
import { lastSeenWords, type RankedKingdom, type RequestsTab } from '../../friendsClient';
import { FRIENDS } from '../../sim/data/definitions';
import { crestId } from '../../sim/crest';
import type { KingdomView } from '../../socialServer/types';
import { el, formatExact } from '../format';
import { btn, knob, sectionHead, sheet } from '../kit';
import { crestEl, townhallTag } from './kingdomBits';

/** Accept and decline: the kit's painted knob, drawn a size up. */
const roundKnob = (b: HTMLButtonElement): HTMLButtonElement => { b.classList.add('fr-round'); return b; };

export function renderFriendsSheet(game: Game): HTMLElement {
  const f = game.friends;
  const ready = f.server !== null && f.snap !== null && f.named();
  const body = (): HTMLElement[] => {
    if (f.server === null) return [el('p', { class: 'fr-empty' }, 'Friends need the messengers, and none can be reached.')];
    if (!ready) return [el('p', { class: 'fr-empty' }, 'Sending for news of your friends…')];
    return [
      requestsPanel(game),
      searchPanel(game),
      invitePanel(game),
      friendsPanel(game),
    ];
  };
  // The sections come in one after another the first time they are drawn
  // after opening, never on a rebuild.
  const settled = f.settled;
  if (ready) f.settled = true;
  // The whole screen however little it holds (`is-panes`, kit.css): the
  // player's own kingdom stays put, and everything under it scrolls.
  const surface = sheet({ title: 'Friends', onClose: () => game.dismiss(), tall: true },
    ...(ready ? [ownCard(game)] : []),
    el('div', { class: `fr${ready ? ' is-named' : ''}${settled ? ' is-settled' : ''}`, 'data-keep-scroll': 'friends' }, ...body()));
  surface.classList.add('is-panes');
  return surface;
}

// ------------------------------------------------------------ the player

/** The player's own kingdom: their place among their friends, their crest,
 *  name and code, how far they have come — and the pencil. */
function ownCard(game: Game): HTMLElement {
  const f = game.friends;
  const me = f.ranked().find((k) => k.isMe)!;
  const edit = knob('✎', () => f.openCrestEditor(), { label: 'Change your crest', kind: 'primary' });
  edit.classList.add('fr-edit');
  return el('div', { class: 'fr-me' },
    rankRibbon(me.rank),
    el('span', { class: 'fr-me-crest' }, crestEl(me.nickname, crestId(game.myCrest()), 'lg')),
    el('div', { class: 'fr-who' },
      el('div', { class: 'fr-name' }, me.nickname),
      el('div', { class: 'fr-sub' }, townhallTag(me.townhall), el('span', { class: 'fr-me-code' }, me.code))),
    edit);
}

// ------------------------------------------------------------ requests

function requestsPanel(game: Game): HTMLElement {
  const f = game.friends;
  const snap = f.snap!;
  const tab = (id: RequestsTab, label: string, count: number): HTMLElement => {
    const open = f.tab === id;
    const b = el('button', {
      class: `bld-tab fr-tab${open ? ' is-open' : ''}`, type: 'button', role: 'tab', 'aria-selected': open ? 'true' : 'false',
    },
    el('span', { class: 'bld-tab-label' }, label),
    // A red wax seal with the count, on the received the moment someone
    // asks, and on the sent while any wait.
    ...(count > 0 ? [el('span', { class: `fr-count${id === 'received' ? ' is-asking' : ''}` }, formatExact(count))] : []));
    b.addEventListener('click', () => { f.tab = id; game.notify(); });
    return b;
  };
  const tabs = el('div', { class: 'bld-tabs fr-tabs', role: 'tablist' },
    tab('received', 'Received', snap.incoming.length),
    tab('sent', 'Sent', snap.outgoing.length),
    tab('suggested', 'Suggested', 0));

  const busy = (code: string) => f.busy.has(code);
  let rows: HTMLElement[];
  let empty: string;
  if (f.tab === 'received') {
    empty = 'Nobody is asking just now.';
    rows = snap.incoming.map((k) => kingdomRow(k, {
      trailing: [
        roundKnob(knob('✓', () => void f.accept(k.code), { label: `Accept ${k.nickname}`, kind: 'primary', disabled: busy(k.code) })),
        roundKnob(knob('✕', () => void f.decline(k.code), { label: `Decline ${k.nickname}`, kind: 'destructive', disabled: busy(k.code) })),
      ],
    }));
  } else if (f.tab === 'sent') {
    empty = 'No request is waiting for an answer.';
    rows = snap.outgoing.map((k) => kingdomRow(k, {
      note: 'Waiting',
      trailing: [btn({ label: 'Cancel', onClick: () => void f.cancel(k.code), ...(busy(k.code) ? { disabledReason: 'Sending' } : {}) })],
    }));
  } else {
    empty = 'No kingdom to suggest yet.';
    rows = snap.suggestions.map((k) => kingdomRow(k, { trailing: [addButton(game, k)] }));
  }
  return el('section', { class: 'fr-requests' },
    sectionHead('Requests'),
    tabs,
    el('div', { class: 'fr-rows' }, ...(rows.length > 0 ? rows : [el('p', { class: 'fr-empty' }, empty)])));
}

/** The button that asks a kingdom — or says where things stand with it. */
function addButton(game: Game, k: KingdomView): HTMLElement {
  const f = game.friends;
  const snap = f.snap!;
  if (snap.me?.code === k.code) return el('span', { class: 'fr-state' }, 'You');
  if (snap.friends.some((x) => x.code === k.code)) return el('span', { class: 'fr-state' }, 'Friends');
  if (snap.outgoing.some((x) => x.code === k.code)) return el('span', { class: 'fr-state' }, 'Asked');
  const theyAsked = snap.incoming.some((x) => x.code === k.code);
  const full = snap.friends.length >= FRIENDS.max;
  return btn({
    label: theyAsked ? 'Accept' : 'Add', kind: 'primary',
    onClick: () => void f.request(k.code),
    ...(f.busy.has(k.code) ? { disabledReason: 'Sending' } : full ? { disabledReason: 'Your list is full' } : {}),
  });
}

// ------------------------------------------------------------ search

function searchPanel(game: Game): HTMLElement {
  const f = game.friends;
  const input = el('input', {
    class: 'fr-field', type: 'search', maxlength: '32', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Name or friend code', 'aria-label': 'Find a kingdom by name or friend code',
  }) as HTMLInputElement;
  input.value = f.query;
  input.addEventListener('input', () => { f.query = input.value; });
  const go = (): void => void f.search(input.value);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const found = f.found === null ? [] : f.found.length === 0
    ? [el('p', { class: 'fr-empty' }, 'No kingdom answers to that.')]
    : f.found.map((k) => kingdomRow(k, { trailing: [addButton(game, k)] }));
  return el('section', { class: 'fr-search' },
    el('div', { class: 'fr-search-row' },
      input,
      btn({ label: 'Search', onClick: go, ...(f.searching ? { disabledReason: 'Searching' } : {}) })),
    ...(found.length > 0 ? [el('div', { class: 'fr-rows fr-found' }, ...found)] : []));
}

// ------------------------------------------------------------ invite

function invitePanel(game: Game): HTMLElement {
  const f = game.friends;
  const code = f.snap!.me!.code;
  const plate = el('button', { class: 'fr-code', type: 'button', 'aria-label': `Copy your friend code, ${code}` },
    el('span', { class: 'fr-code-label' }, 'Your code'),
    el('b', { class: 'fr-code-value' }, code));
  plate.addEventListener('click', () => void f.copyCode());
  return el('section', { class: 'fr-invite' },
    plate,
    btn({ label: 'Invite', kind: 'primary', onClick: () => void f.invite() }));
}

// ------------------------------------------------------------ friends

function friendsPanel(game: Game): HTMLElement {
  const f = game.friends;
  // The player is ranked with their friends, but drawn pinned above: the
  // list holds only the friends, their places counting the player's.
  const rows = f.ranked().filter((k) => !k.isMe).map((k) => kingdomRow(k, {
    rank: k,
    onTap: () => f.openProfile(k.code),
    trailing: [el('span', { class: `fr-seen${lastSeenWords(k.seenAt, game.now()) === 'Online now' ? ' is-online' : ''}` },
      lastSeenWords(k.seenAt, game.now()))],
  }));
  return el('section', { class: 'fr-list' },
    sectionHead(`Friends ${formatExact(rows.length)}/${formatExact(FRIENDS.max)}`),
    ...(rows.length > 0
      ? [el('div', { class: 'fr-rows' }, ...rows)]
      : [el('p', { class: 'fr-empty' }, 'Add a kingdom above, or invite a friend with your code.')]));
}

// ------------------------------------------------------------ a row

function kingdomRow(
  k: KingdomView,
  opts: { rank?: RankedKingdom; trailing?: Node[]; onTap?: () => void; note?: string },
): HTMLElement {
  const tappable = opts.onTap !== undefined;
  const row = el(tappable ? 'button' : 'div', {
    class: `fr-row${tappable ? ' is-tappable' : ''}`,
    ...(tappable ? { type: 'button', 'aria-label': `${k.nickname}, open their profile` } : {}),
  },
  ...(opts.rank === undefined ? [] : [rankRibbon(opts.rank.rank)]),
  crestEl(k.nickname, k.crest),
  el('div', { class: 'fr-who' },
    el('div', { class: 'fr-name' }, k.nickname),
    el('div', { class: 'fr-sub' }, townhallTag(k.townhall), ...(opts.note === undefined ? [] : [el('span', { class: 'fr-note' }, opts.note)]))),
  el('div', { class: 'fr-trail' }, ...(opts.trailing ?? [])));
  if (tappable) row.addEventListener('click', opts.onTap!);
  return row;
}

/** Gold, silver and bronze for the podium; a plain ribbon past it. */
function rankRibbon(rank: number | null): HTMLElement {
  const tone = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'plain';
  return el('span', { class: `fr-rank is-${tone}`, ...(rank === null ? { 'aria-hidden': 'true' } : { 'aria-label': `Place ${formatExact(rank)}` }) },
    rank === null ? '' : formatExact(rank));
}

export { renderFriendProfile } from './friendProfile';
