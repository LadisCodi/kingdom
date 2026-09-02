// Placing a district (§5.6) — a slim bar, because the MAP is the screen here.
//
// The old panel ate 45% of the display at exactly the moment the player
// needs to look at the map, and spent a row on `(x, y)`, which is debug
// output. The decision being made is "is this a good spot", so that is what
// the bar says, in words, while the canvas shows the influence area and what
// each captured cell will yield.

import { DISTRICTS, HARVEST } from '../sim/data/definitions';
import { spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { btn, iconEl } from './kit';

/** Enough captured cells that the spot is worth taking. */
const GOOD_ENOUGH = 3;

export function renderPlacementPanel(game: Game): HTMLElement {
  const info = game.placementInfo()!;
  const def = DISTRICTS[info.definitionId];
  const art = spriteUrl(`${def.sprite}_l1`);

  // What this spot is worth, in words. Only harvest buildings capture
  // anything; for the rest the placement is unconstrained and silent.
  let verdict: HTMLElement;
  if (info.cell === null) {
    verdict = el('span', { class: 'plc-verdict is-bad' }, 'Nowhere to put this yet');
  } else if (def.harvestSource) {
    const source = HARVEST[def.harvestSource];
    const good = info.captured >= GOOD_ENOUGH;
    verdict = info.captured === 0
      ? el('span', { class: 'plc-verdict is-bad' },
          iconEl(source.currencyId, { size: 'sm' }),
          el('span', {}, `Nothing to harvest here — no ${def.harvestSource} in range`))
      : el('span', { class: `plc-verdict ${good ? 'is-good' : 'is-bad'}` },
          iconEl(source.currencyId, { size: 'sm' }),
          el('b', {}, `×${info.captured}`),
          el('span', {}, good ? 'Good spot' : 'Thin pickings'));
  } else {
    verdict = el('span', { class: 'plc-verdict' }, 'Tap the map to move it');
  }

  // Being priced out is no longer a sentence: the cost rides in the button and
  // turns clay (§6.4), which is also why the bar got its width back.
  const blockedBy = info.cell === null ? 'Nowhere legal to build it' : undefined;
  const build = btn({
    label: 'Build',
    kind: 'primary',
    onClick: () => game.confirmBuild(),
    cost: info.cost,
    have: (c) => game.effectiveWalletValue(c),
    disabledReason: blockedBy,
  });
  const cancel = btn({ label: 'Cancel', onClick: () => game.dismiss() });
  cancel.setAttribute('data-own-close', '');

  return el('div', { class: 'plc-bar' },
    el('div', { class: 'plc-art' }, art
      ? el('img', { src: art, alt: '' })
      : iconEl(info.definitionId, { size: 'lg' })),
    el('div', { class: 'plc-body' },
      el('div', { class: 'plc-name' }, def.name),
      verdict,
      el('div', { class: 'plc-time' },
        iconEl('hourglass', { size: 'sm' }), formatDuration(info.duration)),
      // btn() disables but only action() draws a reason, and a bar has no
      // room for that layout — so the reason goes here. Nothing is greyed
      // out without saying why (§6.3). Affordability is not one of these any
      // more; the button says that itself now.
      ...(blockedBy
        ? [el('div', { class: 'plc-reason' }, iconEl('padlock', { size: 'sm' }), blockedBy)]
        : [])),
    el('div', { class: 'plc-actions' }, cancel, build),
  );
}
