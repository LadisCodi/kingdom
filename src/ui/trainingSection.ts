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
import { DISTRICTS, TECHNOLOGIES, TROOPS, UNITS, troopsOf, unitOf } from '../sim/data/definitions';
import {
  itemCount, lineFor, lineRemainingSeconds, lineRushCost, rankGate, rankInLine, trainPlan,
  trainRoom, trainSecondsAt, trainingCompletesAt, trainingProgress, type TrainAmount,
} from '../sim/army';
import { BEATS } from '../sim/combat';
import { isTechComplete } from '../sim/research';
import type { District, TrainableId, TroopId, UnitId } from '../sim/state';
import { el, formatDuration, formatExact, coach } from './format';
import { action, btn, holdToRepeat, iconEl, isShort, knob, progress, withTooltip, type LiveParts } from './kit';
import { timerButton } from './speedupSheet';
import type { IconName } from './kit/icon';
import { unitPortrait } from './unitArt';
import { tr, trn } from '../i18n/tr';

/** A villager is not in the UNITS table — no stats, no power, a price that
 *  climbs — so its card copy lives here rather than being faked into the
 *  roster. One place, and it reads like the others. */
const villager = () => ({
  name: tr('Villager'),
  description: tr('A hardworking settler who tends the fields and pays rent.'),
});

/** A trainee's name — the district card heads the training block with it. */
export const nameFor = (trainee: TrainableId) =>
  (trainee === 'Villager' ? villager().name : TROOPS[trainee].name);

/** A TAG: a short chip for what the unit IS or does, which says a line more
 *  when tapped — the kit's tooltip (kit/tooltip.ts). */
const tag = (label: string, tip: string, tone: 'type' | 'trait'): HTMLElement =>
  withTooltip(el('button', { class: `tr-tag is-${tone}`, type: 'button', 'aria-label': `${label}: ${tip}` },
    label), tip, label);

/** The type chip: what the unit IS, in the language the type chart speaks —
 *  and its tip, what that means in a fight: who it beats and who beats it.
 *  Both read off the chart (combat.ts BEATS), so neither can disagree with
 *  what a battle does. */
function typeTag(unitId: UnitId): HTMLElement {
  const unit = UNITS[unitId];
  const type = unit.tags.includes('Distance') ? tr('Ranged')
    : unit.tags.includes('Mounted') ? tr('Mounted') : tr('Melee');
  const plural = (id: UnitId) => tr('{name}s', { name: UNITS[id].name });
  const beats = BEATS[unitId];
  const beatenBy = (Object.keys(BEATS) as UnitId[]).find((k) => BEATS[k] === unitId);
  const tip = beatenBy === undefined
    ? tr('Strong vs {strong}.', { strong: plural(beats) })
    : tr('Strong vs {strong}, weak vs {weak}.', { strong: plural(beats), weak: plural(beatenBy) });
  return tag(type, tip, 'type');
}

/** One number a soldier is chosen on: a small tile of the building card's
 *  kind — the mark and the number, the name under them. */
const stat = (icon: IconName, label: string, value: number): HTMLElement =>
  el('div', { class: 'tr-stat k-section', 'aria-label': `${label} ${value}` },
    el('div', { class: 'tr-stat-top', 'aria-hidden': 'true' },
      iconEl(icon), el('b', { class: 'tr-stat-value' }, formatExact(value))),
    el('div', { class: 'tr-stat-label', 'aria-hidden': 'true' }, label));

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
        Math.ceil(lineRemainingSeconds(game.state, district.uniqueId, now)),
        lineRushCost(game.state, district.uniqueId, now),
        game.hasSpeedups({ kind: 'training', buildingId: district.uniqueId }),
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
    root.append(el('div', { class: 'tr-desc' }, tr('{used} of {cap} beds taken', {
      used: formatExact(ward.used), cap: formatExact(ward.cap),
    })));
    if (ward.byUnit.length === 0) {
      root.append(el('div', { class: 'tr-desc' },
        tr('Nobody in the beds. Soldiers hurt in a fight wait here instead of dying.')));
    }
    for (const { unitId, count } of ward.byUnit) {
      const seconds = game.healWait(unitId, count);
      root.append(el('div', { class: 'tr-info is-ward k-section' },
        unitPortrait(unitId, 'tr-portrait'),
        el('div', { class: 'tr-body' },
          el('div', { class: 'tr-name' }, trn(count, '{n} {name}', '{n} {name}s', {
            n: formatExact(count), name: TROOPS[unitId].name,
          })),
          el('div', { class: 'tr-desc' },
            tr('Off the roster until they are back on their feet. Cheaper to mend than to replace.'))),
        action({
          label: tr('Heal'),
          kind: 'primary',
          onClick: () => game.doHealWounded(unitId, count, district),
          cost: game.healPrice(unitId, count),
          have: (c) => game.walletValue(c),
          disabledReason: game.armyRoom().used + count > game.armyRoom().cap
            ? tr('No room in the ranks — upgrade this hall')
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
  // One unit per building (dataRules.ts); a hall shows the RANK it is set to
  // train — its pick, or the best one open (game.ts `traineeAt`).
  const selected = game.traineeAt(district);
  root.append(detail(game, district, selected, batch()));
  return root;
}

/** Seconds the head of the line still needs — the time under its bar. */
function queueLeft(game: Game, district: District, head: ReturnType<typeof lineFor>[number]): number {
  return head.startedAt === null
    ? (head.kind === 'heal'
      ? game.healWait(head.trainee as TroopId, itemCount(head))
      : trainSecondsAt(game.state, district.uniqueId, head.trainee, head))
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
  if (line.length === 0) {
    return el('div', { class: 'tr-batch' },
      el('div', { class: 'tr-batch-empty' }, tr('Nothing in training')));
  }
  const count = line.reduce((n, item) => n + itemCount(item), 0);
  // The time left rides INSIDE the bar, on its own label, as every bar's
  // reading does (the quest scroll's counter).
  const bar = progress('green');
  const left = queueLeft(game, district, line[0]);
  // Running only once the head has started; waiting, it stays where it is.
  bar.run(trainingProgress(game.state, district.uniqueId, now),
    line[0].startedAt === null ? 0 : left * 1000,
    formatDuration(Math.ceil(left)));
  const total = isWard
    ? line.reduce((n, item, i) => n + (i === 0
      ? queueLeft(game, district, item)
      : game.healWait(item.trainee as TroopId, itemCount(item))), 0)
    : lineRemainingSeconds(game.state, district.uniqueId, now);
  return el('div', { class: 'tr-batch' },
    el('div', { class: 'tr-batch-row' },
      el('div', { class: 'tr-batch-face', title: `${count} ${nameFor(line[0].trainee)}` },
        unitPortrait(line[0].trainee),
        ...(count > 1 ? [el('span', { class: 'tr-count' }, `x${count}`)] : [])),
      // What is happening over its bar, and the whole batch's time under it.
      el('div', { class: 'tr-batch-progress' },
        el('span', { class: 'tr-batch-what' }, isWard ? tr('Mending') : tr('Training')),
        bar.root,
        el('span', { class: 'tr-batch-total' }, tr('Total time: {time}', { time: formatDuration(Math.ceil(total)) }))),
      timerButton(game, { kind: 'training', buildingId: district.uniqueId }, coach(btn({
        label: tr('Finish'),
        kind: 'gem',
        onClick: () => game.doFinishTraining(district),
        cost: { Gems: lineRushCost(game.state, district.uniqueId, now) },
        have: (c) => game.walletValue(c),
      }), 'card:finish-training'))));
}

/** What keeps a RANK from this hall, in a few words — the technology it
 *  waits on or the level the hall needs; undefined when it is open. */
function rankReason(game: Game, district: District, troop: TroopId): string | undefined {
  const gate = rankGate(game.state, troop, district);
  if (gate === null) return undefined;
  if (gate === 'HallLevel') {
    return tr('{name} level {n}', {
      name: DISTRICTS[district.definitionId].name, n: formatExact(TROOPS[troop].minBuildingLevel),
    });
  }
  const tech = [TROOPS[unitOf(troop)].requiredTech, TROOPS[troop].requiredTech]
    .find((t) => t !== null && !isTechComplete(game.state, t));
  return tech === undefined || tech === null ? tr('Not researched') : tr('Needs {tech}', { tech: TECHNOLOGIES[tech].name });
}

/** Why Train is dead right now for an order of `count`, in a few words;
 *  undefined when it is not. Being short of coin is not a gate (§6.4). */
function gateOf(game: Game, district: District, trainee: TrainableId, count: number): string | undefined {
  const unit = trainee === 'Villager' ? null : TROOPS[trainee];
  if (trainee !== 'Villager') {
    const reason = rankReason(game, district, trainee);
    if (reason !== undefined) return reason;
    // One rank in a line at a time (combat.md §6.4).
    const inLine = rankInLine(game.state, district.uniqueId);
    if (inLine !== null && inLine !== trainee) return tr('Finish the current batch');
  }
  const room = trainRoom(game.state, trainee);
  if (room === 0) return unit === null ? tr('No house to live in') : tr('Max army reached');
  return room < count ? tr('Room for {n}', { n: formatExact(room) }) : undefined;
}

/** The amount selector's face. */
const amountLabel = (a: TrainAmount): string => (a === 'all' ? tr('All') : `x${formatExact(a)}`);

/** The panel for the building's one trainee: portrait, tags, flavour, the
 *  priced Train button (its training time is the building's own stat), a
 *  soldier's four numbers in a row of their own, and the batch at the foot. */
function detail(game: Game, district: District, trainee: TrainableId, batch: HTMLElement): HTMLElement {
  // What one press orders: the amount picked on the selector, priced whole.
  const { count, cost } = trainPlan(game.state, trainee, game.trainAmount);
  const unit = trainee === 'Villager' ? null : TROOPS[trainee];

  // A GATE keeps the button and disables it: where the price would be, the
  // priced frame says in a few words why it cannot be pressed. Being short of
  // coin is not a gate: the price stays, and its red term says so (§6.4).
  const gate = gateOf(game, district, trainee, count);
  const buy = btn({
    label: tr('Train'),
    kind: 'primary',
    onClick: () => { game.doTrain(trainee, district); },
    ...(gate === undefined
      ? { cost, have: (c) => game.walletValue(c) }
      : { costExtra: [{ icon: 'padlock', amount: gate, short: true }] }),
  });
  // HELD, Train presses itself, faster the longer the finger stays — and
  // stops where a tap would find the button dead: a gate, or the purse
  // short. The card is rebuilt by every press, so the hold is keyed by the
  // building, not by this node (kit/holdRepeat.ts).
  holdToRepeat(buy, `train:${district.uniqueId}:${trainee}`, () => {
    const here = game.state.city.districts.find((d) => d.uniqueId === district.uniqueId);
    const plan = trainPlan(game.state, trainee, game.trainAmount);
    if (here === undefined || gateOf(game, here, trainee, plan.count) !== undefined) return false;
    if (isShort(plan.cost, (c) => game.walletValue(c))) return false;
    return game.doTrain(trainee, here) === 'Queued';
  });
  buy.dataset.coach = 'card:train';
  if (gate !== undefined) buy.classList.add('is-gated');

  // THE AMOUNT: one round knob on the panel's corner that turns through x1,
  // x10, x100 and All — what Train orders, and what its price is for.
  const amount = knob(amountLabel(game.trainAmount), () => game.cycleTrainAmount(), {
    label: game.trainAmount === 'all'
      ? tr('Train as many as you can at a time')
      : tr('Train {n} at a time', { n: formatExact(game.trainAmount) }),
  });
  amount.classList.add('tr-amount');

  const tags = unit === null
    ? [tag(tr('Worker'), tr('Lives in a house, pays rent and works the buildings.'), 'type')]
    : [typeTag(unitOf(trainee as TroopId))];

  // How many the player already HAS: the army's soldiers of this unit (the
  // wounded are the ward's), or the villagers who live in the city.
  const owned = trainee === 'Villager'
    ? game.state.city.population
    : game.state.army.filter((u) => u.definitionId === trainee).length;
  // A soldier's numbers: the four it is chosen on sit under its picture and
  // blurb, beside Train; any more would take a row of their own under both,
  // the same tiles, four to the row.
  const figures = unit === null ? [] : [
    stat('atk', tr('stat::Attack'), unit.atk),
    stat('dmg', tr('Damage'), unit.dmg),
    stat('def', tr('Defence'), unit.def),
    stat('hp', tr('Health'), unit.hp),
  ];
  // A HALL'S PORTRAIT IS A BUTTON (combat.md §6.4): it drops the list of
  // the unit's ranks, and the one picked is what this panel shows and Train
  // trains. A villager has no ranks, so the Townhall's stays a picture.
  const ranked = trainee !== 'Villager';
  const who = el(ranked ? 'button' : 'div', {
    class: `tr-who${ranked ? ' is-picker' : ''}`,
    title: tr('You have {n}', { n: formatExact(owned) }),
    ...(ranked ? {
      type: 'button',
      'aria-haspopup': 'listbox',
      'aria-expanded': String(game.rankMenuFor === district.uniqueId),
      'aria-label': tr('{name} — choose a rank', { name: nameFor(trainee) }),
    } : {}),
  },
  unitPortrait(trainee, 'tr-portrait'),
  el('span', { class: 'tr-count' }, `x${formatExact(owned)}`),
  ...(ranked ? [el('span', { class: 'tr-who-caret', 'aria-hidden': 'true' }, iconEl('arrowUp', { size: 'sm' }))] : []));
  if (ranked) who.addEventListener('click', () => game.toggleRankMenu(district));
  const menu = ranked && game.rankMenuFor === district.uniqueId
    ? rankMenu(game, district, trainee as TroopId) : null;
  return el('div', { class: `tr-info k-section${figures.length > 0 ? ' has-stats' : ''}` },
    amount,
    who,
    // No name here: it heads the whole block, on the section's rule.
    el('div', { class: 'tr-body' },
      el('div', { class: 'tr-tags' }, ...tags),
      el('div', { class: 'tr-desc' }, unit === null ? villager().description : unit.description)),
    el('div', { class: 'tr-buy' }, buy),
    ...(figures.length === 0 ? [] : [el('div', { class: 'tr-stats' }, ...figures.slice(0, 4))]),
    ...(figures.length <= 4 ? [] : [el('div', { class: 'tr-stats is-more' }, ...figures.slice(4))]),
    // The rank list opens IN the panel, under the numbers, so a long card
    // scrolls to it rather than clipping it.
    ...(menu === null ? [] : [menu]),
    batch,
  );
}

/**
 * THE RANK LIST — what the hall's portrait drops (combat.md §6.4): one row a
 * rank, its portrait with the coin, its name and its four numbers as VALUES
 * (two ranks are compared by reading them, never by a multiplier); a rank
 * still shut adds the padlock and what opens it. Its price is the Train
 * button's once it is picked.
 */
function rankMenu(game: Game, district: District, picked: TroopId): HTMLElement {
  const rows = troopsOf(unitOf(picked)).map((troop) => {
    const def = TROOPS[troop];
    const reason = rankReason(game, district, troop);
    const row = el('button', {
      class: `tr-rank${troop === picked ? ' is-picked' : ''}${reason !== undefined ? ' is-locked' : ''}`,
      type: 'button', role: 'option', 'aria-selected': String(troop === picked),
    },
    unitPortrait(troop, 'tr-rank-face'),
    el('span', { class: 'tr-rank-body' },
      el('span', { class: 'tr-rank-head' },
        el('span', { class: 'tr-rank-name' }, def.name),
        ...(reason === undefined ? []
          : [el('span', { class: 'tr-rank-lock' }, iconEl('padlock', { size: 'sm' }), reason)])),
      el('span', { class: 'tr-rank-stats' },
        miniStat('atk', def.atk), miniStat('dmg', def.dmg), miniStat('def', def.def), miniStat('hp', def.hp))));
    row.addEventListener('click', (e) => { e.stopPropagation(); game.pickRank(district, troop); });
    return row;
  });
  return el('div', { class: 'tr-ranks', role: 'listbox', 'aria-label': tr('Ranks') }, ...rows);
}

/** One number in a rank row: its mark and its value, small. */
const miniStat = (icon: IconName, value: number): HTMLElement =>
  el('span', { class: 'tr-rank-stat' }, iconEl(icon, { size: 'sm' }), formatExact(value));

