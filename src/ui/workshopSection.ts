// The workshop block on a district card: the queue, what the crew is doing to
// the front of it, and the button that adds one more
// (Docs/plans/builder-30-days.md §3).
//
// It is deliberately the shape of `trainingSection.ts` — a strip of what is
// coming, then one action — because a workshop and a hall are the same
// promise in different materials: you ask for a thing, villagers make it, it
// arrives while you are away.
//
// The one thing this block has to teach, and says in words when it is true,
// is that **an empty crew means an empty stockpile**. A queue with nobody on
// it does not move at all, which is not obvious from a progress bar that
// simply never fills.

import type { Game } from '../game';
import { DISTRICTS, GOODS } from '../sim/data/definitions';
import { getGood } from '../sim/goods';
import { canAffordGoods } from '../sim/goods';
import { canAfford } from '../sim/wallet';
import { mana } from '../sim/mana';
import {
  isWorkshop, itemRemainingSeconds, itemRushCost, queueCapacity, recipeOf,
} from '../sim/workshops';
import type { District, GoodId } from '../sim/state';
import { el, formatDuration } from './format';
import { action, iconEl, knob, progress, stat } from './kit';

/** The whole block, or null when this building is not a workshop. */
export function workshopSection(game: Game, district: District): HTMLElement | null {
  if (!isWorkshop(district) || district.state !== 'Built') return null;
  const now = game.now();
  const recipe = recipeOf(district);
  const line = game.state.city.workshops[district.uniqueId];
  const items = line?.items ?? [];
  const capacity = queueCapacity(district);
  const crew = district.assignedWorkers;

  const box = el('div', { class: 'dc-workshop' });

  // ---- what it makes, and out of what ------------------------------------
  box.append(el('div', { class: 'dc-ws-head' },
    iconEl(recipe.id as GoodId, { size: 'lg' }),
    el('div', { class: 'dc-ws-title' },
      el('div', { class: 'dc-ws-name' }, recipe.name),
      el('div', { class: 'dc-ws-recipe' },
        ...costLine(recipe.input as Record<string, number>),
        ...(recipe.inputGood !== null
          ? [iconEl(recipe.inputGood, { size: 'sm' }), String(recipe.inputGoodAmount)] : []),
        ...(recipe.inputMana > 0
          ? [iconEl('Mana', { size: 'sm' }), String(recipe.inputMana)] : []))),
    el('div', { class: 'dc-ws-held' },
      stat(recipe.id as GoodId, String(getGood(game.state.city.goods, recipe.id)), 'in store')),
  ));

  // ---- the crew, which is the engine -------------------------------------
  box.append(el('div', { class: 'dc-ws-crew' },
    iconEl('workers', { size: 'sm' }),
    crew === 0
      ? el('span', { class: 'is-warning' }, 'No villagers here — nothing is being made')
      : el('span', {}, `${crew} working · ${formatDuration(recipe.workSeconds / crew)} each`)));

  // ---- the queue ----------------------------------------------------------
  const strip = el('div', { class: 'dc-ws-queue' });
  for (let i = 0; i < capacity; i++) {
    const item = items[i];
    if (!item) {
      strip.append(el('div', { class: 'dc-ws-slot is-empty' }));
      continue;
    }
    const working = i < crew;
    const slot = el('div', { class: `dc-ws-slot${working ? ' is-working' : ''}` },
      iconEl(item.good as GoodId, { size: 'sm' }));
    if (working) {
      const bar = progress('gold');
      bar.set(item.workMs / (GOODS[item.good].workSeconds * 1000));
      slot.append(bar.root);
    }
    slot.append(knob('✕', () => game.doCancelWorkshopItem(district.uniqueId, i),
      { label: 'Cancel' }));
    strip.append(slot);
  }
  box.append(strip);

  // ---- what the front of the queue is doing -------------------------------
  const remaining = itemRemainingSeconds(game.state, district, now);
  if (remaining !== null) {
    const rush = itemRushCost(game.state, district, now);
    box.append(el('div', { class: 'dc-ws-eta' },
      iconEl('hourglass', { size: 'sm' }),
      `next in ${formatDuration(remaining)}`,
      ...(rush === null ? [] : [action({
        label: 'Finish',
        kind: 'secondary',
        onClick: () => game.doRushWorkshopItem(district.uniqueId),
        cost: { Gems: rush },
        have: (c) => game.walletValue(c),
      })])));
  }

  // ---- add one ------------------------------------------------------------
  const goodCost = recipe.inputGood === null
    ? {} : { [recipe.inputGood]: recipe.inputGoodAmount };
  const short = !canAfford(game.state.city.wallet, recipe.input)
    || !canAffordGoods(game.state.city.goods, goodCost)
    || (recipe.inputMana > 0 && mana(game.state) < recipe.inputMana);
  box.append(action({
    label: `Make ${recipe.name}`,
    kind: 'primary',
    icon: DISTRICTS[district.definitionId].id,
    onClick: () => game.doQueueGood(district.uniqueId),
    disabledReason: items.length >= capacity ? 'The queue is full' : undefined,
    cost: recipe.input,
    have: (c) => game.walletValue(c),
    costExtra: [
      ...(recipe.inputGood !== null
        ? [{
          icon: recipe.inputGood,
          amount: String(recipe.inputGoodAmount),
          short: getGood(game.state.city.goods, recipe.inputGood) < recipe.inputGoodAmount,
        }] : []),
      ...(recipe.inputMana > 0
        ? [{
          icon: 'Mana' as const,
          amount: String(recipe.inputMana),
          short: mana(game.state) < recipe.inputMana,
        }] : []),
    ],
    info: short ? undefined : el('span', {}, `${items.length}/${capacity} queued`),
  }));

  return box;
}

/** The raw half of a recipe, as icon + amount pairs. */
function costLine(cost: Record<string, number>): Node[] {
  const out: Node[] = [];
  for (const [c, n] of Object.entries(cost)) {
    out.push(iconEl(c as never, { size: 'sm' }), document.createTextNode(String(n)));
  }
  return out;
}
