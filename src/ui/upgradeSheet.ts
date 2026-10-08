// The upgrade popup (Docs/art/ui-menus-redesign.md, mockup M35).
//
// The card's Upgrade button opens it. Three blocks, in the order a player
// asks for them:
//
//   1. WHAT IT BECOMES — the building at its level and at the next, each with
//      its level on a plaque under it.
//   2. WHAT IT GAINS — one row per stat the level moves: the current value
//      and, in green, what the level adds. A stat it leaves alone is not
//      listed.
//   3. WHAT IT ASKS — every requirement with a tick or a cross, then the
//      price, the build time and the button.
//
// An unmet requirement locks the button and says so under it; a short purse
// only turns its price red, since the purse fills on its own.

import type { Game } from '../game';
import { DISTRICTS } from '../sim/data/definitions';
import { upgradeRefusal } from '../sim/commands';
import { upgradeCost, upgradeDuration, upgradeGoodsCost } from '../sim/districts';
import { getGood } from '../sim/goods';
import type { District, GoodId } from '../sim/state';
import { buildingPortrait } from './districtCard';
import { coach, el, formatDuration, formatExact } from './format';
import { btn, iconEl, priceLine, sectionHead, sheet, type IconName } from './kit';
import { requirements, statChanges } from './upgradeStats';

/** The building at a level, with the level on its plaque. */
const levelTile = (district: District, level: number, tone: 'from' | 'to'): HTMLElement =>
  el('div', { class: `up-level is-${tone}` },
    buildingPortrait(DISTRICTS[district.definitionId], level),
    el('span', { class: 'up-level-plaque' }, `Level ${level}`));

export function renderUpgradeSheet(game: Game, district: District): HTMLElement {
  const next = district.level + 1;
  const stats = statChanges(game, district, next);
  const gates = requirements(game, district, next);
  const locked = gates.some((r) => !r.met);

  // ---- 1. what it becomes
  const levels = el('div', { class: 'up-levels' },
    levelTile(district, district.level, 'from'),
    el('span', { class: 'up-arrow', 'aria-hidden': 'true' }, iconEl('arrowUp')),
    levelTile(district, next, 'to'));

  // ---- 2. what it gains
  const gains = stats.map((s) => el('div', { class: 'up-row k-section' },
    iconEl(s.icon),
    el('span', { class: 'up-row-label' }, s.label),
    el('b', { class: 'up-row-value' }, s.value),
    el('b', { class: `up-row-delta${s.better ? '' : ' is-worse'}` }, s.delta)));

  // ---- 3. what it asks
  const gateRows = gates.map((r) => el('div', { class: `up-row k-section is-gate${r.met ? ' is-met' : ''}` },
    iconEl(r.icon),
    el('span', { class: 'up-row-label' }, r.label),
    iconEl(r.met ? 'tick' : 'cross', { label: r.met ? 'Met' : 'Not met' })));

  // The price: the currencies, then the refined goods beside them (they are
  // not wallet rows), then the build time.
  const cost = upgradeCost(district.definitionId, district.ordinal, district.level);
  const goods = Object.entries(upgradeGoodsCost(game.state, district.definitionId, next)) as Array<[GoodId, number]>;
  const price = priceLine([
    ...Object.entries(cost).map(([c, n]) => ({
      icon: c as IconName, amount: formatExact(n as number), short: game.walletValue(c as never) < (n as number),
    })),
    ...goods.map(([id, n]) => ({
      icon: id as IconName, amount: formatExact(n), short: getGood(game.state.city.goods, id) < n,
    })),
  ], el('span', { class: 'up-price-time' },
    iconEl('hourglass'),
    formatDuration(upgradeDuration(game.state, district.definitionId, district.level))));

  // The sim's own check decides the button, so the popup can never offer a
  // press the command would refuse; the requirements decide its words.
  const refusal = upgradeRefusal(game.state, district.uniqueId);
  const note = locked
    ? 'Complete all requirements to upgrade'
    : refusal === 'NoBuilderFree' ? 'Every builder is busy' : null;
  const button = coach(btn({
    label: 'Upgrade',
    kind: 'primary',
    icon: locked ? 'padlock' : undefined,
    onClick: () => { game.doUpgrade(district.uniqueId); game.closeUpgrade(); },
    disabledReason: refusal === null ? undefined : (note ?? 'Not enough to pay for it'),
  }), 'upgrade-go');

  const body = el('div', { class: 'up' },
    levels,
    ...(gains.length === 0 ? [] : [sectionHead('Improvements'), el('div', { class: 'up-table' }, ...gains)]),
    ...(gateRows.length === 0 ? [] : [sectionHead('Requirements'), el('div', { class: 'up-table' }, ...gateRows)]),
    el('div', { class: 'up-buy k-section' },
      price,
      button,
      ...(note === null ? [] : [el('div', { class: 'up-note' }, note)])),
  );

  return sheet({ title: `Upgrade to Level ${next}`, onClose: () => game.closeUpgrade(), centred: true }, body);
}

/** What the popup draws that can change while it is open — the gates, the
 *  purse's shortfalls, the button — for the overlay's rebuild check, so its
 *  portraits are not rebuilt (and blink) every tick. */
export function upgradeSignature(game: Game, district: District): string {
  const next = district.level + 1;
  const cost = upgradeCost(district.definitionId, district.ordinal, district.level);
  return JSON.stringify([
    district.uniqueId,
    district.level,
    statChanges(game, district, next).map((s) => [s.value, s.delta]),
    requirements(game, district, next).map((r) => r.met),
    Object.entries(cost).map(([c, n]) => game.walletValue(c as never) < (n as number)),
    Object.entries(upgradeGoodsCost(game.state, district.definitionId, next))
      .map(([id, n]) => getGood(game.state.city.goods, id as GoodId) < n),
    upgradeRefusal(game.state, district.uniqueId),
    upgradeDuration(game.state, district.definitionId, district.level),
  ]);
}
