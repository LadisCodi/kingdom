// Technologies: Knowledge poured in, Gold paid at the end, no clock
// (Docs/features/07-research.md §1), the requires tree and the era bars.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { advance, enqueueBuild, researchTech } from '../src/sim/commands';
import {
  CURRENCIES, DISTRICTS, ERA_COUNT, TECHNOLOGIES, TECH_ORDER, TOME_ORDER, UNITS,
} from '../src/sim/data/definitions';
import { placementBlock, requiredTechForLevel } from '../src/sim/districts';
import {
  anyResearchActionable, canResearchTech, canStartTech, completeTech as payAndComplete,
  eraShortfall, isTechComplete, isTechFilled, isTechStarted, isTomeOpen, openTomes,
  pourKnowledge, researchActionableCount, researchRefusal, techCost, techKnowledgeCost,
  techKnowledgeMissing, techPoured, techState, techUnlocks,
} from '../src/sim/research';
import {
  CHANNEL_W, COLS, colLeft, edgePath, edgePieces, ELBOW_R, NODE_H, NODE_W, PAGE_W, pageRows, ROW_GAP,
} from '../src/ui/research/layout';
import { getWallet, type TechId } from '../src/sim/state';
import {
  addAllTrainers, completeRanks, completeTech, freshGame, freshPresenter, fund,
  ladders, map, openEveryEra, rankOf, T0,
} from './helpers';

const FARM_CELL = { x: 2, y: 0 }; // revealed grassland
const PLOT_CELL = { x: 2, y: 1 }; // revealed grassland

const knowledge = (state: ReturnType<typeof freshGame>): number =>
  getWallet(state.kingdom.wallet, 'Knowledge');
const gold = (state: ReturnType<typeof freshGame>): number =>
  getWallet(state.city.wallet, 'Gold');

/** Pour what it needs and pay the Gold, the way the sheet's two presses do. */
const research = (state: ReturnType<typeof freshGame>, id: TechId, now = T0) => {
  pourKnowledge(state, id);
  return researchTech(state, map, id, now);
};

describe('technology basics', () => {
  // Docs/features/12-quests.md §2 (quests 9-15): Agriculture opens the plots,
  // and Farming — the row under it — opens the Farm that works them.
  it('the farming chain: Agriculture opens the plots, Farming the Farm', () => {
    const state = freshGame();
    fund(state, { Gold: 5000, Wood: 500, Food: 500, Knowledge: 500 });
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe('NeedsResearch');
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    expect(research(state, 'Farming')).toBe('MissingRequirement');

    // Nothing at all is researched on a fresh kingdom: a book needs no card
    // to open it. Forestry is Civics' one first-row card.
    expect(state.research.completed).toEqual([]);
    expect(TECHNOLOGIES.Forestry.requires).toEqual([]);
    expect(TECHNOLOGIES.Agriculture.requires).toEqual(['Forestry']);
    expect(research(state, 'Agriculture')).toBe('MissingRequirement');
    completeTech(state, 'Forestry');
    // No clock: it lands on the press.
    expect(research(state, 'Agriculture')).toBe('Researched');
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(research(state, 'Agriculture')).toBe('AlreadyDone');

    // The plot opens; the Farm waits one row down.
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe(null);
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    expect(research(state, 'Farming')).toBe('Researched');
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe(null);
    expect(enqueueBuild(state, map, 'Farm', FARM_CELL)).toBe('Started');
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
  // (Docs/features/07-research.md §2.1). It holds pouring as well as paying.
  it('the era bar: a band past the first waits on the region', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000, Knowledge: 5_000 });
    const era = TECHNOLOGIES.Cavalry.era;
    expect(era).toBeGreaterThan(1);
    expect(researchRefusal(state, 'Cavalry')).toBe('MissingRequirement');

    for (const req of TECHNOLOGIES.Cavalry.requires) completeTech(state, req);
    expect(eraShortfall(state, 'Warfare', era)).toBeGreaterThan(0);
    expect(researchRefusal(state, 'Cavalry')).toBe('EraLocked');
    expect(pourKnowledge(state, 'Cavalry')).toEqual({ result: 'EraLocked', poured: 0 });
    expect(knowledge(state), 'a refused pour takes nothing').toBe(5_000);
    expect(research(state, 'Cavalry')).toBe('EraLocked');
    expect(canStartTech(state, 'Cavalry')).toBe(false);

    openEveryEra(state);
    expect(eraShortfall(state, 'Warfare', era)).toBe(0);
    expect(researchRefusal(state, 'Cavalry')).toBe(null);
    expect(research(state, 'Cavalry')).toBe('Researched');
  });

  // Two purses, one gate: Knowledge from the kingdom, poured; Gold from the
  // city, paid on completion.
  it('charges Gold from the city AND Knowledge from the kingdom, in every era', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000, Knowledge: 0 });
    expect(techKnowledgeCost('Forestry')).toBeGreaterThan(0);
    expect(canStartTech(state, 'Forestry'), 'no Knowledge at all').toBe(false);
    fund(state, { Knowledge: techKnowledgeCost('Forestry') });
    expect(canStartTech(state, 'Forestry')).toBe(true);

    for (const req of TECHNOLOGIES.Communities.requires) completeTech(state, req);
    openEveryEra(state);
    const k = techKnowledgeCost('Communities');
    fund(state, { Knowledge: 0 });
    expect(canStartTech(state, 'Communities'), 'rich in Gold, no Knowledge').toBe(false);
    expect(researchTech(state, map, 'Communities', T0)).toBe('NotFilled');

    fund(state, { Knowledge: k });
    const purse = gold(state);
    expect(research(state, 'Communities')).toBe('Researched');
    expect(gold(state)).toBe(purse - techCost('Communities'));
    expect(knowledge(state)).toBe(0);
  });

  // Research is Knowledge plus the city's Gold, and nothing else: Stardust and
  // raw materials never buy a technology.
  it('costs Gold from the city purse and nothing else', () => {
    const state = freshGame();
    fund(state, { Gold: 50_000, Wood: 500, Stardust: 5000, Knowledge: 5_000 });
    for (const req of TECHNOLOGIES.Sailing.requires) completeTech(state, req);
    openEveryEra(state);
    const purse = gold(state);
    expect(research(state, 'Sailing')).toBe('Researched');
    expect(gold(state)).toBe(purse - techCost('Sailing'));
    expect(state.city.wallet.Wood).toBe(500);
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(5000);
    expect(knowledge(state)).toBe(5_000 - techKnowledgeCost('Sailing'));
  });

  it('refuses a technology the city cannot pay for, however much Stardust the kingdom holds', () => {
    const state = freshGame();
    const id: TechId = 'Warrior';
    expect(techCost(id)).toBeGreaterThan(0);
    fund(state, { Gold: techCost(id) - 1, Wood: 999_999, Stardust: 999_999, Knowledge: 500 });
    expect(research(state, id)).toBe('NotEnoughGold');
    expect(isTechComplete(state, id)).toBe(false);
    expect(gold(state), 'a refusal takes no Gold').toBe(techCost(id) - 1);
    // The Knowledge stays poured: nothing is ever handed back, nor lost.
    expect(techPoured(state, id)).toBe(techKnowledgeCost(id));
    fund(state, { Gold: techCost(id) });
    expect(researchTech(state, map, id, T0)).toBe('Researched');
    expect(gold(state)).toBe(0);
  });

  it('takes no time: completing it creates nothing for advance() to do', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Knowledge: 10 });
    expect(research(state, 'Warrior')).toBe('Researched');
    const completed = [...state.research.completed];
    advance(state, map, T0 + 3_600_000);
    expect(state.research.completed).toEqual(completed);
  });
});

// Pouring (Docs/features/07-research.md §1): Knowledge goes into a card on as
// many visits as it takes and stays there.
describe('pouring Knowledge', () => {
  // A technology whose Knowledge is more than one visit's worth.
  const big = (): { state: ReturnType<typeof freshGame>; id: TechId } => {
    const state = freshGame();
    const id: TechId = 'Cavalry';
    for (const req of TECHNOLOGIES[id].requires) completeTech(state, req);
    openEveryEra(state);
    fund(state, { Gold: 99_999, Knowledge: 0 });
    return { state, id };
  };

  it('fills a technology across several visits', () => {
    const { state, id } = big();
    const need = techKnowledgeCost(id);
    expect(need).toBeGreaterThan(10);

    expect(pourKnowledge(state, id)).toEqual({ result: 'NothingHeld', poured: 0 });
    expect(isTechStarted(state, id)).toBe(false);

    fund(state, { Knowledge: 10 });
    expect(pourKnowledge(state, id)).toEqual({ result: 'Poured', poured: 10 });
    expect(knowledge(state)).toBe(0);
    expect(techPoured(state, id)).toBe(10);
    expect(techKnowledgeMissing(state, id)).toBe(need - 10);
    expect(isTechStarted(state, id)).toBe(true);
    expect(isTechFilled(state, id)).toBe(false);
    expect(researchTech(state, map, id, T0)).toBe('NotFilled');
    expect(gold(state), 'NotFilled takes no Gold').toBe(99_999);

    // The next visit pours only what is still missing, and keeps the rest.
    fund(state, { Knowledge: need });
    expect(pourKnowledge(state, id)).toEqual({ result: 'Poured', poured: need - 10 });
    expect(knowledge(state)).toBe(10);
    expect(isTechFilled(state, id)).toBe(true);
    expect(pourKnowledge(state, id)).toEqual({ result: 'AlreadyFull', poured: 0 });
    expect(knowledge(state)).toBe(10);

    expect(canResearchTech(state, id)).toBe(true);
    expect(researchTech(state, map, id, T0)).toBe('Researched');
    expect(gold(state)).toBe(99_999 - techCost(id));
    expect(techPoured(state, id), 'the poured record goes once it is done').toBe(0);
    expect(state.research.poured[id]).toBeUndefined();
    expect(pourKnowledge(state, id)).toEqual({ result: 'AlreadyDone', poured: 0 });
  });

  it('never hands poured Knowledge back, however long the wait', () => {
    const { state, id } = big();
    fund(state, { Knowledge: 7 });
    pourKnowledge(state, id);
    advance(state, map, T0 + 30 * 3_600_000);
    expect(techPoured(state, id)).toBe(7);
    // The drip refilled the bar, but nothing came back out of the card.
    expect(knowledge(state)).toBe(10);
  });

  it('holds Knowledge in several technologies at once', () => {
    const state = freshGame();
    openEveryEra(state);
    const a: TechId = 'Cavalry';
    const b: TechId = 'SecondSanctum';
    for (const req of [...TECHNOLOGIES[a].requires, ...TECHNOLOGIES[b].requires]) {
      completeTech(state, req);
    }
    fund(state, { Knowledge: 5 });
    expect(pourKnowledge(state, a).poured).toBe(5);
    fund(state, { Knowledge: 8 });
    expect(pourKnowledge(state, b).poured).toBe(8);
    expect(techPoured(state, a)).toBe(5);
    expect(techPoured(state, b)).toBe(8);
    expect(isTechStarted(state, a) && isTechStarted(state, b)).toBe(true);
  });

  it('refuses a card the tree does not allow yet, and takes nothing', () => {
    const state = freshGame();
    fund(state, { Knowledge: 10 });
    expect(pourKnowledge(state, 'Agriculture')).toEqual({ result: 'MissingRequirement', poured: 0 });
    expect(knowledge(state)).toBe(10);
    completeTech(state, 'Forestry');
    expect(pourKnowledge(state, 'Forestry')).toEqual({ result: 'AlreadyDone', poured: 0 });
    expect(knowledge(state)).toBe(10);
  });

  it('completeTech (the pure half) pays the Gold only once the Knowledge is in', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Knowledge: 1 });
    pourKnowledge(state, 'Warrior');
    expect(payAndComplete(state, 'Warrior')).toBe('NotFilled');
    expect(gold(state)).toBe(1000);
    fund(state, { Knowledge: 5 });
    pourKnowledge(state, 'Warrior');
    expect(payAndComplete(state, 'Warrior')).toBe('Researched');
    expect(gold(state)).toBe(1000 - techCost('Warrior'));
  });

  // EVERY BOOK IS OPEN, from the first minute.
  it('has every book open from the first minute, with nothing granted', () => {
    const state = freshGame();
    expect(state.research.completed).toEqual([]);
    for (const tome of TOME_ORDER) expect(isTomeOpen(state, tome), tome).toBe(true);
    expect(openTomes(state)).toEqual(TOME_ORDER);
  });
});

describe('a new kingdom starts with nothing', () => {
  it('holds no Knowledge at all', () => {
    expect(getWallet(freshGame().kingdom.wallet, 'Knowledge')).toBe(0);
    expect(CURRENCIES.Knowledge.start).toBe(0);
  });

  it('has nothing poured', () => {
    expect(freshGame().research.poured).toEqual({});
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
describe('the three states — there is no tree fog', () => {
  /** The first row of a book: nothing above it, so it can be worked from the off. */
  const roots = (): TechId[] => TECH_ORDER
    .filter((id) => TECHNOLOGIES[id].placed && TECHNOLOGIES[id].requires.length === 0);
  /** What a root opens directly. */
  const childrenOf = (parent: TechId): TechId[] => TECH_ORDER
    .filter((id) => TECHNOLOGIES[id].requires.includes(parent));

  it('a root is in progress from the first minute, and what it opens is locked', () => {
    const state = freshGame();
    const root = roots()[0];
    expect(techState(state, root)).toBe('progress');
    const next = childrenOf(root);
    expect(next.length, 'the fixture needs a root with children').toBeGreaterThan(0);
    for (const id of next) expect(techState(state, id), id).toBe('locked');
  });

  it('a requirement researched moves what it opens to in progress, and research to done', () => {
    const state = freshGame();
    const root = roots()[0];
    const child = childrenOf(root)[0];
    completeTech(state, root);
    expect(techState(state, root)).toBe('done');
    expect(techState(state, child)).toBe('progress');
  });

  it('a band still shut keeps its technologies locked even with every requirement met', () => {
    const state = freshGame();
    const shut = TECH_ORDER.find((id) => TECHNOLOGIES[id].placed && TECHNOLOGIES[id].era > 1)!;
    for (const req of TECHNOLOGIES[shut].requires) completeTech(state, req);
    expect(techState(state, shut)).toBe('locked');
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

  // A connector is DRAWN from pieces of art (research.css): runs, elbows
  // turned to face their bend, and a head. The pieces must meet end to end,
  // or a gap shows in the ink.
  it('breaks a connector into runs and elbows that meet end to end', () => {
    const from = { top: 0, col: 0 };
    const to = { top: NODE_H + ROW_GAP, col: 2 };
    const points = edgePath(from, to);
    const pieces = edgePieces(points);
    expect(pieces.map((p) => (p.kind === 'elbow' ? p.turn : p.kind)))
      .toEqual(['v', 'top-right', 'h', 'bottom-left', 'v', 'head']);
    // Every run stops ELBOW_R short of the corner it turns at.
    const [down, , across, , into] = pieces as Array<{ x: number; y: number; len: number }>;
    expect(down.y + down.len).toBe(points[1].y - ELBOW_R);
    expect(across.x).toBe(points[1].x + ELBOW_R);
    expect(across.x + across.len).toBe(points[2].x - ELBOW_R);
    expect(into.y).toBe(points[2].y + ELBOW_R);
    expect(into.y + into.len).toBe(to.top);
    expect(pieces.at(-1)).toEqual({ kind: 'head', x: points[3].x, y: to.top });
  });

  it('turns an elbow the way its connector bends, leftward too', () => {
    const turns = (path: Array<{ x: number; y: number }>) =>
      edgePieces(path).flatMap((p) => (p.kind === 'elbow' ? [p.turn] : []));
    // Down, left, down.
    expect(turns(edgePath({ top: 0, col: 2 }, { top: NODE_H + ROW_GAP, col: 0 })))
      .toEqual(['left-top', 'right-bottom']);
    // Out into the channel and back: every bend is one of the four.
    const channel = turns(edgePath({ top: 0, col: 1 }, { top: 4 * (NODE_H + ROW_GAP), col: 1 }, false));
    expect(channel).toHaveLength(4);
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


// The CTA and the node dots (Docs/art/ui-menus-redesign.md §6.7). A lit tab
// never lies: it means one press on the screen behind it does something that
// matters — pour enough to fill a card, or pay for one already full.
describe('what the player can actually act on', () => {
  it('is lit by a pour that would fill, or by a full card and the Gold', () => {
    const state = freshGame();
    const id: TechId = 'Warrior';
    fund(state, { Gold: 0, Knowledge: techKnowledgeCost(id) - 1 });
    // A pour that would not fill it is not worth a light.
    expect(canStartTech(state, id)).toBe(false);
    fund(state, { Knowledge: techKnowledgeCost(id) });
    expect(canStartTech(state, id), 'the bar covers what is missing').toBe(true);
    pourKnowledge(state, id);
    // Full, but no Gold: nothing to press.
    expect(canStartTech(state, id)).toBe(false);
    fund(state, { Gold: techCost(id) });
    expect(canStartTech(state, id)).toBe(true);
    expect(researchTech(state, map, id, T0)).toBe('Researched');
    expect(canStartTech(state, id)).toBe(false);
  });

  it('counts a partly poured card by what is still missing', () => {
    const state = freshGame();
    const id: TechId = 'Cavalry';
    for (const req of TECHNOLOGIES[id].requires) completeTech(state, req);
    openEveryEra(state);
    fund(state, { Knowledge: 10 });
    pourKnowledge(state, id);
    fund(state, { Knowledge: techKnowledgeMissing(state, id) - 1 });
    expect(canStartTech(state, id)).toBe(false);
    fund(state, { Knowledge: techKnowledgeMissing(state, id) });
    expect(canStartTech(state, id)).toBe(true);
  });

  it('goes dark when there is neither Knowledge nor Gold', () => {
    const state = freshGame();
    fund(state, { Gold: 0, Knowledge: 0 });
    expect(anyResearchActionable(state)).toBe(false);
    expect(researchActionableCount(state)).toBe(0);
    fund(state, { Gold: 99_999, Knowledge: 999 });
    expect(anyResearchActionable(state)).toBe(true);
    expect(researchActionableCount(state))
      .toBe(TECH_ORDER.filter((id) => canStartTech(state, id)).length);
  });

  it('gates a rank by the row above it — a ladder is a NAME, not a chain', () => {
    const state = freshGame();
    fund(state, { Gold: 99_999, Knowledge: 999 });
    expect(canStartTech(state, 'TapPowerI')).toBe(false); // its row above is not done
    expect(TECHNOLOGIES.TapPowerI.requires).not.toEqual([]);
    for (const above of TECHNOLOGIES.TapPowerI.requires) completeTech(state, above);
    expect(canStartTech(state, 'TapPowerI')).toBe(true);
    // Rank II asks for ITS row above and for the band it sits in — never for
    // rank I.
    expect(TECHNOLOGIES.TapPowerII.requires).not.toContain('TapPowerI');
    expect(canStartTech(state, 'TapPowerII')).toBe(false); // era 2, band shut
    expect(research(state, 'TapPowerI')).toBe('Researched');
    expect(rankOf(state, 'TapPower')).toBe(1);
    openEveryEra(state);
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
    expect(game.researchCtaCount()).toBeGreaterThanOrEqual(1);
  });

  it('counts every technology the player could start this second', () => {
    const game = freshPresenter(freshGame());
    fund(game.state, { Gold: 0 });
    expect(game.researchCtaCount()).toBe(0);
    fund(game.state, { Gold: 1e9, Knowledge: 1e9 });
    const startable = TECH_ORDER.filter((id) => canStartTech(game.state, id)).length;
    expect(game.researchCtaCount()).toBe(startable);
    expect(startable).toBeGreaterThan(1);
  });
});

// Docs/features/tech-tree.md §7 — PLANNED nodes. They are on the tree so its
// shape can be seen, and they do nothing yet. Four things keep that honest.
describe('planned technologies', () => {
  const PLANNED = TECH_ORDER.filter((id) => TECHNOLOGIES[id].planned);

  // The flag is the statement: it draws the hatched node and the panel's
  // "Not yet in the prototype" line. Pinning the SET stops one being quietly
  // un-flagged (shipping a no-op as content) or a new no-op arriving unflagged.
  // Fourteen: Civics kept none. `Land Survey` and `Apprenticeships` were cut
  // when the book was laid out — with every requirement one row up, a card
  // that does nothing is a toll on the way to one that does, and the answer
  // for a Civics page with no room for a leaf was to drop them.
  it('are exactly the seven the design lists, and no more', () => {
    // The tree was rebuilt on 2026-10-01 (Docs/features/22-progression.md §9):
    // a planned card is a promise of a mechanic still to come, one per book
    // at most a couple, and the Atlas's Cartography is the world map's.
    expect(PLANNED.sort()).toEqual([
      'Cartography', 'Invocation', 'LeyLines', 'LeyReading', 'LeyStorm', 'Rumours', 'Scouting',
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
