// Tile / district card: identity, level, harvest info, workers ±, Townhall
// villager training, upgrade, and — while a build/upgrade is in progress —
// progress + gem finish.

import { icon, type Game } from '../game';
import { canAfford, gemRushCost } from '../sim/commands';
import { DISTRICTS, HARVEST, TRAINING, WORKER, levelIndexed } from '../sim/data/definitions';
import { districtCount, requiredTownhallLevel, upgradeCost, upgradeDuration } from '../sim/districts';
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
    // Townhall: villager training (tap-boostable).
    if (district.definitionId === 'Townhall') {
      const training = game.trainingInfo();
      if (training.active) {
        const bar = el('div', { class: 'progress' },
          el('div', { class: 'fill' }),
          el('div', { class: 'label' }, `+1 👥 in ${Math.ceil(training.remainingSeconds)}s`));
        (bar.querySelector('.fill') as HTMLElement).style.width = `${training.progress * 100}%`;
        panel.append(bar);
        panel.append(el('div', { class: 'muted' },
          `Tap the Townhall to add +${TRAINING.tapBoostSeconds}s of training per tap.`));
      } else {
        const trainBtn = button('Train', () => game.doStartTraining());
        const affordable = canAfford(game.state.city.wallet, { Food: training.cost });
        trainBtn.disabled = training.atMax || !affordable;
        panel.append(el('div', { class: 'action-row' },
          el('span', { class: `info${training.atMax || affordable ? '' : ' blocked'}` },
            training.atMax
              ? 'Population at max — build more Housing'
              : `Train villager — ${training.cost} ${icon('Food')} (${formatDuration(TRAINING.seconds)})`),
          trainBtn));
      }
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
          el('span', {}, `+${spec.yieldPerWorker} ${icon(spec.currencyId)} every ~${Math.round(WORKER.workSeconds + 3)}s`)),
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
    panel.append(el('div', { class: 'action-row' },
      el('span', { class: 'info' }, `Finish now — ${gemRushCost(queueItem, now)} ${icon('Gems')}`),
      button('Finish', () => game.doRush(queueItem.uniqueId))));
    if (queueItem.kind === 'build') {
      panel.append(el('div', { class: 'action-row' },
        el('span', { class: 'info' }, 'Cancel construction — full refund'),
        button('Cancel', () => game.doCancelItem(queueItem.uniqueId), 'danger')));
    }
  } else if (district.state === 'Built' && district.level < def.maxLevel) {
    // Upgrade widget (with radius/worker-cap deltas for worker buildings).
    const n = districtCount(game.state, district.definitionId);
    const cost = upgradeCost(district.definitionId, n, district.level);
    const duration = upgradeDuration(district.definitionId, district.level);
    const requiredTh = requiredTownhallLevel(district.definitionId, district.level + 1);
    const thLevel = townhall(game.state).level;
    const affordable = canAfford(game.state.city.wallet, cost);
    const blocked = thLevel < requiredTh;
    const upBtn = button('Upgrade', () => game.doUpgrade(district.uniqueId));
    upBtn.disabled = blocked || !affordable;
    const info = el('div', { class: 'info' },
      el('div', { class: affordable ? '' : 'blocked' },
        `Upgrade to lvl ${district.level + 1} — ${formatCost(cost)} (${formatDuration(duration)})`));
    if (def.influenceRadiusPerLevel.length > 0) {
      const nextRadius = levelIndexed(def.influenceRadiusPerLevel, district.level + 1);
      const nextCap = levelIndexed(def.maxWorkersPerLevel, district.level + 1);
      info.append(el('div', { class: 'sub delta' },
        `radius ${influenceRadius(district)}→${nextRadius}, worker cap →${nextCap}`));
    }
    if (blocked) info.append(el('div', { class: 'sub blocked' }, `Townhall lvl ${requiredTh} required`));
    panel.append(el('div', { class: 'action-row' }, info, upBtn));
  }

  return panel;
}
