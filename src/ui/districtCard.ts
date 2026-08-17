// Tile / district card: identity, level, production stats, upgrade, buy
// population (housing districts), workers +/- (worker districts), and — while
// a build/upgrade is in progress — progress + gem finish (Docs/09).

import { icon, type Game } from '../game';
import { canAfford, gemRushCost } from '../sim/commands';
import { DISTRICTS, levelIndexed } from '../sim/data/definitions';
import { districtCount, requiredTownhallLevel, upgradeCost, upgradeDuration } from '../sim/districts';
import { districtProductionPerMinute } from '../sim/recalc';
import { populationCost } from '../sim/population';
import { maxPopulation } from '../sim/recalc';
import {
  queueProgress, remainingSeconds, townhall,
  type CurrencyId, type District,
} from '../sim/state';
import { assignableWorkerLimit } from '../sim/workedUnits';
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
    panel.append(el('div', { class: 'muted' }, 'Under construction — produces nothing yet.'));
  } else {
    const rows = el('div', { class: 'rows' });
    const production = districtProductionPerMinute(district);
    for (const [c, rate] of Object.entries(production)) {
      rows.append(el('div', { class: 'row' },
        el('span', {}, `${icon(c as CurrencyId)} production`),
        el('span', {}, `${Math.round(rate * 100) / 100}/min`)));
    }
    for (const gen of district.generators) {
      if (gen.vaultCapacity > 0) {
        rows.append(el('div', { class: 'row' },
          el('span', {}, `${icon(gen.currencyId)} vault (tap tile to collect)`),
          el('span', {}, `${gen.vaultStored}/${gen.vaultCapacity}`)));
      }
    }
    if (def.populationCapacity > 0) {
      rows.append(el('div', { class: 'row' },
        el('span', {}, '👥 housing'), el('span', {}, `+${def.populationCapacity}`)));
    }
    panel.append(rows);

    // Buy Population widget (districts with population capacity).
    if (def.populationCapacity > 0) {
      const pop = game.state.city.population;
      const atMax = pop >= maxPopulation(game.state);
      const cost = populationCost(pop);
      const buyBtn = button(
        atMax ? 'Population at max' : `Buy population — ${cost} ${icon('Food')} (+5 🪙/min each)`,
        () => game.doBuyPopulation(),
      );
      buyBtn.disabled = atMax;
      panel.append(el('div', { class: 'actions' }, buyBtn));
    }

    // Workers +/- (worker districts).
    if (def.maxWorkersPerLevel.length > 0) {
      const limit = assignableWorkerLimit(game.state, game.map, district);
      const maxForLevel = levelIndexed(def.maxWorkersPerLevel, district.level);
      const minus = button('−', () => game.doChangeWorkers(district.uniqueId, -1));
      minus.disabled = district.assignedWorkers === 0;
      const plus = button('+', () => game.doChangeWorkers(district.uniqueId, 1));
      plus.disabled = district.assignedWorkers >= limit || game.freeWorkers() === 0;
      const perTile = Object.entries(def.yieldPerWorkedTile)
        .map(([c, n]) => `+${n} ${icon(c as CurrencyId)}/min`)
        .join(' ');
      panel.append(
        el('div', { class: 'actions' },
          el('span', {}, `Workers ${district.assignedWorkers}/${limit} (max ${maxForLevel})`),
          minus, plus,
          el('span', { class: 'muted' }, `worker #1 runs the base; each extra works a tile (${perTile})`),
        ),
      );
    }
  }

  // Progress + gem finish for the in-flight queue item.
  if (queueItem) {
    const progress = queueProgress(queueItem, now);
    const remaining = remainingSeconds(queueItem, now);
    const bar = el('div', { class: 'progress' },
      el('div', { class: 'fill', style: '' }),
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
    // Upgrade widget.
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
    if (blocked) actions.append(el('span', { class: 'blocked' }, `Townhall lvl ${requiredTh} required`));
    panel.append(actions);
  }

  return panel;
}
