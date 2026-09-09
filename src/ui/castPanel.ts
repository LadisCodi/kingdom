// Casting a relic's ability (Docs/features/08-magic.md §4).
//
// Deliberately the same slim bar as placement, because it is the same
// interaction: the MAP is the screen, the panel only says what the tap will
// cost and what it will buy. Reusing the placement shell rather than inventing
// a targeting UI is the whole reason cast mode was folded into placement mode
// in the first place.
//
// The one thing this bar does that placement does not: it quantifies the
// outcome BEFORE the commit. Divination's whole argument is that its flat Mana
// price beats a doubling Gold curve, and the player can only weigh that if the
// bar says "saves 320 Gold" while they are standing on the cell.

import { ARTIFACTS } from '../sim/data/definitions';
import { spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl } from './kit';

export function renderCastPanel(game: Game): HTMLElement {
  const info = game.castInfo()!;
  const def = ARTIFACTS[info.artifactId];
  const active = def.active!;
  const art = spriteUrl(def.sprite);

  // What this cast buys, right here, in a number the player can compare.
  let verdict: HTMLElement;
  if (active.targeted && info.cell === null) {
    verdict = el('span', { class: 'plc-verdict is-bad' }, 'Nowhere to cast it yet');
  } else if (active.id === 'Divination') {
    verdict = el('span', { class: 'plc-verdict is-good' },
      iconEl('Gold', { size: 'sm' }),
      el('b', {}, String(info.saving)),
      el('span', {}, 'Gold saved — the same Mana at any distance'));
  } else if (active.id === 'Bloom') {
    verdict = info.blooms === 0
      ? el('span', { class: 'plc-verdict is-bad' }, 'Nothing tired within reach')
      : el('span', { class: 'plc-verdict is-good' },
        iconEl('sparkle', { size: 'sm' }),
        el('b', {}, `×${info.blooms}`),
        el('span', {}, 'cells renewed'));
  } else {
    verdict = el('span', { class: 'plc-verdict' }, active.text);
  }

  // Not affording the Mana is no longer a sentence — the price is in the
  // button and turns clay (§6.4).
  const blockedBy = active.targeted && info.cell === null
    ? 'Nowhere legal to cast it'
    : undefined;

  const confirm = btn({
    label: 'Cast',
    kind: 'primary',
    onClick: () => game.confirmCast(),
    costExtra: [{ icon: 'Mana', amount: String(info.manaCost), short: !info.affordable }],
    disabledReason: blockedBy,
  });
  const cancel = btn({ label: 'Cancel', onClick: () => game.dismiss() });
  cancel.setAttribute('data-own-close', '');

  return el('div', { class: 'plc-bar is-cast' },
    el('div', { class: 'plc-art' }, art
      ? el('img', { src: art, alt: '' })
      : el('span', { class: 'plc-glyph' }, def.glyph)),
    el('div', { class: 'plc-body' },
      el('div', { class: 'plc-name' }, active.name),
      verdict,
      ...(blockedBy
        ? [el('div', { class: 'plc-reason' }, iconEl('padlock', { size: 'sm' }), blockedBy)]
        : [])),
    el('div', { class: 'plc-actions' }, cancel, confirm),
  );
}
