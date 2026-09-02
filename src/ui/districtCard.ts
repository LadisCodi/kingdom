// The district card (§5.7) — everything you can do to one building.
//
// The most-used panel in the game and the most overloaded: five variants
// shared one undifferentiated stack of label/value rows, so every building
// looked identical, and the reason to spend — what an upgrade actually
// changes — was a 12px grey subline.
//
// The shell gives each variant the same frame: the building's own art at its
// current level, its level as stars, one line saying what it does, and one
// primary action at the bottom. The upgrade is a before → after strip, so the
// player sees the thing growing rather than reading `radius 2→3`.

import { formatAdjacency, type Game } from '../game';
import { gemRushCost } from '../sim/commands';
import {
  DISTRICTS, HARVEST, TAP, TECHNOLOGIES, TRAINING, UNITS, WORKER, levelIndexed,
} from '../sim/data/definitions';
import { committedArmyPower, maxArmyPower, trainingProgress } from '../sim/army';
import { districtAdjacency } from '../sim/adjacency';
import {
  districtCount, requiredTechForLevel, requiredTownhallLevel, upgradeCost, upgradeDuration,
} from '../sim/districts';
import {
  districtCapacity, houseGoldPerMinute,
} from '../sim/population';
import { mana } from '../sim/mana';
import { isTechComplete } from '../sim/research';
import { spriteUrl } from '../render/sprites';
import {
  coordKey, queueProgress, remainingSeconds, townhall, type District,
} from '../sim/state';
import { recoversAt, tapFraction } from '../sim/harvest';
import { effectiveTapYield, effectiveWorkerYield } from '../sim/upgrades';
import { assignableWorkerLimit, influenceRadius } from '../sim/workers';
import { el, formatDuration } from './format';
import { action, btn, iconEl, knob, pips, progress, stat } from './kit';

/** Level as stars rather than "lvl 2/3" — a count you read, not parse. */
function levelStars(level: number, max: number): HTMLElement {
  const row = el('span', { class: 'dc-stars' });
  for (let i = 0; i < max; i++) {
    const star = iconEl('star', { size: 'sm' });
    if (i >= level) star.classList.add('is-empty');
    row.append(star);
  }
  return row;
}

/** The building's own art at a given level, falling back to its icon. */
function portrait(def: (typeof DISTRICTS)[keyof typeof DISTRICTS], level: number): HTMLElement {
  const url = spriteUrl(`${def.sprite}_l${level}`) ?? spriteUrl(def.sprite);
  return el('div', { class: 'dc-portrait' }, url
    ? el('img', { src: url, alt: '' })
    : iconEl(def.id, { size: 'lg' }));
}

/**
 * A small map of what this building can reach: its own footprint, the cells
 * its workers will harvest, and the ground in between. Replaces "Area of
 * influence: radius 2" and "Forest cells in range: 4" — two numbers that
 * describe a shape nobody was being shown.
 */
function influenceThumb(game: Game, district: District): HTMLElement {
  const def = DISTRICTS[district.definitionId];
  const r = influenceRadius(district);
  const caught = new Set(game.workableCellsOf(district).map((c) => coordKey(c)));
  const grid = el('div', {
    class: 'dc-thumb',
    style: `grid-template-columns: repeat(${r * 2 + def.size.x}, 1fr)`,
  });
  for (let dy = -r; dy < r + def.size.y; dy++) {
    for (let dx = -r; dx < r + def.size.x; dx++) {
      const cell = { x: district.location.x + dx, y: district.location.y + dy };
      const self = dx >= 0 && dx < def.size.x && dy >= 0 && dy < def.size.y;
      const cls = self ? 'is-self' : caught.has(coordKey(cell)) ? 'is-catch' : '';
      grid.append(el('span', { class: `dc-cell ${cls}` }));
    }
  }
  return grid;
}

export function renderDistrictCard(game: Game, district: District): HTMLElement {
  const def = DISTRICTS[district.definitionId];
  const now = game.now();
  const body = el('div', { class: 'dc-body' });
  const queueItem = game.state.city.queue.find((q) => q.districtUniqueId === district.uniqueId);

  // ------------------------------------------------------------ variant body
  if (district.state === 'UnderConstruction') {
    body.append(el('div', { class: 'dc-note' }, 'Under construction.'));
  } else {
    // The Townhall's job is growing the population, so the queue is the star.
    if (district.definitionId === 'Townhall') {
      const training = game.trainingInfo();
      if (training.active) {
        const bar = progress('gold');
        bar.set(training.progress, `Next villager in ${Math.ceil(training.remainingSeconds)}s`);
        body.append(bar.root);
        if (training.queued > 1) {
          body.append(el('div', { class: 'dc-queue' },
            iconEl('population', { size: 'sm' }),
            pips(1, training.queued),
            el('span', {}, `${training.queued - 1} more waiting`)));
        }
        // The tap boost is an affordance on the BUILDING, so it is pointed
        // at rather than described.
        body.append(el('div', { class: 'dc-tapline' },
          iconEl('showme', { size: 'sm' }),
          `Tap the Townhall itself to hurry it — +${TRAINING.tapBoostSeconds}s each tap`));
      }
      const trainAction = action({
        label: 'Train',
        kind: 'primary',
        onClick: () => game.doQueueTraining(),
        disabledReason: training.atMax
          ? 'Nowhere to put them — build more Housing'
          : undefined,
        cost: { Food: training.cost },
        have: (c) => game.effectiveWalletValue(c),
        info: el('span', { class: 'dc-uptime' },
          iconEl('hourglass', { size: 'sm' }), formatDuration(TRAINING.seconds)),
      });
      if (game.uiHint() === 'card:train') trainAction.classList.add('hinted');
      body.append(trainAction);
    }

    // A crop plot is a resource cell you tap, so show what is left in it.
    if (district.definitionId === 'FarmLands') {
      const spec = HARVEST.Crops;
      const left = Math.round(tapFraction(game.state, district.location, spec, now)
        * spec.tapsToExhaust);
      const readyAt = recoversAt(game.state, district.location, now);
      body.append(el('div', { class: 'dc-homes' },
        iconEl('Food', { size: 'sm' }),
        pips(left, spec.tapsToExhaust),
        el('span', {}, readyAt === null
          ? `${left} harvests left`
          : `regrowing — ${formatDuration((readyAt - now) / 1000)}`)));
      body.append(el('div', { class: 'dc-tapline' },
        iconEl('showme', { size: 'sm' }),
        `Tap the plot for +${effectiveTapYield(game.state, spec)} Food`));
    }

    // A house is people and the rent they pay, so show both as such.
    if (districtCapacity(game.state, district) > 0) {
      const capacity = districtCapacity(game.state, district);
      const residents = game.residentsIn(district);
      const perMinute = houseGoldPerMinute(game.state, district);
      const adjacency = districtAdjacency(game.state, district);

      body.append(el('div', { class: 'dc-homes' },
        iconEl('population', { size: 'sm' }),
        pips(residents, capacity),
        el('span', {}, `${residents} of ${capacity} homes filled`)));

      if (residents > 0) {
        body.append(el('div', { class: 'dc-drip' },
          stat('Gold', Number.isInteger(perMinute) ? String(perMinute) : perMinute.toFixed(1),
            'per minute')));
      }
      // Adjacency as a verdict rather than a signed number.
      if (adjacency !== 0) {
        body.append(el('div', { class: `dc-badge ${adjacency < 0 ? 'is-bad' : 'is-good'}` },
          adjacency < 0
            ? `Crowded ${formatAdjacency(adjacency)}/min — houses too close together`
            : `Cosy neighbourhood ${formatAdjacency(adjacency)}/min`));
      }
      // No cycle bar any more: the house has no timer to show. What bounds
      // the tap is the Mana pool, so the card says the price and what is left
      // to spend — a number the player can act on, where a countdown was only
      // ever a number to wait out.
      body.append(el('div', { class: 'dc-tapline' },
        iconEl('showme', { size: 'sm' }),
        residents === 0
          ? 'Nobody lives here yet — train villagers at the Townhall'
          : `Tap to pull ${TAP.boostSeconds}s of rent forward, as often as you like`));
      if (residents > 0) {
        const pool = mana(game.state);
        body.append(el('div', { class: `dc-tapcost${pool < TAP.manaCost ? ' is-bad' : ''}` },
          iconEl('Mana', { size: 'sm' }),
          `${TAP.manaCost} per tap — ${pool} left`));
      }
    }

    // A military building trains its own unit, in its own line, exactly as
    // the Townhall trains villagers. That symmetry is why the standing Army
    // screen could disappear: an army only matters when it is SENT somewhere,
    // and it is recruited where it is made.
    if (def.trains !== null) {
      const unitId = def.trains;
      const unit = UNITS[unitId];
      const cap = maxArmyPower(game.state);
      const used = committedArmyPower(game.state);
      const inLine = game.state.city.armyQueue.filter((i) => i.buildingId === district.uniqueId);
      const techOk = unit.requiredTech === null || isTechComplete(game.state, unit.requiredTech);

      body.append(el('div', { class: 'dc-army' },
        iconEl('army', { size: 'sm' }),
        el('span', {}, `Army ${used} of ${cap}`),
        el('span', { class: 'dc-army-note' },
          `this hall holds ${levelIndexed(def.armyCapPerLevel, district.level)} of it`)));

      if (inLine.length > 0) {
        const bar = progress('sky');
        bar.set(
          trainingProgress(game.state, district.uniqueId, game.now()),
          inLine.length > 1
            ? `${unit.name} — ${inLine.length} in the line`
            : `${unit.name} in training`,
        );
        body.append(bar.root);
        body.append(el('div', { class: 'dc-tapline' },
          iconEl('showme', { size: 'sm' }),
          `Tap the ${def.name} to hurry them along`));
      }

      const cost = unit.recruitCost;
      body.append(action({
        label: `Recruit ${unit.name}`,
        kind: 'primary',
        onClick: () => game.doTrain(unitId),
        cost,
        have: (c) => game.effectiveWalletValue(c),
        disabledReason: !techOk
          ? `Research ${TECHNOLOGIES[unit.requiredTech!].name} first`
          : used + unit.power > cap
            ? 'Your army is full — upgrade this hall'
            : undefined,
      }));
      body.append(el('div', { class: 'dc-army-stats' },
        stat('army', String(unit.atk), 'attack'),
        stat('padlock', String(unit.def), 'defence'),
        stat('population', String(unit.hp), 'health'),
        stat('hourglass', formatDuration(unit.trainDurationSeconds), 'to train')));
    }

    // A worker building is an AREA and the people you put in it. Both were
    // numbers in a table; both are now pictures.
    if (def.maxWorkersPerLevel.length > 0 && def.harvestSource) {
      const spec = HARVEST[def.harvestSource];
      const cells = game.workableCellsOf(district);
      const limit = assignableWorkerLimit(district);

      body.append(el('div', { class: 'dc-area' },
        influenceThumb(game, district),
        el('div', {},
          el('div', { class: 'dc-area-count' },
            iconEl(spec.currencyId, { size: 'sm' }),
            el('b', {}, `×${cells.length}`),
            el('span', {}, `${def.harvestSource} in reach`)),
          el('div', { class: 'dc-area-rate' },
            `+${effectiveWorkerYield(game.state, spec)} per trip, about every `
            + `${Math.round(WORKER.workSeconds + 3)}s`))));

      // Slots, not a fraction: filled ones are people, empty ones are room.
      const slots = el('div', { class: 'dc-slots' });
      for (let i = 0; i < limit; i++) {
        const filled = i < district.assignedWorkers;
        slots.append(el('span', { class: `dc-slot${filled ? ' is-filled' : ''}` },
          ...(filled ? [iconEl('workers', { size: 'sm' })] : [])));
      }
      const minus = knob('−', () => game.doChangeWorkers(district.uniqueId, -1), {
        label: 'Remove a worker', disabled: district.assignedWorkers === 0,
      });
      const plus = knob('+', () => game.doChangeWorkers(district.uniqueId, 1), {
        label: 'Add a worker',
        disabled: district.assignedWorkers >= limit || game.freeWorkers() === 0,
      });
      if (game.uiHint() === 'card:workers') plus.classList.add('hinted');
      body.append(el('div', { class: 'dc-crew' }, minus, slots, plus));

      // What the crew is doing, aggregated — a per-worker list of emoji was
      // noise once there were more than two of them.
      const busy = game.state.workers.filter((w) => w.buildingId === district.uniqueId);
      if (busy.length > 0) {
        const counts = new Map<string, number>();
        for (const w of busy) {
          const label = { Idle: 'waiting', MovingToCell: 'heading out',
            Working: 'working', MovingHome: 'carrying home' }[w.activity];
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        body.append(el('div', { class: 'dc-note' },
          [...counts].map(([label, n]) => `${n} ${label}`).join(' · ')));
      } else if (district.assignedWorkers === 0) {
        body.append(el('div', { class: 'dc-tapline' },
          iconEl('showme', { size: 'sm' }), 'Nobody works here yet — add a villager'));
      }
    }
  }

  // ----------------------------------------------------------------- footer
  const foot = el('div', { class: 'dc-foot' });

  if (queueItem) {
    // Scaffolding: what is happening and how to skip it.
    const bar = progress('sky');
    bar.set(queueProgress(queueItem, now),
      queueItem.startedAt === null
        ? 'waiting for a builder'
        : `${formatDuration(remainingSeconds(queueItem, now))} left`);
    foot.append(bar.root);
    const rush = btn({
      label: 'Finish',
      kind: 'gem',
      onClick: () => game.doRush(queueItem.uniqueId),
      // The price used to be glued into the label with a separator. It is a
      // cost like any other, so it goes where every other cost now goes.
      cost: { Gems: gemRushCost(queueItem, now) },
      have: (c) => game.effectiveWalletValue(c),
    });
    const buttons = el('div', { class: 'dc-actions' }, rush);
    if (queueItem.kind === 'build') {
      buttons.append(btn({
        label: 'Cancel',
        kind: 'destructive',
        onClick: () => game.doCancelItem(queueItem.uniqueId),
      }));
    }
    foot.append(buttons);
  } else if (district.state === 'Built' && district.level < def.maxLevel) {
    const next = district.level + 1;
    const n = districtCount(game.state, district.definitionId);
    const cost = upgradeCost(district.definitionId, n, district.level);
    const requiredTh = requiredTownhallLevel(district.definitionId, next);
    const gateTech = requiredTechForLevel(district.definitionId, next);

    // The reason, in plain words, and tappable when it points somewhere.
    // Being short of the price is NOT one of these any more: the cost now
    // rides inside the button and turns clay, which says it better than a
    // sentence beside it could (§6.4).
    let reason: string | undefined;
    if (townhall(game.state).level < requiredTh) {
      reason = `Your Townhall must reach level ${requiredTh}`;
    } else if (gateTech !== null && !isTechComplete(game.state, gateTech)) {
      reason = `Research ${TECHNOLOGIES[gateTech].name} first`;
    }

    // Before → after: the thing growing, rather than "radius 2→3".
    const strip = el('div', { class: 'dc-ba' },
      portrait(def, district.level),
      iconEl('showme', { size: 'sm' }),
      portrait(def, next));
    const deltas = el('div', { class: 'dc-deltas' });
    if (def.influenceRadiusPerLevel.length > 0) {
      deltas.append(el('span', {}, `reach ${influenceRadius(district)} → `
        + `${levelIndexed(def.influenceRadiusPerLevel, next)}`));
      deltas.append(el('span', {}, `workers ${assignableWorkerLimit(district)} → `
        + `${levelIndexed(def.maxWorkersPerLevel, next)}`));
    }
    if (def.populationCapacityPerLevel.length > 0) {
      const capNow = districtCapacity(game.state, district);
      const capNext = capNow + levelIndexed(def.populationCapacityPerLevel, next)
        - levelIndexed(def.populationCapacityPerLevel, district.level);
      deltas.append(el('span', {}, `homes ${capNow} → ${capNext}`));
    }

    const upgrade = action({
      label: 'Upgrade',
      kind: 'primary',
      onClick: () => game.doUpgrade(district.uniqueId),
      disabledReason: reason,
      cost,
      have: (c) => game.effectiveWalletValue(c),
      // What is left beside the button is the WAIT, which is a consequence
      // rather than a price and has no business inside the press-target.
      info: el('span', { class: 'dc-uptime' },
        iconEl('hourglass', { size: 'sm' }),
        formatDuration(upgradeDuration(district.definitionId, district.level))),
    });
    if (game.uiHint() === 'card:upgrade') upgrade.classList.add('hinted');
    foot.append(strip, deltas, upgrade);
  }

  const close = knob('✕', () => game.dismiss(), { label: 'Close' });
  close.setAttribute('data-own-close', '');

  return el('div', { class: 'dc' },
    el('div', { class: 'dc-head' },
      portrait(def, district.level),
      el('div', { class: 'dc-id' },
        el('div', { class: 'dc-name' }, def.name),
        levelStars(district.level, def.maxLevel),
        el('div', { class: 'dc-what' }, def.description)),
      close),
    body,
    foot,
  );
}
