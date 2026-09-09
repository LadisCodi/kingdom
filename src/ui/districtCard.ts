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

import { adjacencyReadout, formatAdjacency, type Game } from '../game';
import { gemRushCost } from '../sim/commands';
import {
  DISTRICTS, HARMONY, HARVEST, MANA, TAP, TECHNOLOGIES, levelIndexed, type AdjacencyStat,
} from '../sim/data/definitions';
import { committedTroops, armyCap } from '../sim/army';
import { adjacencyInEffect, districtAdjacency } from '../sim/adjacency';
import {
  canMoveDistrict, districtCount, maxCountForTownhallLevel, requiredTechForLevel,
  requiredTownhallLevel, upgradeCost, upgradeDuration, upgradeGoodsCost,
} from '../sim/districts';
import { getGood } from '../sim/goods';
import {
  harmonyBlock, harmonyCost, harmonyDemand, harmonySupply, harmonySurplusTier, isDecoration,
} from '../sim/harmony';
import {
  districtCapacity, houseGoldPerMinute,
} from '../sim/population';
import { mana } from '../sim/mana';
import { harvestSourceAt } from '../sim/harvest';
import { isTechComplete } from '../sim/research';
import { spriteUrl } from '../render/sprites';
import { trainingSection } from './trainingSection';
import { workshopSection } from './workshopSection';
import {
  coordKey, queueProgress, remainingSeconds, townhall, type District, type GoodId,
} from '../sim/state';
import { recoversAt, stockAt, tapYieldAt } from '../sim/harvest';
import { effectiveWorkerStrike, tapWorkSeconds, workerStrikeMs } from '../sim/upgrades';
import { assignableWorkerLimit, influenceRadius } from '../sim/workers';
import { el, formatDuration } from './format';
import { action, btn, iconEl, knob, pips, progress, stat } from './kit';

/** What each adjacency stat is called on a card. The number beside it is
 *  signed and the tone is already right, so the words only have to say WHAT
 *  the neighbours are moving. */
const ADJACENCY_WORDS: Record<AdjacencyStat, string> = {
  goldPerMinute: 'Neighbours',
  workTime: 'Good neighbours — work time',
  trainTime: 'A military quarter — training time',
};

/** The most stars worth counting at a glance. A ten-level building gets a
 *  numeral instead: ten pips is a bar chart, not a count. */
const MAX_STARS = 5;

/** Level as stars rather than "lvl 2/3" — a count you read, not parse. Past
 *  `MAX_STARS` levels that stops being true, so the ladder becomes one star
 *  and the two numbers. */
function levelStars(level: number, max: number): HTMLElement {
  if (max > MAX_STARS) {
    return el('span', { class: 'dc-stars is-numeral' },
      iconEl('star', { size: 'sm' }),
      el('b', {}, `${level}`),
      el('span', {}, `/ ${max}`));
  }
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
  // Levels 6-10 of a producer buy neither crew nor reach — the plot runs out
  // of cells long before that — so the card has to name what they DO buy or
  // the button looks like it does nothing.
  const term = (list: readonly number[], level: number, blank: number) =>
    (list.length === 0 ? blank : levelIndexed(list, level) ?? blank);
  if (def.extraUnitsPerDeliveryPerLevel.length > 0) {
    const from = term(def.extraUnitsPerDeliveryPerLevel, district.level, 0);
    const to = term(def.extraUnitsPerDeliveryPerLevel, next, 0);
    if (to !== from) delta('per delivery', `+${from}`, `+${to}`);
  }
  if (def.strikeSpeedPerLevel.length > 0) {
    const from = term(def.strikeSpeedPerLevel, district.level, 1);
    const to = term(def.strikeSpeedPerLevel, next, 1);
    if (to !== from) delta('swing', `×${from}`, `×${to}`);
  }
  if (def.armyCapPerLevel.length > 0) {
    delta('army cap',
      levelIndexed(def.armyCapPerLevel, district.level),
      levelIndexed(def.armyCapPerLevel, next));
  }
  // The Infirmary's whole ladder: how many wounded can wait for a bed before
  // the rest of them die (Docs/features/combat.md §4).
  if (def.bedsPerLevel.length > 0) {
    delta('beds',
      levelIndexed(def.bedsPerLevel, district.level),
      levelIndexed(def.bedsPerLevel, next));
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
  // reservoir, since the Townhall stopped producing (08-magic.md §2).
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

    // A workshop turns things out too, so it gets the same kind of block.
    const workshop = workshopSection(game, district);
    if (workshop) body.append(workshop);

    // A decoration is ONE number, and this is it. It has no crew, no queue
    // and no tap, so without this line its card would be empty.
    if (isDecoration(def)) {
      body.append(el('div', { class: 'dc-harmony' },
        iconEl('harmony', { size: 'sm' }),
        el('span', {}, `Supplies ${def.harmonySupply} Harmony`),
        el('span', { class: 'dc-army-note' }, 'and a house beside it collects more rent')));
    }

    // The city's beauty, read where it is SPENT: the Townhall is where the
    // taxes the surplus moves are collected. Silent on a city that has
    // neither supplied nor been asked for any — there is nothing to explain
    // on day one.
    if (district.definitionId === 'Townhall') {
      const supply = harmonySupply(game.state);
      const demand = harmonyDemand(game.state);
      if (supply > 0 || demand > 0) {
        const tier = harmonySurplusTier(game.state);
        const nextTier = HARMONY.surplusTiers.find(
          (t) => tier === null || t.at > tier.at);
        const note = tier !== null
          ? `+${Math.round(tier.bonus * 100)}% taxes`
          : nextTier !== undefined && demand > 0
            ? `${Math.round(nextTier.at * 100)}% of demand pays +${
              Math.round(nextTier.bonus * 100)}% taxes`
            : 'nothing demands it yet';
        body.append(el('div', { class: 'dc-harmony' },
          iconEl('harmony', { size: 'sm' }),
          el('span', {}, `Harmony ${supply} supplied, ${demand} demanded`),
          el('span', { class: 'dc-army-note' }, note)));
      }
    }

    // A crop plot is a resource cell you tap, so show what is left in it.
    if (district.definitionId === 'FarmLands') {
      const spec = HARVEST.Crops;
      const left = stockAt(game.state, game.map, district.location, now);
      const readyAt = recoversAt(game.state, game.map, district.location, now);
      body.append(el('div', { class: 'dc-homes' },
        iconEl('Food', { size: 'sm' }),
        pips(left, spec.stock),
        el('span', {}, readyAt === null
          ? `${left} Food left in it`
          : `regrowing — ${formatDuration((readyAt - now) / 1000)}`)));
      body.append(el('div', { class: 'dc-tapline' },
        iconEl('showme', { size: 'sm' }),
        `Tap the plot for +${tapYieldAt(game.state, game.map, district.location, now)} Food`));
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
      // No cycle bar and no cap: a house has no timer to show and no advance
      // budget to spend (one was built and removed on playtest — it read as an
      // arbitrary refusal on the building the player taps most). What bounds
      // the tap is the Mana pool, so the card says the price and what is left
      // to spend, which is a number the player can act on.
      body.append(el('div', { class: 'dc-tapline' },
        iconEl('showme', { size: 'sm' }),
        residents === 0
          ? 'Nobody lives here yet — train villagers at the Townhall'
          : `Tap to pull ${Math.round(tapWorkSeconds(game.state))}s of rent forward, `
            + 'as often as you like'));
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
        el('span', {}, `Army ${committedTroops(game.state)} of ${armyCap(game.state)}`),
        el('span', { class: 'dc-army-note' },
          `this hall holds ${levelIndexed(def.armyCapPerLevel, district.level)} of it`)));
    }

    // A worker building is an AREA and the people you put in it. Both were
    // numbers in a table; both are now pictures.
    if (def.maxWorkersPerLevel.length > 0 && def.harvestSources.length > 0) {
      const cells = game.workableCellsOf(district);
      const limit = assignableWorkerLimit(district);

      // One line per thing this building goes after. For everything but the
      // Mine that is a single line and reads exactly as it always did; the
      // Mine gets two, because iron and gold do not pay the same coin and one
      // averaged number would be a lie about both.
      const perSource = def.harvestSources.map((s) => {
        const spec = HARVEST[s];
        const n = cells.filter((c) => harvestSourceAt(game.state, c) === s).length;
        return el('div', { class: 'dc-area-count' },
          iconEl(spec.currencyId, { size: 'sm' }),
          el('b', {}, `×${n}`),
          el('span', {}, `${s} in reach`),
          el('span', { class: 'dc-area-rate' },
            ` +${effectiveWorkerStrike(game.state, spec, district)} every `
            + `${Math.round(workerStrikeMs(game.state, spec, district) / 100) / 10}s`));
      });

      body.append(el('div', { class: 'dc-area' },
        influenceThumb(game, district),
        el('div', {},
          ...perSource,
          el('div', { class: 'dc-area-rate' },
            // Two cells per worker is the authoring law: a cell drains, then
            // sits recovering, so a crew wants about twice its own number of
            // cells in reach or the surplus stands around (04-harvest.md §2.1).
            `${cells.length} in reach for ${district.assignedWorkers} — wants ~${
              district.assignedWorkers * 2}`))));

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

    // Every OTHER thing the neighbours are doing to this building. Gold is
    // already said in the house's own words above, so it is not repeated.
    for (const e of adjacencyInEffect(game.state, district)) {
      if (e.stat === 'goldPerMinute') continue;
      const { label, tone } = adjacencyReadout(e.stat, e.total);
      body.append(el('div', { class: `dc-badge is-${tone}` },
        `${ADJACENCY_WORDS[e.stat]} ${label}`));
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
    } else {
      // The third errand, and the only one whose answer is a building the
      // player has not thought of yet — so it says the number and the verb.
      const short = harmonyBlock(game.state, def, next, district);
      if (short !== null) reason = `Needs ${short.shortBy} more Harmony — build a decoration`;
    }

    // Refined goods sit beside the currencies rather than among them: they
    // are not wallet rows, and being short of one sends the player to a
    // workshop queue rather than out to the map.
    const goodsPrice = upgradeGoodsCost(district.definitionId, next);
    const goodsTerms = (Object.entries(goodsPrice) as Array<[GoodId, number]>)
      .map(([id, n]) => ({
        icon: id,
        amount: String(n),
        short: getGood(game.state.city.goods, id) < n,
      }));

    // Harmony rides with the goods rather than with the currencies: it is not
    // spent and never leaves the city, so it is a REQUIREMENT quoted at the
    // price — which is what a chip beside the button says and a sentence
    // above it does not.
    const harmonyPrice = harmonyCost(def, next);
    const harmonyTerm = harmonyPrice > harmonyCost(def, district.level)
      ? [{
        icon: 'harmony' as const,
        amount: String(harmonyPrice),
        short: harmonyBlock(game.state, def, next, district) !== null,
      }]
      : [];

    const upgrade = action({
      label: 'Upgrade',
      kind: 'primary',
      onClick: () => game.doUpgrade(district.uniqueId),
      disabledReason: reason,
      cost,
      costExtra: [...goodsTerms, ...harmonyTerm],
      have: (c) => game.walletValue(c),
      // What is left beside the button is the WAIT, which is a consequence
      // rather than a price and has no business inside the press-target.
      info: el('span', { class: 'dc-uptime' },
        iconEl('hourglass', { size: 'sm' }),
        formatDuration(upgradeDuration(game.state, district.definitionId, district.level))),
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
