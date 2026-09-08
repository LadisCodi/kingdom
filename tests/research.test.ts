// Technologies: slots (base + gem-bought), the requires tree, timed
// completion through the unified advance, and the save round-trip.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { advance, enqueueBuild } from '../src/sim/commands';
import {
  CURRENCIES, DISTRICTS, ERA_COUNT, KNOWLEDGE, RESEARCH_SETTINGS, RUSH, TECHNOLOGIES,
  TECH_ORDER, TOME_ORDER, UNITS,
} from '../src/sim/data/definitions';
import { placementBlock, requiredTechForLevel } from '../src/sim/districts';
import {
  anyResearchActionable, buySlot, canStartTech, eraShortfall, isTechComplete, isTomeOpen,
  knowledgeShortfallMs, openTomes, slotGemCost, startTech, techCost, techKnowledgeCost,
  techSlots, techUnlocks, techVisibility,
} from '../src/sim/research';
import {
  CHANNEL_W, COLS, colLeft, edgePath, NODE_H, NODE_W, PAGE_W, pageRows, ROW_GAP,
} from '../src/ui/research/layout';
import { finishTechWithGems, techRushCost } from '../src/sim/research';
import { knowledgePerHour } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type TechId } from '../src/sim/state';
import {
  addAllTrainers, completeRanks, completeTech, freshGame, freshPresenter, fund,
  ladders, map, openEveryEra, rankOf, T0, tickAt,
} from './helpers';

const FARM_CELL = { x: 2, y: 0 }; // revealed grassland
const PLOT_CELL = { x: 2, y: 1 }; // revealed grassland

describe('technology basics', () => {
  // Docs/features/12-quests.md §2 (quests 9-15): Agriculture opens the plots,
  // and Farming — the row under it — opens the Farm that works them. Two
  // researches, and the chain carries both (`Fields`, then `Tillage`), so the
  // beat between "tap this for Food" and "stop tapping this for Food" is a
  // research the tutorial asks for rather than one the player has to find.
  // Decided 2026-09-08, when Civics became a whole book.
  it('the farming chain: Agriculture opens the plots, Farming the Farm', () => {
    const state = freshGame();
    fund(state, { Gold: 5000, Wood: 500, Food: 500, Knowledge: 500 });
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe('NeedsResearch');
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    // Farming is a band down in Civics, so it waits on what it requires.
    expect(startTech(state, 'Farming', T0)).toBe('MissingRequirement');

    // Nothing at all is researched on a fresh kingdom: a book needs no card
    // to open it. Forestry is Civics' one first-row card, and Agriculture is
    // the row under it — a requirement is the row above (2026-09-08).
    expect(state.research.completed).toEqual([]);
    expect(TECHNOLOGIES.Forestry.requires).toEqual([]);
    expect(TECHNOLOGIES.Agriculture.requires).toEqual(['Forestry']);
    expect(startTech(state, 'Agriculture', T0)).toBe('MissingRequirement');
    completeTech(state, 'Forestry');
    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    expect(startTech(state, 'Agriculture', T0)).toBe('AlreadyActive');
    const durationMs = TECHNOLOGIES.Agriculture.durationSeconds * 1000;
    tickAt(state, T0 + durationMs - 1000);
    expect(isTechComplete(state, 'Agriculture')).toBe(false);
    tickAt(state, T0 + durationMs);
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(startTech(state, 'Agriculture', T0 + durationMs)).toBe('AlreadyDone');

    // The plot opens; the Farm waits one row down.
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe(null);
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    expect(startTech(state, 'Farming', T0 + durationMs)).toBe('Started');
    tickAt(state, T0 + durationMs + TECHNOLOGIES.Farming.durationSeconds * 1000);
    expect(isTechComplete(state, 'Farming')).toBe(true);
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe(null);
    expect(enqueueBuild(state, map, 'Farm', FARM_CELL)).toBe('Started');
    // Farming used to be what the Farm's second level cost; that level asks
    // for no technology now.
    expect(requiredTechForLevel('Farm', 2)).toBe(null);
  });

  it('gates units: every unit has its technology (Warrior, Archery)', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Food: 500, Stone: 300 });
    addAllTrainers(state);
    expect(trainUnit(state, 'Warrior', T0)).toBe('TechRequired');
    completeTech(state, 'Warrior');
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    expect(trainUnit(state, 'Archer', T0)).toBe('TechRequired');
    completeTech(state, 'Archery');
    expect(trainUnit(state, 'Archer', T0)).toBe('Queued');
  });

  // THE ERA BAR IS A GATE IN THE WORLD, not a keystone
  // (Docs/features/07-research.md §2.1). Cavalry sits in a band past the
  // first, so its own requirements are not enough: the region has to have
  // been opened up too, which is what stops a rich city reading a book it has
  // not explored for.
  it('the era bar: a band past the first waits on the region', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000, Knowledge: 5_000 });
    const era = TECHNOLOGIES.Cavalry.era;
    expect(era).toBeGreaterThan(1);
    // The tome is not even open yet — no ruin has been seen.
    expect(startTech(state, 'Cavalry', T0)).toBe('MissingRequirement');

    for (const req of TECHNOLOGIES.Cavalry.requires) completeTech(state, req);
    expect(eraShortfall(state, 'Warfare', era)).toBeGreaterThan(0);
    expect(startTech(state, 'Cavalry', T0)).toBe('EraLocked');
    expect(canStartTech(state, 'Cavalry')).toBe(false);

    openEveryEra(state);
    expect(eraShortfall(state, 'Warfare', era)).toBe(0);
    expect(startTech(state, 'Cavalry', T0)).toBe('Started');
  });

  // THE CLOCK IS A PRICE. Knowledge is paid from the kingdom purse alongside
  // the Gold from the city's — two purses, one gate — and era 1 charges none,
  it('charges Gold from the city AND Knowledge from the kingdom, in every era', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000 });
    state.kingdom.wallet.Knowledge = 0; // the opening grant, spent — this is about the purse
    // Era 1 is priced in the clock too (2026-09-08), and cheaply: the clock
    // runs on a base rate from the first minute and a new kingdom is granted
    // enough for the opening chain.
    expect(techKnowledgeCost('Forestry')).toBeGreaterThan(0);
    expect(canStartTech(state, 'Forestry'), 'no Knowledge at all').toBe(false);
    fund(state, { Knowledge: techKnowledgeCost('Forestry') });
    expect(canStartTech(state, 'Forestry')).toBe(true);

    // Communities is a band down, where the clock HAS started.
    for (const req of TECHNOLOGIES.Communities.requires) completeTech(state, req);
    openEveryEra(state);
    const k = techKnowledgeCost('Communities');
    expect(k).toBeGreaterThan(0);
    expect(canStartTech(state, 'Communities'), 'rich in Gold, no Knowledge').toBe(false);
    expect(startTech(state, 'Communities', T0)).toBe('NotEnoughResources');

    fund(state, { Knowledge: k });
    const gold = getWallet(state.city.wallet, 'Gold');
    expect(startTech(state, 'Communities', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - techCost('Communities'));
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(0);
  });

  it('says how long until the Knowledge is there, or that nothing is dripping', () => {
    const state = freshGame();
    state.kingdom.wallet.Knowledge = 0; // the opening grant, spent — this is about the wait
    // Short by the whole price at 20/h.
    expect(knowledgeShortfallMs(state, 'ScalingTools', 20))
      .toBe((techKnowledgeCost('ScalingTools') / 20) * 3_600_000);
    // …and with no territory there is no answer but "go and take some".
    expect(knowledgeShortfallMs(state, 'ScalingTools', 0)).toBe(Infinity);
    fund(state, { Knowledge: 10_000 });
    expect(knowledgeShortfallMs(state, 'ScalingTools', 0)).toBe(0);
  });

  // EVERY BOOK IS OPEN, from the first minute. Opening one used to be a free,
  // instant cover page granted by an event in the world — the first paid
  // reveal for Magic, the first ruin in sight for Warfare — and the card
  // existed only to be the marker. What paces a book is its era bars, which
  // ask for revealed cells, so the marker was saying nothing they were not.
  it('has every book open from the first minute, with nothing granted', () => {
    const state = freshGame();
    expect(state.research.completed).toEqual([]);
    for (const tome of TOME_ORDER) expect(isTomeOpen(state, tome), tome).toBe(true);
    expect(openTomes(state)).toEqual(TOME_ORDER);
  });

  // CLAIM: research is bought with Gold out of the CITY purse, up front, and
  // it costs nothing else. That is what puts the tree in the same contest as
  // clearing fog and raising a building — three calls on one budget — and it
  // is why a kingdom rich in Stardust cannot buy a technology with it.
  it('costs are paid up front, in Gold, from the city purse', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000, Wood: 500, Stardust: 5000, Knowledge: 5_000 });
    // Sailing sits a band down in Magic, so whatever the row above it holds
    // has to be standing — read off the tree, since that is a drag away.
    for (const req of TECHNOLOGIES.Sailing.requires) completeTech(state, req);
    openEveryEra(state); // Sailing is a band down, and a band is a gate in the world
    const purse = getWallet(state.city.wallet, 'Gold');
    expect(startTech(state, 'Sailing', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(purse - techCost('Sailing'));
    expect(state.city.wallet.Wood).toBe(500); // no materials, only Gold
    // Stardust is untouched: it buys heroes and relics and nothing else.
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(5000);
  });

  it('refuses a technology the city cannot pay for, however much Stardust the kingdom holds', () => {
    const state = freshGame();
    fund(state, { Gold: techCost('Forestry') - 1, Wood: 999_999, Stardust: 999_999, Knowledge: 500 });
    expect(startTech(state, 'Forestry', T0)).toBe('NotEnoughResources');
    fund(state, { Gold: techCost('Forestry') });
    expect(startTech(state, 'Forestry', T0)).toBe('Started');
  });
});

// What a BRAND NEW kingdom holds, pinned — the opening grant was removed on
// 2026-09-08 and "I start with some Knowledge" is now a save that survived,
// not a design. Anything on screen above these two numbers is an old save.
describe('a new kingdom starts with nothing and the base drip', () => {
  it('holds no Knowledge at all', () => {
    expect(getWallet(freshGame().kingdom.wallet, 'Knowledge')).toBe(0);
    expect(CURRENCIES.Knowledge.start).toBe(0);
  });

  it('drips at the base rate, with no ground held', () => {
    const state = freshGame();
    expect(state.landmarks.claimed).toEqual({});
    expect(knowledgePerHour(state)).toBe(KNOWLEDGE.basePerHour);
  });

  // The rate is a SUM OF FRACTIONS — a base plus 0.2 a landmark — so binary
  // floating point can hand back a long tail, and one reached a screenshot as
  // `+2.4000000000000004/h`. Whether any PARTICULAR count produces one
  // depends on the authored numbers and moved the day the base went 0.8 → 1,
  // so what is pinned here is the guard rather than the artifact: however
  // much ground is held, the rounded readout is one decimal and no more.
  it('never reads out with a floating-point tail, at any amount of ground', () => {
    for (let claimed = 0; claimed <= 20; claimed += 1) {
      const state = freshGame();
      state.landmarks.claimed = Object.fromEntries(
        Array.from({ length: claimed }, (_, i) => [`L${i}`, true]),
      );
      const shown = String(Math.round(knowledgePerHour(state) * 10) / 10);
      expect(shown, `${claimed} landmarks reads out as ${shown}`).toMatch(/^\d+(\.\d)?$/);
    }
  });
});

describe('research slots', () => {
  it('base slot limits concurrency; a gem-bought slot lifts it', () => {
    const state = freshGame();
    state.player.wallet.Gems = 2500; // exactly the second slot
    fund(state, { Gold: 5000, Knowledge: 500 });
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.techSlots); // 1
    // The first card of two different BOOKS, so neither waits on the other
    // and both reach the slot check this test is about. Within one book a
    // requirement is the row above (2026-09-08), so Civics has one card that
    // asks for nothing and Agriculture is not it any more.
    expect(startTech(state, 'Forestry', T0)).toBe('Started');
    expect(startTech(state, 'Warrior', T0)).toBe('NoFreeSlot');

    expect(slotGemCost(state)).toBe(2500);
    expect(buySlot(state)).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    expect(techSlots(state)).toBe(2);
    expect(startTech(state, 'Warrior', T0)).toBe('Started');

    // Escalating price for the next one — and 0 gems left.
    expect(slotGemCost(state)).toBe(5000);
    expect(buySlot(state)).toBe('NotEnoughGems');
  });

  it('slots are capped at research.max_slots', () => {
    const state = freshGame();
    state.player.wallet.Gems = 99_999;
    expect(buySlot(state)).toBe('Purchased'); // → 2
    expect(buySlot(state)).toBe('Purchased'); // → 3 = max
    expect(buySlot(state)).toBe('AtMax');
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.maxSlots);
  });

  it('two active technologies complete independently, in time order', () => {
    const state = freshGame();
    state.player.wallet.Gems = 2500;
    fund(state, { Gold: 5000, Knowledge: 500 });
    // Urban Planning asks for the row above it — Masonry AND the Market —
    // and the Warrior is a first-row card of another book, so the two are
    // independent. Agriculture would not do: Market's own chain already
    // completes it.
    completeTech(state, 'Market');
    completeTech(state, 'Masonry');
    buySlot(state);
    expect(startTech(state, 'UrbanPlanning', T0)).toBe('Started'); // 60s
    expect(startTech(state, 'Warrior', T0 + 5_000)).toBe('Started'); // 30s → done at 35s
    tickAt(state, T0 + 50_000);
    expect(isTechComplete(state, 'Warrior')).toBe(true);
    expect(isTechComplete(state, 'UrbanPlanning')).toBe(false);
    tickAt(state, T0 + 60_000);
    expect(isTechComplete(state, 'UrbanPlanning')).toBe(true);
    expect(state.research.active).toHaveLength(0);
  });
});

describe('save round-trip', () => {
  it('restores completed techs, active researches, slots and line ranks', () => {
    const state = freshGame();
    state.player.wallet.Gems = 2500;
    fund(state, { Gold: 10_000, Wood: 500, Food: 500, Knowledge: 500 });
    completeTech(state, 'Agriculture');
    for (const req of TECHNOLOGIES.UrbanPlanning.requires) completeTech(state, req);
    buySlot(state);
    startTech(state, 'UrbanPlanning', T0);
    completeRanks(state, 'TapPower', 1);

    // Reload mid-research: it finishes in real time during the absence.
    const restored = deserialize(serialize(state, T0 + 10_000), map, T0 + 600_000)!;
    expect(isTechComplete(restored, 'Agriculture')).toBe(true);
    expect(isTechComplete(restored, 'UrbanPlanning')).toBe(true);
    expect(restored.research.slotsPurchased).toBe(1);
    expect(rankOf(restored, 'TapPower')).toBe(1);
  });
});

// The GEOMETRY the renderer draws with. What the document itself may say —
// collisions, a requirement pointing back up the page, a rank out of turn —
// is `tests/techTree.test.ts` against `techTreeRules.ts`, the module the
// editor and the save endpoint check too. This block is the pixels.
// TREE FOG (Docs/features/07-research.md §5.2). Pinned here because the rule
// has been wrong once already: the page used to hold a technology hidden until
// the player STARTED researching the card before it, so the next `?` only ever
// appeared after you had committed — a tree nobody could plan a route through.
// The doc said "every prerequisite is normal" the whole time.
describe('tree fog', () => {
  /** The first row of a book: nothing above it, so it is buyable from the off. */
  const roots = (): TechId[] => TECH_ORDER
    .filter((id) => TECHNOLOGIES[id].placed && TECHNOLOGIES[id].requires.length === 0);
  /** What a root opens directly. */
  const childrenOf = (parent: TechId): TechId[] => TECH_ORDER
    .filter((id) => TECHNOLOGIES[id].requires.includes(parent));

  it('shows what comes next as a silhouette, without researching anything', () => {
    const state = freshGame();
    const root = roots()[0];
    expect(techVisibility(state, root), 'a root is buyable from the first minute')
      .toBe('normal');
    // Its children require it and it is NOT researched — the point of the rule.
    const next = childrenOf(root);
    expect(next.length, 'the fixture needs a root with children').toBeGreaterThan(0);
    for (const id of next) {
      expect(techVisibility(state, id), `${id} should be a silhouette under ${root}`)
        .toBe('silhouette');
    }
  });

  it('stops at one step, so a silhouette reveals nothing of its own', () => {
    const state = freshGame();
    const root = roots()[0];
    for (const child of childrenOf(root)) {
      for (const grandchild of childrenOf(child)) {
        // …unless it hangs off something else that IS revealed, which is the
        // honest reading of "every prerequisite is normal".
        const revealedParent = TECHNOLOGIES[grandchild].requires
          .every((r) => techVisibility(state, r) === 'normal');
        if (revealedParent) continue;
        expect(techVisibility(state, grandchild), `${grandchild} is two steps out`)
          .toBe('hidden');
      }
    }
  });

  it('turns a silhouette normal when the card before it is researched', () => {
    const state = freshGame();
    const root = roots()[0];
    const child = childrenOf(root)[0];
    expect(techVisibility(state, child)).toBe('silhouette');
    completeTech(state, root);
    expect(techVisibility(state, child)).toBe('normal');
  });
});

describe('tome page geometry (layout is content)', () => {
  // THE PAGE HAS TO FIT THE PHONE. Three columns and two side channels is
  // the whole width budget, and the old canvas was 1,160px wide behind a
  // drag-pan precisely because nothing held it to this.
  it('fits the target device without a horizontal scroll', () => {
    expect(PAGE_W).toBeLessThanOrEqual(402); // iPhone 17, the device this is played on
    expect(colLeft(0)).toBeGreaterThanOrEqual(CHANNEL_W);
    expect(colLeft(COLS - 1) + NODE_W).toBeLessThanOrEqual(PAGE_W - CHANNEL_W);
  });

  // A card is the thing a thumb presses, and it is now the biggest target in
  // the game rather than the smallest.
  it('keeps a card a thumb-sized target', () => {
    expect(NODE_W).toBeGreaterThanOrEqual(40);
    expect(NODE_H).toBeGreaterThanOrEqual(40);
  });

  // A CONNECTOR MAY NEVER CROSS A CARD, and the routing is what guarantees
  // it rather than a rule about where cards may sit: between neighbouring
  // rows the horizontal leg runs in the GUTTER, and anything longer goes out
  // into the side CHANNEL, down the outside of the page and back in.
  it('routes a step between neighbouring rows through the gutter', () => {
    const from = { top: 0, col: 0 };
    const to = { top: NODE_H + ROW_GAP, col: 2 };
    const path = edgePath(from, to);
    const horizontal = path.filter((p, i) => i > 0 && p.y === path[i - 1].y);
    expect(horizontal.length).toBe(1);
    for (const p of path) {
      expect(p.y).toBeGreaterThanOrEqual(NODE_H); // out of the bottom edge, never inside
      expect(p.y).toBeLessThanOrEqual(to.top);
    }
  });

  it('routes a blocked column out into the side channel, clear of every card', () => {
    const from = { top: 0, col: 1 };
    const to = { top: 4 * (NODE_H + ROW_GAP), col: 1 };
    // `clear: false` is the renderer saying "there are cards in the way" —
    // it is the only thing that knows, and the geometry does as it is told.
    const path = edgePath(from, to, false);
    // The long vertical leg — the one that would have run through three rows
    // of cards — is outside the columns entirely.
    const long = path.filter((p, i) => i > 0 && p.x === path[i - 1].x
      && Math.abs(p.y - path[i - 1].y) > NODE_H);
    expect(long.length).toBeGreaterThan(0);
    for (const p of long) {
      const insideColumns = p.x > colLeft(0) && p.x < colLeft(COLS - 1) + NODE_W;
      expect(insideColumns, `x=${p.x} runs down the cards`).toBe(false);
    }
  });

  // …and when the column IS clear it stays in it, because a straight line
  // down two rows of empty slots reads better than a trip round the outside.
  it('runs straight down a clear column instead', () => {
    const from = { top: 0, col: 1 };
    const to = { top: 2 * (NODE_H + ROW_GAP), col: 1 };
    expect(edgePath(from, to, true)).toEqual([
      { x: colLeft(1) + NODE_W / 2, y: NODE_H },
      { x: colLeft(1) + NODE_W / 2, y: to.top },
    ]);
  });

  // The page is as long as what the player can SEE: a row the fog has emptied
  // is not a blank line in the middle of the flow.
  it('collapses a row the fog has emptied, and keeps the era bars', () => {
    const rows = pageRows(TECHNOLOGIES, 'Civics', (id) => TECHNOLOGIES[id as TechId].era === 1);
    expect(rows.some((r) => r.kind === 'techs' && r.era !== 1)).toBe(false);
    for (const row of rows) {
      if (row.kind === 'techs') expect(row.slots.some((slot) => slot !== null)).toBe(true);
    }
    // Civics runs to THREE bands — a book carries its own count now — and the
    // two it has past the first hold nothing the filter kept, yet still say
    // they exist.
    expect(ERA_COUNT.Civics).toBe(3);
    expect(rows.filter((r) => r.kind === 'gate').map((r) => r.era)).toEqual([2, 3]);
  });
});

// What a technology gives you. The completion banners have always derived
// this after the fact; the research screen needs the same list BEFORE the
// player commits, so it lives in one place that cannot drift from the gates.
describe('techUnlocks', () => {
  it('reports exactly what the gates check, and nothing else', () => {
    for (const id of TECH_ORDER) {
      for (const u of techUnlocks(id)) {
        if (u.kind === 'district') expect(DISTRICTS[u.id].requiredTech).toBe(id);
        if (u.kind === 'unit') expect(UNITS[u.id].requiredTech).toBe(id);
        if (u.kind === 'districtLevel') {
          // A gate at index n unlocks level n+2 (the list is 0-indexed by level-1).
          expect(DISTRICTS[u.id].requiredTechPerLevel[u.level - 2]).toBe(id);
        }
      }
    }
  });

  it('leaves nothing gated behind — every gate is announced by its tech', () => {
    const announced = new Set(
      TECH_ORDER.flatMap((id) => techUnlocks(id).map((u) => `${u.kind}:${u.id}`)),
    );
    for (const def of Object.values(DISTRICTS)) {
      if (def.requiredTech !== null) expect(announced).toContain(`district:${def.id}`);
    }
    for (const unit of Object.values(UNITS)) {
      if (unit.requiredTech !== null) expect(announced).toContain(`unit:${unit.id}`);
    }
  });

  it('orders districts before units, so the banner sequence is unchanged', () => {
    for (const id of TECH_ORDER) {
      const kinds = techUnlocks(id).map((u) => u.kind);
      // No findLastIndex — the tsconfig targets ES2022.
      let lastDistrict = -1;
      kinds.forEach((k, i) => { if (k.startsWith('district')) lastDistrict = i; });
      const firstUnit = kinds.indexOf('unit');
      if (lastDistrict !== -1 && firstUnit !== -1) expect(lastDistrict).toBeLessThan(firstUnit);
    }
  });

  it('a tech that unlocks nothing returns an empty list', () => {
    const barren = TECH_ORDER.filter((id) => techUnlocks(id).length === 0);
    expect(barren.length).toBeLessThan(TECH_ORDER.length); // sanity: not all barren
  });
});

// The CTA and the node dots (Docs/art/ui-menus-redesign.md §6.7).
//
// The claim they protect is that a lit tab never lies: it means the screen
// behind it has something the player can press THIS SECOND. `canStartTech` is
// the same gate the command checks, which is what stops the light and the
// button drifting apart. It used to be two gates, because an upgrade was a
// different kind of purchase; every node is a technology now.
describe('what the player can actually act on', () => {
  it('agrees with startTech, gate for gate', () => {
    const state = freshGame();
    const id: TechId = 'Forestry';
    // Broke: prerequisites fine, cost not. (A fresh city starts with enough
    // Gold for the first research — the opening is authored that way — so
    // this has to spend it first to reach the gate under test.)
    fund(state, { Gold: 0 });
    expect(canStartTech(state, id)).toBe(false);
    fund(state, TECHNOLOGIES[id].cost);
    expect(canStartTech(state, id)).toBe(true);
    expect(startTech(state, id, T0)).toBe('Started');
    // Running is not startable, and it has taken the only slot.
    expect(canStartTech(state, id)).toBe(false);
    expect(startTech(state, id, T0)).toBe('AlreadyActive');
  });

  it('goes dark when every slot is busy, even with the money', () => {
    const state = freshGame();
    fund(state, { Gold: 99_999, Knowledge: 999 });
    expect(anyResearchActionable(state)).toBe(true);
    // Fill every slot: nothing is startable even though everything is paid for.
    while (state.research.active.length < techSlots(state)) {
      const next = TECH_ORDER.find((t) => canStartTech(state, t));
      expect(next).toBeDefined();
      startTech(state, next!, T0);
    }
    expect(anyResearchActionable(state)).toBe(false);
  });

  it('gates a rank by the row above it — a ladder is a NAME, not a chain', () => {
    // Two rules changed on 2026-09-08 and this is where they meet. A
    // requirement sits on the row immediately above, never further; and a
    // rank ladder carries no mechanism of its own — `Tap Power II` does not
    // ask for `Tap Power I`, the numeral only tells the player the bonus
    // goes further down the book. Every rank is an ordinary card gated by
    // its own row above, which is what let the page be laid out for READING.
    const state = freshGame();
    fund(state, { Gold: 99_999, Knowledge: 999 });
    expect(canStartTech(state, 'TapPowerI')).toBe(false); // its row above is not done
    expect(TECHNOLOGIES.TapPowerI.requires).not.toEqual([]);
    for (const above of TECHNOLOGIES.TapPowerI.requires) completeTech(state, above);
    expect(canStartTech(state, 'TapPowerI')).toBe(true);
    // Rank II asks for ITS row above and for the band it sits in — never for
    // rank I. Skipping rank I is legal, and the ladder still counts ranks.
    expect(TECHNOLOGIES.TapPowerII.requires).not.toContain('TapPowerI');
    expect(canStartTech(state, 'TapPowerII')).toBe(false); // era 2, band shut
    expect(startTech(state, 'TapPowerI', T0)).toBe('Started');
    advance(state, map, T0 + TECHNOLOGIES.TapPowerI.durationSeconds * 1000);
    expect(rankOf(state, 'TapPower')).toBe(1);
    openEveryEra(state);
    fund(state, { Knowledge: 5_000 });
    expect(canStartTech(state, 'TapPowerII')).toBe(false); // band open, row above not
    for (const above of TECHNOLOGIES.TapPowerII.requires) completeTech(state, above);
    expect(canStartTech(state, 'TapPowerII')).toBe(true);

    // A finished ladder is not actionable, however rich you are.
    completeRanks(state, 'TapPower', ladders.TapPower.length);
    expect(rankOf(state, 'TapPower')).toBe(ladders.TapPower.length);
    for (const id of ladders.TapPower) expect(canStartTech(state, id)).toBe(false);
  });

  it('lights the presenter CTA only when something is pressable', () => {
    const game = freshPresenter(freshGame());
    fund(game.state, { Gold: 0 }); // spent the opening purse on fog
    expect(game.researchCtaLit()).toBe(false);
    fund(game.state, TECHNOLOGIES.Forestry.cost);
    expect(game.researchCtaLit()).toBe(true);
  });
});

// Docs/features/tech-tree.md §7 — PLANNED nodes. They are on the tree so its
// shape can be seen, and they do nothing yet. Four things keep that honest.
describe('planned technologies', () => {
  const PLANNED = TECH_ORDER.filter((id) => TECHNOLOGIES[id].planned);

  // The flag is the statement: it draws the hatched node and the panel's
  // "Not yet in the prototype" line. Pinning the SET stops one being quietly
  // un-flagged (shipping a no-op as content) or a new no-op arriving unflagged.
  // Fifteen: Civics kept none. `Land Survey` and `Apprenticeships` were cut
  // when the book was laid out — with every requirement one row up, a card
  // that does nothing is a toll on the way to one that does, and the answer
  // for a Civics page with no room for a leaf was to drop them.
  it('are exactly the fifteen the design lists, and no more', () => {
    expect(PLANNED.sort()).toEqual([
      'FieldMedicine', 'FrugalRites', 'Invocation',
      'LeyLines', 'LeyReading', 'LeyStorm', 'Lorekeeping', 'RitualCasting', 'Scouting',
      'Scrying', 'Siegecraft', 'Standards', 'Vanguard', 'Veterancy', 'Wayshrines',
    ].sort());
  });

  it('are never required by a keystone, so no era is walled behind a no-op', () => {
    for (const id of TECH_ORDER) {
      if (!/^(Warband|Attunement)(II|III|IV)$/.test(id)) continue;
      for (const req of TECHNOLOGIES[id].requires) {
        expect(TECHNOLOGIES[req].planned, `${id} requires planned ${req}`).toBe(false);
      }
    }
  });

  it('unlock nothing — the gates agree they are inert', () => {
    for (const id of PLANNED) expect(techUnlocks(id)).toEqual([]);
  });

  // Wider than the ladders it used to name: NOTHING that works waits on a
  // no-op, wherever it sits. A planned card in the middle of a page makes the
  // player buy nothing to reach something, and with every requirement now one
  // row up (`techTreeRules.ts`) that is a shape the page can fall into by
  // accident — the drop default prefers a card that does something for exactly
  // this reason.
  it('are never required by anything that works, so nothing waits on a no-op', () => {
    for (const id of TECH_ORDER) {
      if (TECHNOLOGIES[id].planned) continue;
      for (const req of TECHNOLOGIES[id].requires) {
        expect(TECHNOLOGIES[req].planned, `${id} waits on planned ${req}`).toBe(false);
      }
    }
  });
});

// Gems finish a running research, at the same price per second a build rush
// pays (Docs/features/07-research.md §1). It was designed and unbuilt until
// the slot strip gave it a place to be pressed.
describe('finishing a research with Gems', () => {
  const running = () => {
    const state = freshGame();
    fund(state, { Gold: 99_999, Knowledge: 999 });
    state.player.wallet.Gems = 0;
    expect(startTech(state, 'Forestry', T0)).toBe('Started');
    return state;
  };

  it('prices it by the seconds left, like a build', () => {
    const state = running();
    // Forestry runs for three seconds, which floors to the one-Gem minimum
    // whenever you ask — so the ratio is measured on a long wait instead.
    const TEN_MINUTES = 600_000;
    state.research.active[0]!.durationMs = TEN_MINUTES;

    const full = techRushCost(state, 'Forestry', T0)!;
    const half = techRushCost(state, 'Forestry', T0 + TEN_MINUTES / 2)!;
    const done = techRushCost(state, 'Forestry', T0 + TEN_MINUTES)!;

    expect(full).toBe(Math.ceil(600 / RUSH.secondsPerGem));
    expect(half).toBe(Math.ceil(300 / RUSH.secondsPerGem));
    // Never free, however little is left: a press that costs nothing is not
    // an offer, it is a button that finishes things.
    expect(done).toBe(1);
  });

  it('completes it now and charges the Gems', () => {
    const state = running();
    const cost = techRushCost(state, 'Forestry', T0)!;
    state.player.wallet.Gems = cost;

    expect(finishTechWithGems(state, 'Forestry', T0)).toBe('Finished');

    expect(isTechComplete(state, 'Forestry')).toBe(true);
    expect(state.research.active).toEqual([]); // the slot is free again
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
  });

  it('refuses without the Gems, and takes nothing', () => {
    const state = running();
    state.player.wallet.Gems = techRushCost(state, 'Forestry', T0)! - 1;

    expect(finishTechWithGems(state, 'Forestry', T0)).toBe('NotEnoughGems');
    expect(isTechComplete(state, 'Forestry')).toBe(false);
    expect(state.research.active).toHaveLength(1);
  });

  it('refuses a technology that is not running', () => {
    const state = freshGame();
    expect(techRushCost(state, 'Forestry', T0)).toBeNull();
    expect(finishTechWithGems(state, 'Forestry', T0)).toBe('NotActive');
  });

  // The one thing a rush must not do: leave a boundary behind it. Completing
  // by editing the duration backwards would put one in the past, and one-call
  // replay and stepped ticking would land on it differently (invariant 1).
  it('leaves nothing for a later advance to complete twice', () => {
    const state = running();
    state.player.wallet.Gems = 9999;
    finishTechWithGems(state, 'Forestry', T0);
    const completedTwice = state.research.completed.filter((id) => id === 'Forestry');
    advance(state, map, T0 + TECHNOLOGIES.Forestry.durationSeconds * 2000);
    expect(state.research.completed.filter((id) => id === 'Forestry'))
      .toEqual(completedTwice);
  });
});
