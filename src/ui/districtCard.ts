// Tile / district card: identity, level, harvest info, workers ±, Townhall
// cycle, upgrade, and — while a build/upgrade is in progress — progress + gem
// finish.

import { icon, type Game } from '../game';
import { canAfford, gemRushCost } from '../sim/commands';
import { DISTRICTS, HARVEST, TOWNHALL_CYCLE, WORKER, levelIndexed } from '../sim/data/definitions';
import { districtCount, requiredTownhallLevel, upgradeCost, upgradeDuration } from '../sim/districts';
import { maxPopulation, populationCost } from '../sim/population';
import {
  queueProgress, remainingSeconds, townhall,
  type District,
} from '../sim/state';
import { assignableWorkerLimit, influenceRadius } from '../sim/workers';
import { button, el, formatCost, formatDuration } from './format';

export function renderDistrictCard(game: Game, district: District): HTMLElement {
  const def = DISTRICTS[district.definitionId];
  const panel = el('div', {});
  const now = game.now();

  panel.append(
    el('h3', {}, `${def.glyph} ${def.name}`,
      el('span', { class: 'muted' }, ` lvl ${district.level}/${def.maxLevel}`)),
  );

  const queueItem = game.state.city.queue.find((q) => q.districtUniqueId === district.uniqueId);

  if (district.state === 'UnderConstruction') {
    panel.append(el('div', { class: 'muted' }, 'Under construction.'));
  } else {
    // Townhall: the tap-boostable tax cycle.
    if (district.definitionId === 'Townhall') {
      const cycle = game.townhallCycleInfo();
      const bar = el('div', { class: 'progress' },
        el('div', { class: 'fill' }),
        el('div', { class: 'label' },
          `+${cycle.payout} ${icon('Silver')} in ${Math.ceil(cycle.remainingSeconds)}s`));
      (bar.querySelector('.fill') as HTMLElement).style.width = `${cycle.progress * 100}%`;
      panel.append(bar);
      panel.append(el('div', { class: 'muted' },
        `Tap the Townhall to add +${TOWNHALL_CYCLE.tapBoostSeconds}s of progress per tap.`));
    }

    // Crop plot: it's a resource cell.
    if (district.definitionId === 'FarmLands') {
      panel.append(el('div', { class: 'muted' },
        `Tap for +${HARVEST.Crops.yieldPerTap} ${icon('Food')} — exhausts after ` +
        `${HARVEST.Crops.tapsToExhaust} taps, recovers in ${HARVEST.Crops.recoverySeconds}s.`));
    }

    if (def.populationCapacity > 0) {
      panel.append(el('div', { class: 'rows' },
        el('div', { class: 'row' },
          el('span', {}, '👥 housing'), el('span', {}, `+${def.populationCapacity}`))));
      const pop = game.state.city.population;
      const atMax = pop >= maxPopulation(game.state);
      const buyBtn = button(
        atMax ? 'Population at max' : `Buy population — ${populationCost(pop)} ${icon('Food')}`,
        () => game.doBuyPopulation(),
      );
      buyBtn.disabled = atMax;
      panel.append(el('div', { class: 'actions' }, buyBtn));
    }

    // Worker buildings: area, workers ±, live worker states.
    if (def.maxWorkersPerLevel.length > 0 && def.harvestSource) {
      const spec = HARVEST[def.harvestSource];
      const cells = game.workableCellsOf(district);
      const limit = assignableWorkerLimit(game.state, game.map, district);
      const maxForLevel = levelIndexed(def.maxWorkersPerLevel, district.level);
      panel.append(el('div', { class: 'rows' },
        el('div', { class: 'row' },
          el('span', {}, 'Area of influence'),
          el('span', {}, `radius ${influenceRadius(district)}`)),
        el('div', { class: 'row' },
          el('span', {}, `${def.harvestSource} cells in range`),
          el('span', {}, `${cells.length}`)),
        el('div', { class: 'row' },
          el('span', {}, 'Per delivery'),
          el('span', {}, `+${WORKER.carry} ${icon(spec.currencyId)} every ~${Math.round(WORKER.workSeconds + 3)}s`)),
      ));
      const minus = button('−', () => game.doChangeWorkers(district.uniqueId, -1));
      minus.disabled = district.assignedWorkers === 0;
      const plus = button('+', () => game.doChangeWorkers(district.uniqueId, 1));
      plus.disabled = district.assignedWorkers >= limit || game.freeWorkers() === 0;
      panel.append(el('div', { class: 'actions' },
        el('span', {}, `Workers ${district.assignedWorkers}/${limit} (cap ${maxForLevel})`),
        minus, plus));
      const states = game.state.workers
        .filter((w) => w.buildingId === district.uniqueId)
        .map((w) => ({
          Idle: '💤 waiting', MovingToCell: '🚶 heading out',
          Working: '⛏ working', MovingHome: '🎒 returning',
        }[w.activity]));
      if (states.length > 0) {
        panel.append(el('div', { class: 'muted' }, states.join(' · ')));
      }
    }
  }

  // Progress + gem finish for the in-flight queue item.
  if (queueItem) {
    const progress = queueProgress(queueItem, now);
    const remaining = remainingSeconds(queueItem, now);
    const bar = el('div', { class: 'progress' },
      el('div', { class: 'fill' }),
      el('div', { class: 'label' },
        queueItem.startedAt === null ? 'waiting for a builder' : `${formatDuration(remaining)} left`));
    (bar.querySelector('.fill') as HTMLElement).style.width = `${progress * 100}%`;
    panel.append(bar);
    const actions = el('div', { class: 'actions' });
    actions.append(
      button(`Finish now — ${gemRushCost(queueItem, now)} ${icon('Gems')}`, () =>
        game.doRush(queueItem.uniqueId)),
    );
    if (queueItem.kind === 'build') {
      actions.append(button('Cancel & refund', () => game.doCancelItem(queueItem.uniqueId), 'danger'));
    }
    panel.append(actions);
  } else if (district.state === 'Built' && district.level < def.maxLevel) {
    // Upgrade widget (with radius/worker-cap deltas for worker buildings).
    const n = districtCount(game.state, district.definitionId);
    const cost = upgradeCost(district.definitionId, n, district.level);
    const duration = upgradeDuration(district.definitionId, district.level);
    const requiredTh = requiredTownhallLevel(district.definitionId, district.level + 1);
    const thLevel = townhall(game.state).level;
    const affordable = canAfford(game.state.city.wallet, cost);
    const blocked = thLevel < requiredTh;
    const upBtn = button(
      `Upgrade to lvl ${district.level + 1} — ${formatCost(cost)} (${formatDuration(duration)})`,
      () => game.doUpgrade(district.uniqueId),
    );
    upBtn.disabled = blocked || !affordable;
    const actions = el('div', { class: 'actions' }, upBtn);
    if (def.influenceRadiusPerLevel.length > 0) {
      const nextRadius = levelIndexed(def.influenceRadiusPerLevel, district.level + 1);
      const nextCap = levelIndexed(def.maxWorkersPerLevel, district.level + 1);
      actions.append(el('span', { class: 'muted' },
        el('span', { class: 'delta' }, `radius ${influenceRadius(district)}→${nextRadius}, worker cap →${nextCap}`)));
    }
    if (blocked) actions.append(el('span', { class: 'blocked' }, `Townhall lvl ${requiredTh} required`));
    panel.append(actions);
  }

  return panel;
}
