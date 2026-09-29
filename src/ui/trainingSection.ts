// The training section of a district card — the one block every building that
// turns anything out shares: the Townhall's villagers, a hall's soldiers, a
// ward's mending (Docs/art/ui-menus-redesign.md, "the training widget").
//
// Each building trains ONE thing (dataRules.ts), so there is nothing to pick.
// Two parts, top to bottom:
//
//  - THE PANEL for that one trainee (its name heads the block, on the
//    section's rule — districtCard.ts): its portrait, tags, one line of
//    flavour, the priced Train button — and for a soldier the three numbers
//    it is judged on.
//  - THE BATCH, at the foot of the same panel: how many are coming, the bar
//    and time left for the one being trained, the whole batch's time, and
//    the gem button that finishes it. One unit per building means the line
//    is only ever one batch — "Warrior x3" — so it is one strip, not a queue.
//
// Everything the panel says is DERIVED — the tags from the unit's type and
// the type chart, the numbers from the units table — so nothing here is
// authored twice.

import type { Game } from '../game';
import { DISTRICTS, TECHNOLOGIES, UNITS, type UnitDef } from '../sim/data/definitions';
import {
  itemCount, lineFor, lineRemainingSeconds, lineRushCost, trainCost, trainSecondsAt,
  trainingCompletesAt, trainingProgress,
} from '../sim/army';
import { BEATS } from '../sim/combat';
import { isTechComplete } from '../sim/research';
import type { District, TrainableId, UnitId } from '../sim/state';
import { el, formatDuration } from './format';
import { action, btn, iconEl, type LiveParts } from './kit';
import type { IconName } from './kit/icon';
import { unitPortrait } from './unitArt';

/** A villager is not in the UNITS table — no stats, no power, a price that
 *  climbs — so its card copy lives here rather than being faked into the
 *  roster. One place, and it reads like the others. */
const VILLAGER = {
  name: 'Villager',
  description: 'A hardworking settler who tends the fields and pays rent.',
};

/** A trainee's name — the district card heads the training block with it. */
export const nameFor = (trainee: TrainableId) =>
  (trainee === 'Villager' ? VILLAGER.name : UNITS[trainee].name);

/** A TAG: a short chip for what the unit IS or does, which says a line more
 *  when tapped. Only one is open at a time; a tap anywhere else in the block
 *  closes it (the listener is on the block, `trainingSection`). */
function tag(label: string, tip: string, tone: 'type' | 'trait'): HTMLElement {
  const b = el('button', {
    class: `tr-tag is-${tone}`, type: 'button', 'aria-label': `${label}: ${tip}`,
  },
    label,
    el('span', { class: 'tr-tag-tip', role: 'tooltip' }, el('b', {}, label), ` — ${tip}`));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !b.classList.contains('is-open');
    b.closest('.tr')?.querySelectorAll('.tr-tag.is-open').forEach((t) => t.classList.remove('is-open'));
    b.classList.toggle('is-open', open);
  });
  return b;
}

/** The type chip: what the unit IS, in the language the type chart speaks.
 *  Derived from its tags so it cannot disagree with the chart. */
function typeTag(unit: UnitDef): HTMLElement {
  if (unit.tags.includes('Distance')) return tag('Ranged', 'Shoots from behind the line.', 'type');
  if (unit.tags.includes('Mounted')) return tag('Mounted', 'Rides into battle: fast and hard-hitting.', 'type');
  return tag('Melee', 'Fights up close, at the front of the line.', 'type');
}

/** One number a soldier is chosen on: a tile of the building card's kind. */
const stat = (icon: IconName, label: string, value: number): HTMLElement =>
  el('div', { class: 'tr-stat k-section' },
    iconEl(icon, { size: 'lg' }),
    el('div', { class: 'tr-stat-body' },
      el('div', { class: 'tr-stat-label' }, label),
      el('b', { class: 'tr-stat-value' }, String(value))));

/**
 * `live` is where the block's ticking half goes: the queue's bar, its time and
 * its Finish price move every second, and with a live part they are the only
 * thing that is rebuilt for it. Without one (a caller that rebuilds the
 * whole card anyway) the block is simply built once.
 */
export function trainingSection(
  game: Game, district: District, live?: LiveParts,
): HTMLElement | null {
  const def = DISTRICTS[district.definitionId];
  const offers = def.trains;
  // A building with BEDS runs the same block with no picker: its line mends
  // rather than recruits (Docs/features/combat.md §4).
  const isWard = def.bedsPerLevel.length > 0;
  if (offers.length === 0 && !isWard) return null;

  const root = el('div', { class: 'tr' });
  // A tap anywhere in the block that is not on a tag closes an open tip.
  root.addEventListener('click', () => {
    root.querySelectorAll('.tr-tag.is-open').forEach((t) => t.classList.remove('is-open'));
  });

  const batch = () => {
    const row = () => batchStrip(game, district, isWard);
    const sig = () => {
      const now = game.now();
      const line = lineFor(game.state, district.uniqueId);
      const head = line[0];
      return JSON.stringify([
        line.map((i) => [i.trainee, itemCount(i)]),
        head === undefined ? null : head.startedAt === null,
        head === undefined ? null : Math.ceil(queueLeft(game, district, head)),
        Math.round(trainingProgress(game.state, district.uniqueId, now) * 100),
        Math.ceil(lineRemainingSeconds(game.state, district.uniqueId, now)),
        lineRushCost(game.state, district.uniqueId, now),
      ]);
    };
    return live ? live.add(sig, row) : row();
  };

  // ------------------------------------------------------------- the ward
  //
  // Every wounded soldier in the city, on the building that has the beds.
  // Empty is worth drawing: the ward's size is what the level buys, and a
  // player looking at the card wants to know how much of it is spoken for.
  if (isWard) {
    const ward = game.woundedInfo();
    root.append(el('div', { class: 'tr-desc' }, `${ward.used} of ${ward.cap} beds taken`));
    if (ward.byUnit.length === 0) {
      root.append(el('div', { class: 'tr-desc' },
        'Nobody in the beds. Soldiers hurt in a fight wait here instead of dying.'));
    }
    for (const { unitId, count } of ward.byUnit) {
      const seconds = game.healWait(unitId, count);
      root.append(el('div', { class: 'tr-info is-ward k-section' },
        unitPortrait(unitId, 'tr-portrait'),
        el('div', { class: 'tr-body' },
          el('div', { class: 'tr-name' }, `${count} ${UNITS[unitId].name}${count === 1 ? '' : 's'}`),
          el('div', { class: 'tr-desc' },
            'Off the roster until they are back on their feet. Cheaper to mend '
            + 'than to replace.')),
        action({
          label: 'Heal',
          kind: 'primary',
          onClick: () => game.doHealWounded(unitId, count, district),
          cost: game.healPrice(unitId, count),
          have: (c) => game.walletValue(c),
          disabledReason: game.armyRoom().used + count > game.armyRoom().cap
            ? 'No room in the ranks — upgrade this hall'
            : undefined,
          info: el('span', { class: 'dc-uptime' },
            iconEl('hourglass', { size: 'sm' }), formatDuration(seconds)),
        }),
      ));
    }
    if (lineFor(game.state, district.uniqueId).length > 0) {
      root.append(el('div', { class: 'tr-batch-box k-section' }, batch()));
    }
  }
  if (offers.length === 0) return root;

  // ---------------------------------------------------- the panel, the queue
  // One trainee per building (dataRules.ts): the first is the only one.
  const selected = offers[0];
  root.append(detail(game, district, selected, batch()));
  return root;
}

/** Seconds the head of the line still needs — the time under its bar. */
function queueLeft(game: Game, district: District, head: ReturnType<typeof lineFor>[number]): number {
  return head.startedAt === null
    ? (head.kind === 'heal'
      ? game.healWait(head.trainee as UnitId, itemCount(head))
      : trainSecondsAt(game.state, district.uniqueId, head.trainee))
    : Math.max(0, (trainingCompletesAt(head) - game.now()) / 1000);
}

/**
 * THE BATCH, and the price of not waiting. The ticking half of the block.
 *
 * One unit per building (dataRules.ts), so everything in the line is one
 * batch of it — counted as one, "x3". (A ward's line mends whichever
 * soldiers came back hurt; its count is everyone on the table, and its face
 * is the one being mended now.)
 */
function batchStrip(game: Game, district: District, isWard: boolean): HTMLElement {
  const now = game.now();
  const line = lineFor(game.state, district.uniqueId);
  const head = el('div', { class: 'tr-batch-head' }, isWard ? 'Mending' : 'Training batch');
  if (line.length === 0) {
    return el('div', { class: 'tr-batch' }, head,
      el('div', { class: 'tr-batch-empty' }, 'Nothing in training'));
  }
  const count = line.reduce((n, item) => n + itemCount(item), 0);
  const pct = Math.round(trainingProgress(game.state, district.uniqueId, now) * 100);
  const total = isWard
    ? line.reduce((n, item, i) => n + (i === 0
      ? queueLeft(game, district, item)
      : game.healWait(item.trainee as UnitId, itemCount(item))), 0)
    : lineRemainingSeconds(game.state, district.uniqueId, now);
  return el('div', { class: 'tr-batch' }, head,
    el('div', { class: 'tr-batch-row' },
      el('div', { class: 'tr-batch-face', title: `${count} ${nameFor(line[0].trainee)}` },
        unitPortrait(line[0].trainee),
        ...(count > 1 ? [el('span', { class: 'tr-batch-count' }, `x${count}`)] : [])),
      el('div', { class: 'tr-batch-progress' },
        el('span', { class: 'tr-batch-bar' }, el('span', { style: `width: ${pct}%` })),
        el('span', { class: 'tr-batch-left' },
          `${formatDuration(Math.ceil(queueLeft(game, district, line[0])))} left`)),
      el('div', { class: 'tr-batch-total' },
        el('span', {}, 'Total time'),
        el('b', {}, formatDuration(Math.ceil(total)))),
      btn({
        label: 'Finish',
        kind: 'gem',
        onClick: () => game.doFinishTraining(district),
        cost: { Gems: lineRushCost(game.state, district.uniqueId, now) },
        have: (c) => game.walletValue(c),
      })));
}

/** The panel for the building's one trainee: portrait, tags, flavour, the
 *  priced Train button (its training time is the building's own stat), a
 *  soldier's three numbers in a row of their own, and the batch at the foot. */
function detail(game: Game, district: District, trainee: TrainableId, batch: HTMLElement): HTMLElement {
  const cost = trainCost(game.state, trainee);
  const unit = trainee === 'Villager' ? null : UNITS[trainee];

  // A GATE takes the button's place. When something other than money is in
  // the way — no room, a technology, a full army — a dead button with a
  // caption is two things saying one thing. So the slot holds the reason
  // alone, in the padlock's colour, and the button comes back when the gate
  // opens. Being short of coin is not a gate: the button stays and its red
  // price says so (§6.4).
  const army = game.armyRoom();
  const gate = unit === null
    ? (game.trainingInfo().atMax ? 'Nowhere to put them — build more Housing' : undefined)
    : unit.requiredTech !== null && !isTechComplete(game.state, unit.requiredTech)
      ? `Research ${TECHNOLOGIES[unit.requiredTech].name} first`
      : army.used + 1 > army.cap ? 'The army is full — upgrade this hall' : undefined;
  const buy = gate !== undefined
    ? el('div', { class: 'tr-blocked' }, iconEl('padlock', { size: 'sm' }), gate)
    : btn({
      label: 'Train',
      kind: 'primary',
      onClick: () => game.doTrain(trainee, district),
      cost,
      have: (c) => game.walletValue(c),
    });

  const tags = unit === null
    ? [tag('Worker', 'Lives in a house, pays rent and works the buildings.', 'type')]
    : [typeTag(unit),
      tag(`Strong vs ${UNITS[BEATS[trainee as UnitId]].name}`,
        `Deals extra damage to ${UNITS[BEATS[trainee as UnitId]].name}s.`, 'trait')];

  return el('div', { class: 'tr-info k-section' },
    unitPortrait(trainee, 'tr-portrait'),
    // No name here: it heads the whole block, on the section's rule.
    el('div', { class: 'tr-body' },
      el('div', { class: 'tr-tags' }, ...tags),
      el('div', { class: 'tr-desc' }, unit === null ? VILLAGER.description : unit.description)),
    el('div', { class: 'tr-buy' }, buy),
    ...(unit === null ? [] : [el('div', { class: 'tr-stats' },
      stat('atk', 'Attack', unit.dmg),
      stat('def', 'Defence', unit.def),
      stat('hp', 'Health', unit.hp))]),
    batch,
  );
}
