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
import { action, btn, costChips, iconEl, knob, progress } from './kit';

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
    if (district.definitionId === 'Townhall') {
      const training = game.trainingInfo();
      if (training.active) {
        const bar = progress('gold');
        bar.set(training.progress,
          `+1 villager in ${Math.ceil(training.remainingSeconds)}s`
          + (training.queued > 1 ? ` · ${training.queued - 1} more queued` : ''));
        body.append(bar.root);
        body.append(el('div', { class: 'dc-note' },
          `Tap the Townhall to add +${TRAINING.tapBoostSeconds}s of training per tap.`));
      }
      const trainBtn = button('Train', () => game.doQueueTraining());
      if (game.uiHint() === 'card:train') trainBtn.classList.add('hinted');
      const short = game.shortfall({ Food: training.cost });
      trainBtn.disabled = training.atMax || Object.keys(short).length > 0;
      body.append(el('div', { class: 'action-row' },
        el('span', { class: `info${training.atMax || !trainBtn.disabled ? '' : ' blocked'}` },
          training.atMax
            ? 'Population at max — build more Housing'
            : `Train villager — ${training.cost} ${icon('Food')} (${formatDuration(TRAINING.seconds)})`),
        trainBtn));
    }

    if (district.definitionId === 'FarmLands') {
      body.append(el('div', { class: 'dc-note' },
        `Tap for +${effectiveTapYield(game.state, HARVEST.Crops)} ${icon('Food')} — exhausts after `
        + `${HARVEST.Crops.tapsToExhaust} taps, recovers in ${HARVEST.Crops.recoverySeconds}s.`));
    }

    if (districtCapacity(game.state, district) > 0) {
      const residents = game.residentsIn(district);
      const perMinute = houseGoldPerMinute(game.state, district);
      const adjacency = districtAdjacency(game.state, district);
      const rows = el('div', { class: 'rows' },
        el('div', { class: 'row' },
          el('span', {}, '👥 residents'),
          el('span', {}, `${residents}/${districtCapacity(game.state, district)}`)));
      if (residents > 0) {
        rows.append(el('div', { class: 'row' },
          el('span', {}, '💰 taxes'),
          el('span', {}, `${Number.isInteger(perMinute) ? perMinute : perMinute.toFixed(1)} ${icon('Gold')}/min`)));
      }
      if (adjacency !== 0) {
        rows.append(el('div', { class: 'row' },
          el('span', {}, 'Neighbors'),
          el('span', { class: adjacency < 0 ? 'blocked' : 'delta' },
            `${formatAdjacency(adjacency)}/min`)));
      }
      body.append(rows);
      body.append(el('div', { class: 'dc-note' }, residents === 0
        ? 'Nobody lives here yet — train villagers at the Townhall.'
        : `Tap to fast-forward tax collection — +${TAXES.tapBoostSeconds}s per tap.`));
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
