// The presenter (`src/game.ts`) — the layer every view reads its decisions
// from, and the layer the UI redesign rewires. It had no coverage at all;
// these tests are the regression net the migration leans on, so they assert
// BEHAVIOUR (what a view is told) and never markup.
//
// Node environment, no jsdom: `Game` constructs fine without a DOM, and the
// views hold nothing but markup once the decisions live here.
import { HELP } from '../src/sim/data/definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lineFor } from '../src/sim/army';
import { formatDuration } from '../src/ui/format';
import type { Game } from '../src/game';
import { HARVEST, HEROES, LAIRS, LANDMARKS, QUESTS, TECHNOLOGIES, TRAINING } from '../src/sim/data/definitions';
import { isTechComplete, pourKnowledge } from '../src/sim/research';
import { validPlacementCells } from '../src/sim/districts';
import { effectiveStock, harvestSourceAt } from '../src/sim/harvest';
import { townhallDistance } from '../src/sim/grid';
import { explorationGate, fogState, isPayable, isReachable } from '../src/sim/fog';
import {
  coordKey, getWallet, townhall, type Coord, type CurrencyId, type TerrainId,
} from '../src/sim/state';
import {
  addBuilt, canGather, completeTech, FOREST, firstGame, freshGame, freshPresenter, fund, map, openEveryEra, T0,
  reveal, screenAt,
} from './helpers';
import { grantHero } from '../src/sim/heroes';
import { addToWallet } from '../src/sim/state';

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
    withOverlay.setOverlay('bag');
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
  it('auto-selects the nearest legal cell the Townhall does not hide, and leaves menus behind', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.setOverlay('build');

    game.startPlacement('Housing');

    const selected = (game.mode as { selected: { x: number; y: number } }).selected;
    const legal = validPlacementCells(state, map, 'Housing');
    expect(legal).toContainEqual(selected);
    // In FRONT of the Townhall on screen, or beside it — never under its art:
    // the 2×2 hall at the origin stands over the cells behind it (x + y < 2)
    // whose screen column (x − y) lies within its own (−2 … 2).
    const hall = townhall(state).location;
    const behind = selected.x + selected.y < hall.x + hall.y + 2
      && Math.abs(selected.x - selected.y - (hall.x - hall.y)) < 2;
    expect(behind).toBe(false);
    // …and nothing visible was passed over for it.
    const d = townhallDistance(map, selected);
    const nearest = Math.min(...legal.map((c) => townhallDistance(map, c)));
    expect(d - nearest).toBeLessThanOrEqual(1);
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
    // Before the Bag is open there is no sheet to raise: the purse shakes.
    state.tutorial.veteran = false;
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

describe('the placement window and the builder sheet', () => {
  it('closing a build goes back to the Build menu; closing a move back to its card', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.setOverlay('build');
    game.startPlacement('Housing');
    game.closePlacement();
    expect(game.mode).toEqual({ kind: 'normal' });
    expect(game.openOverlay).toBe('build');

    const hall = townhall(state);
    game.dismiss();
    game.mode = { kind: 'moving', districtUniqueId: hall.uniqueId, definitionId: 'Townhall',
      selected: hall.location, origin: hall.location };
    game.closePlacement();
    expect(game.inspectedDistrictId).toBe(hall.uniqueId);
    expect(game.openOverlay).toBe(null);
  });

  it('a build card quotes the wait of the cell its ghost will appear on', () => {
    const game = freshPresenter();
    const quoted = game.buildCardDuration('Housing');
    game.startPlacement('Housing');
    expect(game.placementInfo()!.duration).toBe(quoted);
  });

  it('the ghost shows a move arrow only for legal steps, and none while it is held', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.startPlacement('Housing');
    const at = (game.mode as { selected: { x: number; y: number } }).selected;
    const legal = new Set(validPlacementCells(state, map, 'Housing').map((c) => `${c.x},${c.y}`));
    const steps = game.ghostSteps();
    expect(steps.length).toBeGreaterThan(0);
    for (const d of steps) expect(legal.has(`${at.x + d.x},${at.y + d.y}`)).toBe(true);
    game.holdGhost(true);
    expect(game.ghostSteps()).toEqual([]);
    expect(game.markers().previewSteps).toEqual([]);
    game.holdGhost(false);
    expect(game.ghostSteps()).toEqual(steps);
  });

  it('a build every builder is busy for opens the sheet; a freed builder builds from it', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Gold: 9999, Wood: 9999, Stone: 9999, Food: 9999 });
    game.startPlacement('Housing');
    game.confirmBuild(); // takes the only builder
    game.startPlacement('Housing');
    game.confirmBuild();
    expect(game.openOverlay).toBe('builder');
    expect(game.mode.kind).toBe('placing'); // the ghost waits behind the sheet
    expect(game.builderJobs()).toHaveLength(1);
    expect(game.builderJobs()[0].task).toBe('Building');

    const ask = game.builderAskJob()!;
    expect(ask.verb).toBe('Build');
    expect(ask.what).toBe('Ready to build the Housing');

    // Finish the job: the builder is free and the sheet stays up.
    addToWallet(state.player.wallet, 'Gems', 10_000);
    game.doRush(game.builderJobs()[0].item.uniqueId);
    expect(game.builderJobs()).toHaveLength(0);
    expect(game.openOverlay).toBe('builder');

    // The free row's Build starts the build on the ghost and closes the sheet.
    ask.start();
    expect(state.city.queue).toHaveLength(1);
    expect(game.mode).toEqual({ kind: 'normal' });
    expect(game.openOverlay).toBe(null);
  });

  it('a builder out on the world board is busy for a city build', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Gold: 9999, Wood: 9999, Stone: 9999, Food: 9999 });
    state.world.builds.push({ index: 0, what: 'Rural', level: 1, finishesAt: game.now() + 60_000 });
    game.startPlacement('Housing');
    game.confirmBuild();
    expect(state.city.queue).toHaveLength(0);
    expect(game.openOverlay).toBe('builder');
    expect(game.builderJobs()).toHaveLength(0);
    expect(game.builderWorldJobs()).toHaveLength(1);
    expect(game.builderWorldJobs()[0].name).toBe('Rural district');
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
        // or a lair to send a party into.
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

    // It points for `help.pointerSeconds` (Docs/features/23-tutorials.md §5).
    vi.advanceTimersByTime(HELP.pointerSeconds * 1000 - 1);
    expect(game.uiHint()).toBe('build:Housing');
    vi.advanceTimersByTime(2);
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

  // What answers the player's own press is not announced: they know.
  const drain = (game: Game): string[] => {
    const titles: string[] = [];
    for (let b = game.takeBanner(); b !== null; b = game.takeBanner()) titles.push(b.title);
    return titles;
  };

  it('announces no research: it is instant, and the sheet says what it opened', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    for (const req of TECHNOLOGIES.Warrior.requires) completeTech(state, req);
    openEveryEra(state);
    fund(state, { Gold: 99_999, Knowledge: 500 });
    pourKnowledge(state, 'Warrior');
    drain(game);
    game.doResearchTech('Warrior');
    expect(isTechComplete(state, 'Warrior')).toBe(true);
    expect(drain(game)).toEqual([]);
  });

  it('claims a self-claiming quest the moment it is done', () => {
    const state = firstGame();
    const game = freshPresenter(state);
    state.quests.index = QUESTS.findIndex((q) => q.id === 'Woodcraft');
    expect(QUESTS[state.quests.index].autoClaim).toBe(true);
    fund(state, { Gold: 99_999, Knowledge: 10 });
    const gold = state.city.wallet.Gold ?? 0;
    pourKnowledge(state, 'Forestry');
    game.doResearchTech('Forestry');
    expect(game.questInfo()?.quest.id).toBe('Timber');
    // Paid on the way: the research's price out, the quest's reward in.
    expect(state.city.wallet.Gold).toBe(gold - 20 + (QUESTS.find((q) => q.id === 'Woodcraft')!.reward.Gold ?? 0));
  });

  it('announces no claim, nor the first coin of a resource', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;
    reveal(state, [tower.location]);
    fund(state, { Gold: 99_999 });
    game.notify();
    drain(game);
    game.doClaimLandmark(tower.location);
    expect(state.landmarks.claimed[tower.id]).toBe(true);
    // Its wider sight may bring OTHER sites into view; those are news.
    const sightings = new Set(['A place of power!', 'Lair sighted!', 'An abandoned building!']);
    expect(drain(game).filter((t) => !sightings.has(t))).toEqual([]);
    state.pendingDiscoveries.push('resource:Wood');
    game.notify();
    expect(drain(game)).toEqual([]);
  });

  it('leaves a site a scene introduces to the scene, and tells a veteran by banner', () => {
    for (const veteran of [false, true]) {
      const state = firstGame();
      state.tutorial.veteran = veteran;
      const game = freshPresenter(state);
      drain(game);
      state.pendingDiscoveries.push('site:Orcs', 'site:Goblins');
      game.notify();
      const names: string[] = [];
      for (let b = game.takeBanner(); b !== null; b = game.takeBanner()) names.push(b.name);
      const orcs = LAIRS.Orcs.name;
      expect(names.includes(orcs), `veteran ${veteran}`).toBe(veteran);
      expect(names).toContain(LAIRS.Goblins.name);
    }
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

  // Stardust buys heroes and relics and nothing else, so it reads in the
  // Reliquary next to what it pays for. A coin on the plank is a coin you
  // spend from anywhere; this is not one — and neither is Knowledge, which
  // reads in the Research screen (Docs/features/07-research.md §4).
  it('never puts Stardust on the plank, however much the kingdom holds', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    fund(state, { Stardust: 5000 });

    expect(game.visibleCurrencies()).not.toContain('Stardust');
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
    // The villagers still free to assign — the card's stepper says how many
    // work here.
    expect(slot.value).toBe(game.freeWorkers());
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
    fund(state, { Food: 7, Stardust: 4, Gems: 2 });

    expect(game.shortfall({ Food: 7 })).toEqual({});
    expect(game.shortfall({ Food: 10 })).toEqual({ Food: 3 });
    expect(game.shortfall({ Stardust: 4, Gems: 2 })).toEqual({});
    expect(game.shortfall({ Stardust: 9 })).toEqual({ Stardust: 5 });
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

  // The tab's badge counts what the lit check only asks about: the two must
  // never disagree, or the orb would show with no number behind it.
  it('counts what it lights for', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    expect(game.buildCtaCount()).toBe(0);
    fund(state, { Gold: 9999, Wood: 9999, Stone: 9999, Food: 9999 });
    expect(game.buildCtaCount()).toBeGreaterThan(0);
    expect(game.buildCtaCount() > 0).toBe(game.buildCtaLit());
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
    state.tutorial.veteran = false; // the Bag shut: nothing to offer but the shake
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

// Terrain multiplies what a cell HOLDS (04-harvest.md §2.2), and a placement
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
        .toBe(effectiveStock(state, map, y.cell, HARVEST.Forest));
    }
  });
});

// The heroes screen opts out of the per-tick rebuild by declaring what it
// reads (src/ui/kit/host.ts). A signature that misses an input does not
// flicker — it goes stale — so these assert the two halves of the contract:
// a bare second changes nothing, and every hero-facing move changes it.
// The plank carries what the OPEN SCREEN spends. The roster's two coins are
// on no plank anywhere, and the city's four buy nothing there — so it is a
// swap, not an addition, which is also what keeps the row from clipping.
describe('the plank follows the screen', () => {
  it('carries the city coins on the map', () => {
    const game = freshPresenter();
    expect(game.visibleCurrencies()).toContain('Gold');
    expect(game.visibleCurrencies()).not.toContain('HeroXp');
  });

  it('swaps to Hero XP and Stardust while the roster is open', () => {
    const game = freshPresenter();
    game.setOverlay('heroes');

    expect(game.visibleCurrencies()).toEqual(['HeroXp', 'Stardust']);
  });

  it('keeps Gold on the research screen, and Knowledge in its own tab', () => {
    const game = freshPresenter();
    game.setOverlay('research');

    // A technology is priced in Gold AND Knowledge: Gold on the plank, and
    // Knowledge in the tab under it, which stays down while research is open.
    expect(game.visibleCurrencies()).toEqual(['Gold']);
    expect(game.keepsKnowledgeTab()).toBe(true);
    game.setOverlay('knowledge');
    expect(game.keepsKnowledgeTab()).toBe(true);
    game.setOverlay('build');
    expect(game.keepsKnowledgeTab()).toBe(false);
  });

  it('gives the coins back when the roster closes', () => {
    const game = freshPresenter();
    game.setOverlay('heroes');
    game.setOverlay(null);

    expect(game.visibleCurrencies()).toContain('Gold');
  });
});

// The Knowledge tab under the plank (Docs/features/07-research.md §3): a bar
// that fills at a point an hour, and says when the next point and the full
// bar land — and stops saying so once it is full.
describe('the Knowledge bar read-out', () => {
  it('counts down to the next point and to full while filling', () => {
    const state = freshGame();
    state.kingdom.wallet.Knowledge = 3;
    state.kingdom.lastKnowledgeAt = T0;
    const game = freshPresenter(state);
    vi.spyOn(game, 'now').mockReturnValue(T0 + 20 * 60_000); // 20 min into the hour
    const info = game.knowledgeInfo();
    expect(info).toMatchObject({ value: 3, cap: 10, full: false, over: false, perHour: 1 });
    expect(info.nextIn).toBe(`+1 in ${formatDuration(40 * 60)}`);
    // 40 min to the 4th point, then six more hours to the 10th.
    expect(info.fullIn).toBe(`Full in ${formatDuration(40 * 60 + 6 * 3600)}`);
  });

  it('reports full, and no countdown, at the cap', () => {
    const state = freshGame();
    state.kingdom.wallet.Knowledge = 10;
    const game = freshPresenter(state);
    vi.spyOn(game, 'now').mockReturnValue(T0);
    const info = game.knowledgeInfo();
    expect(info.full).toBe(true);
    expect(info.over).toBe(false);
    expect(info.nextIn).toBeNull();
    expect(info.fullIn).toBeNull();
  });
});

describe('the heroes screen signature', () => {
  it('does not move on a tick that changed nothing it draws', () => {
    const game = freshPresenter();
    const before = game.heroesSignature();
    game.tick();
    expect(game.heroesSignature()).toBe(before);
  });

  it('moves when a hero is granted, levelled, ascended or paid fragments', () => {
    const game = freshPresenter();
    // Funded up front, so each move below is the hero action and not the
    // funding: a level spends Hero XP, an ascension spends both fragments and
    // the Stardust toll.
    addToWallet(game.state.kingdom.wallet, 'HeroXp', 50_000);
    addToWallet(game.state.kingdom.wallet, 'Stardust', 5_000);

    const seen = new Set<string>([game.heroesSignature()]);

    grantHero(game.state, 'Bard');
    seen.add(game.heroesSignature());

    game.state.heroes.fragments.Bard = 40;
    seen.add(game.heroesSignature());

    game.openHeroId = 'Bard';
    seen.add(game.heroesSignature());

    game.doLevelHero('Bard');
    expect(game.state.heroes.levels.Bard).toBe(2); // it really happened
    seen.add(game.heroesSignature());

    game.doAscendHero('Bard');
    expect(game.state.heroes.ascension.Bard).toBe(1);
    seen.add(game.heroesSignature());

    // Five moves, five distinct readings: none of them collide.
    expect(seen.size).toBe(6);
  });
});

// ui/kit/host.ts: a screen with nothing ticking on it says what it reads and
// is rebuilt only when that moves. Each signature below is checked the way
// the heroes one is — still on a tick, moved on the thing the screen shows —
// and the screens that DO tick must answer null so they keep rebuilding.
describe('the overlay signatures', () => {
  it('hold still on a tick that changed nothing they draw', () => {
    const game = freshPresenter();
    for (const name of ['iapConfirm', 'store', 'welcome', 'payerProfile'] as const) {
      const before = game.overlaySignature(name);
      expect(before, name).not.toBeNull();
      game.tick();
      expect(game.overlaySignature(name), name).toBe(before);
    }
  });

  it('the store moves with the Gems', () => {
    const game = freshPresenter();
    const store = game.overlaySignature('store');
    addToWallet(game.state.player.wallet, 'Gems', 5_000);
    expect(game.overlaySignature('store')).not.toBe(store);
  });

  it('the builder sheet keeps rebuilding: its bars and Finish prices move with the clock', () => {
    expect(freshPresenter().overlaySignature('builder')).toBeNull();
  });

  it('the purchase sheet moves with the pending pack', () => {
    const game = freshPresenter();
    const before = game.overlaySignature('iapConfirm');
    game.pendingSku = 'gems_pouch' as typeof game.pendingSku;
    expect(game.overlaySignature('iapConfirm')).not.toBe(before);
  });

  it('screens with a countdown or a regenerating pool are not signed', () => {
    const game = freshPresenter();
    for (const name of ['relic', 'mana', 'research', 'build', 'purse'] as const) {
      expect(game.overlaySignature(name), name).toBeNull();
    }
  });

  it('signs the attack screen, and moves it with a resting hero by the minute', () => {
    const game = freshPresenter();
    game.state.heroes.hurt.Warden = { missing: 1, at: game.now(), exhausted: true };
    const before = game.overlaySignature('lair');
    expect(before).not.toBeNull();
    expect(game.overlaySignature('lair')).toBe(before);
    game.state.heroes.hurt.Warden = { missing: 1, at: game.now() - 5 * 60_000, exhausted: true };
    expect(game.overlaySignature('lair')).not.toBe(before);
  });
});

describe('formatDuration', () => {
  it('carries a rounded-up remainder into the bigger unit', () => {
    // A fortnight's season, one minute in: 13d 23h 59m, which rounds to
    // "13d 24h" without the carry.
    expect(formatDuration(14 * 86_400 - 60)).toBe('14d');
    expect(formatDuration(86_400 - 10)).toBe('24h');
    expect(formatDuration(3600 - 0.4)).toBe('60m');
  });

  it('still prints the two units when the remainder is real', () => {
    expect(formatDuration(13 * 86_400 + 12 * 3600)).toBe('13d 12h');
    expect(formatDuration(2 * 3600 + 30 * 60)).toBe('2h 30m');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(0)).toBe('instant');
  });
});

// How many fragments a reward flies to the header as (ui/rewardFly.ts).
describe('reward fragments', () => {
  it('flies a small tap one fragment a unit, and a large one by the production rule', () => {
    const game = freshPresenter();
    for (const n of [1, 2, 3, 4]) expect(game.rewardFragments('Wood', n, true)).toBe(n);
    // From five up a tap is a reward like any other: 3 to 12, or 5 unproduced.
    const big = game.rewardFragments('Wood', 5, true);
    expect(big).toBe(game.rewardFragments('Wood', 5));
    expect(big).toBeGreaterThanOrEqual(3);
    expect(big).toBeLessThanOrEqual(12);
  });

  it('keeps the production rule for everything that is not a tap', () => {
    const game = freshPresenter();
    expect(game.rewardFragments('Gems', 2)).toBe(5); // nothing makes Gems
    expect(game.rewardFragments('Wood', 2)).toBeGreaterThanOrEqual(3);
  });
});

// THE HERO PICKER (ui/heroPicker.ts): any screen asks for n slots and gets
// the heroes chosen back, in slot order, or nothing on a close.
describe('the hero picker', () => {
  const withHeroes = (): Game => {
    const state = freshGame();
    for (const id of ['Scout', 'Bard', 'Cleric'] as const) grantHero(state, id);
    return freshPresenter(state);
  };

  it('seats a tapped hero in the first free slot, and a second tap takes it out', () => {
    const game = withHeroes();
    game.openHeroPicker({ slots: 2, onSelect: () => {} });
    game.heroPickToggle('Scout');
    game.heroPickToggle('Bard');
    expect(game.heroPick!.slots).toEqual(['Scout', 'Bard']);
    game.heroPickToggle('Scout');
    expect(game.heroPick!.slots).toEqual([null, 'Bard']);
    game.heroPickToggle('Cleric');
    expect(game.heroPick!.slots).toEqual(['Cleric', 'Bard']);
  });

  it('refuses a hero with every slot full, and an exhausted one', () => {
    const game = withHeroes();
    game.openHeroPicker({ slots: 1, selected: ['Scout'], onSelect: () => {} });
    game.heroPickToggle('Bard');
    expect(game.heroPick!.slots).toEqual(['Scout']);
    game.heroPickClearSlot(0);
    game.state.heroes.hurt.Bard = { missing: 0.5, at: game.now(), exhausted: true };
    game.heroPickToggle('Bard');
    expect(game.heroPick!.slots).toEqual([null]);
  });

  it('hands the choice back on Select and nothing on a close, returning to the screen behind', () => {
    const game = withHeroes();
    game.setOverlay('lair');
    let got: string[] | null = null;
    game.openHeroPicker({ slots: 3, selected: ['Scout'], onSelect: (h) => { got = h; } });
    expect(game.openOverlay).toBe('heroPicker');
    game.heroPickCancel();
    expect(got).toBeNull();
    expect(game.openOverlay).toBe('lair');

    game.openHeroPicker({ slots: 3, selected: ['Scout'], onSelect: (h) => { got = h; } });
    game.heroPickToggle('Cleric');
    game.heroPickConfirm();
    expect(got).toEqual(['Scout', 'Cleric']);
    expect(game.openOverlay).toBe('lair');
  });

  it('filters by the type a hero fights as', () => {
    const game = withHeroes();
    game.openHeroPicker({ slots: 1, onSelect: () => {} });
    const all = game.heroPickList();
    const type = HEROES[all[0]!].unitType;
    game.heroPickFilter(type);
    expect(game.heroPickList().every((h) => HEROES[h].unitType === type)).toBe(true);
  });
});

// A refused fog tap shows where the fog CAN be cleared (Docs/plans/ux-pass.md
// §2.6): the buyable cell nearest the one tapped wears the quest hint's hand.
describe('a refused fog tap points at the frontier', () => {
  const chebyshev = (a: Coord, b: Coord) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const buyable = (game: Game, c: Coord) =>
    fogState(game.state, game.map, c) === 'Discovered' && isPayable(game.state, game.map, c)
    && explorationGate(game.map, c) === null;
  /** The cell of `fog` farthest from the Townhall — well past the frontier. */
  const farthest = (game: Game, pred: (c: Coord) => boolean): Coord => {
    const cells = game.map.cells.filter(pred);
    expect(cells.length).toBeGreaterThan(0);
    return cells.reduce((a, b) => (townhallDistance(game.map, b) > townhallDistance(game.map, a) ? b : a));
  };
  const expectNearestFrontier = (game: Game, tapped: Coord) => {
    const hint = game.hintCell();
    expect(hint).not.toBeNull();
    expect(buyable(game, hint!)).toBe(true);
    const best = Math.min(...game.map.cells.filter((c) => buyable(game, c)).map((c) => chebyshev(c, tapped)));
    expect(chebyshev(hint!, tapped)).toBe(best);
  };

  it('on a dark cell no path reaches yet', () => {
    const game = freshPresenter();
    const far = farthest(game, (c) => fogState(game.state, game.map, c) === 'Discovered'
      && !isReachable(game.state, game.map, c));
    game.handleTap(...screenAt(game, far));
    expectNearestFrontier(game, far);
  });

  it('on the plain dark past it', () => {
    const game = freshPresenter();
    const far = farthest(game, (c) => fogState(game.state, game.map, c) === 'Undiscovered');
    game.handleTap(...screenAt(game, far));
    expectNearestFrontier(game, far);
  });

  it('not on a cell it can clear', () => {
    const game = freshPresenter();
    const edge = game.map.cells.find((c) => buyable(game, c))!;
    game.handleTap(...screenAt(game, edge));
    expect(game.hintCell()).toBeNull();
  });
});
