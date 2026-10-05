// THE DOORS (Docs/features/22-progression.md): what opens each book, the
// places that open a mechanic when claimed, the heroes the story brings, and
// what a save from before the doors reads as.
import { describe, expect, it } from 'vitest';
import { FOG, LANDMARKS, QUESTS } from '../src/sim/data/definitions';
import { advance } from '../src/sim/commands';
import { claimLandmark, watchtowerClaimed } from '../src/sim/landmarks';
import { isTomeOpen, researchRefusal, TOME_OPENS } from '../src/sim/research';
import { lairZoneCells } from '../src/sim/lairZone';
import { pull, pullPrice } from '../src/sim/heroes';
import { claimQuest } from '../src/sim/quests';
import { deserialize, serialize } from '../src/sim/save';
import { freshlyOpenDoors, isDoorOpen, markDoorSeen, showsCollect } from '../src/sim/doors';
import { townhall } from '../src/sim/state';
import { coordKey, type TomeId } from '../src/sim/state';
import { addBuilt, clearLair, firstGame, freshGame, fund, map, reveal, T0 } from './helpers';

const TOMES: TomeId[] = ['Kingdom', 'Sagas', 'Atlas'];
const shrine = LANDMARKS.find((l) => l.id === 'ThornedShrine')!;
const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;

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
    state.landmarks.claimed[tower.id] = true;
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
  it('refuses the Thorned Shrine while the Orcs hold its ground', () => {
    const state = freshGame();
    expect(lairZoneCells('Orcs').some((c) => coordKey(c) === coordKey(shrine.location))).toBe(true);
    reveal(state, [shrine.location]);
    advance(state, map, T0 + 1000); // revealing its ground found the Orcs
    fund(state, { Gold: 99_999 });
    expect(claimLandmark(state, map, shrine.location)).toBe('LairHeld');
    clearLair(state, 'Orcs');
    expect(claimLandmark(state, map, shrine.location)).toBe('Claimed');
  });

  it('lets the Watchtower see further than a shrine', () => {
    expect(FOG.watchtowerDiscoverRadius).toBeGreaterThan(FOG.claimDiscoverRadius);
    const state = freshGame();
    reveal(state, [tower.location]);
    fund(state, { Gold: 99_999 });
    expect(claimLandmark(state, map, tower.location)).toBe('Claimed');
    const far = { x: tower.location.x, y: tower.location.y - FOG.watchtowerDiscoverRadius };
    if (map.terrain.has(coordKey(far))) {
      expect(state.fog.discovered[coordKey(far)] || state.fog.revealed[coordKey(far)]).toBe(true);
    }
  });
});

describe('the heroes the story brings', () => {
  it('brings Bess with the first Tavern, once', () => {
    const state = freshGame();
    expect(state.heroes.owned).toEqual(['Warden']);
    addBuilt(state, 'Tavern', { x: 3, y: 1 });
    advance(state, map, T0 + 1000);
    expect(state.heroes.owned).toContain('Cook');
    advance(state, map, T0 + 2000);
    expect(state.heroes.owned.filter((h) => h === 'Cook')).toHaveLength(1);
  });

  it('makes the first call on the standard banner free, and never a miss', () => {
    const state = freshGame();
    expect(pullPrice(state).amount).toBe(0);
    const result = pull(state, 'basic', { free: true });
    expect(result.result).toBe('Pulled');
    expect(result.heroId).not.toBe(null);
  });
});

describe('the first pack', () => {
  it('is the first fight\'s reward', () => {
    const state = freshGame();
    const i = QUESTS.findIndex((q) => q.id === 'DriveThemOut');
    state.quests.index = i;
    clearLair(state, 'Orcs');
    const before = state.collection.packs.length;
    expect(claimQuest(state)).toBe('Claimed');
    expect(state.collection.packs.length).toBe(before + 1);
    expect(state.collection.packs.at(-1)!.tier).toBe(QUESTS[i].rewardPack);
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
    const doors = ['research', 'build', 'heroes', 'relics', 'store', 'world', 'knowledge', 'banner', 'survey'] as const;
    for (const d of doors) expect(isDoorOpen(state, d), d).toBe(false);
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
    state.collection.packs.push({ id: 'x', tier: 'Green' } as never);
    const fresh = freshlyOpenDoors(state);
    expect(fresh).toContain('relics');
    for (const d of fresh) markDoorSeen(state, d);
    expect(freshlyOpenDoors(state)).toEqual([]);
    // The pack is opened and the season wipes the cards: the door stays.
    state.collection.packs = [];
    expect(isDoorOpen(state, 'relics')).toBe(true);
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
