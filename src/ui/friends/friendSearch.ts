// THE SEARCH POPUP (Docs/features/15-social.md §2.1): asking a kingdom by
// its nickname or its friend code, as Theme Park has it. The field marks
// itself as the player types — a cross until it holds a name or a code of
// the right shape, a tick once it does — and Add waits for the tick. Add
// sends the request at once; the popup then says it went, or why not, and
// a refused name stays crossed until it is changed.

import type { Game } from '../../game';
import { el } from '../format';
import { btn, sheet } from '../kit';

export function renderFriendSearch(game: Game): HTMLElement {
  const f = game.friends;
  const close = (): void => f.closeSearch();
  const lede = el('p', { class: 'fr-search-lede' }, 'Ask a kingdom to be your friend by its name, or by its friend code.');

  if (f.searchStage === 'sent') {
    const to = f.sentTo;
    const friendsNow = to !== null && (f.snap?.friends ?? []).some((k) => k.code === to.code);
    return sheet({ title: 'Find a friend', onClose: close, centred: true },
      el('div', { class: 'fr-search-pop' },
        lede,
        el('div', { class: 'fr-sent' }, friendsNow ? 'You are friends now' : 'Friend request sent'),
        el('p', { class: 'fr-search-fine' },
          to === null ? '' : friendsNow ? `${to.nickname} had already asked you.` : `Awaiting response from ${to.nickname}`)));
  }

  const sending = f.searchStage === 'sending';
  const input = el('input', {
    class: 'fr-field', type: 'text', maxlength: '32', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false',
    placeholder: 'Name or friend code', 'aria-label': 'A kingdom\'s name or friend code',
    ...(sending ? { disabled: 'true' } : {}),
  }) as HTMLInputElement;
  input.value = f.searchDraft;
  const mark = el('span', { class: 'fr-mark', 'aria-hidden': 'true' });
  const field = el('div', { class: 'fr-field-wrap' }, input, mark);
  const refused = el('p', { class: 'fr-refused' });
  const add = btn({ label: 'Add', kind: 'primary', onClick: () => void f.sendSearch() });
  // Marks itself as the player types, without a rebuild — a rebuild would
  // take the field from under their thumb.
  const show = (): void => {
    const valid = f.searchValid();
    const wrong = f.searchRefused !== null;
    field.classList.toggle('is-valid', valid && !wrong);
    field.classList.toggle('is-invalid', f.searchDraft.trim() !== '' && (!valid || wrong));
    refused.textContent = f.searchRefused ?? '';
    add.disabled = !valid || wrong || sending;
  };
  input.addEventListener('input', () => {
    f.searchDraft = input.value;
    f.searchRefused = null;
    show();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void f.sendSearch(); });
  show();
  if (!sending) globalThis.requestAnimationFrame?.(() => input.focus());

  return sheet({ title: 'Find a friend', onClose: close, centred: true },
    el('div', { class: 'fr-search-pop' },
      lede,
      field,
      refused,
      sending
        ? el('div', { class: 'fr-sending' }, el('span', { class: 'fr-wait' }), 'Sending request…')
        : add));
}
