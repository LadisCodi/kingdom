// Technologies: slots (base + gem-bought), the requires tree, timed
// completion through the unified advance, and the save round-trip.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { advance, enqueueBuild } from '../src/sim/commands';
import {
  DISTRICTS, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, UNITS,
} from '../src/sim/data/definitions';
import { placementBlock, requiredTechForLevel } from '../src/sim/districts';
import {
  anyResearchActionable, buySlot, canStartTech, eraShortfall, isTechComplete, isTomeOpen,
  knowledgeShortfallMs, openTome, slotGemCost, startTech, techCost, techKnowledgeCost,
  techSlots, techUnlocks,
} from '../src/sim/research';
import {
  CHANNEL_W, COLS, colLeft, edgePath, NODE_H, NODE_W, PAGE_W, pageRows, ROW_GAP,
} from '../src/ui/research/layout';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type TechId } from '../src/sim/state';
import {
  addAllTrainers, bonusLadders, completeRanks, completeTech, freshGame, freshPresenter, fund,
  ladderParent, ladders, map, openEveryEra, rankOf, T0, tickAt,
} from './helpers';

const FARM_CELL = { x: 2, y: 0 }; // revealed grassland
const PLOT_CELL = { x: 2, y: 1 }; // revealed grassland

describe('technology basics', () => {
  // Docs/features/12-quests.md §2 (quest 9): ONE research opens the plots and the Farm that
  // works them. Splitting them across two techs put a second research between
  // "tap this for Food" and "stop tapping this for Food", which is the beat
  // the tutorial is actually built around. Farming now buys the Farm's level 2.
  it('the farming chain: Agriculture unlocks crop plots AND the Farm', () => {
    const state = freshGame();
    fund(state, { Gold: 5000, Wood: 500, Food: 500 });
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe('NeedsResearch');
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    // Farming is a band down in Civics, so it waits on what it requires.
    expect(startTech(state, 'Farming', T0)).toBe('MissingRequirement');

    // Agriculture is era 1, and the Civics cover page is granted with the
    // kingdom — so it is startable from the very first second.
    expect(isTechComplete(state, 'CharterI')).toBe(true);
    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    expect(startTech(state, 'Agriculture', T0)).toBe('AlreadyActive');
    const durationMs = TECHNOLOGIES.Agriculture.durationSeconds * 1000;
    tickAt(state, T0 + durationMs - 1000);
    expect(isTechComplete(state, 'Agriculture')).toBe(false);
    tickAt(state, T0 + durationMs);
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(startTech(state, 'Agriculture', T0 + durationMs)).toBe('AlreadyDone');

    // Both open at once — no second research between tapping a plot and
    // automating it.
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe(null);
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe(null);
    expect(enqueueBuild(state, map, 'Farm', FARM_CELL)).toBe('Started');
    // Farming is what the Farm's second level costs.
    expect(requiredTechForLevel('Farm', 2)).toBe('Farming');
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
  // because the clock has not started yet (07-research.md §3, §3).
  it('charges Gold from the city AND Knowledge from the kingdom, from era 2 on', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000 });
    // Era 1 is Gold and time alone — the clock has not started.
    expect(techKnowledgeCost('Forestry')).toBe(0);
    expect(canStartTech(state, 'Forestry')).toBe(true);

    // Charter II is the first node with a Knowledge price, one band down.
    completeTech(state, 'CharterII'); // its requirements, not itself
    state.research.completed = state.research.completed.filter((id) => id !== 'CharterII');
    openEveryEra(state);
    const k = techKnowledgeCost('CharterII');
    expect(k).toBeGreaterThan(0);
    expect(canStartTech(state, 'CharterII'), 'rich in Gold, no Knowledge').toBe(false);
    expect(startTech(state, 'CharterII', T0)).toBe('NotEnoughResources');

    fund(state, { Knowledge: k });
    const gold = getWallet(state.city.wallet, 'Gold');
    expect(startTech(state, 'CharterII', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - techCost('CharterII'));
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(0);
  });

  it('says how long until the Knowledge is there, or that nothing is dripping', () => {
    const state = freshGame();
    // 100 short at 20/h is five hours.
    expect(knowledgeShortfallMs(state, 'ScalingTools', 20))
      .toBe((techKnowledgeCost('ScalingTools') / 20) * 3_600_000);
    // …and with no territory there is no answer but "go and take some".
    expect(knowledgeShortfallMs(state, 'ScalingTools', 0)).toBe(Infinity);
    fund(state, { Knowledge: 10_000 });
    expect(knowledgeShortfallMs(state, 'ScalingTools', 0)).toBe(0);
  });

  // The cover page is granted by an event in the world, never bought.
  it('opens a tome on the event that earns it, and not before', () => {
    const state = freshGame();
    expect(isTomeOpen(state, 'Civics')).toBe(true);   // granted with the kingdom
    expect(isTomeOpen(state, 'Magic')).toBe(false);
    expect(isTomeOpen(state, 'Warfare')).toBe(false);

    expect(openTome(state, 'Magic')).toBe(true);
    expect(isTomeOpen(state, 'Magic')).toBe(true);
    // Idempotent: it is called from every reveal, and must cost nothing after
    // the first.
    expect(openTome(state, 'Magic')).toBe(false);
  });

  // CLAIM: research is bought with Gold out of the CITY purse, up front, and
  // it costs nothing else. That is what puts the tree in the same contest as
  // clearing fog and raising a building — three calls on one budget — and it
  // is why a kingdom rich in Stardust cannot buy a technology with it.
  it('costs are paid up front, in Gold, from the city purse', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000, Wood: 500, Stardust: 5000, Knowledge: 5_000 });
    // Sailing sits in Magic era 2, so it wants the era-1 keystone above it.
    completeTech(state, 'AttunementII');
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
    fund(state, { Gold: techCost('Forestry') - 1, Wood: 999_999, Stardust: 999_999 });
    expect(startTech(state, 'Forestry', T0)).toBe('NotEnoughResources');
    fund(state, { Gold: techCost('Forestry') });
    expect(startTech(state, 'Forestry', T0)).toBe('Started');
  });
});

describe('research slots', () => {
  it('base slot limits concurrency; a gem-bought slot lifts it', () => {
    const state = freshGame();
    state.player.wallet.Gems = 2500; // exactly the second slot
    fund(state, { Gold: 5000 });
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.techSlots); // 1
    completeTech(state, 'Forestry');
    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    // Masonry, not Hunting: Hunting is an era-2 major, so it would fail on its
    // REQUIREMENT and never reach the slot check this test is about.
    expect(startTech(state, 'Masonry', T0)).toBe('NoFreeSlot');

    expect(slotGemCost(state)).toBe(2500);
    expect(buySlot(state)).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    expect(techSlots(state)).toBe(2);
    expect(startTech(state, 'Masonry', T0)).toBe('Started');

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
    fund(state, { Gold: 5000 });
    completeTech(state, 'Forestry');
    buySlot(state);
    startTech(state, 'UrbanPlanning', T0); // 60s
    startTech(state, 'Agriculture', T0 + 5_000); // 45s → done at 50s
    tickAt(state, T0 + 50_000);
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
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
    completeTech(state, 'Forestry');
    completeTech(state, 'Agriculture');
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
    // Bands 2, 3 and 4 hold nothing the filter kept, and still say they exist.
    expect(rows.filter((r) => r.kind === 'gate').map((r) => r.era)).toEqual([2, 3, 4]);
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
    fund(state, { Gold: 99_999 });
    expect(anyResearchActionable(state)).toBe(true);
    // Fill every slot: nothing is startable even though everything is paid for.
    while (state.research.active.length < techSlots(state)) {
      const next = TECH_ORDER.find((t) => canStartTech(state, t));
      expect(next).toBeDefined();
      startTech(state, next!, T0);
    }
    expect(anyResearchActionable(state)).toBe(false);
  });

  it('gates a minor rank on its line, one rank at a time', () => {
    const state = freshGame();
    fund(state, { Gold: 99_999 });
    // Rank I hangs off Forestry, exactly as the upgrade used to.
    expect(canStartTech(state, 'TapPowerI')).toBe(false); // parent not done
    completeTech(state, 'Forestry');
    expect(canStartTech(state, 'TapPowerI')).toBe(true);
    // …and rank II is not reachable until rank I is done, which is what makes
    // the ladder a ladder rather than five independent purchases.
    expect(canStartTech(state, 'TapPowerII')).toBe(false);
    expect(startTech(state, 'TapPowerI', T0)).toBe('Started');
    advance(state, map, T0 + TECHNOLOGIES.TapPowerI.durationSeconds * 1000);
    expect(rankOf(state, 'TapPower')).toBe(1);
    // Rank II sits in the next band, so it waits on the era bar as well.
    expect(canStartTech(state, 'TapPowerII')).toBe(false);
    openEveryEra(state);
    fund(state, { Knowledge: 5_000 });
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
  it('are exactly the seventeen the design lists, and no more', () => {
    expect(PLANNED.sort()).toEqual([
      'Apprenticeships', 'FieldMedicine', 'FrugalRites', 'Invocation', 'LandSurvey',
      'LeyLines', 'LeyReading', 'LeyStorm', 'Lorekeeping', 'RitualCasting', 'Scouting',
      'Scrying', 'Siegecraft', 'Standards', 'Vanguard', 'Veterancy', 'Wayshrines',
    ].sort());
  });

  it('are never required by a keystone, so no era is walled behind a no-op', () => {
    for (const id of TECH_ORDER) {
      if (!/^(Charter|Warband|Attunement)(II|III|IV)$/.test(id)) continue;
      for (const req of TECHNOLOGIES[id].requires) {
        expect(TECHNOLOGIES[req].planned, `${id} requires planned ${req}`).toBe(false);
      }
    }
  });

  it('unlock nothing — the gates agree they are inert', () => {
    for (const id of PLANNED) expect(techUnlocks(id)).toEqual([]);
  });

  it("are never a rank ladder's parent, so no working ladder hangs off a no-op", () => {
    for (const ladder of bonusLadders) {
      const parent = ladderParent(ladder)!;
      expect(TECHNOLOGIES[parent].planned, `${ladder} hangs off planned ${parent}`).toBe(false);
    }
  });
});
