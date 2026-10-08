// A FRIEND'S PROFILE (Docs/features/15-social.md §2.1): opened from their
// row on the friends list. Who they are, how far they have come, when they
// were last about — and room for what other parts of the game will let two
// friends do together. Remove sits in the corner and asks before it acts.

import type { Game } from '../../game';
import { tr } from '../../i18n/tr';
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
  if (k === null) return sheet({ title: tr('Friend'), onClose: () => f.closeProfile(), centred: true }, el('div', {}));

  if (f.confirmingRemove) {
    // One sentence around the name, so each language puts it where it goes.
    const [before, after] = tr('Remove {name} from your friends?').split('{name}');
    return sheet({ title: tr('Remove friend'), onClose: () => { f.confirmingRemove = false; game.notify(); }, centred: true },
      el('div', { class: 'fr-confirm' },
        crestEl(k.nickname, k.crest, 'lg'),
        el('p', {}, before ?? '', el('b', {}, k.nickname), after ?? ''),
        el('p', { class: 'fr-confirm-fine' }, tr('They will have to be asked again to come back.')),
        el('div', { class: 'fr-confirm-buttons' },
          btn({ label: tr('Keep'), onClick: () => { f.confirmingRemove = false; game.notify(); } }),
          btn({
            label: tr('Remove'), kind: 'destructive', onClick: () => void f.remove(k.code),
            ...(f.busy.has(k.code) ? { disabledReason: tr('Sending') } : {}),
          }))));
  }

  const actions = FRIEND_ACTIONS.map((a) => btn({ label: a.label, icon: a.icon, onClick: () => a.onClick(game, k.code) }));
  return sheet({ title: tr('Profile'), onClose: () => f.closeProfile(), centred: true },
    el('div', { class: 'fr-profile' },
      el('div', { class: 'fr-profile-head' },
        crestEl(k.nickname, k.crest, 'lg'),
        el('div', { class: 'fr-who' },
          el('div', { class: 'fr-name' }, k.nickname),
          el('div', { class: 'fr-profile-code' }, k.code))),
      el('div', { class: 'fr-facts' },
        el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, tr('Kingdom')), townhallTag(k.townhall)),
        el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, tr('Land revealed')), el('b', {}, tr('{n} cells', { n: formatCount(k.cells) }))),
        el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, tr('Last seen')), el('b', {}, lastSeenWords(k.seenAt, game.now()))),
        ...(k.rank === null ? [] : [el('div', { class: 'fr-fact' }, el('span', { class: 'fr-fact-label' }, tr('Among your friends')), el('b', {}, [tr('1st'), tr('2nd'), tr('3rd')][k.rank - 1] ?? ''))])),
      el('div', { class: 'fr-actions' },
        ...(actions.length > 0 ? actions : [el('p', { class: 'fr-empty' }, tr('Gifts and trades between friends are on their way.'))])),
      el('div', { class: 'fr-profile-foot' },
        btn({ label: tr('Remove'), kind: 'destructive', onClick: () => { f.confirmingRemove = true; game.notify(); } }))));
}
