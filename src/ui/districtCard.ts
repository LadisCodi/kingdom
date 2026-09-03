// The district card (§5.7) — everything you can do to one building.
//
// The most-used panel in the game and the most overloaded: five variants
// shared one undifferentiated stack of label/value rows, so every building
// looked identical, and the reason to spend — what an upgrade actually
// changes — was a 12px grey subline.
//
// The shell gives each variant the same frame: the building's own art at its
// current level, its level as stars, one line saying what it does, and one
// primary action at the bottom. The blocks inside it share a three-column
// shape — a mark, what you are buying, the button that spends — so training
// a unit and buying a level read the same way.

import { formatAdjacency, type Game } from '../game';
import { gemRushCost } from '../sim/commands';
import {
  DISTRICTS, HARVEST, MANA, TAP, TECHNOLOGIES, WORKER, levelIndexed,
} from '../sim/data/definitions';
import { committedArmyPower, maxArmyPower } from '../sim/army';
import { districtAdjacency } from '../sim/adjacency';
import {
  canMoveDistrict, districtCount, maxCountForTownhallLevel, requiredTechForLevel,
  requiredTownhallLevel, upgradeCost, upgradeDuration,
} from '../sim/districts';
import {
  districtCapacity, houseGoldPerMinute,
} from '../sim/population';
import { mana } from '../sim/mana';
import { isTechComplete } from '../sim/research';
import { spriteUrl } from '../render/sprites';
import { trainingSection } from './trainingSection';
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

/**
 * What a level actually buys, as a list of before → after.
 *
 * Every per-level number in the sim is here, and it is the ONLY reason to
 * press Upgrade — so a building with nothing to say is a bug in the balance
 * data rather than a card that quietly shows an empty row.
 */
function upgradeDeltas(game: Game, district: District, next: number): HTMLElement[] {
  const def = DISTRICTS[district.definitionId];
  const out: HTMLElement[] = [];
  const delta = (label: string, from: number | string, to: number | string) =>
    out.push(el('span', { class: 'dc-delta' },
      el('span', { class: 'dc-delta-what' }, label),
      el('b', {}, `${from} \u2192 ${to}`)));

  if (def.influenceRadiusPerLevel.length > 0) {
    delta('reach', influenceRadius(district), levelIndexed(def.influenceRadiusPerLevel, next));
    delta('workers', assignableWorkerLimit(district), levelIndexed(def.maxWorkersPerLevel, next));
  }
  // A hall's level IS its army cap, and until now the only place that number
  // appeared was a note further up the card — nowhere near the button that
  // spends on it, which is the whole reason to upgrade a Barracks.
  if (def.armyCapPerLevel.length > 0) {
    delta('army cap',
      levelIndexed(def.armyCapPerLevel, district.level),
      levelIndexed(def.armyCapPerLevel, next));
  }
  if (def.populationCapacityPerLevel.length > 0) {
    const capNow = districtCapacity(game.state, district);
    delta('homes', capNow, capNow
      + levelIndexed(def.populationCapacityPerLevel, next)
      - levelIndexed(def.populationCapacityPerLevel, district.level));
  }
  // Mana is a per-level number too, on exactly two buildings — and neither
  // had anything to show before, so both upgrades read as blank.
  // The Sanctum owns BOTH Mana numbers now — it is the engine as well as the
  // reservoir, since the Townhall stopped producing (tech-tree.md §12).
  if (district.definitionId === 'Sanctum') {
    delta('Mana held',
      levelIndexed(MANA.sanctumCapPerLevel, district.level),
      levelIndexed(MANA.sanctumCapPerLevel, next));
    delta('Mana/h',
      levelIndexed(MANA.sanctumPerHourPerLevel, district.level),
      levelIndexed(MANA.sanctumPerHourPerLevel, next));
  }
  if (district.definitionId === 'Townhall') {
    // The Townhall's ONLY job: it is the gate on how much city there can be.
    const room = (level: number) => Object.values(DISTRICTS)
      .filter((d) => d.buildable && d.maxCountPerTownhallLevel.length > 0)
      .reduce((n, d) => n + maxCountForTownhallLevel(d, level), 0);
    const before = room(district.level);
    const after = room(next);
    if (after > before) delta('buildings allowed', before, after);
  }
  return out;
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
    // Every building that turns something out gets the same block — the
    // Townhall's villagers and a hall's soldiers are one mechanic now, so
    // they are one piece of UI. See trainingSection.ts.
    const training = trainingSection(game, district);
    if (training) body.append(training);

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

    // The army headroom line stays: it is about the CITY, not about any one
    // unit, and it is the number that explains a refused Train.
    if (def.trains.some((t) => t !== 'Villager')) {
      body.append(el('div', { class: 'dc-army' },
        iconEl('army', { size: 'sm' }),
        el('span', {}, `Army ${committedArmyPower(game.state)} of ${maxArmyPower(game.state)}`),
        el('span', { class: 'dc-army-note' },
          `this hall holds ${levelIndexed(def.armyCapPerLevel, district.level)} of it`)));
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
      have: (c) => game.walletValue(c),
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

    const upgrade = action({
      label: 'Upgrade',
      kind: 'primary',
      onClick: () => game.doUpgrade(district.uniqueId),
      disabledReason: reason,
      cost,
      have: (c) => game.walletValue(c),
      // What is left beside the button is the WAIT, which is a consequence
      // rather than a price and has no business inside the press-target.
      info: el('span', { class: 'dc-uptime' },
        iconEl('hourglass', { size: 'sm' }),
        formatDuration(upgradeDuration(district.definitionId, district.level))),
    });
    if (game.uiHint() === 'card:upgrade') upgrade.classList.add('hinted');

    // One row, the same shape as the training panel above it: a mark on the
    // left, what you are buying in the middle, the button that spends on the
    // right. It replaced a before/after pair of building portraits, which
    // drew the eye hardest while carrying the least — the two pictures are
    // nearly identical, and the numbers underneath were the whole point.
    foot.append(el('div', { class: 'dc-up' },
      // Default size, not lg: the 48px variant overflowed its own 40px well,
      // and the mark is a symbol rather than a portrait — it has no business
      // shouting louder than the unit art above it.
      el('div', { class: 'dc-up-mark' }, iconEl('star')),
      el('div', { class: 'dc-up-body' },
        el('div', { class: 'dc-up-title' }, `Level ${next}`),
        el('div', { class: 'dc-deltas' }, ...upgradeDeltas(game, district, next))),
      upgrade));
  }

  // Moving is not an upgrade path, so it does not belong in the footer's
  // one-primary-action slot (§2.2). It is a quiet secondary on the head, next
  // to Close: something you do TO the building rather than something you buy
  // for it — and it is free, so it carries no price to show.
  const head = el('div', { class: 'dc-tools' });
  if (canMoveDistrict(district)) {
    head.append(knob('✥', () => game.startMove(district.uniqueId), { label: 'Move' }));
  }
  const close = knob('✕', () => game.dismiss(), { label: 'Close' });
  close.setAttribute('data-own-close', '');
  head.append(close);

  return el('div', { class: 'dc' },
    el('div', { class: 'dc-head' },
      portrait(def, district.level),
      el('div', { class: 'dc-id' },
        el('div', { class: 'dc-name' }, def.name),
        levelStars(district.level, def.maxLevel),
        el('div', { class: 'dc-what' }, def.description)),
      head),
    body,
    foot,
  );
}
