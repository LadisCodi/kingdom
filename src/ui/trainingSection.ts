// The training section of a district card — the one block every building that
// turns anything out shares (§5.x, the training mockup).
//
// It replaced two blocks that did the same job in different words: the
// Townhall's "Train" row for villagers and the military halls' "Recruit" row
// for soldiers. They had already been merged in the sim (one queue per
// building), and the card is where that shows: a QUEUE strip of who is coming,
// a picker for what this hall can turn out, and one detail panel for whichever
// is picked.
//
// Three things it deliberately does:
//
//  - The QUEUE is portraits, not a number. "Three in the line" tells you how
//    long to wait; a row of faces tells you WHAT you are waiting for, which is
//    the question when a hall can turn out three different units.
//  - Picking is separate from buying. The player selects a unit to read about
//    it, and trains it with a second, deliberate press — so the detail panel
//    can be browsed without spending anything.
//  - Everything the panel says is DERIVED. The tags give the type chip, the
//    BEATS chart gives "Strong vs", the units table gives cost and duration.
//    Nothing here is authored twice.

import type { Game } from '../game';
import { DISTRICTS, UNITS, type UnitDef } from '../sim/data/definitions';
import {
  lineFor, lineRushCost, trainCost, trainSeconds, trainingCompletesAt, trainingProgress,
} from '../sim/army';
import { BEATS } from '../sim/combat';
import { isTechComplete } from '../sim/research';
import { TECHNOLOGIES } from '../sim/data/definitions';
import type { District, TrainableId, UnitId } from '../sim/state';
import { el, formatDuration } from './format';
import { action, iconEl, progress, stat } from './kit';

/** Which trainee each building's card is showing. Module-level so it survives
 *  the per-tick rebuild — the same reason the research tree keeps its
 *  selection and the market keeps its amount. */
const picked = new Map<string, TrainableId>();

/** A villager is not in the UNITS table — no stats, no power, a price that
 *  climbs — so its card copy lives here rather than being faked into the
 *  roster. One place, and it reads like the others. */
const VILLAGER = {
  name: 'Villager',
  glyph: '🧑‍🌾',
  icon: 'population' as const,
  tag: 'Worker',
  description: 'Works your buildings and pays rent. Everything else needs them.',
};

const iconFor = (trainee: TrainableId) =>
  (trainee === 'Villager' ? VILLAGER.icon : trainee);

const nameFor = (trainee: TrainableId) =>
  (trainee === 'Villager' ? VILLAGER.name : UNITS[trainee].name);

/** The one-word type chip: what the unit IS, in the language the type chart
 *  speaks. Derived from its tags so it cannot disagree with the chart. */
const tagFor = (unit: UnitDef): string =>
  (unit.tags.includes('Distance') ? 'Ranged'
    : unit.tags.includes('Mounted') ? 'Mounted' : 'Melee');

export function trainingSection(game: Game, district: District): HTMLElement | null {
  const def = DISTRICTS[district.definitionId];
  const offers = def.trains;
  if (offers.length === 0) return null;

  const now = game.now();
  const line = lineFor(game.state, district.uniqueId);
  const root = el('div', { class: 'tr' });

  // ---------------------------------------------------------- the queue
  if (line.length > 0) {
    const strip = el('div', { class: 'tr-queue' },
      ...line.map((item, i) => el('div', {
        class: `tr-slot${i === 0 ? ' is-active' : ''}`,
        title: nameFor(item.trainee),
      }, iconEl(iconFor(item.trainee), { size: 'lg' }))));

    const head = line[0];
    const bar = progress('gold');
    const left = head.startedAt === null
      ? trainSeconds(head.trainee)
      : Math.max(0, (trainingCompletesAt(head) - now) / 1000);
    bar.set(trainingProgress(game.state, district.uniqueId, now), formatDuration(Math.ceil(left)));

    const rush = lineRushCost(game.state, district.uniqueId, now);
    root.append(
      el('div', { class: 'tr-head' }, 'Training queue'),
      el('div', { class: 'tr-queue-row' },
        el('div', { class: 'tr-queue-col' }, strip, bar.root),
        action({
          label: 'Finish',
          kind: 'gem',
          onClick: () => game.doFinishTraining(district),
          cost: { Gems: rush },
          have: (c) => game.walletValue(c),
        })),
      // The tap boost is an affordance on the BUILDING, so it is pointed at
      // rather than described.
      el('div', { class: 'dc-tapline' },
        iconEl('showme', { size: 'sm' }),
        `Tap the ${def.name} itself to hurry it along`),
    );
  }

  // --------------------------------------------------------- the picker
  const current = picked.get(district.uniqueId) ?? offers[0];
  const selected = offers.includes(current) ? current : offers[0];

  if (offers.length > 1) {
    root.append(
      el('div', { class: 'tr-head' }, 'Units'),
      el('div', { class: 'tr-picker' }, ...offers.map((t) => {
        const locked = t !== 'Villager'
          && UNITS[t].requiredTech !== null
          && !isTechComplete(game.state, UNITS[t].requiredTech!);
        const b = el('button', {
          class: `tr-pick${t === selected ? ' is-on' : ''}${locked ? ' is-locked' : ''}`,
          type: 'button',
          title: nameFor(t),
        }, iconEl(iconFor(t), { size: 'lg', locked }));
        b.addEventListener('click', () => {
          picked.set(district.uniqueId, t);
          game.notify();
        });
        return b;
      })),
    );
  }

  // ---------------------------------------------------- the detail panel
  root.append(detail(game, district, selected));
  return root;
}

function detail(game: Game, district: District, trainee: TrainableId): HTMLElement {
  const cost = trainCost(game.state, trainee);
  const seconds = trainSeconds(trainee);
  const info = el('div', { class: 'tr-info' });

  if (trainee === 'Villager') {
    const room = game.trainingInfo();
    info.append(
      el('div', { class: 'tr-portrait' }, iconEl('population', { size: 'lg' })),
      el('div', { class: 'tr-body' },
        el('div', { class: 'tr-name' }, VILLAGER.name),
        el('div', { class: 'tr-tag' }, VILLAGER.tag),
        el('div', { class: 'tr-desc' }, VILLAGER.description),
        // No duration here: it already sits beside the Train button, where
        // every other card puts a wait (§6.4).
        el('div', { class: 'tr-stats' },
          stat('population', String(game.state.city.population), 'living here'))),
      action({
        label: 'Train',
        kind: 'primary',
        onClick: () => game.doTrain(trainee, district),
        cost,
        have: (c) => game.walletValue(c),
        disabledReason: room.atMax ? 'Nowhere to put them — build more Housing' : undefined,
        info: el('span', { class: 'dc-uptime' },
          iconEl('hourglass', { size: 'sm' }), formatDuration(seconds)),
      }),
    );
    return info;
  }

  const unit = UNITS[trainee];
  const techOk = unit.requiredTech === null || isTechComplete(game.state, unit.requiredTech);
  const army = game.armyRoom();
  info.append(
    el('div', { class: 'tr-portrait' }, iconEl(trainee, { size: 'lg' })),
    el('div', { class: 'tr-body' },
      el('div', { class: 'tr-name' }, unit.name),
      el('div', { class: 'tr-tag' }, tagFor(unit)),
      el('div', { class: 'tr-desc' }, unit.description),
      el('div', { class: 'tr-stats' },
        stat('army', String(unit.atk), 'attack'),
        stat('padlock', String(unit.def), 'defence'),
        stat('population', String(unit.hp), 'health'),
        // The chart, in one phrase, rather than a table the player has to read.
        el('span', { class: 'tr-beats' }, `Strong vs ${UNITS[BEATS[trainee as UnitId]].name}`))),
    action({
      label: 'Train',
      kind: 'primary',
      onClick: () => game.doTrain(trainee, district),
      cost,
      have: (c) => game.walletValue(c),
      disabledReason: !techOk
        ? `Research ${TECHNOLOGIES[unit.requiredTech!].name} first`
        : army.used + unit.power > army.cap
          ? 'Your army is full — upgrade this hall'
          : undefined,
      info: el('span', { class: 'dc-uptime' },
        iconEl('hourglass', { size: 'sm' }), formatDuration(seconds)),
    }),
  );
  return info;
}
