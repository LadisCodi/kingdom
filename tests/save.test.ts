import { describe, expect, it } from 'vitest';
import { changeWorkers, enqueueBuild } from '../src/sim/commands';
import { HARVEST, QUESTS, SAVE_VERSION, TAP, TOME_ORDER } from '../src/sim/data/definitions';
import {
  deserialize, isPrototypeStale, migrate, serialize, MIN_MIGRATABLE_VERSION, PROTOTYPE_FRESH_START,
} from '../src/sim/save';
import { getWallet, parseCoordKey, type DistrictId } from '../src/sim/state';
import { isStoreFull } from '../src/sim/storage';
import { effectiveStock } from '../src/sim/harvest';
import { isTechComplete, isTomeOpen } from '../src/sim/research';
import { tapWorkSeconds } from '../src/sim/upgrades';
import {
  addBuilt, firstGame, completeTech, FOREST, freshGame, fund, map, rentStored, reveal, stored, T0, tickAt,
} from './helpers';

const SAWMILL = { x: 2, y: -1 }; // beside FOREST, diagonal to the Townhall

const workingGame = () => {
  const state = freshGame();
  state.city.population = 4;
  fund(state, { Gold: 500, Wood: 500, Food: 42 });
  completeTech(state, 'Forestry');
  completeTech(state, 'Saws');
  reveal(state, [FOREST]);
  enqueueBuild(state, map, 'Sawmill', SAWMILL);
  tickAt(state, T0);
  tickAt(state, T0 + 30_000); // sawmill built (23s)
  changeWorkers(state, map, state.city.districts[1].uniqueId, 1, T0 + 30_000);
  state.army.push({ uniqueId: 'unit_1', definitionId: 'Archer' });
  return state;
};

describe('save round-trip', () => {
  it('restores wallets, districts, workers, harvest state, fog, army', () => {
    const state = workingGame();
    const t = T0 + 60_000;
    tickAt(state, t); // a few harvest cycles happened
    const woodAtSave = getWallet(state.city.wallet, 'Wood');
    // Whichever cell the worker actually claimed — the Sawmill's own fog ring
    // reveals more than one tree, so naming it here would only be a guess.
    const worked = Object.keys(state.harvest)[0];
    expect(worked, 'no cell was harvested').toBeDefined();
    expect(state.harvest[worked].units)
      .toBeLessThan(effectiveStock(state, map, parseCoordKey(worked), HARVEST.Forest));

    const restored = deserialize(serialize(state, t), map, t)!;
    expect(restored).not.toBeNull();
    expect(restored.city.wallet).toEqual(state.city.wallet);
    expect(restored.city.population).toBe(4);
    expect(restored.city.districts.map((d) => d.definitionId).sort()).toEqual(['Sawmill', 'Townhall']);
    expect(restored.workers).toHaveLength(1);
    expect(restored.workers[0].activity).toBe(state.workers[0].activity);
    expect(restored.harvest[worked]).toEqual(state.harvest[worked]);
    expect(restored.army).toEqual([{ uniqueId: 'unit_1', definitionId: 'Archer' }]);
    expect(restored.player.wallet.Gems).toBe(500);
    expect(getWallet(restored.city.wallet, 'Wood')).toBe(woodAtSave); // zero-time load adds nothing
  });

  it('v1 saves are rejected (fresh game)', () => {
    expect(
      deserialize({ LastSaved: new Date(T0).toISOString(), GameVersion: 'x', Modules: {} }, map, T0),
    ).toBeNull();
  });

  it('offline replay: an aged save accrues rent and deliveries into the stores', () => {
    const state = workingGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 }); // 2 of the 4 villagers move in
    const saveAt = T0 + 30_000;
    state.city.districts.at(-1)!.rentAnchor = saveAt;
    const gold = getWallet(state.city.wallet, 'Gold');
    const wood = stored(state, 'Wood');
    const restored = deserialize(serialize(state, saveAt), map, saveAt + 4 * 60_000)!;
    expect(rentStored(restored)).toBe(240); // 2 housed × 30/min × 4 min, under the store
    expect(getWallet(restored.city.wallet, 'Gold')).toBe(gold); // not the player's until collected
    expect(stored(restored, 'Wood')).toBeGreaterThan(wood + 10); // spans a recovery window
  });

  it('keeps what waits in a store, and a pre-store save pays its houses from the old anchor', () => {
    const state = workingGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    const house = state.city.districts.at(-1)!;
    house.stored = { Gold: 42 };
    house.rentAnchor = T0;
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.city.districts.at(-1)!.stored).toEqual({ Gold: 42 });
    expect(back.city.districts.at(-1)!.rentAnchor).toBe(T0);
    // A save from before stores had one city anchor, LastTaxAt.
    const save = serialize(state, T0) as any;
    const city = save.Modules['kingdom.cities'].Cities[0];
    city.LastTaxAt = new Date(T0 - 60_000).toISOString();
    for (const d of city.Districts) { delete d.Stored; delete d.RentAnchorUtc; }
    const legacy = deserialize(save, map, T0)!;
    expect(legacy.city.districts.at(-1)!.stored?.Gold).toBe(60); // the minute since the old anchor
  });

  it('offline replay matches a live-ticked session exactly (same horizon)', () => {
    const horizon = 20 * 60_000;
    const saveAt = T0 + 30_000;
    const offline = deserialize(serialize(workingGame(), saveAt), map, saveAt + horizon)!;
    const live = workingGame();
    for (let t = 1000; t <= horizon; t += 1000) tickAt(live, saveAt + t);
    expect(getWallet(offline.city.wallet, 'Wood')).toBe(getWallet(live.city.wallet, 'Wood'));
    expect(getWallet(offline.city.wallet, 'Gold')).toBe(getWallet(live.city.wallet, 'Gold'));
    expect(stored(offline, 'Wood')).toBe(stored(live, 'Wood'));
    expect(stored(offline, 'Gold')).toBe(stored(live, 'Gold'));
  });

  it('no offline cap: the stores are the ceiling — 3 and 6 days away land the same; the queue still completes', () => {
    const mk = () => {
      const s = workingGame();
      fund(s, { Gold: 5000, Wood: 5000 });
      enqueueBuild(s, map, 'Housing', { x: 2, y: 0 });
      return serialize(s, T0 + 30_000);
    };
    const longer = deserialize(mk(), map, T0 + 30_000 + 144 * 3_600_000)!;
    const shorter = deserialize(mk(), map, T0 + 30_000 + 72 * 3_600_000)!;
    expect(stored(longer, 'Wood')).toBe(stored(shorter, 'Wood'));
    expect(stored(longer, 'Gold')).toBe(stored(shorter, 'Gold'));
    expect(longer.city.districts.filter((d) => isStoreFull(longer, d)).length).toBeGreaterThan(0);
    // The queued Housing finished.
    expect(longer.city.districts.find((d) => d.definitionId === 'Housing')!.state).toBe('Built');
    // A crew by a full store waits at the door rather than walking.
    const w = longer.workers[0];
    expect(w.stateUntil === null || w.stateUntil > T0 + 30_000 + 144 * 3_600_000 - 60_000).toBe(true);
  });
});

// The migration chain (Docs/implementation-plan.md §1). Additive changes
// need no migrator — a version bump plus the defensive readers is enough —
// so this covers the two gates that DO have to hold on every bump.
describe('save versions', () => {
  it('rejects a save written by a newer client', () => {
    const save = serialize(freshGame(), T0);
    save.SaveVersion = SAVE_VERSION + 1;
    expect(deserialize(save, map, T0)).toBeNull();
  });

  it('rejects anything below MIN_MIGRATABLE_VERSION', () => {
    const save = serialize(freshGame(), T0);
    save.SaveVersion = MIN_MIGRATABLE_VERSION - 1;
    expect(deserialize(save, map, T0)).toBeNull();
  });

  // PROTOTYPE ONLY: the boot discards a save from before the fresh start,
  // and never one the build itself writes.
  it('marks a save from before the prototype fresh start, and never a current one', () => {
    const save = serialize(freshGame(), T0);
    expect(PROTOTYPE_FRESH_START).toBeLessThanOrEqual(SAVE_VERSION);
    expect(isPrototypeStale(save)).toBe(false);
    save.SaveVersion = PROTOTYPE_FRESH_START - 1;
    expect(isPrototypeStale(save)).toBe(true);
  });

  it('carries a current save through the chain unchanged', () => {
    const save = serialize(freshGame(), T0);
    expect(migrate(save)).toBe(true);
    expect(save.SaveVersion).toBe(SAVE_VERSION);
  });

  // v21: Berries, Meat, Fish and Iron stopped being wallet rows. A save's
  // balances convert at the rates they were EARNED at — the old `countsAs`
  // values and Iron's 3:1 against Stone — not at whatever a cell pays per tap
  // today. Somebody who banked 10 Fish banked 10 Food's worth of buying
  // power, whatever a shoal is worth now.
  it('folds the retired currencies into Food and Stone', () => {
    const state = freshGame();
    fund(state, { Gold: 7, Food: 2, Stone: 1 });
    const save = serialize(state, T0);
    const city = (save.Modules['kingdom.cities'] as any).Cities[0];
    Object.assign(city.Currencies, { Berries: 4, Meat: 3, Fish: 10, Iron: 5 });
    save.SaveVersion = 20;

    const restored = deserialize(save, map, T0)!;
    expect(restored).not.toBeNull();
    // 2 + 4×1 + 3×3 + 10×1 = 25
    expect(getWallet(restored.city.wallet, 'Food')).toBe(25);
    // 1 + 5×3 = 16
    expect(getWallet(restored.city.wallet, 'Stone')).toBe(16);
    expect(getWallet(restored.city.wallet, 'Gold')).toBe(7); // untouched
    for (const dead of ['Berries', 'Meat', 'Fish', 'Iron']) {
      expect(restored.city.wallet).not.toHaveProperty(dead);
    }
  });

  // v23: the Mine stopped being a building. A player who already paid for one
  // keeps it — as a Quarry, which does the Mine's whole job now. Deleting it
  // would take away something they own, which is the one thing the design
  // promises never to do.
  it('turns a standing Mine into a Quarry rather than deleting it', () => {
    const state = freshGame();
    addBuilt(state, 'Quarry', { x: 4, y: -1 });
    const save = serialize(state, T0);
    const city = (save.Modules['kingdom.cities'] as any).Cities[0];
    // Re-label it as the building that no longer exists, the way a save
    // written before this change would have it on disk.
    const standing = city.Districts.find((d: any) => d.DefinitionID === 'Quarry');
    expect(standing).toBeDefined();
    standing.DefinitionID = 'Mine';
    standing.AssignedWorkers = 2;
    save.SaveVersion = 22;

    const restored = deserialize(save, map, T0)!;
    expect(restored).not.toBeNull();
    const moved = restored.city.districts.find((d) => d.location.x === 4 && d.location.y === -1)!;
    expect(moved.definitionId).toBe('Quarry');
    // The crew came with the building; nobody was sent home.
    expect(moved.assignedWorkers).toBe(2);
    expect(restored.city.districts.some((d) => (d.definitionId as string) === 'Mine')).toBe(false);
  });

  it('leaves a v21 save alone — the fold runs once, not on every load', () => {
    const state = freshGame();
    fund(state, { Food: 5, Stone: 3 });
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(getWallet(restored.city.wallet, 'Food')).toBe(5);
    expect(getWallet(restored.city.wallet, 'Stone')).toBe(3);
  });

  // v43: a building carries the ORDINAL it was placed with, and that ordinal
  // prices every level of it for ever. An old save has none, and defaulting
  // to 1 would make every building in a grown city the cheap first one — so
  // the migrator numbers each kind in the order the save lists it, which IS
  // the order the player built them.
  it('numbers an old save\'s buildings in the order they were placed', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    addBuilt(state, 'Sawmill', { x: 4, y: 0 });
    addBuilt(state, 'Housing', { x: 2, y: 2 });
    addBuilt(state, 'Housing', { x: 4, y: 2 });
    const save = serialize(state, T0);
    for (const d of (save.Modules['kingdom.cities'] as any).Cities[0].Districts) {
      delete d.Ordinal;
    }
    save.SaveVersion = 42;

    const restored = deserialize(save, map, T0)!;
    const kind = (id: DistrictId) => restored.city.districts
      .filter((d) => d.definitionId === id).map((d) => d.ordinal);
    expect(kind('Housing')).toEqual([1, 2, 3]);
    expect(kind('Sawmill')).toEqual([1]);
    // Each kind counts on its own — the Townhall is not Housing #0.
    expect(kind('Townhall')).toEqual([1]);
  });

  // v33: Hero XP stopped being a tally beside each hero and became a kingdom
  // wallet row that buys ANY hero's levels. It was written and never read
  // until then, so nothing was ever spent from it and every point a save
  // holds is still owed — the whole per-hero map folds into the one counter.
  it('folds every hero\'s XP tally into one kingdom counter', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    (save.Modules['kingdom.heroes'] as any).Xp = { Warden: 120, Bard: 30, Scholar: 7 };
    save.SaveVersion = 32;

    const restored = deserialize(save, map, T0)!;
    expect(restored).not.toBeNull();
    expect(getWallet(restored.kingdom.wallet, 'HeroXp')).toBe(157);
  });

  // …and a save that never banked any is not handed a phantom balance.
  it('gives a hero-less save no XP at all', () => {
    const save = serialize(freshGame(), T0);
    (save.Modules['kingdom.heroes'] as any).Xp = {};
    save.SaveVersion = 32;

    const restored = deserialize(save, map, T0)!;
    expect(getWallet(restored.kingdom.wallet, 'HeroXp')).toBe(0);
  });

  // v23: Knowledge and Stardust swapped jobs. Every Knowledge a live save
  // holds was earned as COLLECTION currency, so it must keep buying relics
  // and heroes — it becomes Stardust. This is the whole point of the migrator
  // and the one thing a bare key rename would have got catastrophically
  // wrong: it would hand the entire research tree to anybody with a balance.
  it('converts a banked Knowledge balance into Stardust, not into research', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    const kingdom = (save.Modules['kingdom.kingdoms'] as any);
    kingdom.Currencies = { ...kingdom.Currencies, Knowledge: 4200 };
    save.SaveVersion = 22;

    const restored = deserialize(save, map, T0)!;
    expect(restored).not.toBeNull();
    // It buys what it was earned for.
    expect(getWallet(restored.kingdom.wallet, 'Stardust')).toBe(4200);
    // And it buys no research at all: the clock starts at zero and is earned
    // back from the ground the player holds. Same purse, different job.
    expect(getWallet(restored.kingdom.wallet, 'Knowledge')).toBe(0);
    expect(restored.kingdom.wallet).not.toHaveProperty('Knowledge');
  });

  // v24: upgrades stopped being a separate kind of thing, and the migrator
  // still turns `UpgradeLevels` into ranks. TapPower left the tree with the
  // one-tree rework (2026-10, no refunds — this is a prototype), so the ranks
  // it makes are dropped by the loader like any card the tree no longer has.
  it('turns banked upgrade levels into ranks, and drops the ranks the tree lost', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    const research = (save.Modules['kingdom.research'] as any);
    research.UpgradeLevels = { TapPower: 3, Resonance: 1 };
    save.SaveVersion = 23;

    const restored = deserialize(save, map, T0)!;
    expect(restored).not.toBeNull();
    expect(restored.research.completed.some((id) => id.startsWith('TapPower'))).toBe(false);
    expect(restored.research.completed.some((id) => id.startsWith('Resonance'))).toBe(false);
    // Nothing the player lost reaches the sim: the tap is worth its base.
    expect(tapWorkSeconds(restored)).toBe(TAP.workSeconds);
  });

  // v25: tomes have cover pages, granted rather than researched. A save from
  // before they existed has none, so every era-1 technology hides behind a
  // requirement nothing will ever complete — the Civics page showed one
  // lonely scroll. Found by loading a real save in the browser.
  // The v25 migrator GRANTED cover pages a pre-tome save never had, so its
  // books would not sit shut behind a card it had no way to hold. It is inert
  // now: tome openness stopped being a technology, so an old save's books are
  // open for the same reason a new one's are — there is nothing to open.
  it('leaves a pre-tome save with every book open and nothing granted', () => {
    const state = freshGame();
    state.research.completed = ['Forestry', 'Warrior'];
    const save = serialize(state, T0);
    save.SaveVersion = 24;
    const restored = deserialize(save, map, T0)!;
    for (const tome of TOME_ORDER) expect(isTomeOpen(restored, tome), tome).toBe(true);
    // Exactly what the save held, and only the one card v70 hands a kingdom
    // that never had the tutorial: Pickaxes, so its mountains still answer.
    expect(restored.research.completed).toEqual(['Forestry', 'Warrior', 'Pickaxes']);
  });

  it('leaves a v23 save alone — the swap runs once, not on every load', () => {
    const state = freshGame();
    state.kingdom.wallet.Stardust = 900;
    state.kingdom.wallet.Knowledge = 40;
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(getWallet(restored.kingdom.wallet, 'Stardust')).toBe(900);
    expect(getWallet(restored.kingdom.wallet, 'Knowledge')).toBe(40);
  });
});

// The Market left the game on 2026-09-09 — the building, its technology and
// the three quests that named it. A save can be holding all three, and every
// one of them would be read against a table that no longer has the row.
// v63: the depths behind the gate are retired (Docs/proposals/lairs.md §7).
// A lair is one fight, so what a save knew about rooms and depths has nothing
// left to mean. v97: the season pass goes, and its board of missions with it.
describe('the depths retired (v63)', () => {
  const v62 = () => {
    const state = freshGame();
    const save = serialize(state, T0);
    const modules = save.Modules as any;
    modules['kingdom.ruins'] = {
      Progress: [{ RuinID: 'HollowBarrow', Depth: 2, Cleared: 3 }],
      Cleared: ['HollowBarrow'],
      DeepestDepth: 2,
    };
    modules['kingdom.kingdoms'].Pass = { Season: 3, Xp: 250, Live: [
      { UniqueID: 'm1', Kind: 'ClearRooms', Meter: 'rooms', Base: 0, Target: 3, Subject: null, Window: 0, Slot: 0 },
      { UniqueID: 'm2', Kind: 'OpenPacks', Meter: 'packs', Base: 0, Target: 2, Subject: null, Window: 0, Slot: 1 },
      { UniqueID: 'm3', Kind: 'CompleteDepths', Meter: 'depths', Base: 0, Target: 1, Subject: null, Window: 0, Slot: 2 },
    ] };
    save.SaveVersion = 62;
    return save;
  };

  it('drops the ruins module, and the season pass with its missions', () => {
    const save = v62();
    expect(migrate(save)).toBe(true);
    const modules = save.Modules as any;
    expect(modules['kingdom.ruins']).toBeUndefined();
    expect(modules['kingdom.kingdoms'].Pass).toBeUndefined();
    const back = deserialize(v62(), map, T0)!;
    expect('ruins' in back).toBe(false);
    expect('pass' in back.kingdom).toBe(false);
  });

  it('writes no season pass any more', () => {
    const save = serialize(freshGame(), T0);
    expect((save.Modules as any)['kingdom.kingdoms'].Pass).toBeUndefined();
  });

  it('writes no ruins module any more', () => {
    const save = serialize(freshGame(), T0);
    expect((save.Modules as any)['kingdom.ruins']).toBeUndefined();
  });
});

// v64: ruins and gates are lairs (Docs/proposals/lairs.md). A rename only:
// the module, its fields and every persisted place id.
describe('ruins and gates become lairs (v64)', () => {
  const OLD_TO_NEW = {
    HollowBarrow: 'Orcs',
    SunkenChapel: 'Harpies',
    DrownedIronworks: 'Goblins',
    CountingHouse: 'WolfRiders',
    StarObservatory: 'Drake',
  } as const;
  const oldIds = Object.keys(OLD_TO_NEW) as Array<keyof typeof OLD_TO_NEW>;

  const v63 = () => {
    const save = serialize(freshGame(), T0);
    const modules = save.Modules as any;
    delete modules['kingdom.lairs'];
    modules['kingdom.gates'] = {
      Gates: oldIds.map((id, i) => ({
        RuinID: id,
        NextRaidAtUtc: i === 4 ? null : new Date(T0 + (i + 1) * 60_000).toISOString(),
        Trips: i % 3,
        Hoard: i === 0 ? {} : { Gold: 10 * i, Wood: i },
        Cleared: i === 4,
      })),
      Reports: [
        { ID: 'raid_1', RuinID: 'HollowBarrow', AtUtc: new Date(T0 - 60_000).toISOString(), Took: { Gold: 7 } },
        { ID: 'raid_2', RuinID: 'CountingHouse', AtUtc: new Date(T0 - 30_000).toISOString(), Took: { Food: 3 } },
      ],
    };
    modules['kingdom.discoveries'].Keys = [
      'resource:Gold', ...oldIds.map((id) => `site:${id}`),
    ];
    save.SaveVersion = 63;
    return save;
  };

  it('renames the module, its fields and every id', () => {
    const save = v63();
    expect(migrate(save)).toBe(true);
    const modules = save.Modules as any;
    expect(modules['kingdom.gates']).toBeUndefined();
    expect(modules['kingdom.lairs'].Lairs.map((g: any) => g.LairID))
      .toEqual(oldIds.map((id) => OLD_TO_NEW[id]));
    expect(modules['kingdom.lairs'].Lairs.some((g: any) => 'RuinID' in g)).toBe(false);
    expect(modules['kingdom.lairs'].Reports.map((r: any) => r.LairID)).toEqual(['Orcs', 'WolfRiders']);
    expect(modules['kingdom.discoveries'].Keys)
      .toEqual(['resource:Gold', ...oldIds.map((id) => `site:${OLD_TO_NEW[id]}`)]);
  });

  it('loads each lair with its state intact under its new id', () => {
    const back = deserialize(v63(), map, T0)!;
    expect(back).not.toBeNull();
    oldIds.forEach((old, i) => {
      const lair = back.lairs[OLD_TO_NEW[old]];
      // Trips and raid reports belonged to the three-raid garrison and are
      // not read any more; a v63 lair has no find time, so it reads 0.
      expect(lair, old).toEqual({
        armedAt: 0,
        nextRaidAt: i === 4 ? null : T0 + (i + 1) * 60_000,
        hoard: i === 0 ? {} : { Gold: 10 * i, Wood: i },
        // Before the claim, a lair was cleared the moment it was beaten.
        defeated: i === 4,
        cleared: i === 4,
      });
    });
    for (const id of Object.values(OLD_TO_NEW)) expect(back.discoveries[`site:${id}`]).toBe(true);
    for (const id of oldIds) expect(back.discoveries[`site:${id}`]).toBeUndefined();
  });

  it('round-trips under the new names', () => {
    const state = deserialize(v63(), map, T0)!;
    const modules = serialize(state, T0).Modules as any;
    expect(modules['kingdom.gates']).toBeUndefined();
    expect(modules['kingdom.lairs'].Lairs.map((g: any) => g.LairID)).toContain('Drake');
    expect(deserialize(serialize(state, T0), map, T0)!.lairs).toEqual(state.lairs);
  });
});

// v61: research takes no time (Docs/features/07-research.md §1). No slots, no
// clock — so a save written mid-research, or with slots bought, has to land
// somewhere the new model can hold.
describe('research without a clock (v61)', () => {
  const v60 = (active: string[], slots: number) => {
    const state = freshGame();
    const save = serialize(state, T0);
    const research = (save.Modules as any)['kingdom.research'];
    research.Completed = ['Forestry'];
    research.Active = active.map((id) => ({ ID: id, StartedAtUtc: new Date(T0).toISOString() }));
    research.SlotsPurchased = slots;
    delete research.Poured;
    save.SaveVersion = 60;
    return { save, gems: getWallet(state.player.wallet, 'Gems') };
  };

  it('completes a research that was running — it had been paid for', () => {
    const { save } = v60(['Agriculture'], 0);
    expect(migrate(save)).toBe(true);
    const research = (save.Modules as any)['kingdom.research'];
    expect(research.Completed).toEqual(['Forestry', 'Agriculture', 'Pickaxes']); // + v70's
    expect(research.Active).toBeUndefined();
    expect(research.SlotsPurchased).toBeUndefined();
    expect(research.Poured).toEqual({});
    const back = deserialize(v60(['Agriculture'], 0).save, map, T0)!;
    expect(isTechComplete(back, 'Agriculture')).toBe(true);
    expect(back.research.poured).toEqual({});
  });

  it('refunds bought slots as Gems on the ladder they were sold on', () => {
    for (const [slots, refund] of [[0, 0], [1, 2500], [2, 7500]] as const) {
      const { save, gems } = v60([], slots);
      const back = deserialize(save, map, T0)!;
      expect(getWallet(back.player.wallet, 'Gems'), `${slots} slots`).toBe(gems + refund);
    }
  });

  it('round-trips what is poured and how much Knowledge Gold has bought', () => {
    const state = freshGame();
    state.research.poured = { Agriculture: 1, TradeRoutesI: 2 };
    state.kingdom.knowledgeBoughtWithGold = 7;
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.research.poured).toEqual({ Agriculture: 1, TradeRoutesI: 2 });
    expect(back.kingdom.knowledgeBoughtWithGold).toBe(7);
  });
});

// The Knowledge drip is production, but the bar bounds it: it is NOT cut at
// the 8h offline cap (Docs/features/07-research.md §3, invariant 2).
describe('the Knowledge drip and the offline cap', () => {
  const awayFor = (hours: number) => {
    const state = freshGame();
    state.kingdom.wallet.Knowledge = 0;
    state.kingdom.lastKnowledgeAt = T0;
    const back = deserialize(serialize(state, T0), map, T0 + hours * 3_600_000)!;
    return getWallet(back.kingdom.wallet, 'Knowledge');
  };

  it('fills the bar over a 12h absence — stopped by the bar, not by 8h', () => {
    expect(awayFor(12)).toBe(10);
  });

  it('pays an hour a point inside the cap', () => {
    expect(awayFor(5)).toBe(5);
  });

  it('pays the 9th hour too, which the cap would have cut', () => {
    expect(awayFor(9)).toBe(9);
  });
});

describe('the Market, retired', () => {
  it('drops a built Market, its queue item and its technologies', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 3, y: 2 });
    const save = serialize(state, T0);
    const city = (save.Modules as any)['kingdom.cities'].Cities[0];
    city.Districts.push({
      UniqueID: 'd_market', DefinitionID: 'Market', VisualVariant: 1,
      AssignedWorkers: 0, Level: 3, GridLocation: { x: 5, y: 5 },
      ConstructionState: 'Built',
    });
    city.Districts.push({
      UniqueID: 'd_market_2', DefinitionID: 'Market', VisualVariant: 1,
      AssignedWorkers: 0, Level: 1, GridLocation: { x: 6, y: 5 },
      ConstructionState: 'UnderConstruction',
    });
    const house = city.Districts.find((d: any) => d.DefinitionID === 'Housing');
    city.QueueItems = [
      { UniqueID: 'q_market', DistrictID: 'd_market_2', DurationSeconds: 30,
        StartedAtUtc: null },
      { UniqueID: 'q_house', DistrictID: house.UniqueID, DurationSeconds: 20,
        StartedAtUtc: null, TargetLevel: 2 },
    ];
    city.QueueKinds = ['build', 'upgrade'];
    const research = (save.Modules as any)['kingdom.research'];
    research.Completed = ['Forestry', 'Market', 'MarketStallII', 'Guildhalls'];
    save.SaveVersion = 41;

    const back = deserialize(save, map, T0)!;
    expect(back.city.districts.map((d) => d.definitionId)).not.toContain('Market');
    expect(back.city.districts.some((d) => d.definitionId === 'Housing')).toBe(true);
    // The queue and its parallel kinds stay in step — one item, still a build.
    expect(back.city.queue).toHaveLength(1);
    expect(back.city.queue[0].uniqueId).toBe('q_house');
    expect(back.city.queue[0].kind).toBe('upgrade');
    expect(back.research.completed).toEqual(['Forestry', 'Pickaxes']); // + v70's
  });
});

// v70: stone is taught (Docs/features/22-progression.md §4).
describe('Pickaxes, taught (v70)', () => {
  const v69 = (index: number, veteran: boolean) => {
    const state = firstGame();
    state.quests.index = index;
    state.tutorial.veteran = veteran;
    const save = serialize(state, T0);
    save.SaveVersion = 69;
    return save;
  };

  it('hands the card to a kingdom past where it is taught, and moves its chain on', () => {
    const back = deserialize(v69(30, false), map, T0)!;
    expect(back.research.completed).toContain('Pickaxes');
    // v69's 30 was the orc fight (v70 made it 32), wherever v72 put it since.
    expect(QUESTS[back.quests.index].id).toBe('DriveThemOut');
  });

  it('leaves a kingdom before it to learn it from the chain', () => {
    const back = deserialize(v69(10, false), map, T0)!;
    expect(back.research.completed).not.toContain('Pickaxes');
    expect(back.quests.index).toBe(10);
  });

  it('hands it to a veteran wherever the chain stands', () => {
    expect(deserialize(v69(5, true), map, T0)!.research.completed).toContain('Pickaxes');
  });
});

// v72: stone is taught where it is first wanted (Docs/features/22-progression.md §4).
describe('Pickaxes, moved to the second story (v72)', () => {
  const v71 = (index: number) => {
    const state = firstGame();
    state.quests.index = index;
    state.quests.progress = 7;
    const save = serialize(state, T0);
    save.SaveVersion = 71;
    return save;
  };
  // v71's chain, as it stood: Picks 27, Rubble 28, Mustered 29 … MoreRoom 39, SecondStory 40.
  it('closes the chain up over the two quests that moved', () => {
    const back = deserialize(v71(29), map, T0)!;
    expect(QUESTS[back.quests.index].id).toBe('Mustered');
    expect(back.quests.progress).toBe(0);
    expect(QUESTS[deserialize(v71(39), map, T0)!.quests.index].id).toBe('MoreRoom');
  });

  it('sends a kingdom on a moved quest on to the one that followed it', () => {
    expect(QUESTS[deserialize(v71(27), map, T0)!.quests.index].id).toBe('Mustered');
    expect(QUESTS[deserialize(v71(28), map, T0)!.quests.index].id).toBe('Mustered');
  });

  it('leaves the chain before and after the move where it was', () => {
    const early = deserialize(v71(10), map, T0)!;
    expect(early.quests.index).toBe(10);
    expect(early.quests.progress).toBe(7);
    expect(QUESTS[deserialize(v71(40), map, T0)!.quests.index].id).toBe('SecondStory');
  });
});

// v73: a lair is found before the army is asked for (Docs/features/12-quests.md §2).
describe('War drums, in front of Armed men (v73)', () => {
  const v72 = (index: number) => {
    const state = firstGame();
    state.quests.index = index;
    state.quests.progress = 3;
    const save = serialize(state, T0);
    save.SaveVersion = 72;
    return save;
  };
  // v72's chain, as it stood: FurtherAfield 25, ArmedMen 26, Mustered 27.
  it('puts a kingdom on Armed men on War drums first', () => {
    const back = deserialize(v72(26), map, T0)!;
    expect(QUESTS[back.quests.index].id).toBe('WarDrums');
    expect(back.quests.progress).toBe(0);
  });

  it('moves a kingdom past it on by one, and leaves one before it alone', () => {
    expect(QUESTS[deserialize(v72(27), map, T0)!.quests.index].id).toBe('Mustered');
    const early = deserialize(v72(25), map, T0)!;
    expect(QUESTS[early.quests.index].id).toBe('FurtherAfield');
    expect(early.quests.progress).toBe(3);
  });
});

// v69: the tree in five books. A researched card that was renamed or split
// keeps what it bought (Docs/features/22-progression.md §9).
describe('the tree in five books (v69)', () => {
  it('turns a renamed card into its successor, and a split one into all its parts', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    const research = (save.Modules as any)['kingdom.research'];
    research.Completed = ['Forestry', 'Taxes01', 'Engineering', 'VigilsI', 'PitonsI'];
    research.Poured = { Reforesting01: 1, DrillmasterII: 2 };
    save.SaveVersion = 68;
    const back = deserialize(save, map, T0)!;
    expect(back.research.completed).toEqual(expect.arrayContaining([
      'Forestry', 'TradeRoutesI', 'Joinery', 'StoneDressing', 'TimberFraming',
    ]));
    // A successor the one-tree rework cut (QuarryHoists, BountiesI, TalesII)
    // is gone, as any card the tree dropped is — and so is a discount.
    for (const gone of ['PitonsI', 'QuarryHoists', 'BountiesI']) {
      expect(back.research.completed).not.toContain(gone);
    }
    expect(back.research.poured).toEqual({ ReforestingI: 1 });
  });
});

// v102: an ascension is a point of a star, not a tier. Tier t was t − 1
// ascensions, so it becomes t − 1 full stars of six points.
describe('v102 turns a hero\'s tier into stars', () => {
  it('maps tier t to t − 1 full stars, and keeps the level', () => {
    const state = freshGame();
    state.heroes.owned.push('Bard', 'Warden');
    state.heroes.levels.Bard = 23;
    const save = serialize(state, T0);
    const heroes = (save.Modules as any)['kingdom.heroes'];
    delete heroes.Ascension;
    heroes.Tiers = { Bard: 3, Warden: 1 };
    save.SaveVersion = 101;
    const back = deserialize(save, map, T0)!;
    expect(back.heroes.ascension).toEqual({ Bard: 12, Warden: 0 });
    // …and v106 then rescales the level to the 310 ladder, held to the cap.
    expect(back.heroes.levels.Bard).toBe(130);
  });
});

describe('v106 rescales a hero\'s level to the 310 ladder', () => {
  it('keeps its share of the climb, held to its ascension\'s new cap', () => {
    const state = freshGame();
    state.heroes.owned.push('Bard', 'Warden', 'Scout');
    const save = serialize(state, T0);
    const heroes = (save.Modules as any)['kingdom.heroes'];
    heroes.Levels = { Bard: 1, Warden: 10, Scout: 50 };
    heroes.Ascension = { Bard: 0, Warden: 6, Scout: 30 };
    save.SaveVersion = 105;
    const back = deserialize(save, map, T0)!;
    // 1 stays 1; 10 → 1 + 9·309/49 = 58 (cap 70); 50 → 310 (cap 310).
    expect(back.heroes.levels).toEqual({ Bard: 1, Warden: 58, Scout: 310 });
  });
});
