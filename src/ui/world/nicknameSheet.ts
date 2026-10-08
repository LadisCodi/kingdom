// "What do they call you?" — asked the first time the player goes out onto
// the world board (Docs/features/19-world-map.md §1.3). Until then the
// kingdom is on no board; answering seats it, in a rival's city on a shared
// board, under this name for every other kingdom to read.
//
// The name is final, and the sheet says so before it is given. The field is
// checked as the player types; whether another kingdom has the name only the
// server knows, and its answer comes back as the line under the field.

import type { Game } from '../../game';
import { NICKNAME_MAX, nicknameProblem } from '../../worldServer/nickname';
import { el } from '../format';
import { btn, iconEl, sheet } from '../kit';
import { tr } from '../../i18n/tr';

export function renderNicknameSheet(game: Game): HTMLElement {
  const input = el('input', {
    class: 'nick-field',
    type: 'text',
    maxlength: String(NICKNAME_MAX + 4),
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    placeholder: tr('Your name'),
    'aria-label': tr('Your name on the world map'),
  }) as HTMLInputElement;
  input.value = game.nicknameDraft;
  const hint = el('div', { class: 'nick-hint' });
  const showHint = (): void => {
    const problem = game.nicknameDraft === '' ? null : nicknameProblem(game.nicknameDraft);
    const line = game.nicknameRefused ?? problem;
    hint.textContent = line ?? tr('Three to sixteen letters, numbers or spaces');
    hint.classList.toggle('is-refused', line !== null);
  };
  showHint();

  const join = (): void => void game.doJoinWorld(input.value);
  input.addEventListener('input', () => {
    game.nicknameDraft = input.value;
    game.nicknameRefused = null;
    showHint();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
  // Ready to type the moment the sheet is up.
  globalThis.requestAnimationFrame?.(() => input.focus());

  return sheet({ title: tr('Your name'), onClose: () => game.dismiss(), centred: true },
    el('div', { class: 'nick' },
      el('div', { class: 'nick-lede' },
        iconEl('compass', { size: 'lg' }),
        el('div', {},
          el('p', {}, tr('Out on the world map, other kingdoms will know you by this name.')),
          el('p', {}, tr('Your city takes its place on the board the moment you set out.')))),
      input,
      hint,
      btn({
        label: game.joiningWorld ? tr('Joining…') : tr('Join'),
        kind: 'primary',
        onClick: join,
        ...(game.joiningWorld ? { disabledReason: tr('Joining') } : {}),
      }),
      el('div', { class: 'nick-fine' },
        iconEl('padlock', { size: 'sm' }),
        tr('The name is for good: it cannot be changed later.'))));
}
