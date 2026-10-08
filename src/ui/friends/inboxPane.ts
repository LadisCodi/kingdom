// THE INBOX (Docs/features/15-social.md §2.3): the friends screen's third
// tab. What other kingdoms have sent — a request to be friends, answered
// here as on the list, the answers to the player's own, and the wish board's
// news (§2.4) — under New and Old. Opening the tab reads what is new; it moves under Old on the next
// visit, not while the player is looking. Delete read clears Old.

import type { Game } from '../../game';
import { tr } from '../../i18n/tr';
import type { MessageView } from '../../socialServer/types';
import { el, formatCountdown, formatExact } from '../format';
import { btn, iconEl, knob, sectionHead } from '../kit';
import { crestEl, roundKnob } from './kingdomBits';
import { lotArt, lotWords } from './lotArt';
import { FRIEND_HELP, ITEMS } from '../../sim/data/definitions';
import { tileArt } from '../itemArt';

export function inboxPane(game: Game): HTMLElement[] {
  const f = game.friends;
  const inbox = f.snap?.inbox ?? [];
  const isNew = (m: MessageView) => m.readAt === null || f.readThisVisit.has(m.id);
  const fresh = inbox.filter(isNew);
  const old = inbox.filter((m) => !isNew(m));
  const section = (title: string, list: MessageView[], empty: string): HTMLElement =>
    el('section', { class: 'fr-inbox' },
      sectionHead(title),
      el('div', { class: 'fr-rows' }, ...(list.length > 0 ? list.map((m) => messageRow(game, m)) : [el('p', { class: 'fr-empty' }, empty)])));
  return [
    section(tr('New messages'), fresh, tr('No new messages')),
    section(tr('Old messages'), old, tr('No old messages')),
    ...(old.length > 0
      ? [el('div', { class: 'fr-inbox-foot' }, btn({ label: tr('Delete read'), kind: 'destructive', onClick: () => void f.deleteRead() }))]
      : []),
  ];
}

/** One message: who sent it, what it says, when — and, for a request
 *  waiting, the answer buttons and the time left to answer. */
function messageRow(game: Game, m: MessageView): HTMLElement {
  const f = game.friends;
  const now = game.now();
  const who = m.from.nickname;
  let line: string;
  let fine: string | null = null;
  let trailing: Node[] = [];
  switch (m.kind) {
    case 'request':
      if (m.state === 'pending') {
        line = tr('Sent you a friend request');
        fine = expiresWords(m.expiresAt, now);
        const busy = f.busy.has(m.from.code);
        trailing = [
          roundKnob(knob('✕', () => void f.decline(m.from.code), { label: tr('Decline {name}', { name: who }), kind: 'destructive', disabled: busy })),
          roundKnob(knob('✓', () => void f.accept(m.from.code), { label: tr('Accept {name}', { name: who }), kind: 'primary', disabled: busy })),
        ];
      } else if (m.state === 'accepted') {
        line = tr('You accepted their friend request');
        trailing = [outcome('accepted')];
      } else if (m.state === 'declined') {
        line = tr('You declined their friend request');
        trailing = [outcome('declined')];
      } else {
        line = tr('Their friend request expired');
        trailing = [outcome('expired')];
      }
      break;
    case 'accepted':
      line = tr('Accepted your friend request: you are friends now');
      trailing = [outcome('accepted')];
      break;
    case 'declined':
      line = tr('Declined your friend request');
      trailing = [outcome('declined')];
      break;
    // The wish board (§2.4): what moved, on the message.
    case 'wishFilled':
      line = tr('Filled your wish');
      trailing = [lotArt(m.lots!.got)];
      fine = tr('You got {lot}', { lot: lotWords(m.lots!.got) });
      break;
    case 'filledWish':
      line = tr('You filled their wish');
      trailing = [lotArt(m.lots!.got)];
      fine = tr('You got {lot}', { lot: lotWords(m.lots!.got) });
      break;
    // Daily help (§3): the gift is in the Bag already.
    case 'helped':
      line = tr('Helped your kingdom');
      trailing = [el('span', { class: 'wb-art is-gift' }, ...tileArt(FRIEND_HELP.giftItem, ''))];
      fine = tr('{item} in your Bag', { item: ITEMS[FRIEND_HELP.giftItem].name });
      break;
    case 'wishExpired':
      line = tr('Nobody filled your wish');
      trailing = [lotArt(m.lots!.got)];
      fine = tr('{lot} came back', { lot: lotWords(m.lots!.got) });
      break;
  }
  // Read, a message says when it was read rather than when it came (§2.3).
  const stamp = m.readAt ?? m.at;
  return el('div', { class: `fr-row fr-msg${m.readAt === null ? ' is-unread' : ''}` },
    crestEl(who, m.from.crest),
    el('div', { class: 'fr-who' },
      el('div', { class: 'fr-msg-head' }, el('span', { class: 'fr-name' }, who), el('span', { class: 'fr-msg-time' }, agoWords(stamp, now))),
      el('div', { class: 'fr-note' }, line),
      ...(fine === null ? [] : [el('div', { class: `fr-fine${m.kind === 'request' ? '' : ' is-trade'}` }, fine)])),
    el('div', { class: 'fr-trail' }, ...trailing));
}

/** How a request ended: a green tick, a red cross, or a grey hourglass. */
function outcome(how: 'accepted' | 'declined' | 'expired'): HTMLElement {
  const label = how === 'accepted' ? tr('Accepted') : how === 'declined' ? tr('Declined') : tr('Expired');
  return el('span', { class: `fr-outcome is-${how}`, role: 'img', 'aria-label': label },
    how === 'accepted' ? iconEl('tick', { size: 'sm' }) : how === 'declined' ? '✕' : iconEl('hourglass', { size: 'sm' }));
}

/** A request's time to answer: *Expires in 1d 23h*. */
export const expiresWords = (at: number, now: number): string =>
  tr('Expires in {time}', { time: formatCountdown(Math.max(0, (at - now) / 1000)) });

/** How long ago, roughly: *Just now*, *5m ago*, *3h ago*, *2d ago*. */
export function agoWords(at: number, now: number): string {
  const min = Math.floor(Math.max(0, now - at) / 60_000);
  if (min < 1) return tr('Just now');
  if (min < 60) return tr('{n}m ago', { n: formatExact(min) });
  const h = Math.floor(min / 60);
  if (h < 24) return tr('{n}h ago', { n: formatExact(h) });
  return tr('{n}d ago', { n: formatExact(Math.floor(h / 24)) });
}
