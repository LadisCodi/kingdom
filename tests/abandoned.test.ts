import { describe, expect, it } from 'vitest';
import { ABANDONED, DISTRICTS, QUESTS } from '../src/sim/data/definitions';
import { validateRegionMap, type RegionMapDoc } from '../src/sim/data/mapRules';
import regionMap from '../src/sim/data/region-map.json';
import { moveDistrict, repairAbandoned, repairRefusal } from '../src/sim/commands';
import { questValue } from '../src/sim/quests';
import { nextBuildCost } from '../src/sim/districts';
import { fogState, recordVisibleSites } from '../src/sim/fog';
import { isGrowing } from '../src/sim/harvest';
import { placementBlock } from '../src/sim/districts';
import { deserialize, serialize } from '../src/sim/save';
import { sightedThings } from '../src/sim/sight';
import { cellHasSite, standingAbandonedAt } from '../src/sim/sites';
import { coordKey, getWallet, type GameState } from '../src/sim/state';
import { firstGame, fund, map, reveal, T0 } from './helpers';

const site = (id: string) => ABANDONED.find((a) => a.id === id)!;

/** The opening's old House, its ground revealed and the purse full. */
function atTheOldHouse(): GameState {
  const state = firstGame();
  reveal(state, [site('OldHouse').location]);
  fund(state, { Wood: 1000, Gold: 1000, Stone: 1000 });
  return state;
}

describe('the abandoned buildings', () => {
  it('opens with the House, the two plots, the Farm and the Sawmill — and the Shrine and the Watchtower', () => {
    expect(ABANDONED.map((a) => a.districtId).sort())
      .toEqual(['Farm', 'FarmLands', 'FarmLands', 'Housing', 'Sawmill', 'Shrine', 'Watchtower']);
  });

  it('is sighted as a silhouette from the first minute, and undiscovered', () => {
    const state = firstGame();
    const seen = new Set(sightedThings(state, map).filter((t) => t.kind === 'abandoned').map((t) => t.id));
    for (const a of ABANDONED) {
      expect(seen.has(a.id), a.id).toBe(true);
      expect(fogState(state, map, a.location), a.id).toBe('Undiscovered');
    }
  });

  it('is site ground until repaired: nothing is built on it', () => {
    const state = atTheOldHouse();
    const at = site('OldHouse').location;
    expect(cellHasSite(state, at)).toBe(true);
    expect(placementBlock(state, map, 'Housing', at)).toBe('HasSite');
  });

  it('is repaired as a build, without its technology, at the next price', () => {
    const state = firstGame();
    const plot = site('OldPlotNorth');
    reveal(state, [plot.location]);
    fund(state, { Wood: 1000, Gold: 1000 });
    // FarmLands is opened by Agriculture, which the opening never asks for.
    expect(DISTRICTS.FarmLands.requiredTech).not.toBeNull();
    const cost = nextBuildCost(state, 'FarmLands');
    const wood = getWallet(state.city.wallet, 'Wood');
    expect(repairAbandoned(state, map, plot.id)).toBe('Started');
    // A crop plot is a plantable: it comes back as its feature, growing.
    expect(state.city.districts.some((x) => x.location.x === plot.location.x && x.location.y === plot.location.y)).toBe(false);
    expect(state.features[coordKey(plot.location)]).toBe('Crops');
    expect(isGrowing(state, map, plot.location, state.lastAdvance)).toBe(true);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(wood - (cost.Wood ?? 0));
    expect(standingAbandonedAt(state, plot.location)).toBeUndefined();
    expect(repairAbandoned(state, map, plot.id)).toBe('NotFound');
  });

  it('is repaired in a short wait of its own, flat — not a build’s', () => {
    const state = atTheOldHouse();
    expect(DISTRICTS.Housing.repairDurationSeconds).toBeGreaterThan(0);
    expect(repairAbandoned(state, map, 'OldHouse')).toBe('Started');
    expect(state.city.queue.at(-1)!.durationSeconds).toBe(DISTRICTS.Housing.repairDurationSeconds);
  });

  it('keeps the old Farm out of its plots’ reach, so the opening carries it over', () => {
    // FTUE: the plots are repaired, then the Farm, which works nothing where
    // it stands until it is moved between them (23-tutorials.md §3.1).
    const state = firstGame();
    const plots = [site('OldPlotNorth'), site('OldPlotSouth')];
    const farm = site('OldFarm');
    reveal(state, [...plots.map((p) => p.location), farm.location]);
    fund(state, { Wood: 1000, Gold: 1000 });
    for (const a of [...plots, farm]) expect(repairAbandoned(state, map, a.id), a.id).toBe('Started');
    const fieldside = QUESTS.find((q) => q.id === 'Fieldside')!;
    expect(fieldside).toMatchObject({ goalType: 'WorkInReach', goalTarget: 'Farm', goalAmount: 2 });
    expect(questValue(state, fieldside)).toBe(0);
    const between = { x: plots[0].location.x, y: (plots[0].location.y + plots[1].location.y) / 2 };
    reveal(state, [between]);
    const district = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    expect(moveDistrict(state, map, district.uniqueId, between, T0)).toBe('Moved');
    expect(questValue(state, fieldside)).toBe(2);
  });

  it('is refused as a build is', () => {
    const fogged = firstGame();
    expect(repairRefusal(fogged, map, 'OldHouse')).toBe('NotRevealed');
    const poor = firstGame();
    reveal(poor, [site('OldHouse').location]);
    poor.city.wallet.Wood = 0;
    expect(repairRefusal(poor, map, 'OldHouse')).toBe('NotEnoughResources');
    const busy = atTheOldHouse();
    expect(repairAbandoned(busy, map, 'OldHouse')).toBe('Started');
    reveal(busy, [site('OldSawmill').location]);
    // One builder, and the House holds it.
    expect(repairRefusal(busy, map, 'OldSawmill')).toBe('NoBuilderFree');
  });

  it('is named the moment it is discovered, not when it is sighted', () => {
    const state = firstGame();
    const house = site('OldHouse');
    expect(state.discoveries[`site:${house.id}`]).toBeUndefined();
    state.fog.discovered[`${house.location.x},${house.location.y}`] = true;
    recordVisibleSites(state, map);
    expect(state.discoveries[`site:${house.id}`]).toBe(true);
  });

  it('survives a save, and a kingdom that built where one stands never sees it', () => {
    const state = atTheOldHouse();
    repairAbandoned(state, map, 'OldHouse');
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.abandoned.repaired.OldHouse).toBe(true);

    // A save from before: no `kingdom.abandoned`, and a district already on
    // the old Sawmill's cell.
    const old = firstGame();
    const saw = site('OldSawmill');
    old.city.districts.push({
      ...old.city.districts[0], uniqueId: 'district_Barracks_x', definitionId: 'Barracks',
      location: saw.location, ordinal: 1, level: 1, state: 'Built',
    });
    const file = serialize(old, T0);
    delete (file.Modules as Record<string, unknown>)['kingdom.abandoned'];
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.abandoned.repaired.OldSawmill).toBe(true);
    expect(loaded.abandoned.repaired.OldHouse).toBeUndefined();
  });
});

describe('the map rules for abandoned buildings', () => {
  const doc = (): RegionMapDoc => structuredClone(regionMap) as unknown as RegionMapDoc;

  it('holds the shipped map legal', () => {
    expect(validateRegionMap(doc()).errors).toEqual([]);
  });

  it('refuses one in the water, or of no building', () => {
    const d = doc();
    const water = d.terrain.cells.find((c) => c.id === 'Water')!;
    d.abandoned!.push({ id: 'Wet', district: 'Housing', x: water.x, y: water.y, sight: 3 });
    d.abandoned!.push({ id: 'Nothing', district: 'Castle', x: 0, y: 6, sight: 3 });
    const messages = validateRegionMap(d).errors.map((e) => e.message).join('\n');
    expect(messages).toMatch(/Wet.*water|water.*Wet/);
    expect(messages).toMatch(/is not a building/);
  });

  it('refuses more of a kind inside a reach than its Townhall allows', () => {
    const d = doc();
    // The first Townhall holds one Sawmill, and the opening already has one.
    d.abandoned!.push({ id: 'SecondSawmill', district: 'Sawmill', x: -1, y: 4, sight: 3 });
    expect(validateRegionMap(d).errors.map((e) => e.message).join('\n'))
      .toMatch(/2 abandoned Sawmill lie inside Townhall 1's reach/);
  });

  it('shares the sites\' one namespace for ids', () => {
    const d = doc();
    d.abandoned!.push({ id: d.landmarks[0].id, district: 'Housing', x: -1, y: 4, sight: 3 });
    expect(validateRegionMap(d).errors.map((e) => e.message).join('\n')).toMatch(/already taken/);
  });
});
