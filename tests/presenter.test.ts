// The presenter (`src/game.ts`) — the layer every view reads its decisions
// from, and the layer the UI redesign rewires. It had no coverage at all;
// these tests are the regression net the migration leans on, so they assert
// BEHAVIOUR (what a view is told) and never markup.
//
// Node environment, no jsdom: `Game` constructs fine without a DOM, and the
// views hold nothing but markup once the decisions live here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lineFor } from '../src/sim/army';
import { HARVEST, QUESTS, TRAINING } from '../src/sim/data/definitions';
import { validPlacementCells } from '../src/sim/districts';
import { effectiveStock, harvestSourceAt } from '../src/sim/harvest';
import { townhallDistance } from '../src/sim/grid';
import {
  coordKey, getWallet, townhall, type Coord, type CurrencyId, type TerrainId,
} from '../src/sim/state';
import {
  addBuilt, canGather, completeTech, FOREST, freshGame, freshPresenter, fund, map,
  reveal, screenAt,
} from './helpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('the overlay / dismiss state machine', () => {
  it('opening an overlay records it and notifies exactly once', () => {
    const game = freshPresenter();
    let notifications = 0;
    game.onChange(() => { notifications += 1; });

    game.setOverlay('build');

    expect(game.openOverlay).toBe('build');
    expect(notifications).toBe(1);
  });

  it('opening an overlay closes an open district card', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.inspectedDistrictId = townhall(state).uniqueId;

    game.setOverlay('research');

    expect(game.inspectedDistrictId).toBe(null);
  });

  it('reports an open sheet from each of its three independent causes', () => {
    const state = freshGame();

    const normal = freshPresenter(state);
    expect(normal.hasOpenSheet()).toBe(false);

    const withOverlay = freshPresenter(state);
    withOverlay.setOverlay('reliquary');
    expect(withOverlay.hasOpenSheet()).toBe(true);

    const withCard = freshPresenter(state);
    withCard.inspectedDistrictId = townhall(state).uniqueId;
    expect(withCard.hasOpenSheet()).toBe(true);

    const placing = freshPresenter(freshGame());
    placing.startPlacement('Housing');
    expect(placing.mode.kind).toBe('placing');
    expect(placing.hasOpenSheet()).toBe(true);
  });

  it('dismiss() clears all three at once', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.startPlacement('Housing');
    game.inspectedDistrictId = townhall(state).uniqueId;
    game.openOverlay = 'build';

    game.dismiss();

    expect(game.mode).toEqual({ kind: 'normal' });
    expect(game.openOverlay).toBe(null);
    expect(game.inspectedDistrictId).toBe(null);
    expect(game.hasOpenSheet()).toBe(false);
  });
});

describe('placement', () => {
  it('auto-selects the legal cell nearest the Townhall and leaves menus behind', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.setOverlay('build');

    game.startPlacement('Housing');

    const nearest = validPlacementCells(state, map, 'Housing')
      .reduce((best, c) =>
        townhallDistance(map, c) < townhallDistance(map, best) ? c : best);
    expect(game.mode).toEqual({ kind: 'placing', definitionId: 'Housing', selected: nearest });
    expect(game.openOverlay).toBe(null);
  });

  it('placementInfo() agrees with the selected cell', () => {
    const game = freshPresenter();
    expect(game.placementInfo()).toBe(null); // nothing to report outside placement mode

    game.startPlacement('Housing');
    const info = game.placementInfo()!;

    expect(info.definitionId).toBe('Housing');
    expect(info.cell).toEqual((game.mode as { selected: unknown }).selected);
    expect(info.duration).toBeGreaterThan(0);
    expect(info.affordable).toBe(false); // a fresh game cannot afford anything
  });

  it('an unaffordable confirm shakes the costed currencies and queues nothing', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    const shaken: CurrencyId[][] = [];
    game.onShake((c) => shaken.push(c));
    game.startPlacement('Housing');

    game.confirmBuild();

    expect(state.city.queue).toHaveLength(0);
    expect(game.mode.kind).toBe('placing'); // still placing — nothing was spent
    expect(shaken).toHaveLength(1);
    expect(shaken[0].length).toBeGreaterThan(0);
  });

  it('an affordable confirm queues the build and returns to the map', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Gold: 9999, Wood: 9999, Stone: 9999, Food: 9999 });
    game.startPlacement('Housing');

    game.confirmBuild();

    expect(state.city.queue).toHaveLength(1);
    expect(game.mode).toEqual({ kind: 'normal' });
  });
});

describe('the quest tracker', () => {
  it('reports its position in the chain', () => {
    const game = freshPresenter();
    const info = game.questInfo()!;

    expect(info.index).toBe(0);
    expect(info.total).toBe(QUESTS.length);
    expect(info.value).toBeLessThanOrEqual(info.quest.goalAmount);
  });

  it('claiming a complete quest advances the chain', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    // Force completion of whatever the first quest wants.
    state.quests.progress = QUESTS[0].goalAmount;
    fund(state, { Gold: 9999, Wood: 9999, Food: 9999, Stone: 9999, Iron: 9999 });

    const before = game.questInfo()!;
    expect(before.complete).toBe(true);
    game.doClaimQuest();

    expect(game.questInfo()!.index).toBe(before.index + 1);
  });

  it('retires the tracker once the chain runs out', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    state.quests.index = QUESTS.length;

    expect(game.questInfo()).toBe(null);
  });
});

// focusQuest() is the most branch-heavy method in the presenter (one arm per
// goal type) and the one the nav rework walks past. Every quest in the
// shipped chain must land the player *somewhere* actionable.
describe('focusQuest() — the 🔍 lands somewhere for every quest in the chain', () => {
  it.each(QUESTS.map((q, index) => [index, q.id, q.goalType] as const))(
    'quest %i (%s, %s)',
    (index) => {
      const state = freshGame();
      const game = freshPresenter(state);
      state.quests.index = index;
      // Give the chain something to point at: a worker building and a house.
      addBuilt(state, 'Sawmill', { x: 4, y: 2 });
      addBuilt(state, 'Housing', { x: 3, y: 2 });

      expect(() => game.focusQuest()).not.toThrow();

      const landed =
        game.uiHint() !== null ||
        game.hintCell() !== null ||
        game.openOverlay !== null ||
        game.inspectedDistrictId !== null ||
        // Sites are the fourth thing the 🔍 can land on: a landmark to claim
        // or a ruin to send a party into.
        game.inspectedSite !== null;
      expect(landed).toBe(true);
    },
  );
});

describe('transient UI hints', () => {
  it('a ui hint expires on its own', () => {
    vi.useFakeTimers();
    const game = freshPresenter();

    game.setUiHint('build:Housing');
    expect(game.uiHint()).toBe('build:Housing');

    vi.advanceTimersByTime(8001);
    expect(game.uiHint()).toBe(null);
  });

  it('a cell hint and a ui hint are different channels', () => {
    const game = freshPresenter();

    game.setCellHint({ x: 1, y: 1 });
    expect(game.hintCell()).toEqual({ x: 1, y: 1 });
    expect(game.uiHint()).toBe(null);

    game.clearHint();
    expect(game.hintCell()).toBe(null);
  });
});

describe('the banner queue', () => {
  it('hands banners back one at a time, in order', () => {
    const game = freshPresenter();
    game.queueBanner({ title: 'First', icon: '🌲', name: 'a', desc: '' });
    game.queueBanner({ title: 'Second', icon: '🪨', name: 'b', desc: '' });

    expect(game.takeBanner()?.title).toBe('First');
    expect(game.takeBanner()?.title).toBe('Second');
    expect(game.takeBanner()).toBe(null);
  });

  it('a finished build announces itself', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Gold: 9999, Wood: 9999, Stone: 9999, Food: 9999 });
    game.startPlacement('Housing');
    game.confirmBuild();
    while (game.takeBanner() !== null) { /* drain anything already queued */ }

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60 * 60 * 1000); // an hour is past any build time
    game.tick();

    const banner = game.takeBanner();
    expect(banner?.title).toBe('Construction complete!');
    expect(banner?.name).toBe('Housing');
  });
});

// Manual taps are deliberately not cooldown-gated, so if a held pointer's
// repeat AND the tap on release both landed, one press would collect twice.
// The input layer suppresses the release-tap when a repeat consumed the
// gesture — which only works if handleHold reports honestly.
describe('hold-to-collect reports whether it consumed the gesture', () => {
  it('true when it actually collected, false once the cooldown closes', () => {
    const state = canGather(freshGame()); // the forest is gated on Forestry
    const game = freshPresenter(state);
    game.camera.centerOnCell(FOREST);
    const [sx, sy] = screenAt(game, FOREST);

    expect(game.handleHold(sx, sy)).toBe(true); // collected
    expect(game.handleHold(sx, sy)).toBe(false); // same instant — cooldown
  });

  it('false over ground it cannot harvest, so the release-tap survives', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    const bare = { x: 2, y: 0 }; // revealed grassland, no resource
    game.camera.centerOnCell(bare);
    const [sx, sy] = screenAt(game, bare);

    expect(game.handleHold(sx, sy)).toBe(false);
  });

  it('false while a menu is open — holds never reach the map', () => {
    const game = freshPresenter();
    const forest = { x: 2, y: 2 };
    game.camera.centerOnCell(forest);
    const [sx, sy] = screenAt(game, forest);
    game.setOverlay('build');

    expect(game.handleHold(sx, sy)).toBe(false);
  });
});

describe('the HUD', () => {
  it('shows three coins until a resource becomes relevant', () => {
    const state = freshGame();
    const game = freshPresenter(state);

    expect(game.visibleCurrencies()).toEqual(['Gold', 'Food', 'Wood']);
  });

  it('reveals Stone once Masonry lands, and keeps it when spent to zero', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    completeTech(state, 'Masonry');

    expect(game.visibleCurrencies()).toContain('Stone');
    expect(getWallet(state.city.wallet, 'Stone')).toBe(0); // still broke…
    expect(game.visibleCurrencies()).toContain('Stone'); // …and still shown
  });

  it('reveals a resource held before its tech — a quest reward, say', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    expect(game.visibleCurrencies()).not.toContain('Stone');

    fund(state, { Stone: 3 });

    expect(game.visibleCurrencies()).toContain('Stone');
  });

  // Knowledge buys heroes and relics and nothing else, so it reads in the
  // Reliquary next to what it pays for. A coin on the plank is a coin you
  // spend from anywhere; this is not one.
  it('never puts Knowledge on the plank, however much the kingdom holds', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Knowledge: 5000 });

    expect(game.visibleCurrencies()).not.toContain('Knowledge');
    expect(game.visibleCurrencies()).toEqual(['Gold', 'Food', 'Wood']);
  });

  // One plaque, not three permanent counters: whichever number the player
  // can currently act on.
  it('shows population by default', () => {
    const state = freshGame();
    const game = freshPresenter(state);

    expect(game.hudSlot()).toEqual({ kind: 'population', value: 0, max: expect.any(Number) });
  });

  it('shows builders while something is being queued', () => {
    const state = freshGame();
    const game = freshPresenter(state);

    game.setOverlay('build');
    expect(game.hudSlot().kind).toBe('builders');

    game.startPlacement('Housing'); // placement, too — same decision
    expect(game.hudSlot().kind).toBe('builders');
  });

  it('shows workers while a building that can be staffed is open', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    addBuilt(state, 'Sawmill', { x: 4, y: 2 });
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    sawmill.assignedWorkers = 2;
    state.city.population = 5;

    game.inspectedDistrictId = sawmill.uniqueId;

    const slot = game.hudSlot();
    expect(slot.kind).toBe('workers');
    expect(slot.value).toBe(2); // working
    expect(slot.max).toBe(2 + game.freeWorkers()); // of the whole workforce
  });

  it('stays on population for a building nobody can be assigned to', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    addBuilt(state, 'Housing', { x: 3, y: 2 });

    game.inspectedDistrictId = state.city.districts
      .find((d) => d.definitionId === 'Housing')!.uniqueId;

    expect(game.hudSlot().kind).toBe('population');
  });

  it('focusTownhall() closes what is open and inspects the hall', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.setOverlay('research');

    game.focusTownhall();

    expect(game.openOverlay).toBe(null);
    expect(game.inspectedDistrictId).toBe(townhall(state).uniqueId);
  });
});

// A blocked action has to say what is missing, not just go grey (§6.3).
describe('shortfall', () => {
  it('reports only what is actually missing, and by how much', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Wood: 8, Stone: 50 });

    expect(game.shortfall({ Wood: 20, Stone: 10 })).toEqual({ Wood: 12 });
  });

  it('is empty when the cost is affordable', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Wood: 20 });

    expect(game.shortfall({ Wood: 20 })).toEqual({});
  });

  it('reads each purse where it lives — city, kingdom, player', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Food: 7, Knowledge: 4, Gems: 2 });

    expect(game.shortfall({ Food: 7 })).toEqual({});
    expect(game.shortfall({ Food: 10 })).toEqual({ Food: 3 });
    expect(game.shortfall({ Knowledge: 4, Gems: 2 })).toEqual({});
    expect(game.shortfall({ Knowledge: 9 })).toEqual({ Knowledge: 5 });
  });
});

describe('the Build call-to-action', () => {
  it('lights only once something is both affordable and placeable', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    expect(game.buildCtaLit()).toBe(false);

    fund(state, { Gold: 9999, Wood: 9999, Stone: 9999, Food: 9999 });
    expect(game.buildCtaLit()).toBe(true);
  });
});

describe('villager training', () => {
  // The two blockers are checked in this order, and they surface through
  // different channels — a full city explains itself in words, an empty
  // purse shakes the currency you are short of.
  it('a full city toasts rather than shaking — Food is never the complaint', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    const shaken: CurrencyId[][] = [];
    const toasts: string[] = [];
    game.onShake((c) => shaken.push(c));
    game.onToast((m) => toasts.push(m));

    game.doQueueTraining(); // fresh game: no Housing, so no room to grow into

    expect(toasts).toEqual(['Population at max — build more Housing']);
    expect(shaken).toEqual([]);
    expect(lineFor(state, townhall(state).uniqueId)).toHaveLength(0);
  });

  it('with room but no Food, it shakes Food and queues nobody', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    addBuilt(state, 'Housing', { x: 3, y: 2 });
    const shaken: CurrencyId[][] = [];
    game.onShake((c) => shaken.push(c));

    game.doQueueTraining();

    expect(shaken).toEqual([['Food']]);
    expect(lineFor(state, townhall(state).uniqueId)).toHaveLength(0);
  });

  it('an affordable train starts the clock and spends the Food', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    addBuilt(state, 'Housing', { x: 3, y: 2 }); // capacity to grow into
    fund(state, { Food: 9999 });
    const before = getWallet(state.city.wallet, 'Food');

    game.doQueueTraining();

    expect(lineFor(state, townhall(state).uniqueId).length).toBeGreaterThan(0);
    expect(getWallet(state.city.wallet, 'Food')).toBeLessThan(before);
    expect(game.trainingInfo().active).toBe(true);
    expect(game.trainingInfo().remainingSeconds).toBeLessThanOrEqual(TRAINING.seconds);
  });
});

// Terrain multiplies what a cell HOLDS (04-harvest.md §3.2), and a placement
// is the one moment that number is a decision — so the ghost has to say it.
// Dragging a crop plot from grass to sand takes it from 13 Food to 5 and there
// is otherwise nothing on screen that admits it.
describe('placement labels read the ground', () => {
  const cellOf = (kind: TerrainId): Coord | undefined =>
    map.cells.find((c) => map.terrain.get(coordKey(c)) === kind
      && harvestSourceAt(freshGame(), c) === null);

  it('a crop plot labels its own ghost, and the number moves with the biome', () => {
    const state = freshGame();
    completeTech(state, 'Farming');
    const game = freshPresenter(state);
    game.startPlacement('FarmLands');

    const seen: Array<{ kind: TerrainId; label: string; tone?: string }> = [];
    for (const kind of ['Grassland', 'Plains', 'Desert', 'Snow'] as TerrainId[]) {
      const cell = cellOf(kind);
      if (!cell) continue;
      reveal(state, [cell]);
      (game.mode as { selected: Coord }).selected = cell;
      const mine = game.markers().yieldCells.find((y) => coordKey(y.cell) === coordKey(cell));
      expect(mine, `${kind} has no label`).toBeDefined();
      seen.push({ kind, label: mine!.label, tone: mine!.tone });
    }
    // Whatever the province happens to paint, richer ground reads higher and
    // is toned for it — that is the whole job of the label.
    const grass = seen.find((s) => s.kind === 'Grassland');
    const sand = seen.find((s) => s.kind === 'Desert');
    if (grass && sand) {
      expect(parseInt(grass.label, 10)).toBeGreaterThan(parseInt(sand.label, 10));
      expect(grass.tone).toBe('good');
      expect(sand.tone).toBe('bad');
    }
    const plains = seen.find((s) => s.kind === 'Plains');
    if (plains) expect(plains.tone).toBeUndefined(); // the baseline is untoned
  });

  it('a Sawmill labels every tree in reach with what is in it', () => {
    const state = freshGame();
    completeTech(state, 'Saws');
    // Stand the ghost next to a known tree, so "in reach" is not the map's
    // business — the subject is what the label SAYS, not which cells qualify.
    const shed = { x: FOREST.x + 1, y: FOREST.y - 1 };
    reveal(state, [FOREST, shed]);
    const game = freshPresenter(state);
    game.startPlacement('Sawmill');
    (game.mode as { selected: Coord }).selected = shed;

    const labels = game.markers().yieldCells;
    expect(labels.length).toBeGreaterThan(0);
    for (const y of labels) {
      // Every label sits on a tree, and says the tree's whole depot.
      expect(harvestSourceAt(state, y.cell)).toBe('Forest');
      expect(parseInt(y.label, 10))
        .toBe(effectiveStock(map, y.cell, HARVEST.Forest));
    }
  });
});
