// The presenter (`src/game.ts`) — the layer every view reads its decisions
// from, and the layer the UI redesign rewires. It had no coverage at all;
// these tests are the regression net the migration leans on, so they assert
// BEHAVIOUR (what a view is told) and never markup.
//
// Node environment, no jsdom: `Game` constructs fine without a DOM, and the
// views hold nothing but markup once the decisions live here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUESTS, TRAINING } from '../src/sim/data/definitions';
import { validPlacementCells } from '../src/sim/districts';
import { townhallDistance } from '../src/sim/grid';
import { getWallet, townhall, type CurrencyId } from '../src/sim/state';
import {
  addBuilt, completeTech, freshGame, freshPresenter, fund, map, screenAt,
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
        game.inspectedDistrictId !== null;
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
    const state = freshGame();
    const game = freshPresenter(state);
    const forest = { x: 2, y: 2 }; // authored Trees cell, seed-revealed
    game.camera.centerOnCell(forest);
    const [sx, sy] = screenAt(game, forest);

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
    expect(game.visibleCurrencies()).not.toContain('Iron');

    fund(state, { Iron: 3 });

    expect(game.visibleCurrencies()).toContain('Iron');
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

  it('counts food equivalents, so berries can cover a Food cost', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Food: 2, Berries: 5 }); // berries count as Food 1:1

    expect(game.shortfall({ Food: 7 })).toEqual({});
    expect(game.shortfall({ Food: 10 })).toEqual({ Food: 3 });
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
    expect(state.city.training).toBe(null);
  });

  it('with room but no Food, it shakes Food and queues nobody', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    addBuilt(state, 'Housing', { x: 3, y: 2 });
    const shaken: CurrencyId[][] = [];
    game.onShake((c) => shaken.push(c));

    game.doQueueTraining();

    expect(shaken).toEqual([['Food']]);
    expect(state.city.training).toBe(null);
  });

  it('an affordable train starts the clock and spends the Food', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    addBuilt(state, 'Housing', { x: 3, y: 2 }); // capacity to grow into
    fund(state, { Food: 9999 });
    const before = getWallet(state.city.wallet, 'Food');

    game.doQueueTraining();

    expect(state.city.training).not.toBe(null);
    expect(getWallet(state.city.wallet, 'Food')).toBeLessThan(before);
    expect(game.trainingInfo().active).toBe(true);
    expect(game.trainingInfo().remainingSeconds).toBeLessThanOrEqual(TRAINING.seconds);
  });
});
