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

import { formatAdjacency, icon, type Game } from '../game';
import { gemRushCost } from '../sim/commands';
import {
  DISTRICTS, HARVEST, TAXES, TECHNOLOGIES, TRAINING, WORKER, levelIndexed,
} from '../sim/data/definitions';
import { districtAdjacency } from '../sim/adjacency';
import {
  districtCount, requiredTechForLevel, requiredTownhallLevel, upgradeCost, upgradeDuration,
} from '../sim/districts';
import { districtCapacity, houseGoldPerMinute } from '../sim/population';
import { isTechComplete } from '../sim/research';
import { spriteUrl } from '../render/sprites';
import {
  queueProgress, remainingSeconds, townhall,
  type CurrencyId, type District,
} from '../sim/state';
import { effectiveTapYield, effectiveWorkerYield } from '../sim/upgrades';
import { assignableWorkerLimit, influenceRadius } from '../sim/workers';
import { button, el, formatDuration } from './format';
import { action, btn, costChips, iconEl, knob, pips, progress, stat } from './kit';

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
      const short = game.shortfall({ Food: training.cost });
      const trainAction = action({
        label: 'Train',
        kind: 'primary',
        onClick: () => game.doQueueTraining(),
        disabledReason: training.atMax
          ? 'Nowhere to put them — build more Housing'
          : Object.keys(short).length > 0
            ? `Short ${short.Food} Food`
            : undefined,
        info: el('span', { class: 'dc-upcost' },
          costChips({ Food: training.cost }, (c) => game.effectiveWalletValue(c)),
          el('span', { class: 'dc-uptime' },
            iconEl('hourglass', { size: 'sm' }), formatDuration(TRAINING.seconds))),
      });
      if (game.uiHint() === 'card:train') trainAction.classList.add('hinted');
      body.append(trainAction);
    }

    if (district.definitionId === 'FarmLands') {
      body.append(el('div', { class: 'dc-note' },
        `Tap for +${effectiveTapYield(game.state, HARVEST.Crops)} ${icon('Food')} — exhausts after `
        + `${HARVEST.Crops.tapsToExhaust} taps, recovers in ${HARVEST.Crops.recoverySeconds}s.`));
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
      body.append(el('div', { class: 'dc-tapline' },
        iconEl('showme', { size: 'sm' }),
        residents === 0
          ? 'Nobody lives here yet — train villagers at the Townhall'
          : `Tap the house to hurry the rent — +${TAXES.tapBoostSeconds}s each tap`));
    }

    if (def.maxWorkersPerLevel.length > 0 && def.harvestSource) {
      const spec = HARVEST[def.harvestSource];
      const cells = game.workableCellsOf(district);
      const limit = assignableWorkerLimit(district);
      body.append(el('div', { class: 'rows' },
        el('div', { class: 'row' },
          el('span', {}, 'Area of influence'),
          el('span', {}, `radius ${influenceRadius(district)}`)),
        el('div', { class: 'row' },
          el('span', {}, `${def.harvestSource} cells in range`),
          el('span', {}, `${cells.length}`)),
        el('div', { class: 'row' },
          el('span', {}, 'Per delivery'),
          el('span', {}, `+${effectiveWorkerYield(game.state, spec)} ${icon(spec.currencyId)} every ~${Math.round(WORKER.workSeconds + 3)}s`)),
      ));
      const minus = button('−', () => game.doChangeWorkers(district.uniqueId, -1));
      minus.disabled = district.assignedWorkers === 0;
      const plus = button('+', () => game.doChangeWorkers(district.uniqueId, 1));
      plus.disabled = district.assignedWorkers >= limit || game.freeWorkers() === 0;
      if (game.uiHint() === 'card:workers') plus.classList.add('hinted');
      body.append(el('div', { class: 'actions' },
        el('span', {}, `Workers ${district.assignedWorkers}/${limit}`),
        minus, plus));
      const states = game.state.workers
        .filter((w) => w.buildingId === district.uniqueId)
        .map((w) => ({
          Idle: '💤 waiting', MovingToCell: '🚶 heading out',
          Working: '⛏ working', MovingHome: '🎒 returning',
        }[w.activity]));
      if (states.length > 0) body.append(el('div', { class: 'dc-note' }, states.join(' · ')));
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
      label: `Finish · ${gemRushCost(queueItem, now)}`,
      kind: 'gem',
      icon: 'Gems',
      onClick: () => game.doRush(queueItem.uniqueId),
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
    const short = game.shortfall(cost);

    // The reason, in plain words, and tappable when it points somewhere.
    let reason: string | undefined;
    if (townhall(game.state).level < requiredTh) {
      reason = `Your Townhall must reach level ${requiredTh}`;
    } else if (gateTech !== null && !isTechComplete(game.state, gateTech)) {
      reason = `Research ${TECHNOLOGIES[gateTech].name} first`;
    } else if (Object.keys(short).length > 0) {
      reason = `Short ${(Object.entries(short) as Array<[CurrencyId, number]>)
        .map(([c, amount]) => `${amount} ${c}`).join(' and ')}`;
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
      info: el('span', { class: 'dc-upcost' },
        costChips(cost, (c) => game.effectiveWalletValue(c)),
        el('span', { class: 'dc-uptime' },
          iconEl('hourglass', { size: 'sm' }),
          formatDuration(upgradeDuration(district.definitionId, district.level)))),
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
