// Technologies: slots (base + gem-bought), the requires tree, timed
// completion through the unified advance, and the save round-trip.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { advance, enqueueBuild } from '../src/sim/commands';
import {
  DISTRICTS, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_LINES, TECH_ORDER, UNITS,
} from '../src/sim/data/definitions';
import { placementBlock, requiredTechForLevel } from '../src/sim/districts';
import {
  anyResearchActionable, buySlot, canStartTech, isTechComplete, slotGemCost,
  startTech, techCost, techSlots, techUnlocks,
} from '../src/sim/research';
import { edgeCells, FAN_DY, GRID, NODE, UNODE } from '../src/ui/research/layout';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type TechId } from '../src/sim/state';
import { lineMaxRank, lineRank } from '../src/sim/upgrades';
import {
  addAllTrainers, completeRanks, completeTech, freshGame, freshPresenter, fund, map,
  T0, tickAt,
} from './helpers';

const FARM_CELL = { x: 2, y: 0 }; // revealed grassland
const PLOT_CELL = { x: 2, y: 1 }; // revealed grassland

describe('technology basics', () => {
  // Docs/onboarding.md step 9: ONE research opens the plots and the Farm that
  // works them. Splitting them across two techs put a second research between
  // "tap this for Food" and "stop tapping this for Food", which is the beat
  // the tutorial is actually built around. Farming now buys the Farm's level 2.
  it('the farming chain: Agriculture unlocks crop plots AND the Farm', () => {
    const state = freshGame();
    fund(state, { Gold: 5000, Wood: 500, Food: 500 });
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe('NeedsResearch');
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    expect(startTech(state, 'Farming', T0)).toBe('MissingRequirement'); // needs Agriculture

    // Everything hangs off Forestry — the intended first research.
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

  it('the requires tree: Cavalry is blocked until Warrior is done', () => {
    const state = freshGame();
    fund(state, { Gold: 5000 });
    expect(startTech(state, 'Cavalry', T0)).toBe('MissingRequirement');
    completeTech(state, 'Warrior');
    expect(startTech(state, 'Cavalry', T0)).toBe('Started');
  });

  // CLAIM: research is bought with Gold out of the CITY purse, up front, and
  // it costs nothing else. That is what puts the tree in the same contest as
  // clearing fog and raising a building — three calls on one budget — and it
  // is why a kingdom rich in Stardust cannot buy a technology with it.
  it('costs are paid up front, in Gold, from the city purse', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Stardust: 5000 });
    completeTech(state, 'Forestry');
    completeTech(state, 'Cartography'); // the exploration branch heads here now
    expect(startTech(state, 'Sailing', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1000 - techCost('Sailing'));
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
    const state = freshGame(); // 10 Gems
    fund(state, { Gold: 5000 });
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.techSlots); // 1
    completeTech(state, 'Forestry');
    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    expect(startTech(state, 'Masonry', T0)).toBe('NoFreeSlot');

    expect(slotGemCost(state)).toBe(10);
    expect(buySlot(state)).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    expect(techSlots(state)).toBe(2);
    expect(startTech(state, 'Masonry', T0)).toBe('Started');

    // Escalating price for the next one — and 0 gems left.
    expect(slotGemCost(state)).toBe(30);
    expect(buySlot(state)).toBe('NotEnoughGems');
  });

  it('slots are capped at research.max_slots', () => {
    const state = freshGame();
    state.player.wallet.Gems = 999;
    expect(buySlot(state)).toBe('Purchased'); // → 2
    expect(buySlot(state)).toBe('Purchased'); // → 3 = max
    expect(buySlot(state)).toBe('AtMax');
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.maxSlots);
  });

  it('two active technologies complete independently, in time order', () => {
    const state = freshGame();
    state.player.wallet.Gems = 10;
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
    state.player.wallet.Gems = 10;
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
    expect(lineRank(restored, 'TapPower')).toBe(1);
  });
});

describe('tree layout (layout is content)', () => {
  // Majors only. A minor rank is drawn in its line's fan under the parent, so
  // it has no authored position to protect (tech-tree.md §1 rule 2).
  const MAJORS = TECH_ORDER.filter((id) => TECHNOLOGIES[id].node !== null);
  const nodes = MAJORS.map((id) => ({ id, ...TECHNOLOGIES[id].node! }));
  const at = (x: number, y: number) => nodes.find((n) => n.x === x && n.y === y);

  it('no two technologies share a grid cell', () => {
    expect(new Set(nodes.map((n) => `${n.x},${n.y}`)).size).toBe(nodes.length);
  });

  // THE FAN HAS TO FIT BETWEEN TWO ROWS, and it did not: an upgrade circle
  // hung 0.7 x GRID below its parent, which put it 12px INSIDE the technology
  // on the row underneath. Nothing noticed, because the invariant below is
  // about connectors crossing nodes and this is nodes crossing nodes.
  //
  // Both ends are hard. A circle must clear its parent square, and it must
  // clear whatever sits one row down — and the second constraint is the one
  // that is easy to forget, because it involves a node the fan has nothing to
  // do with.
  it('hangs an upgrade fan clear of its parent AND of the row below it', () => {
    const halfSquare = NODE / 2;
    const halfCircle = UNODE / 2;
    expect(FAN_DY, 'the fan overlaps its own parent').toBeGreaterThan(halfSquare + halfCircle);
    expect(FAN_DY, 'the fan overlaps the technology one row below')
      .toBeLessThan(GRID - halfSquare - halfCircle);
  });

  // A tap target below ~40px is one a thumb misses, and the upgrade circle is
  // the smallest thing in the game a player is asked to press.
  it('keeps the upgrade circle a thumb-sized target', () => {
    expect(UNODE).toBeGreaterThanOrEqual(40);
    expect(UNODE).toBeLessThan(NODE); // …and still unmistakably the smaller shape
  });

  // Reads the SAME route the renderer draws (src/ui/research/layout.ts)
  // rather than a hand-copied description of it, so a change to the routing
  // updates both at once instead of leaving this quietly asserting fiction.
  it('edgeCells walks the route it claims to', () => {
    // Same row: everything strictly between the endpoints.
    expect(edgeCells({ x: 0, y: 0 }, { x: 3, y: 0 }))
      .toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    // Elbowed: horizontal first, so the corner is at (to.x, from.y) and IS
    // reported — a node sitting there is exactly the failure to catch.
    expect(edgeCells({ x: 0, y: 0 }, { x: 2, y: 2 }))
      .toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }]);
    // Adjacent nodes have nothing in between.
    expect(edgeCells({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('no connector passes through an unrelated node', () => {
    for (const id of MAJORS) {
      const to = TECHNOLOGIES[id].node!;
      for (const req of TECHNOLOGIES[id].requires) {
        const from = TECHNOLOGIES[req].node;
        if (from === null) continue; // a rank's parent edge lives in the fan
        for (const cell of edgeCells(from, to)) {
          const blocker = at(cell.x, cell.y);
          expect(blocker?.id, `${req} → ${id} runs through ${blocker?.id}`).toBeUndefined();
        }
      }
    }
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
    // the line a ladder rather than five independent purchases.
    expect(canStartTech(state, 'TapPowerII')).toBe(false);
    expect(startTech(state, 'TapPowerI', T0)).toBe('Started');
    advance(state, map, T0 + TECHNOLOGIES.TapPowerI.durationSeconds * 1000);
    expect(lineRank(state, 'TapPower')).toBe(1);
    expect(canStartTech(state, 'TapPowerII')).toBe(true);

    // A finished line is not actionable, however rich you are.
    completeRanks(state, 'TapPower', lineMaxRank('TapPower'));
    expect(lineRank(state, 'TapPower')).toBe(lineMaxRank('TapPower'));
    for (const id of TECH_LINES.TapPower) expect(canStartTech(state, id)).toBe(false);
  });

  it('lights the presenter CTA only when something is pressable', () => {
    const game = freshPresenter(freshGame());
    fund(game.state, { Gold: 0 }); // spent the opening purse on fog
    expect(game.researchCtaLit()).toBe(false);
    fund(game.state, TECHNOLOGIES.Forestry.cost);
    expect(game.researchCtaLit()).toBe(true);
  });
});
