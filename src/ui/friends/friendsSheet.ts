// THE FRIENDS LIST (Docs/features/15-social.md §2.1), opened from its knob
// under the header, on two tabs: the List and the Inbox (§2.3,
// inboxPane.ts).
//
// The List, top to bottom: the player's own kingdom, pinned under the tabs
// with the pencil that opens the crest editor; then, in the one scroller,
// the requests — received, sent and suggested in one list — with Share and
// Search under them, and the friends ranked by how far each has come. The
// door opens only once the kingdom has a name, so the screen never asks for
// one: the world board's is taken over on the first hello.
//
// Everything here reads `game.friends` (friendsClient.ts) and calls it.

import type { Game } from '../../game';
import { tr } from '../../i18n/tr';
import { lastSeenWords, type FriendsTab, type RankedKingdom } from '../../friendsClient';
import { FRIEND_HELP, FRIENDS } from '../../sim/data/definitions';
import { crestId } from '../../sim/crest';
import type { KingdomView } from '../../socialServer/types';
import { el, formatCountdown, formatExact } from '../format';
import { btn, ctaBadge, knob, sectionHead, sheet } from '../kit';
import { expiresWords, inboxPane } from './inboxPane';
import { tradePane } from './tradePane';
import { crestEl, rankRibbon, roundKnob, townhallTag } from './kingdomBits';

export function renderFriendsSheet(game: Game): HTMLElement {
  const f = game.friends;
  const ready = f.server !== null && f.snap !== null && f.named();
  const body = (): HTMLElement[] => {
    if (f.server === null) return [el('p', { class: 'fr-empty' }, tr('Friends need the messengers, and none can be reached.'))];
    if (!ready) return [el('p', { class: 'fr-empty' }, tr('Sending for news of your friends…'))];
    if (f.tab === 'inbox') return inboxPane(game);
    if (f.tab === 'trade') return tradePane(game);
    return [requestsPanel(game), friendsPanel(game)];
  };
  // The sections come in one after another the first time they are drawn
  // after opening, never on a rebuild.
  const settled = f.settled;
  if (ready) f.settled = true;
  // The whole screen however little it holds (`is-panes`, kit.css): the tabs
  // and the player's own kingdom stay put, and everything under them scrolls.
  const surface = sheet({ title: tr('Friends'), onClose: () => game.dismiss(), tall: true },
    ...(ready ? [tabRow(game)] : []),
    ...(ready && f.tab === 'list' ? [ownCard(game)] : []),
    el('div', {
      class: `fr${ready ? ' is-named' : ''}${settled ? ' is-settled' : ''}`, 'data-keep-scroll': `friends-${f.tab}`,
    }, ...body()));
  surface.classList.add('is-panes');
  return surface;
}

/** List, Trade and Inbox: the Build menu's wooden plates; the call to action
 *  on Trade while a friend's wish can be filled, and on the Inbox for what is
 *  unread. */
function tabRow(game: Game): HTMLElement {
  const f = game.friends;
  const tab = (id: FriendsTab, label: string, count: number): HTMLElement => {
    const open = f.tab === id;
    const b = el('button', {
      class: `bld-tab fr-tab${open ? ' is-open' : ''}`, type: 'button', role: 'tab', 'aria-selected': open ? 'true' : 'false',
    },
    el('span', { class: 'bld-tab-label' }, label),
    ...(count > 0 ? [ctaBadge(count, `friends-tab:${id}`)] : []));
    b.addEventListener('click', () => f.setTab(id));
    return b;
  };
  return el('div', { class: 'bld-tabs fr-tabs', role: 'tablist' },
    tab('list', tr('List'), 0),
    tab('trade', tr('Trade'), f.fillable().length),
    tab('inbox', tr('Inbox'), f.unread()));
}

// ------------------------------------------------------------ the player

/** The player's own kingdom: their place among their friends, their crest,
 *  name and code — a tap on the code copies it — and the pencil. */
function ownCard(game: Game): HTMLElement {
  const f = game.friends;
  const me = f.ranked().find((k) => k.isMe)!;
  const edit = knob('✎', () => f.openCrestEditor(), { label: tr('Change your crest'), kind: 'primary' });
  edit.classList.add('fr-edit');
  const code = el('button', { class: 'fr-me-code', type: 'button', 'aria-label': tr('Copy your friend code, {code}', { code: me.code }) }, me.code);
  code.addEventListener('click', () => void f.copyCode());
  return el('div', { class: 'fr-me' },
    rankRibbon(me.rank),
    el('span', { class: 'fr-me-crest' }, crestEl(me.nickname, crestId(game.myCrest()), 'lg')),
    el('div', { class: 'fr-who' },
      el('div', { class: 'fr-name' }, me.nickname),
      el('div', { class: 'fr-sub' }, townhallTag(me.townhall), code)),
    edit);
}

// ------------------------------------------------------------ requests

/** One list, as Theme Park has it: those asking the player, then those the
 *  player asked, then kingdoms to ask — the suggestions filling it to its
 *  rows. Share and Search under it. */
function requestsPanel(game: Game): HTMLElement {
  const f = game.friends;
  const snap = f.snap!;
  const busy = (code: string) => f.busy.has(code);
  const full = snap.friends.length >= FRIENDS.max;
  const rows = [
    ...snap.incoming.map((k) => kingdomRow(k, {
      note: tr('Sent you a friend request'),
      fine: expiresWords(k.at + FRIENDS.requestHours * 3600_000, game.now()),
      trailing: [
        roundKnob(knob('✕', () => void f.decline(k.code), { label: tr('Decline {name}', { name: k.nickname }), kind: 'destructive', disabled: busy(k.code) })),
        roundKnob(knob('✓', () => void f.accept(k.code), { label: tr('Accept {name}', { name: k.nickname }), kind: 'primary', disabled: busy(k.code) })),
      ],
    })),
    ...snap.outgoing.map((k) => kingdomRow(k, {
      note: tr('Awaiting response…'),
      trailing: [el('span', { class: 'fr-wait', role: 'img', 'aria-label': tr('Waiting for an answer') })],
    })),
    ...snap.suggestions.map((k) => kingdomRow(k, {
      note: tr('Suggested friend'),
      trailing: [roundKnob(knob('+', () => void f.request(k.code), {
        label: tr('Ask {name} to be friends', { name: k.nickname }), kind: 'primary', disabled: busy(k.code) || full,
      }))],
    })),
  ];
  return el('section', { class: 'fr-requests' },
    sectionHead(tr('Friend requests')),
    el('div', { class: 'fr-rows' }, ...(rows.length > 0 ? rows : [el('p', { class: 'fr-empty' }, tr('No pending requests'))])),
    el('div', { class: 'fr-ask' },
      btn({ label: tr('Share'), kind: 'primary', onClick: () => void f.invite() }),
      btn({ label: tr('Search'), onClick: () => f.openSearch() })));
}

// ------------------------------------------------------------ friends

function friendsPanel(game: Game): HTMLElement {
  const f = game.friends;
  // The player is ranked with their friends, but drawn pinned above: the
  // list holds only the friends, their places counting the player's.
  const now = game.now();
  const left = f.snap?.helpsLeft ?? 0;
  const rows = f.ranked().filter((k) => !k.isMe).map((k) => kingdomRow(k, {
    rank: k,
    onTap: () => f.openProfile(k.code),
    trailing: [el('div', { class: 'fr-help' },
      el('span', { class: `fr-seen${lastSeenWords(k.seenAt, now) === tr('Online now') ? ' is-online' : ''}` },
        lastSeenWords(k.seenAt, now)),
      helpControl(game, k.code, left))],
  }));
  return el('section', { class: 'fr-list' },
    el('div', { class: 'wb-theirs-head' },
      sectionHead(tr('Friends {n}/{max}', { n: formatExact(rows.length), max: formatExact(FRIENDS.max) })),
      ...(rows.length > 0 ? [el('span', { class: 'wb-fills' }, tr('Helps {n}/{max}', { n: formatExact(left), max: formatExact(FRIEND_HELP.perDay) }))] : [])),
    ...(rows.length > 0
      ? [el('div', { class: 'fr-rows' }, ...rows)]
      : [el('p', { class: 'fr-empty' }, tr('Add a kingdom above, or invite a friend with your code.'))]));
}

/** A friend's Help (15 §3): once in any 24 hours each, within the helps
 *  left; once given, how long until it can be given again. */
function helpControl(game: Game, code: string, left: number): HTMLElement {
  const f = game.friends;
  const at = f.helpedAt(code);
  if (at !== null) {
    const again = Math.max(0, (at + 24 * 3_600_000 - game.now()) / 1000);
    return el('span', { class: 'fr-helped' }, tr('Helped · again in {time}', { time: formatCountdown(again) }));
  }
  const help = btn({
    label: tr('Help'), kind: 'primary', onClick: () => void f.help(code),
    ...(f.busy.has(code) ? { disabledReason: tr('Sending') } : left <= 0 ? { disabledReason: tr('No helps left today') } : {}),
  });
  // The row opens the profile; the button only helps.
  help.addEventListener('click', (e) => e.stopPropagation());
  return help;
}

// ------------------------------------------------------------ a row

function kingdomRow(
  k: KingdomView,
  opts: { rank?: RankedKingdom; trailing?: Node[]; onTap?: () => void; note?: string; fine?: string },
): HTMLElement {
  const tappable = opts.onTap !== undefined;
  // A div that acts as a button, so a row may carry buttons of its own.
  const row = el('div', {
    class: `fr-row${tappable ? ' is-tappable' : ''}`,
    ...(tappable ? { role: 'button', tabindex: '0', 'aria-label': tr('{name}, open their profile', { name: k.nickname }) } : {}),
  },
  ...(opts.rank === undefined ? [] : [rankRibbon(opts.rank.rank)]),
  crestEl(k.nickname, k.crest),
  el('div', { class: 'fr-who' },
    el('div', { class: 'fr-name' }, k.nickname),
    // A request says where it stands in place of how far the kingdom has
    // come, as Theme Park's does; a fine line under it, the time left.
    opts.note === undefined
      ? el('div', { class: 'fr-sub' }, townhallTag(k.townhall))
      : el('div', { class: 'fr-note' }, opts.note),
    ...(opts.fine === undefined ? [] : [el('div', { class: 'fr-fine' }, opts.fine)])),
  el('div', { class: 'fr-trail' }, ...(opts.trailing ?? [])));
  if (tappable) {
    row.addEventListener('click', opts.onTap!);
    row.addEventListener('keydown', (e) => {
      if (e.target === row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        opts.onTap!();
      }
    });
  }
  return row;
}

/** Gold, silver and bronze for the podium; a plain ribbon past it. */
export { renderFriendProfile } from './friendProfile';
