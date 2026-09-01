// Settings overlay: save status and the reset-save escape hatch. Reset is
// destructive, so it uses a two-step confirm (arm, then tap again within 4s)
// instead of firing on the first tap.

import { musicMuted, setMusicMuted } from '../audio/music';
import type { Game } from '../game';
import { GAME_VERSION, SAVE_VERSION } from '../sim/data/definitions';
import { button, el } from './format';

let armedUntil = 0; // epoch ms; the per-tick re-render disarms it visually

export function renderSettingsMenu(
  game: Game,
  opts: { saveModeLabel: string; onReset: () => void },
): HTMLElement {
  const menu = el('div', { class: 'menu' });
  menu.append(el('h2', {}, 'Settings'));

  menu.append(el('div', { class: 'rows' },
    el('div', { class: 'row' },
      el('span', {}, 'Save'), el('span', {}, opts.saveModeLabel)),
    el('div', { class: 'row' },
      el('span', {}, 'Version'), el('span', {}, `${GAME_VERSION} · save v${SAVE_VERSION}`)),
  ));

  const musicSwitch = button('', () => {
    setMusicMuted(!musicMuted());
    game.notify();
  }, `switch${musicMuted() ? '' : ' on'}`);
  musicSwitch.setAttribute('aria-label', 'Music on/off');
  menu.append(el('div', { class: 'action-row' },
    el('span', { class: 'info' }, `Music — ${musicMuted() ? 'off' : '🎵 on'}`),
    musicSwitch));

  menu.append(el('h2', { style: 'margin-top:16px' }, 'Danger zone'));
  const armed = Date.now() < armedUntil;
  const resetBtn = button(armed ? 'Tap again to confirm' : 'Reset', () => {
    if (Date.now() < armedUntil) {
      armedUntil = 0;
      opts.onReset();
      return;
    }
    armedUntil = Date.now() + 4000;
    game.notify();
  }, 'danger');
  menu.append(el('div', { class: 'action-row' },
    el('span', { class: armed ? 'blocked' : 'info' },
      armed
        ? 'This wipes ALL progress, for good.'
        : 'Reset save — start a brand-new game'),
    resetBtn));
  return menu;
}
