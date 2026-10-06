// A FRIEND'S PROFILE (Docs/features/15-social.md §2.1): opened from their
// row on the friends list. Who they are, how far they have come, when they
// were last about — and room for what other parts of the game will let two
// friends do together. Remove sits in the corner and asks before it acts.

import type { Game } from '../../game';
import { lastSeenWords } from '../../friendsClient';
import { el, formatCount } from '../format';
import { btn, iconEl, sheet } from '../kit';
import { crestEl, townhallTag } from './kingdomBits';

/** What other systems offer between two friends. Each adds its own here;
 *  none does yet. */
export const FRIEND_ACTIONS: Array<{ label: string; icon: Parameters<typeof iconEl>[0]; onClick: (game: Game, code: string) => void }> = [];

export function renderFriendProfile(game: Game): HTMLElement {
  const f = game.friends;
  const k = f.opened();
  if (k === null) return sheet({ title: 'Friend', onClose: () => f.closeProfile(), centred: true }, el('div', {}));

  if (f.confirmingRemove) {
    return sheet({ title: 'Remove friend', onClose: () => { f.confirmingRemove = false; game.notify(); }, centred: true },
      el('div', { class: 'fr-confirm' },
        crestEl(k.nickname, k.code, 'lg'),
        el('p', {}, 'Remove ', el('b', {}, k.nickname), ' from your friends?'),
        el('p', { class: 'fr-confirm-fine' }, 'They will have to be asked again to come back. Rewards already taken are kept.'),
        el('div', { class: 'fr-confirm-buttons' },
          btn({ label: 'Keep', onClick: () => { f.confirmingRemove = false; game.notify(); } }),
          btn({
            label: 'Remove', kind: 'destructive', onClick: () => void f.remove(k.code),
            ...(f.busy.has(k.code) ? { disabledReason: 'Sending' } : {}),
          }))));
  }

  const actions = FRIEND_ACTIONS.map((a) => btn({ label: a.label, icon: a.icon, onClick: () => a.onClick(game, k.code) }));
  return sheet({ title: 'Profile', onClose: () => f.closeProfile(), centred: true },
    el('div', { class: 'fr-profile' },
      el('div', { class: 'fr-profile-head' },
        crestEl(k.nickname, k.code, 'lg'),
        el('div', { class: 'fr-who' },
          el('div', { class: 'fr-name' }, k.nickname),
          el('div', { class: 'fr-profile-code' }, k.code))),
      el('div', { class: 'fr-facts' },
        el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, 'Kingdom'), townhallTag(k.townhall)),
        el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, 'Land revealed'), el('b', {}, `${formatCount(k.cells)} cells`)),
        el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, 'Last seen'), el('b', {}, lastSeenWords(k.seenAt, game.now()))),
        ...(k.rank === null ? [] : [el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, 'Among your friends'), el('b', {}, `${['1st', '2nd', '3rd'][k.rank - 1]}`))])),
      el('div', { class: 'fr-actions' },
        ...(actions.length > 0 ? actions : [el('p', { class: 'fr-empty' }, 'Gifts and trades between friends are on their way.')])),
      el('div', { class: 'fr-profile-foot' },
        btn({ label: 'Remove', kind: 'destructive', onClick: () => { f.confirmingRemove = true; game.notify(); } }))));
}
