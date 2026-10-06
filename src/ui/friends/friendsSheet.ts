// THE FRIENDS LIST (Docs/features/15-social.md §2.1), opened from its knob
// under the header.
//
// Top to bottom, as the player meets it: the requests (received, sent,
// suggested), a search, the invitation with the player's own code, the list
// of friends ranked by how far each has come, and the reward path at the
// foot. The first visit without a name asks for one, and the rest arrives.
//
// Everything here reads `game.friends` (friendsClient.ts) and calls it.

import { itemWords, type Game } from '../../game';
import { lastSeenWords, type RankedKingdom, type RequestsTab } from '../../friendsClient';
import { FRIENDS } from '../../sim/data/definitions';
import type { ItemId } from '../../sim/state';
import type { KingdomView } from '../../socialServer/types';
import { NICKNAME_MAX, nicknameProblem } from '../../worldServer/nickname';
import { el, formatExact } from '../format';
import { itemIcon } from '../itemArt';
import { btn, currencyIcon, iconEl, knob, sectionHead, sheet, withTooltip } from '../kit';
import { crestEl, townhallTag } from './kingdomBits';

/** Accept and decline: the kit's painted knob, drawn a size up. */
const roundKnob = (b: HTMLButtonElement): HTMLButtonElement => { b.classList.add('fr-round'); return b; };

export function renderFriendsSheet(game: Game): HTMLElement {
  const f = game.friends;
  const body = (): HTMLElement[] => {
    if (f.server === null) return [el('p', { class: 'fr-empty' }, 'Friends need the messengers, and none can be reached.')];
    if (f.snap === null) return [el('p', { class: 'fr-empty' }, 'Sending for news of your friends…')];
    if (!f.named()) return [nameStep(game)];
    return [
      requestsPanel(game),
      searchPanel(game),
      invitePanel(game),
      friendsPanel(game),
      ...(f.path() === null ? [] : [rewardPath(game)]),
    ];
  };
  // The sections come in one after another the first time they are drawn
  // after opening — and after a name is taken (§2.1) — never on a rebuild.
  const settled = f.settled;
  if (f.named()) f.settled = true;
  return sheet({ title: 'Friends', onClose: () => game.dismiss(), tall: true },
    el('div', { class: `fr${f.named() ? ' is-named' : ''}${settled ? ' is-settled' : ''}` }, ...body()));
}

// ------------------------------------------------------------ the name

/** The first visit: a name before anything else — the same name the world
 *  board will know the kingdom by. */
function nameStep(game: Game): HTMLElement {
  const f = game.friends;
  const input = el('input', {
    class: 'nick-field', type: 'text', maxlength: String(NICKNAME_MAX + 4), autocomplete: 'off',
    autocapitalize: 'words', spellcheck: 'false', placeholder: 'Your name', 'aria-label': 'Your name',
  }) as HTMLInputElement;
  input.value = f.nicknameDraft;
  const hint = el('div', { class: 'nick-hint' });
  const showHint = (): void => {
    const line = f.nicknameRefused ?? (f.nicknameDraft === '' ? null : nicknameProblem(f.nicknameDraft));
    hint.textContent = line ?? 'Three to sixteen letters, numbers or spaces';
    hint.classList.toggle('is-refused', line !== null);
  };
  showHint();
  const go = (): void => void f.takeName(input.value);
  input.addEventListener('input', () => {
    f.nicknameDraft = input.value;
    f.nicknameRefused = null;
    showHint();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  globalThis.requestAnimationFrame?.(() => input.focus());
  return el('div', { class: 'nick fr-name' },
    el('div', { class: 'nick-lede' },
      iconEl('crest', { size: 'lg' }),
      el('div', {},
        el('p', {}, 'Before you call on friends, tell them who you are.'),
        el('p', {}, 'Other kingdoms will know you by this name, here and on the world map.'))),
    input,
    hint,
    btn({
      label: f.naming ? 'Sending…' : 'Confirm', kind: 'primary', onClick: go,
      ...(f.naming ? { disabledReason: 'Sending' } : {}),
    }),
    el('div', { class: 'nick-fine' }, iconEl('padlock', { size: 'sm' }), 'The name is for good: it cannot be changed later.'));
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
  const ranked = f.ranked();
  const friends = ranked.length - 1;
  const rows = ranked.map((k) => kingdomRow(k, {
    rank: k,
    onTap: k.isMe ? undefined : () => f.openProfile(k.code),
    trailing: [el('span', { class: `fr-seen${!k.isMe && lastSeenWords(k.seenAt, game.now()) === 'Online now' ? ' is-online' : ''}` },
      k.isMe ? 'You' : lastSeenWords(k.seenAt, game.now()))],
  }));
  return el('section', { class: 'fr-list' },
    sectionHead(`Friends ${formatExact(friends)}/${formatExact(FRIENDS.max)}`),
    el('div', { class: 'fr-rows' }, ...rows),
    ...(friends === 0 ? [el('p', { class: 'fr-empty' }, 'Add a kingdom above, or invite a friend with your code.')] : []));
}

// ------------------------------------------------------------ rewards

/** The reward path at the foot of the screen: a track of milestones, the
 *  ones reached glowing until they are taken, the rest telling what they
 *  hold on a tap. Put away once every reward is taken. */
function rewardPath(game: Game): HTMLElement {
  const f = game.friends;
  const path = f.path()!;
  const last = path.milestones[path.milestones.length - 1];
  const top = last.friends;
  const fill = Math.min(1, path.counting / top);
  const nodes = path.milestones.map((m) => {
    const claimed = path.claimed.includes(m.index);
    const ready = !claimed && path.counting >= m.friends;
    const isLast = m === last;
    const gems = m.reward.wallet.Gems ?? 0;
    const item = Object.keys(m.reward.items)[0] as ItemId | undefined;
    const art = item !== undefined ? iconEl(itemIcon(item), { size: 'lg' }) : currencyIcon('Gems', { size: 'lg' });
    const words = rewardWords(gems, item);
    const node = el('button', {
      class: `fr-node${claimed ? ' is-claimed' : ''}${ready ? ' is-ready' : ''}${isLast ? ' is-last' : ''}`
        + `${f.justClaimed.has(m.index) ? ' is-popping' : ''}`,
      type: 'button',
      style: `--at: ${(m.friends / top).toFixed(4)}`,
      'aria-label': `${formatExact(m.friends)} friends: ${words}${claimed ? ', taken' : ready ? ', ready to take' : ''}`,
    },
    el('span', { class: 'fr-node-art' }, art, ...(claimed ? [el('span', { class: 'fr-node-tick' }, iconEl('tick', { size: 'sm' }))] : [])),
    el('span', { class: 'fr-node-count' }, formatExact(m.friends)));
    // Ready: a tap takes it. Otherwise a tap says what it holds — the last
    // one above all, which is the one worth reaching for.
    if (ready) node.addEventListener('click', () => f.claim(m.index));
    else withTooltip(node, words, claimed ? 'Taken' : `${formatExact(m.friends)} friends`);
    return node;
  });
  f.justClaimed.clear();
  return el('section', { class: 'fr-path' },
    el('div', { class: 'fr-path-head' },
      el('b', {}, 'Friend rewards'),
      el('span', {}, `${formatExact(Math.min(path.counting, top))}/${formatExact(top)}`)),
    el('div', { class: 'fr-track' },
      el('div', { class: 'fr-track-bar' }, el('div', { class: 'fr-track-fill', style: `width: ${(fill * 100).toFixed(1)}%` })),
      ...nodes),
    el('p', { class: 'fr-path-note' }, `A friend counts once their Townhall reaches level ${formatExact(FRIENDS.countsFromTownhall)}.`));
}

function rewardWords(gems: number, item: ItemId | undefined): string {
  return [...(gems > 0 ? [`${formatExact(gems)} Gems`] : []), ...(item !== undefined ? [itemWords(item)] : [])].join(' and ');
}

// ------------------------------------------------------------ a row

function kingdomRow(
  k: KingdomView,
  opts: { rank?: RankedKingdom; trailing?: Node[]; onTap?: () => void; note?: string },
): HTMLElement {
  const me = opts.rank?.isMe === true;
  const tappable = opts.onTap !== undefined;
  const row = el(tappable ? 'button' : 'div', {
    class: `fr-row${me ? ' is-me' : ''}${tappable ? ' is-tappable' : ''}`,
    ...(tappable ? { type: 'button', 'aria-label': `${k.nickname}, open their profile` } : {}),
  },
  ...(opts.rank === undefined ? [] : [rankRibbon(opts.rank.rank)]),
  crestEl(k.nickname, k.code),
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
