// The upgrade popup (Docs/art/ui-menus-redesign.md §7.27, mockup M25).
//
// Buying a level used to be a block at the bottom of the building card, under
// everything the building already does. That put the most expensive decision
// in the game in the least-read part of the panel, and it left no room to say
// what the level BUYS — the stats were four tiles of `8 → 10` and the gates
// were one sentence naming whichever errand happened to be first.
//
// So it is its own surface now, and the card's Upgrade button is what opens
// it. Three blocks, in the order a player asks for them:
//
//   1. WHAT IT IS — the portrait at the level it would BECOME, the name, and
//      `Level 3 → Level 4`. The art changes with the level, so the picture is
//      part of the pitch rather than decoration.
//   2. WHAT IT BUYS — every stat the building has, paired. An unchanged row
//      stays and greys; dropping it would make the table shortest exactly
//      when the player most wants to check.
//   3. WHAT IT ASKS — every gate with a tick or a cross, then the price and
//      the button.
//
// The GATES decide the button and the PRICE decides its colour: a level you
// cannot afford still shows a live button that turns clay, because the purse
// fills on its own and the errand does not.

import type { Game } from '../game';
import { DISTRICTS, levelIndexed } from '../sim/data/definitions';
import {
  districtLabel, upgradeCost, upgradeDuration, upgradeGoodsCost,
} from '../sim/districts';
import { getGood } from '../sim/goods';
import { harmonyBlock, harmonyCost } from '../sim/harmony';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { District, GoodId } from '../sim/state';
import { el, formatDuration } from './format';
import { btn, iconEl, sheet } from './kit';
import { requirements, statChanges } from './upgradeStats';

/**
 * The building's own art at a level.
 *
 * A building with per-level art (`townhall_lv3`) draws it; one without falls
 * back to its single sprite and then to the atlas cell, so a set that is half
 * painted still reads. The level is part of the STEM rather than a variant
 * flag because that is how the files arrive from the cutter.
 */
export function levelPortrait(definitionId: string, level: number, cls: string): HTMLElement {
  const stem = definitionId.toLowerCase();
  const url = spriteUrl(`${stem}_lv${level}`) ?? spriteUrl(stem);
  return url
    ? spriteImgAt(url, cls)
    : el('span', { class: `${cls} is-fallback` }, iconEl(definitionId as never, { size: 'lg' }));
}

export function renderUpgradeSheet(game: Game, district: District): HTMLElement {
  const def = DISTRICTS[district.definitionId];
  const next = district.level + 1;
  const back = () => game.closeUpgrade();

  const stats = statChanges(game, district, next);
  const gates = requirements(game, district, next);
  const blocked = gates.some((r) => !r.met);

  // ---- 1. what it is: the portrait at the level it BECOMES
  const head = el('div', { class: 'up-head' },
    el('div', { class: 'up-portrait' }, levelPortrait(district.definitionId, next, 'up-portrait-art')),
    el('div', { class: 'up-id' },
      el('div', { class: 'up-name' }, districtLabel(game.state, district)),
      el('div', { class: 'up-what' }, def.description),
      el('div', { class: 'up-ladder' },
        el('span', { class: 'up-ladder-from' }, `Level ${district.level}`),
        el('span', { class: 'up-arrow' }, iconEl('arrowUp', { size: 'sm' })),
        el('span', { class: 'up-ladder-to' }, `Level ${next}`))));

  // ---- 2. what it buys
  const statRows = stats.map((s) => el('div', {
    class: `up-row${s.changed ? '' : ' is-same'}`,
  },
    iconEl(s.icon, { size: 'sm' }),
    el('span', { class: 'up-row-label' }, s.label),
    el('b', { class: 'up-row-from' }, s.value),
    el('span', { class: 'up-arrow' }, iconEl('arrowUp', { size: 'sm' })),
    el('b', { class: 'up-row-to' }, s.to)));

  // ---- 3. what it asks
  const gateRows = gates.map((r) => el('div', {
    class: `up-row is-gate${r.met ? ' is-met' : ''}`,
  },
    iconEl(r.icon, { size: 'sm' }),
    el('span', { class: 'up-row-label' }, r.label),
    iconEl(r.met ? 'tick' : 'cross', { size: 'sm' })));

  // The price: currencies, then the refined goods and the Harmony that ride
  // beside them rather than among them (they are not wallet rows).
  const cost = upgradeCost(district.definitionId, district.ordinal, district.level);
  const goods = (Object.entries(upgradeGoodsCost(district.definitionId, next)) as Array<[GoodId, number]>)
    .map(([id, n]) => ({ icon: id, amount: n, short: getGood(game.state.city.goods, id) < n }));
  const demand = harmonyCost(def, next);
  const harmony = demand > harmonyCost(def, district.level)
    ? [{
      icon: 'harmony' as const,
      amount: demand,
      short: harmonyBlock(game.state, def, next, district) !== null,
    }]
    : [];

  const priceChip = (icon: string, amount: number, short: boolean) =>
    el('span', { class: `up-price-chip${short ? ' is-short' : ''}` },
      iconEl(icon as never, { size: 'sm' }), el('b', {}, String(amount)));

  const price = el('div', { class: 'up-price' },
    ...Object.entries(cost).map(([c, n]) =>
      priceChip(c, n as number, game.walletValue(c as never) < (n as number))),
    ...goods.map((g) => priceChip(g.icon, g.amount, g.short)),
    ...harmony.map((h) => priceChip(h.icon, h.amount, h.short)),
    el('span', { class: 'up-price-time' },
      iconEl('hourglass', { size: 'sm' }),
      formatDuration(upgradeDuration(game.state, district.definitionId, district.level))));

  const body = el('div', { class: 'up' },
    head,
    el('div', { class: 'up-section' }, el('span', {}, 'Stats')),
    el('div', { class: 'up-table' }, ...statRows),
    ...(gateRows.length === 0 ? [] : [
      el('div', { class: 'up-section' }, el('span', {}, 'Requirements')),
      el('div', { class: 'up-table' }, ...gateRows),
    ]),
    el('div', { class: 'up-buy' },
      price,
      btn({
        label: 'Upgrade',
        kind: 'primary',
        icon: 'arrowUp',
        onClick: () => { game.doUpgrade(district.uniqueId); game.closeUpgrade(); },
        // A GATE kills the button; a short purse only colours it. The purse
        // fills on its own and the errand does not, so only one of the two is
        // a reason to refuse the press.
        cost: blocked ? undefined : cost,
        have: (c) => game.walletValue(c),
        disabledReason: blocked ? 'Not every requirement is met' : undefined,
      })),
  );

  return sheet({
    title: `Upgrade to Level ${next}`,
    onClose: back,
    centred: true,
  }, body);
}

/** What the sheet draws, for the presenter's rebuild check. Every number on it
 *  that can move while it is open: the purse, the goods, the gates. */
export function upgradeSignature(game: Game, district: District): string {
  const next = district.level + 1;
  return JSON.stringify([
    district.uniqueId,
    district.level,
    statChanges(game, district, next).map((s) => [s.value, s.to]),
    requirements(game, district, next).map((r) => r.met),
    Object.keys(upgradeCost(district.definitionId, district.ordinal, district.level))
      .map((c) => game.walletValue(c as never)),
    levelIndexed([0], 1),
  ]);
}
