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
  DISTRICTS, HARMONY, HARVEST, type AdjacencyStat,
} from '../sim/data/definitions';
import { adjacencyInEffect, districtAdjacency } from '../sim/adjacency';
import { upgradeRefusal } from '../sim/commands';
import { canMoveDistrict, districtLabel } from '../sim/districts';
import {
  harmonyDemand, harmonySupply, harmonySurplusTier, isDecoration,
} from '../sim/harmony';
import {
  districtCapacity, houseGoldPerMinute,
} from '../sim/population';
import { isStoreFull, storedTotal } from '../sim/storage';
import { harvestSourceAt } from '../sim/harvest';
import { releaseSprites, spriteImgAt, spriteUrl } from '../render/sprites';
import { nameFor, trainingSection } from './trainingSection';
import { districtCardSignature } from './districtCardSignature';
import { statsAt } from './upgradeStats';
import { workshopSection } from './workshopSection';
import { unitPortrait } from './unitArt';
import type { IconName } from './kit/icon';
import { LiveParts, type Screen } from './kit';
import {
  queueProgress, remainingSeconds, type CurrencyId, type District,
} from '../sim/state';
import { recoversAt, stockAt, tapYieldAt } from '../sim/harvest';
import { effectiveWorkerStrike, workerStrikeMs } from '../sim/upgrades';
import { assignableWorkerLimit } from '../sim/workers';
import { el, formatDuration, formatExact, formatShort } from './format';
import { btn, closeKnob, ctaBadge, iconEl, knob, moveKnob, pips, progress, sectionHead, windowHead } from './kit';

/** What each adjacency stat is called on a card. The number beside it is
 *  signed and the tone is already right, so the words only have to say WHAT
 *  the neighbours are moving. */
const ADJACENCY_WORDS: Record<AdjacencyStat, string> = {
  goldPerMinute: 'Neighbours',
  workTime: 'Good neighbours — work time',
  trainTime: 'A military quarter — training time',
};



/**
 * The building at a level, in a tile of darker paper — the card's portrait,
 * and the upgrade popup's two (upgradeSheet.ts).
 *
 * Two sprite namings are tried because two tools write them: `townhall_lv3`
 * from the smooth cutter (scripts/ui-cut.mjs) and `<sprite>_l3` from the
 * older per-level map art.
 */
export function buildingPortrait(
  def: (typeof DISTRICTS)[keyof typeof DISTRICTS], level: number, building = false,
): HTMLElement {
  // Levelled art comes in TIERS (`_l1`, `_l4`, `_l8`): the highest one at or
  // below this level, walked down the way the map draws it — a level with no
  // art of its own must not fall past its tier to the icon.
  let url = spriteUrl(`${def.id.toLowerCase()}_lv${level}`);
  for (let l = level; url === null && l >= 1; l--) url = spriteUrl(`${def.sprite}_l${l}`);
  url ??= spriteUrl(def.sprite);
  // A tile of darker paper (kit .k-section) with a small ornament pressed
  // into each corner. The picture is drawn LARGER than the tile and clipped
  // by the mask, so the building fills its frame without spilling out.
  return el('div', { class: 'dc-portrait k-section' },
    el('div', { class: 'dc-portrait-mask' },
      url ? spriteImgAt(url, 'dc-portrait-art') : iconEl(def.id, { size: 'lg' })),
    ...(['tl', 'tr', 'bl', 'br'] as const).map((corner) =>
      el('span', { class: `dc-orn is-${corner}`, 'aria-hidden': 'true' })),
    ...(building ? [workingHammer()] : []));
}

/**
 * While a building is being built or upgraded, a hammer floats over its
 * portrait and works it: one blow at the right corner, a flight to the left
 * one, two small taps there, and back — each blow throwing a few sparks.
 * All CSS (district.css, `dc-hammer`), so a tick never restarts it.
 */
function workingHammer(): HTMLElement {
  const sparks = (site: 'r' | 'l') => el('span', { class: `dc-sparks is-${site}` },
    ...[0, 1, 2, 3].map((i) => el('i', { class: `dc-spark is-${i}` })));
  return el('span', { class: 'dc-work', 'aria-hidden': 'true' },
    el('span', { class: 'dc-hammer' }), sparks('r'), sparks('l'));
}



/** What a crew works, in a stat tile's short words and mark. */
const SOURCE_WORD: Record<string, string> = {
  Crops: 'Fields', Forest: 'Trees', Stone: 'Rocks', MountainIron: 'Iron',
  MountainGold: 'Gold', Fish: 'Shoals', Berries: 'Bushes', Meat: 'Game',
};
const SOURCE_ICON: Record<string, IconName> = {
  Crops: 'FarmLands', Forest: 'Wood', Stone: 'Stone', MountainIron: 'Iron',
  MountainGold: 'Gold', Fish: 'Fish', Berries: 'Berries', Meat: 'Meat',
};

/** What a crew makes an hour, per coin: the rate one worker earns at this
 *  building — its haul and its swing included — times the crew. */
function crewOutput(game: Game, district: District): Array<[CurrencyId, number]> {
  const def = DISTRICTS[district.definitionId];
  const perHour = new Map<CurrencyId, number>();
  for (const s of def.harvestSources) {
    const spec = HARVEST[s];
    if (perHour.has(spec.currencyId)) continue;
    perHour.set(spec.currencyId, district.assignedWorkers
      * effectiveWorkerStrike(game.state, spec, district)
      * (3_600_000 / workerStrikeMs(game.state, spec, district)));
  }
  return [...perHour];
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
  // A building still going up has nothing to show yet but its construction,
  // which the head carries.
  if (district.state !== 'UnderConstruction') {
    // Every building that turns something out gets the same block — the
    // Townhall's villagers and a hall's soldiers are one mechanic now, so
    // they are one piece of UI. See trainingSection.ts.
    const training = trainingSection(game, district, live);
    if (training) {
      // The block is headed by what it trains — one unit per building.
      body.append(sectionHead(def.bedsPerLevel.length > 0 || def.trains.length === 0
        ? 'Ward' : nameFor(def.trains[0])), training);
    }

    // A workshop turns things out too, so it gets the same kind of block.
    const workshop = workshopSection(game, district, live);
    if (workshop) body.append(sectionHead('Workshop'), workshop);

    // A decoration is ONE number, and this is it. It has no crew, no queue
    // and no tap, so without this line its card would be empty.
    if (isDecoration(def)) {
      body.append(sectionHead('Harmony'), el('div', { class: 'dc-harmony' },
        iconEl('harmony', { size: 'sm' }),
        el('span', {}, `Supplies ${formatExact(def.harmonySupply)} Harmony`),
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
        body.append(sectionHead('Harmony'), el('div', { class: 'dc-harmony' },
          iconEl('harmony', { size: 'sm' }),
          el('span', {}, `Harmony ${formatExact(supply)} supplied, ${formatExact(demand)} demanded`),
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
              ? `${formatExact(left)} Food left in it`
              : `regrowing — ${formatDuration((readyAt - t) / 1000)}`)),
          el('div', { class: 'dc-tapline' },
            iconEl('showme', { size: 'sm' }),
            `Tap the plot for +${formatExact(tapYieldAt(game.state, game.map, district.location, t))} Food`));
      };
      body.append(sectionHead('Crops'), part(() => {
        const t = game.now();
        const readyAt = recoversAt(game.state, game.map, district.location, t);
        return JSON.stringify([
          stockAt(game.state, game.map, district.location, t),
          readyAt === null ? null : formatDuration((readyAt - t) / 1000),
          tapYieldAt(game.state, game.map, district.location, t),
        ]);
      }, plot));
    }

    // A house's residents and rent are its stat tiles (Beds 2/2, Gold +3.6k/h);
    // the body only says what its neighbours do to it.
    if (districtCapacity(game.state, district) > 0) {
      const adjacency = districtAdjacency(game.state, district);
      // Adjacency as a verdict rather than a signed number.
      if (adjacency !== 0) {
        body.append(el('div', { class: `dc-badge ${adjacency < 0 ? 'is-bad' : 'is-good'}` },
          adjacency < 0
            ? `Crowded ${formatAdjacency(adjacency * 60)}/h — houses too close together`
            : `Cosy neighbourhood ${formatAdjacency(adjacency * 60)}/h`));
      }
    }

    // The army headroom moved to the HEADER's plaque (`hudSlot`), where the
    // contextual read-outs live: it is a ceiling on the CITY, and inside the
    // card it read as a property of whichever hall was open. What this hall
    // contributes to it is already the upgrade row's delta.

    // THE CREW (mockups: the workers stepper): how many work here against the
    // most it can hold, and the − / + that change it. No tip: the player learns
    // to fit a crew to its fields by watching it work. The villagers still
    // free to assign are the header's counter while this card is open
    // (Game.hudSlot).
    if (def.maxWorkersPerLevel.length > 0 && def.harvestSources.length > 0) {
      const limit = assignableWorkerLimit(district);
      const crew = district.assignedWorkers;

      const minus = knob('−', () => game.doChangeWorkers(district.uniqueId, -1), {
        label: 'Remove a worker', disabled: crew === 0, kind: 'destructive',
      });
      const plus = knob('+', () => game.doChangeWorkers(district.uniqueId, 1), {
        label: 'Add a worker', disabled: crew >= limit || game.freeWorkers() === 0, kind: 'primary',
      });
      if (game.uiHint() === 'card:workers') plus.classList.add('hinted');
      body.append(sectionHead('Workers'), el('div', { class: 'dc-crew' },
        minus,
        unitPortrait('Villager', 'dc-crew-face'),
        el('div', { class: 'dc-crew-count', 'aria-label': `${crew} of ${limit} assigned` },
          el('b', {}, String(crew)), el('span', {}, ` / ${limit}`)),
        plus));
    }

    // Every OTHER thing the neighbours are doing to this building. Gold is
    // already said in the house's own words above, so it is not repeated.
    const neighbours = adjacencyInEffect(game.state, district)
      .filter((e) => e.stat !== 'goldPerMinute');
    if (neighbours.length > 0) body.append(sectionHead('Neighbours'));
    for (const e of neighbours) {
      const { label, tone } = adjacencyReadout(e.stat, e.total);
      body.append(el('div', { class: `dc-badge is-${tone}` },
        `${ADJACENCY_WORDS[e.stat]} ${label}`));
    }
  }

  // --------------------------------------------------- the head's right slot
  // The Upgrade button, or the construction in its place.
  const upgradeAction: HTMLElement[] = [];

  // While it is being built: the bar under the portrait, over the tile's
  // foot, and what is being done under the description.
  const progressUnder: HTMLElement[] = [];
  const doing: HTMLElement[] = [];

  if (queueItem) {
    // THE CONSTRUCTION (M36, A): the Finish that skips it takes the Upgrade
    // button's place; how long is left sits under the portrait and what is
    // being done under the description, breathing. All live — the bar and
    // the price move with the clock; the word has a part of its own, so the
    // clock does not restart its breath.
    const what = () => (queueItem.startedAt === null
      ? 'Waiting'
      : queueItem.kind === 'upgrade' ? 'Upgrading' : 'Building');
    doing.push(part(what, () => el('div', { class: 'dc-build-what' }, what())));
    progressUnder.push(part(() => JSON.stringify([
      queueItem.startedAt === null ? null : formatDuration(remainingSeconds(queueItem, game.now())),
    ]), () => {
      const t = game.now();
      const bar = progress('blue');
      bar.run(queueProgress(queueItem, t),
        queueItem.startedAt === null ? 0 : remainingSeconds(queueItem, t) * 1000,
        queueItem.startedAt === null ? '' : formatDuration(remainingSeconds(queueItem, t)));
      return el('div', { class: 'dc-live' }, bar.root);
    }));
    // No Cancel: a build is paid for when it starts, and a building put in
    // the wrong place is MOVED rather than undone
    // (Docs/features/06-construction.md §1).
    upgradeAction.push(el('div', { class: 'dc-upgrade' }, part(() => {
      const t = game.now();
      return JSON.stringify([gemRushCost(queueItem, t), game.walletValue('Gems') < gemRushCost(queueItem, t)]);
    }, () => btn({
      label: 'Finish',
      kind: 'gem',
      onClick: () => game.doRush(queueItem.uniqueId),
      cost: { Gems: gemRushCost(queueItem, game.now()) },
      have: (c) => game.walletValue(c),
    }))));
  } else if (district.state === 'Built' && district.level < def.maxLevel) {
    // ONE BUTTON, and everything it used to say lives behind it now
    // (upgradeSheet.ts, M25): the requirements, whether each is met, and the
    // price are the popup's to show. The card only says whether it is worth
    // opening — the call to action rides on the button when every gate and
    // every cost is met, so the upgrade would start on the popup's first tap.
    const upgrade = btn({
      label: 'Upgrade',
      kind: 'primary',
      onClick: () => game.openUpgrade(district.uniqueId),
    });
    if (upgradeRefusal(game.state, district.uniqueId) === null) {
      upgrade.append(ctaBadge(1, `upgrade:${district.uniqueId}`));
    }
    upgradeAction.push(el('div', { class: 'dc-upgrade' }, upgrade));
  }

  // THE HEADER: the building's name, and its two tools on the right — Move,
  // then Close, which stays last so it never shifts when a building happens
  // to be movable. Moving is not an upgrade path, so it does not belong in
  // the footer's one-primary-action slot (§2.2): it is something you do TO
  // the building, and it is free, so it carries no price to show.
  const name = districtLabel(game.state, district);
  // The level rides on the title, a size down: *Housing #3 Lv 2*.
  const header = windowHead(name, [
    ...(canMoveDistrict(district)
      ? [moveKnob(() => game.startMove(district.uniqueId), `Move ${name}`)]
      : []),
    closeKnob(() => game.dismiss(), `Close ${name}`),
  ], `Lv ${district.level}`);

  // WHAT THIS BUILDING IS WORTH RIGHT NOW — the same model the upgrade popup
  // reads, at this level alone (upgradeStats.ts). It used to be scattered
  // through the body as label/value rows; a band of tiles under the name is
  // where a player looks for it, and it is the half of the model the popup
  // does not show. Each figure is a tile of darker paper (kit .k-section),
  // three to a row; the next level's value belongs to the upgrade popup.
  // A worker building leads with what its crew makes (the resource is the
  // tile's word: *Food +2.7k/h*) and what it has to work (*Fields 3*); a
  // house leads with its rent (*Gold +1.8k/h*) — its level's rent bonus is
  // already in that figure — and its Beds read residents/beds (*2/2*). The
  // Storage tile reads what the store holds against what it can (*Storage
  // 120/8.6k*) — a tap on the building collects it, so the card has no
  // Collect of its own. The popup-only figures stay off the card.
  const built = district.state === 'Built';
  const figures: Array<{ icon: IconName; label: string; short: string; value: string; bad?: boolean }> = [
    ...(def.maxWorkersPerLevel.length > 0 && def.harvestSources.length > 0 && built
      ? [
        ...crewOutput(game, district).map(([c, n]) => ({
          icon: c as IconName, label: `${c} an hour`, short: c, value: `+${formatShort(n)}/h`,
        })),
        // What there is to work, per source (the Quarry has three).
        ...def.harvestSources.map((src) => {
          const cells = game.workableCellsOf(district);
          const n = cells.filter((c) => harvestSourceAt(game.state, c) === src).length;
          return { icon: SOURCE_ICON[src], label: `${SOURCE_WORD[src]} in range`, short: SOURCE_WORD[src], value: formatExact(n) };
        }),
      ]
      : []),
    ...(districtCapacity(game.state, district) > 0 && built
      ? [{
        icon: 'Gold' as IconName, label: 'Gold an hour', short: 'Gold',
        value: `+${formatShort(houseGoldPerMinute(game.state, district) * 60)}/h`,
      }]
      : []),
    ...statsAt(game, district, district.level).filter((f) => f.onCard !== false).map((f) =>
      (f.key === 'store' && built
        ? { ...f, value: `${formatShort(storedTotal(district))}/${formatShort(f.n)}`, bad: isStoreFull(district) }
        : f.key === 'homes' && built
          ? { ...f, value: `${formatShort(game.residentsIn(district))}/${formatShort(districtCapacity(game.state, district))}` }
          : f)),
  ];
  const stats = figures.length === 0 ? [] : [el('div', { class: 'dc-stats' },
    ...figures.map((f) => el('div', { class: `dc-stat k-section${f.bad ? ' is-bad' : ''}`, title: f.label, 'aria-label': `${f.label} ${f.value}` },
      iconEl(f.icon, { size: 'lg' }),
      el('div', { class: 'dc-stat-body', 'aria-hidden': 'true' },
        el('div', { class: 'dc-stat-label' }, f.short),
        el('b', { class: 'dc-stat-value' }, f.value)))))];

  return el('div', { class: 'dc' },
    header,
    // ONE ROW: the picture, what the building is, and the one thing you BUY
    // for it (M2) — each anchored to the top, each growing down.
    el('div', { class: 'dc-head' },
      progressUnder.length === 0
        ? buildingPortrait(def, district.level)
        : el('div', { class: 'dc-portrait-col' }, buildingPortrait(def, district.level, true), ...progressUnder),
      doing.length === 0
        ? el('div', { class: 'dc-what' }, def.description)
        : el('div', { class: 'dc-what-col' }, el('div', { class: 'dc-what' }, def.description), ...doing),
      ...upgradeAction),
    ...stats,
    body,
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
  // The window's frame, kept across rebuilds: the card's children are swapped
  // when its signature moves, the frame is not (kit.css, `k-window-*`).
  const frame = el('div', { class: 'k-frame', 'aria-hidden': 'true' });
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
      root.replaceChildren(frame, ...Array.from(card.childNodes));
    },
  };
}
