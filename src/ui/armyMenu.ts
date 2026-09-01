// The warband (§5.10).
//
// "Army — Power 6/20" in a title is a stat, not a fantasy, and the
// aspirational content — the units you do NOT have yet — was the least
// visible thing on screen: dimmed rows with a padlock and no picture. A
// locked unit should make you want it.

import { armyPower, maxArmyPower } from '../sim/army';
import { TECHNOLOGIES, UNITS, UNIT_ORDER } from '../sim/data/definitions';
import { isTechComplete } from '../sim/research';
import type { Game } from '../game';
import { el } from './format';
import { btn, costChips, iconEl, meter, pips, sheet } from './kit';

export function renderArmyMenu(game: Game): HTMLElement {
  let hintUsed = false;
  const power = armyPower(game.state);
  const max = maxArmyPower(game.state);
  const atCap = power >= max;

  const cards = UNIT_ORDER.map((id) => {
    const def = UNITS[id];
    const owned = game.state.army.filter((u) => u.definitionId === id).length;
    const techLocked = def.requiredTech !== null && !isTechComplete(game.state, def.requiredTech);
    const capBlocked = power + def.power > max;
    const short = game.shortfall(def.recruitCost);

    const recruit = btn({
      label: 'Recruit',
      kind: 'primary',
      onClick: () => game.doTrain(id),
      disabledReason: techLocked
        ? `Research ${TECHNOLOGIES[def.requiredTech!].name}`
        : capBlocked
          ? 'Your Townhall cannot support more'
          : Object.keys(short).length > 0
            ? `Short ${Object.entries(short).map(([c, n]) => `${n} ${c}`).join(' and ')}`
            : undefined,
    });
    const hinted = game.uiHint() === 'army' && !recruit.disabled && !hintUsed;
    if (hinted) {
      hintUsed = true;
      recruit.classList.add('hinted');
    }

    const card = el('div', { class: `arm-card${techLocked ? ' is-locked' : ''}` },
      el('div', { class: 'arm-portrait' }, iconEl(id, { size: 'lg' })),
      el('div', { class: 'arm-name' }, def.name),
      // Owned as tally marks: a count you glance at, not a number you read.
      el('div', { class: 'arm-owned' }, owned === 0
        ? 'none yet'
        : `${'|'.repeat(Math.min(owned, 10))}${owned > 10 ? `+${owned - 10}` : ''}  ×${owned}`),
      el('div', { class: 'arm-power' },
        iconEl('army', { size: 'sm' }), pips(def.power, def.power), el('span', {}, 'strength')),
      el('div', { class: 'arm-tags' },
        ...def.tags.map((t) => el('span', { class: 'arm-tag' }, t))),
      el('div', { class: 'arm-cost' }, costChips(def.recruitCost, (c) => game.effectiveWalletValue(c))),
      recruit);

    // Locked units stay COLOURFUL behind a scrim: they are the reason to
    // keep researching, so they must not be the dimmest thing here.
    if (techLocked) {
      const jump = el('button', { class: 'arm-unlock', type: 'button' },
        iconEl('padlock', { size: 'sm' }),
        `Research ${TECHNOLOGIES[def.requiredTech!].name}`);
      jump.addEventListener('click', () => game.focusTech(def.requiredTech!));
      card.append(jump);
    }
    return card;
  });

  const body = el('div', {},
    el('div', { class: 'arm-strength' },
      el('div', { class: 'arm-strength-label' }, atCap
        ? 'Your Townhall cannot support more'
        : 'Your warband'),
      meter(power, max),
      el('div', { class: 'arm-strength-count' }, `${power} of ${max}`)),
    el('div', { class: 'arm-grid' }, ...cards),
  );

  return sheet({ title: 'Your warband', onClose: () => game.dismiss() }, body);
}
