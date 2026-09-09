// The room sheet, on a gate (Docs/features/18-garrisons-and-raids.md §7).
//
// It is the ruin's frontier room while the garrison stands, so it is the
// expedition sheet with three things taken away and one added.
//
// TAKEN AWAY: the depth stack, the standing order and the relic socket. There
// is one room, it resolves the moment the player commits, and nothing about
// it lasts long enough for a relic to be a decision.
//
// ADDED: the countdown. This is the only screen in the game with a clock that
// costs the player something when it runs out, and the whole point of the
// gate is that it is a fight you are being HURRIED into — so the counter is
// the second thing on the sheet, under the power comparison that says whether
// the hurry is warranted.
//
// The threat is always in view. A gate teaches the type chart before Depth 1
// adds the power ladder, and a lesson you cannot see is not one.

import { RUINS } from '../sim/data/definitions';
import type { Game } from '../game';
import { heroPicker, troopPicker } from './expeditionSheet';
import { spriteUrl } from '../render/sprites';
import { el, formatDuration } from './format';
import { action, btn, iconEl, sheet, stat } from './kit';

const art = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : el('div', { class: `${cls} is-glyph` }, glyph);
};

export function renderGateSheet(game: Game): HTMLElement {
  const ruinId = game.gateRuin!;
  const ruin = RUINS[ruinId];
  const gate = game.gateFor(ruinId);
  const preview = game.gatePreview()!;
  const blocked = game.gateBlockText();
  const threatIcon = preview.threat === 'Any' ? 'army' : preview.threat;

  // THE number, the way the safe depth is the expedition sheet's: what the
  // party swings for against what is standing in the door. A shortfall is a
  // warning, never a refusal — the player may always try.
  const power = el('div', { class: `gate-power${preview.enough ? '' : ' is-short'}` },
    el('div', { class: 'gate-power-row' },
      el('div', { class: 'gate-power-side' },
        el('b', {}, String(preview.attack)),
        el('span', {}, 'your attack')),
      el('div', { class: 'gate-power-vs' }, 'vs'),
      el('div', { class: 'gate-power-side' },
        el('b', {}, String(preview.power)),
        el('span', {}, 'they hold'))),
    el('div', { class: 'gate-power-note' }, preview.enough
      ? 'Enough to drive them off.'
      : 'Short — you may still try, and lose only the supplies.'),
  );

  const body = el('div', { class: 'gate' },
    el('div', { class: 'gate-head' },
      art(ruin.sprite, ruin.glyph, 'gate-art'),
      el('div', {},
        el('div', { class: 'gate-name' }, `${gate?.creature ?? 'A warband'} at the gate`),
        el('div', { class: 'gate-kind' }, `${ruin.name} · tier ${ruin.tier}`))),

    el('div', { class: 'gate-stats' },
      stat(threatIcon, preview.threat === 'Any' ? 'mixed' : `${preview.threat}s`, 'hold it'),
      stat('atk', String(preview.stats.atk), 'attack'),
      stat('hp', String(preview.stats.hp), 'health')),

    power,
  );

  if (gate !== null && gate.nextRaidAt !== null) {
    const left = Math.max(0, (gate.nextRaidAt - game.now()) / 1000);
    body.append(el('div', { class: 'gate-clock' },
      iconEl('hourglass', { size: 'sm' }),
      `They come for the city in ${formatDuration(left)} — `
      + `${gate.tripsLeft} raid${gate.tripsLeft === 1 ? '' : 's'} left in them.`));
  } else if (gate !== null) {
    body.append(el('div', { class: 'gate-clock' },
      iconEl('clock', { size: 'sm' }),
      'They have taken all they came for, and sit on it.'));
  }

  const hoard = Object.entries(gate?.hoard ?? {}).filter(([, n]) => n > 0);
  if (hoard.length > 0) {
    body.append(el('div', { class: 'gate-hoard' },
      el('div', { class: 'gate-hoard-title' }, 'What they are holding'),
      el('div', { class: 'gate-hoard-row' },
        ...hoard.map(([c, n]) => stat(c as 'Gold', String(n), ''))),
      el('div', { class: 'gate-hoard-note' }, 'Clear the gate and every unit of it comes home.')));
  }

  body.append(
    el('div', { class: 'exp-section' },
      el('div', { class: 'exp-heading' }, 'Who leads'),
      // A hero ALONE is a legal board here, which is what makes this the
      // first fight in the game: it asks for no army at all.
      el('div', { class: 'exp-subheading' },
        'A hero can go alone — the first gate needs no army.'),
      heroPicker(game)),

    el('div', { class: 'exp-section' },
      el('div', { class: 'exp-heading' }, 'Who goes'),
      troopPicker(game)),

    action({
      label: 'Clear the gate',
      kind: 'primary',
      onClick: () => game.doClearGate(),
      cost: preview.supplies,
      have: (c) => game.walletValue(c),
      disabledReason: blocked ?? undefined,
    }),

    el('div', { class: 'gate-note' },
      'Supplies are spent whether you win or lose. Nobody dies, and you can '
      + 'come back as many times as you like.'),
  );

  const close = btn({ label: 'Not yet', onClick: () => game.dismiss() });
  close.setAttribute('data-own-close', '');
  body.append(el('div', { class: 'exp-back' }, close));

  return sheet({ title: 'The gate', onClose: () => game.dismiss() }, body);
}
