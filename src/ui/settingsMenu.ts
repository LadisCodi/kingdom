// Settings (§5.11) — sound, save, and the escape hatch.
//
// Almost fine already. What changed: "Danger zone" is developer language and
// the consequence appeared only on the SECOND tap, after the player had
// already committed once; music was the only audio control although the game
// has a full SFX layer and an ambience bed; and the save status was a
// two-word badge evicted from the HUD.

import { ambienceMuted, setAmbienceMuted } from '../audio/ambience';
import { musicMuted, setMusicMuted } from '../audio/music';
import { setSfxMuted, sfxMuted } from '../audio/sfx';
import type { Game } from '../game';
import { GAME_VERSION, OFFLINE_CAP_HOURS, SAVE_VERSION } from '../sim/data/definitions';
import { el } from './format';
import { action, sheet, switchCtl } from './kit';

// Armed state for the two-step reset. Module-level so it survives the
// per-tick re-render; the timeout disarms it visually.
let armedUntil = 0;
const ARM_MS = 4000;

export function renderSettingsMenu(
  game: Game,
  opts: { saveModeLabel: string; onReset: () => void },
): HTMLElement {
  const toggle = (
    label: string,
    hint: string,
    on: boolean,
    set: (muted: boolean) => void,
  ): HTMLElement => el('div', { class: 'set-row' },
    el('div', {},
      el('div', { class: 'set-label' }, label),
      el('div', { class: 'set-hint' }, hint)),
    switchCtl(on, () => { set(on); game.notify(); }, label));

  const armed = Date.now() < armedUntil;
  const reset = action({
    label: armed ? 'Yes, wipe it' : 'Start over',
    kind: 'destructive',
    onClick: () => {
      if (Date.now() < armedUntil) {
        armedUntil = 0;
        opts.onReset();
        return;
      }
      armedUntil = Date.now() + ARM_MS;
      game.notify();
    },
    // The consequence is stated BEFORE the first tap, not after it.
    info: el('span', { class: armed ? 'set-danger' : '' }, armed
      ? 'Last chance — this cannot be undone.'
      : 'Wipes every building, resource and quest, for good.'),
  });

  const body = el('div', { class: 'set' },
    el('div', { class: 'set-section' }, 'Sound'),
    toggle('Music', 'The harp loop', !musicMuted(), (on) => setMusicMuted(on)),
    toggle('Sound effects', 'Taps, coins, construction', !sfxMuted(), (on) => setSfxMuted(on)),
    toggle('Ambience', 'Wind, waves, birdsong', !ambienceMuted(), (on) => setAmbienceMuted(on)),

    el('div', { class: 'set-section' }, 'Your kingdom'),
    el('div', { class: 'set-row' },
      el('div', {},
        el('div', { class: 'set-label' }, opts.saveModeLabel.includes('cloud')
          ? 'Saved to the cloud'
          : 'Saved to this device'),
        el('div', { class: 'set-hint' },
          `Your kingdom keeps working for up to ${OFFLINE_CAP_HOURS} hours while you are away.`))),

    el('div', { class: 'set-section' }, 'Playing as'),
    el('div', { class: 'set-row' },
      el('div', {},
        el('div', { class: 'set-label' }, game.payerInfo()?.label ?? 'No profile yet'),
        el('div', { class: 'set-hint' },
          'Fixed for this kingdom. Starting over lets you pick another.'))),

    el('div', { class: 'set-section' }, 'Start over'),
    reset,

    el('div', { class: 'set-print' }, `${GAME_VERSION} · save format v${SAVE_VERSION}`),
  );

  return sheet({ title: 'Settings', onClose: () => game.dismiss() }, body);
}
