// THE DOORS (Docs/features/22-progression.md): what opens each book, the
// places that open a mechanic when claimed, the heroes the story brings, and
// what a save from before the doors reads as.
import { describe, expect, it } from 'vitest';
import { ABANDONED, DISTRICTS, FOG, HERO_LADDER, QUESTS } from '../src/sim/data/definitions';
import { advance, repairAbandoned, repairRefusal } from '../src/sim/commands';
import { claimLair } from '../src/sim/expeditions';
import { watchtowerClaimed } from '../src/sim/landmarks';
import { isTomeOpen, researchRefusal, TOME_OPENS } from '../src/sim/research';
import { lairZoneCells } from '../src/sim/lairZone';
import { pull, pullPrice } from '../src/sim/heroes';
import { deserialize, serialize } from '../src/sim/save';
import { freshlyOpenDoors, isDoorOpen, markDoorSeen, showsCollect } from '../src/sim/doors';
import { grantItem, itemCount, useItem } from '../src/sim/bag';
import { openRelicDoor } from '../src/sim/relics';
import { townhall } from '../src/sim/state';
import { cellsOfRect, coordKey, type TomeId } from '../src/sim/state';
import {
  addBuilt, clearLair, firstGame, freshGame, fund, map, raiseWatchtower, reveal, T0, WATCHTOWER,
} from './helpers';

const TOMES: TomeId[] = ['Kingdom', 'Sagas', 'Atlas'];
const shrine = ABANDONED.find((a) => a.id === 'ThornedShrine')!;
const tower = WATCHTOWER;

describe('the books open on the world', () => {
  it('opens the kingdom\'s one tree and nothing else for a new kingdom', () => {
    const state = firstGame();
    expect(TOMES.filter((t) => isTomeOpen(state, t))).toEqual(['Kingdom']);
    // The army is a lane of the one tree, not a book of its own: nothing has
    // to be found or handed over before a soldier can be researched.
    expect(researchRefusal(state, 'Warrior')).not.toBe('TomeClosed');
    // A FOUND book's card still says so before it says anything else.
    expect(researchRefusal(state, 'Cartography')).toBe('TomeClosed');
  });

  it('opens the Sagas with a standing Tavern, and the Atlas with the Watchtower', () => {
    const state = firstGame();
    expect(isTomeOpen(state, 'Sagas')).toBe(false);
    addBuilt(state, 'Tavern', { x: 3, y: 1 });
    expect(isTomeOpen(state, 'Sagas')).toBe(true);
    expect(isTomeOpen(state, 'Atlas')).toBe(false);
    raiseWatchtower(state);
    expect(watchtowerClaimed(state)).toBe(true);
    expect(isTomeOpen(state, 'Atlas')).toBe(true);
  });

  it('keeps every book open for a veteran', () => {
    const state = firstGame();
    state.tutorial.veteran = true;
    expect(TOMES.every((t) => isTomeOpen(state, t))).toBe(true);
  });

  it('decides every book in one place', () => {
    expect(Object.keys(TOME_OPENS).sort()).toEqual([...TOMES].sort());
  });
});

describe('the places that open a mechanic', () => {
  it('refuses to repair the Thorned Shrine while the Orcs hold its ground', () => {
    const state = freshGame();
    expect(lairZoneCells('Orcs').some((c) => coordKey(c) === coordKey(shrine.location))).toBe(true);
    reveal(state, cellsOfRect(shrine.location, { x: 2, y: 2 }));
    advance(state, map, T0 + 1000); // revealing its ground found the Orcs
    fund(state, { Gold: 99_999 });
    expect(repairRefusal(state, map, shrine.id)).toBe('LairHeld');
    clearLair(state, 'Orcs');
    expect(repairRefusal(state, map, shrine.id)).toBeNull();
  });

  // THE WATCHTOWER IS REPAIRED, NOT CLAIMED (22-progression.md §5): with
  // the lens the Orcs carried off, in a minute, and then it sees eight rings
  // and opens the world.
  it('repairs the Watchtower with the Orcs\' lens, in a minute, and it opens the world', () => {
    const radius = DISTRICTS.Watchtower.fogDiscoverRadius;
    expect(radius).toBeGreaterThan(FOG.claimDiscoverRadius);
    const state = firstGame();
    state.lastAdvance = T0;
    reveal(state, cellsOfRect(tower.location, DISTRICTS.Watchtower.size));
    fund(state, { Gold: 99_999, Wood: 99_999 });
    expect(repairRefusal(state, map, tower.id)).toBe('MissingItem');
    grantItem(state, 'WatchtowerLens', 1);
    expect(repairRefusal(state, map, tower.id)).toBeNull();
    expect(repairAbandoned(state, map, tower.id)).toBe('Started');
    expect(itemCount(state, 'WatchtowerLens')).toBe(0);
    expect(isDoorOpen(state, 'world')).toBe(false);
    advance(state, map, T0 + 60_000);
    expect(watchtowerClaimed(state)).toBe(true);
    expect(isDoorOpen(state, 'world')).toBe(true);
    expect(isTomeOpen(state, 'Atlas')).toBe(true);
    const far = { x: tower.location.x, y: tower.location.y - radius };
    if (map.terrain.has(coordKey(far))) {
      expect(state.fog.discovered[coordKey(far)] || state.fog.revealed[coordKey(far)]).toBe(true);
    }
  });

  it('hands the lens over with the Orcs\' prize', () => {
    const state = freshGame();
    state.lairs.Orcs = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: true, cleared: false };
    expect(claimLair(state, 'Orcs').result).toBe('Claimed');
    expect(itemCount(state, 'WatchtowerLens')).toBe(1);
  });
});

describe('the first hero', () => {
  it('is nobody\'s from the start, and the Tavern brings none', () => {
    const state = firstGame();
    expect(state.heroes.owned).toEqual([]);
    addBuilt(state, 'Tavern', { x: 3, y: 1 });
    advance(state, map, T0 + 1000);
    expect(state.heroes.owned).toEqual([]);
  });

  it('comes from the first call on the standard banner: free, and never a miss', () => {
    const state = firstGame();
    expect(pullPrice(state).amount).toBe(0);
    const result = pull(state, 'basic', { free: true });
    expect(result.result).toBe('Pulled');
    expect(result.heroId).not.toBe(null);
    expect(state.heroes.owned).toEqual([result.heroId]);
  });

  it('the first two calls, on either banner, are each a new hero', () => {
    const orders = [['basic', 'basic'], ['basic', 'advanced'], ['advanced', 'basic'], ['advanced', 'advanced']] as const;
    for (let seed = 1; seed <= 50; seed++) {
      for (const order of orders) {
        const state = firstGame();
        state.seed = seed;
        for (const banner of order) {
          const result = pull(state, banner, { free: true });
          expect(result.heroId).not.toBe(null);
          expect(result.duplicate).toBe(false);
        }
        expect(state.heroes.owned.length).toBe(HERO_LADDER.firstCallsNewHero);
      }
    }
  });
});

describe('the first relic', () => {
  it('is met at the first lair\'s prize, and opens the relics door', () => {
    const state = firstGame();
    expect(isDoorOpen(state, 'relics')).toBe(false);
    openRelicDoor(state, 'Orcs');
    expect(isDoorOpen(state, 'relics')).toBe(true);
    expect(isDoorOpen(state, 'bag')).toBe(true);
  });
});

describe('the tutorial in the save', () => {
  it('reads a save from before the doors as a veteran', () => {
    const state = firstGame();
    const save = serialize(state, T0);
    delete save.Modules['kingdom.tutorial'];
    const back = deserialize(save, map, T0)!;
    expect(back.tutorial.veteran).toBe(true);
    expect(isTomeOpen(back, 'Atlas')).toBe(true);
  });

  it('round-trips the scenes played, and a new kingdom stays new', () => {
    const state = firstGame();
    state.tutorial.seen.intro = true;
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.tutorial).toEqual({ veteran: false, seen: { intro: true }, startedAt: state.tutorial.startedAt });
  });
});

describe('the doors of the UI', () => {
  it('shuts every door on a new kingdom', () => {
    const state = firstGame();
    const doors = ['research', 'build', 'heroes', 'relics', 'store', 'world', 'knowledge', 'banner', 'survey', 'bag'] as const;
    for (const d of doors) expect(isDoorOpen(state, d), d).toBe(false);
  });

  it('opens the Bag with the first item, and keeps it open once seen', () => {
    const state = firstGame();
    grantItem(state, 'GoldChest10m');
    expect(isDoorOpen(state, 'bag')).toBe(true);
    markDoorSeen(state, 'bag');
    useItem(state, 'GoldChest10m', 1, T0);
    expect(isDoorOpen(state, 'bag')).toBe(true);
  });

  it('opens the Store with the second Townhall', () => {
    const state = firstGame();
    townhall(state).level = 2;
    expect(isDoorOpen(state, 'store')).toBe(true);
  });

  it('opens Research and Build as the chain reaches them', () => {
    const state = firstGame();
    state.quests.index = QUESTS.findIndex((q) => q.id === 'Woodcraft');
    expect(isDoorOpen(state, 'research')).toBe(true);
    expect(isDoorOpen(state, 'build')).toBe(false);
    state.quests.index = QUESTS.findIndex((q) => q.id === 'GrowingTown');
    expect(isDoorOpen(state, 'build')).toBe(true);
  });

  it('never shuts a door once it has opened', () => {
    const state = firstGame();
    grantItem(state, 'GoldChest10m');
    const fresh = freshlyOpenDoors(state);
    expect(fresh).toContain('bag');
    for (const d of fresh) markDoorSeen(state, d);
    expect(freshlyOpenDoors(state)).toEqual([]);
    // The chest is used: the door stays.
    useItem(state, 'GoldChest10m', 1, T0);
    expect(isDoorOpen(state, 'bag')).toBe(true);
  });

  it('opens every door for a veteran, and announces none', () => {
    const state = firstGame();
    state.tutorial.veteran = true;
    expect(isDoorOpen(state, 'heroes')).toBe(true);
    expect(freshlyOpenDoors(state)).toEqual([]);
  });
});

describe('the Townhall through the First Morning', () => {
  it('keeps its Gold quiet until the morning ends, while the Gold piles up', () => {
    const state = firstGame();
    advance(state, map, T0 + 10 * 60_000);
    const th = townhall(state);
    expect(th.stored?.Gold ?? 0).toBeGreaterThan(0);
    expect(showsCollect(state, th)).toBe(false);
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TaxDay') + 1;
    expect(showsCollect(state, th)).toBe(true);
    // A veteran never had a morning.
    const old = firstGame();
    old.tutorial.veteran = true;
    advance(old, map, T0 + 10 * 60_000);
    expect(showsCollect(old, townhall(old))).toBe(true);
  });
});
