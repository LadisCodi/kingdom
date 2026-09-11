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
  DISTRICTS, HARMONY, HARVEST, TAP, type AdjacencyStat,
} from '../sim/data/definitions';
import { adjacencyInEffect, districtAdjacency } from '../sim/adjacency';
import { canMoveDistrict, districtLabel } from '../sim/districts';
import {
  harmonyDemand, harmonySupply, harmonySurplusTier, isDecoration,
} from '../sim/harmony';
import {
  districtCapacity, houseGoldPerMinute, houseTaxBonus,
} from '../sim/population';
import { mana } from '../sim/mana';
import { harvestSourceAt } from '../sim/harvest';
import { releaseSprites, spriteImgAt, spriteUrl } from '../render/sprites';
import { trainingSection } from './trainingSection';
import { districtCardSignature } from './districtCardSignature';
import { requirements } from './upgradeStats';
import { workshopSection } from './workshopSection';
import { LiveParts, type Screen } from './kit';
import {
  coordKey, queueProgress, remainingSeconds, type District,
} from '../sim/state';
import { recoversAt, stockAt, tapYieldAt } from '../sim/harvest';
import { effectiveWorkerStrike, tapWorkSeconds, workerStrikeMs } from '../sim/upgrades';
import { assignableWorkerLimit, influenceRadius } from '../sim/workers';
import { el, formatDuration } from './format';
import { btn, iconEl, knob, pips, progress, stat } from './kit';

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
    ? spriteImgAt(url)
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
 * The whole card, built fresh. `live` collects the handful of lines that move
 * every second — a countdown, a trough, a stock — so the screen that owns
 * this card can rebuild those alone (see `districtCardScreen`). Without it
 * the card is simply static, which is what a one-shot caller wants.
 */
export function renderDistrictCard(game: Game, district: District, live?: LiveParts): HTMLElement {
  const def = DISTRICTS[district.definitionId];
  // A live part when the card is owned by a screen; built once otherwise.
  const part = (sigOf: () => string, build: () => HTMLElement): HTMLElement =>
    (live ? live.add(sigOf, build) : build());
  // The longest scroller in the game. Kept by name across a rebuild, and —
  // now that the card is built once — simply the same node across ticks.
  const body = el('div', { class: 'dc-body', 'data-keep-scroll': 'dc-body' });
  const queueItem = game.state.city.queue.find((q) => q.districtUniqueId === district.uniqueId);

  // ------------------------------------------------------------ variant body
  if (district.state === 'UnderConstruction') {
    body.append(el('div', { class: 'dc-note' }, 'Under construction.'));
  } else {
    // Every building that turns something out gets the same block — the
    // Townhall's villagers and a hall's soldiers are one mechanic now, so
    // they are one piece of UI. See trainingSection.ts.
    const training = trainingSection(game, district, live);
    if (training) body.append(training);

    // A workshop turns things out too, so it gets the same kind of block.
    const workshop = workshopSection(game, district, live);
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
      const plot = () => {
        const t = game.now();
        const spec = HARVEST.Crops;
        const left = stockAt(game.state, game.map, district.location, t);
        const readyAt = recoversAt(game.state, game.map, district.location, t);
        return el('div', { class: 'dc-live' },
          el('div', { class: 'dc-homes' },
            iconEl('Food', { size: 'sm' }),
            pips(left, spec.stock),
            el('span', {}, readyAt === null
              ? `${left} Food left in it`
              : `regrowing — ${formatDuration((readyAt - t) / 1000)}`)),
          el('div', { class: 'dc-tapline' },
            iconEl('showme', { size: 'sm' }),
            `Tap the plot for +${tapYieldAt(game.state, game.map, district.location, t)} Food`));
      };
      body.append(part(() => {
        const t = game.now();
        const readyAt = recoversAt(game.state, game.map, district.location, t);
        return JSON.stringify([
          stockAt(game.state, game.map, district.location, t),
          readyAt === null ? null : formatDuration((readyAt - t) / 1000),
          tapYieldAt(game.state, game.map, district.location, t),
        ]);
      }, plot));
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
        const bonus = houseTaxBonus(district);
        body.append(el('div', { class: 'dc-drip' },
          stat('Gold', Number.isInteger(perMinute) ? String(perMinute) : perMinute.toFixed(1),
            'per minute'),
          // What the house's own level is worth, said where the rent is read
          // rather than only on the upgrade button.
          ...(bonus > 0
            ? [el('span', { class: 'dc-army-note' },
              `+${Math.round(bonus * 100)}% rent from level ${district.level}`)]
            : [])));
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
        // The pool refills on its own, so this line is live.
        body.append(part(() => String(mana(game.state)), () => {
          const pool = mana(game.state);
          return el('div', { class: `dc-tapcost${pool < TAP.manaCost ? ' is-bad' : ''}` },
            iconEl('Mana', { size: 'sm' }),
            `${TAP.manaCost} per tap — ${pool} left`);
        }));
      }
    }

    // The army headroom moved to the HEADER's plaque (`hudSlot`), where the
    // contextual read-outs live: it is a ceiling on the CITY, and inside the
    // card it read as a property of whichever hall was open. What this hall
    // contributes to it is already the upgrade row's delta.

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
      const crewWords = () => {
        const counts = new Map<string, number>();
        for (const w of game.state.workers) {
          if (w.buildingId !== district.uniqueId) continue;
          const label = { Idle: 'waiting', MovingToCell: 'heading out',
            Working: 'working', MovingHome: 'carrying home' }[w.activity];
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        return [...counts].map(([label, n]) => `${n} ${label}`).join(' · ');
      };
      if (game.state.workers.some((w) => w.buildingId === district.uniqueId)) {
        // Workers change activity many times a minute; only their words are live.
        body.append(part(crewWords, () => el('div', { class: 'dc-note' }, crewWords())));
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
    // Scaffolding: what is happening and how to skip it. Live — the bar and
    // the price of skipping both move with the clock.
    const scaffold = () => {
      const t = game.now();
      const bar = progress('sky');
      bar.set(queueProgress(queueItem, t),
        queueItem.startedAt === null
          ? 'waiting for a builder'
          : `${formatDuration(remainingSeconds(queueItem, t))} left`);
      const rush = btn({
        label: 'Finish',
        kind: 'gem',
        onClick: () => game.doRush(queueItem.uniqueId),
        // The price used to be glued into the label with a separator. It is a
        // cost like any other, so it goes where every other cost now goes.
        cost: { Gems: gemRushCost(queueItem, t) },
        have: (c) => game.walletValue(c),
      });
      // No Cancel: a build is paid for when it starts, and a building put in
      // the wrong place is MOVED rather than undone
      // (Docs/features/06-construction.md §1).
      return el('div', { class: 'dc-live' }, bar.root, el('div', { class: 'dc-actions' }, rush));
    };
    foot.append(part(() => {
      const t = game.now();
      return JSON.stringify([
        queueItem.startedAt === null ? null : formatDuration(remainingSeconds(queueItem, t)),
        Math.round(queueProgress(queueItem, t) * 200),
        gemRushCost(queueItem, t),
        game.walletValue('Gems') < gemRushCost(queueItem, t),
      ]);
    }, scaffold));
  } else if (district.state === 'Built' && district.level < def.maxLevel) {
    // ONE BUTTON, and everything it used to say lives behind it now
    // (upgradeSheet.ts, M25). The card is what the building IS; buying a
    // level is a decision with its own stats table, its own list of gates and
    // its own price, and none of the three fitted under a panel that was
    // already the longest in the game.
    //
    // The button still refuses what it cannot open: a gate in the way greys
    // it and names the first errand, because sending a player into a popup to
    // read a cross they could have been told about here is a wasted tap.
    const next = district.level + 1;
    const gates = requirements(game, district, next);
    const blocking = gates.find((r) => !r.met);
    foot.append(el('div', { class: 'dc-upgrade' },
      btn({
        label: 'Upgrade',
        kind: 'primary',
        onClick: () => game.openUpgrade(district.uniqueId),
      }),
      ...(blocking === undefined ? [] : [el('div', { class: 'dc-upgrade-gate' },
        iconEl('padlock', { size: 'sm' }), blocking.label)]),
    ));
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
        el('div', { class: 'dc-name' }, districtLabel(game.state, district)),
        levelStars(district.level, def.maxLevel),
        el('div', { class: 'dc-what' }, def.description)),
      head),
    body,
    foot,
  );
}

/**
 * The card as a screen that is built ONCE per building.
 *
 * `ScreenSlot` keys it by district, so a different building is a fresh
 * screen. Inside one building's life the card is rebuilt only when its
 * signature moves — a level, a queue, a crew, a price crossing the purse —
 * and every tick in between touches nothing but the live parts. That is what
 * lets a finger hold a knob through a tick, and an iOS fling on the body run
 * to the end: the nodes under the finger are the same nodes a second later.
 */
export function districtCardScreen(game: Game, districtId: string): Screen {
  const root = el('div', { class: 'dc' });
  let signature: string | null = null;
  let live = new LiveParts();
  return {
    root,
    refresh: () => {
      const district = game.state.city.districts.find((d) => d.uniqueId === districtId);
      if (!district) {
        releaseSprites(root);
        root.replaceChildren();
        signature = null;
        return;
      }
      const now = districtCardSignature(game, district);
      if (now === signature) {
        live.refresh();
        return;
      }
      signature = now;
      live = new LiveParts();
      releaseSprites(root);
      const card = renderDistrictCard(game, district, live);
      root.replaceChildren(...Array.from(card.childNodes));
    },
  };
}
