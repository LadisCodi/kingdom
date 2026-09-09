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
  itemCount, lineFor, lineRushCost, trainCost, trainSecondsAt, trainingCompletesAt,
  trainingProgress,
} from '../sim/army';
import { BEATS } from '../sim/combat';
import { maxPopulation } from '../sim/population';
import { isTechComplete } from '../sim/research';
import { TECHNOLOGIES } from '../sim/data/definitions';
import type { District, TrainableId, UnitId } from '../sim/state';
import { el, formatDuration } from './format';
import { action, iconEl, progress } from './kit';
import type { IconName } from './kit/icon';
import { unitBody, unitBust } from './unitArt';

/** Which trainee each building's card is showing. Module-level so it survives
 *  the per-tick rebuild — the same reason the research tree keeps its
 *  selection and the market keeps its amount. */
const picked = new Map<string, TrainableId>();

/** A villager is not in the UNITS table — no stats, no power, a price that
 *  climbs — so its card copy lives here rather than being faked into the
 *  roster. One place, and it reads like the others. */
const VILLAGER = {
  name: 'Villager',
  tag: 'Worker',
  description: 'Works your buildings and pays rent. Everything else needs them.',
};

/**
 * One number a thing is judged ON, at a size that can be read across a panel:
 * the mark and the word on top, the value under them.
 *
 * The inline `stat()` shape — icon, value, word, all on one line — is right in
 * a card the width of a thumb, and wrong here: a panel has a band of its own
 * for these, and several in a row is the comparison the player is actually
 * making. Exported because the upgrade block reads the same way — a level is
 * judged on what it buys, one tile per number, `before → after`.
 */
export const figure = (icon: IconName, label: string, value: string): HTMLElement =>
  el('div', { class: 'tr-fig' },
    el('div', { class: 'tr-fig-head' }, iconEl(icon, { size: 'sm' }), label),
    el('div', { class: 'tr-fig-value' }, value));

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
  // A building with BEDS runs the same block with no picker: its line mends
  // rather than recruits (Docs/features/combat.md §4).
  const isWard = def.bedsPerLevel.length > 0;
  if (offers.length === 0 && !isWard) return null;

  const now = game.now();
  const line = lineFor(game.state, district.uniqueId);
  const root = el('div', { class: 'tr' });

  // ---------------------------------------------------------- the queue
  if (line.length > 0) {
    // CONSECUTIVE RUNS, not one slot each and not one slot per type. Four
    // warriors in a row is one fact — "four warriors" — and four identical
    // faces spent four slots saying it. Collapsing by type ALONE would be
    // wrong for the opposite reason: the line is ordered, and a queue of
    // Warrior, Lancer, Warrior, Warrior shown as "Warrior x3, Lancer x1"
    // lies about what comes out next. So: runs.
    //
    // A ward is already one item that hands over many, so a run adds those
    // counts up rather than counting items.
    const runs: Array<{ trainee: TrainableId; count: number; first: number }> = [];
    line.forEach((item, i) => {
      const last = runs[runs.length - 1];
      if (last !== undefined && last.trainee === item.trainee) last.count += itemCount(item);
      else runs.push({ trainee: item.trainee, count: itemCount(item), first: i });
    });

    const strip = el('div', { class: 'tr-queue' },
      ...runs.map((run) => {
        const name = nameFor(run.trainee);
        return el('div', {
          // The run that holds the HEAD of the line is the one being worked
          // on, which is what the bar underneath is counting down.
          class: `tr-slot${run.first === 0 ? ' is-active' : ''}`,
          title: run.count > 1
            ? `${run.count} ${name}s ${isWard ? 'mending' : 'in the line'}`
            : name,
        },
          unitBust(run.trainee, 'tr-slot-art'),
          ...(run.count > 1 ? [el('span', { class: 'tr-slot-count' }, `x${run.count}`)] : []));
      }));

    const head = line[0];
    const bar = progress('gold');
    const left = head.startedAt === null
      ? (head.kind === 'heal'
        ? game.healWait(head.trainee as UnitId, itemCount(head))
        : trainSecondsAt(game.state, district.uniqueId, head.trainee))
      : Math.max(0, (trainingCompletesAt(head) - now) / 1000);
    bar.set(trainingProgress(game.state, district.uniqueId, now), formatDuration(Math.ceil(left)));

    const rush = lineRushCost(game.state, district.uniqueId, now);
    root.append(
      el('div', { class: 'tr-head' }, isWard ? 'On the table' : 'Training queue'),
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

  // ------------------------------------------------------------- the ward
  //
  // Every wounded soldier in the city, on the building that has the beds.
  // Empty is worth drawing: the ward's size is what the level buys, and a
  // player looking at the card wants to know how much of it is spoken for.
  if (isWard) {
    const ward = game.woundedInfo();
    root.append(el('div', { class: 'tr-head' }, `The ward — ${ward.used} of ${ward.cap} beds`));
    if (ward.byUnit.length === 0) {
      root.append(el('div', { class: 'tr-desc' },
        'Nobody in the beds. Soldiers hurt in a fight wait here instead of dying.'));
    }
    for (const { unitId, count } of ward.byUnit) {
      const seconds = game.healWait(unitId, count);
      root.append(el('div', { class: 'tr-info is-ward' },
        el('div', { class: 'tr-portrait' }, unitBust(unitId, 'tr-portrait-art')),
        el('div', { class: 'tr-body' },
          el('div', { class: 'tr-name' }, `${count} ${UNITS[unitId].name}${count === 1 ? '' : 's'}`),
          el('div', { class: 'tr-tag' }, 'Wounded'),
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
  }
  if (offers.length === 0) return root;

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
        }, unitBust(t, 'tr-pick-art'));
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

/** What the detail panel says about one trainee. The PANEL is the same for a
 *  villager and a soldier — portrait, heading with the button, a line of
 *  copy, a band of figures — and only these parts differ. Keeping the two in
 *  one shape is what stops the Townhall's card drifting from the halls' again:
 *  it had, and the villager's own layout grew taller than the card and put
 *  the Train button under the fold. */
interface TraineeCopy {
  name: string;
  tag: string;
  description: string;
  /** The one phrase under the copy, when there is one — a soldier's place in
   *  the type chart. A villager has no chart. */
  note: HTMLElement | null;
  /** Why the button is off, or nothing when it is on. */
  disabledReason: string | undefined;
  /** The figures a trainee is chosen on. A soldier has four; a villager three. */
  figures: HTMLElement[];
}

function villagerCopy(game: Game, seconds: number): TraineeCopy {
  const room = game.trainingInfo();
  const living = game.state.city.population;
  return {
    ...VILLAGER,
    note: null,
    disabledReason: room.atMax ? 'Nowhere to put them — build more Housing' : undefined,
    // A villager is judged on where it goes rather than what it hits: how
    // many are already here, how much room the houses leave — the number the
    // disabled button is about — and how long the next one takes.
    figures: [
      figure('population', 'Living here', String(living)),
      figure('Housing', 'Room', `${living + room.queued} / ${maxPopulation(game.state)}`),
      figure('hourglass', 'Time', formatDuration(seconds)),
    ],
  };
}

function soldierCopy(game: Game, unitId: UnitId, seconds: number): TraineeCopy {
  const unit = UNITS[unitId];
  const techOk = unit.requiredTech === null || isTechComplete(game.state, unit.requiredTech);
  const army = game.armyRoom();
  return {
    name: unit.name,
    tag: tagFor(unit),
    description: unit.description,
    // The chart, in one phrase, rather than a table the player has to read.
    note: el('span', { class: 'tr-beats' }, `Strong vs ${UNITS[BEATS[unitId]].name}`),
    disabledReason: !techOk
      ? `Research ${TECHNOLOGIES[unit.requiredTech!].name} first`
      : army.used + 1 > army.cap
        ? 'Your army is full — upgrade this hall'
        : undefined,
    // The four numbers a soldier is chosen on, in the band the button used to
    // waste: what it hits for, what it takes, what it has, and what it costs
    // in time. The atlas grew dedicated marks for the first three
    // (Docs/art/ui/icon_stat_*.png), so they stop borrowing the army sword,
    // the padlock and a villager's head.
    figures: [
      figure('atk', 'Damage', String(unit.dmg)),
      figure('def', 'Defence', String(unit.def)),
      figure('hp', 'Health', String(unit.hp)),
      figure('hourglass', 'Time', formatDuration(seconds)),
    ],
  };
}

function detail(game: Game, district: District, trainee: TrainableId): HTMLElement {
  const cost = trainCost(game.state, trainee);
  // What it will take HERE, neighbours included — the number the player is
  // about to commit to, not the one on the sheet.
  const seconds = trainSecondsAt(game.state, district.uniqueId, trainee);
  const copy = trainee === 'Villager'
    ? villagerCopy(game, seconds)
    : soldierCopy(game, trainee, seconds);

  // The button shares its row with the NAME, not with the description: a name
  // and a tag are short, so a fixed-width button beside them still leaves the
  // description its full measure on a 390px phone. Beside the description it
  // would have squeezed it to a sliver.
  //
  // A GATE takes the button's place. When something other than money is in
  // the way — no room, a technology, a full army — a dead button with a
  // caption is two things saying one thing, and the caption was wrapping
  // around it. So the slot holds the reason alone, in the padlock's colour,
  // and the button comes back when the gate opens. Being short of coin is not
  // a gate: the button stays and its red price says so (§6.4).
  const buy = copy.disabledReason !== undefined
    ? el('div', { class: 'tr-blocked' },
      iconEl('padlock', { size: 'sm' }), copy.disabledReason)
    : action({
      label: 'Train',
      kind: 'primary',
      onClick: () => game.doTrain(trainee, district),
      cost,
      have: (c) => game.walletValue(c),
    });
  return el('div', { class: 'tr-info' },
    el('div', { class: 'tr-portrait is-body' }, unitBody(trainee, 'tr-portrait-art')),
    el('div', { class: 'tr-body' },
      el('div', { class: 'tr-top' },
        el('div', { class: 'tr-heading' },
          el('div', { class: 'tr-name' }, copy.name),
          el('div', { class: 'tr-tag' }, copy.tag)),
        buy),
      el('div', { class: 'tr-desc' }, copy.description),
      ...(copy.note ? [copy.note] : [])),
    el('div', { class: 'tr-figures' }, ...copy.figures),
  );
}
