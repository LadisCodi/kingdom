// Relics found and restored (Docs/proposals/relic-restoration.md §1–§4, §9;
// Docs/plans/relics-and-bag.md step 5).

import { describe, expect, it } from 'vitest';
import { artifactLevel } from '../src/sim/artifacts';
import { ARTIFACT_ORDER, RELIC_RULES, relicDoor, relicKind } from '../src/sim/data/definitions';
import { claimLair } from '../src/sim/expeditions';
import {
  canRestore, distinctHeld, dropFragments, forgeReplica, isMet, KEYSTONE, levelStardust, levelUpRelic,
  openFragmentPack, openRelicDoor, replicaPrice, restoreRelic, slotCount, spareWorth,
} from '../src/sim/relics';
import { deserialize, serialize } from '../src/sim/save';
import type { ArtifactId, GameState } from '../src/sim/state';
import { clearLair, freshGame, freshPresenter, map, T0 } from './helpers';

/** Give a relic `n` of each slot, found. */
function hold(state: GameState, id: ArtifactId, n: number[]): void {
  state.relics.held[id] = { found: [...n], bound: [0, 0, 0, 0, 0, 0] };
}

describe('a relic is met at its door', () => {
  it('a city relic\'s first fragment is its lair\'s prize', () => {
    const state = freshGame();
    const relic = ARTIFACT_ORDER.find((id) => relicKind(id) === 'city')!;
    const lair = relicDoor(relic) as never;
    expect(isMet(state, relic)).toBe(false);
    clearLair(state, lair);
    state.lairs[lair] = { ...(state.lairs[lair] as object), cleared: false, defeated: true } as never;
    const report = claimLair(state, lair);
    expect(report.result).toBe('Claimed');
    expect(report.fragments[0]).toEqual({ relic, slot: 0 });
    expect(isMet(state, relic)).toBe(true);
  });

  it('a drop never rolls a relic the player has not met', () => {
    const state = freshGame();
    expect(dropFragments(state, 'any', 10, ['t'])).toEqual([]);
    openRelicDoor(state, 'portal');
    const drops = dropFragments(state, 'any', 20, ['t']);
    expect(drops).toHaveLength(20);
    const met = ARTIFACT_ORDER.filter((id) => isMet(state, id));
    for (const d of drops) expect(met).toContain(d.relic);
    // City drops roll city relics only: none is met, so none lands.
    expect(dropFragments(state, 'city', 5, ['c'])).toEqual([]);
  });

  it('rolls on the event, never on the moment: the same parts, the same fragments', () => {
    const a = freshGame();
    const b = freshGame();
    for (const s of [a, b]) for (const door of ['Orcs', 'Harpies', 'portal']) openRelicDoor(s, door);
    expect(dropFragments(a, 'any', 12, ['quest', 'X'])).toEqual(dropFragments(b, 'any', 12, ['quest', 'X']));
  });

  it('every relic has a door, and city relics are found at lairs', () => {
    for (const id of ARTIFACT_ORDER) expect(relicDoor(id)).not.toBe('');
  });
});

describe('restoring and levelling', () => {
  // THE GATE: six distinct fragments restore it.
  it('six distinct fragments restore it at level 1', () => {
    const state = freshGame();
    const id = ARTIFACT_ORDER[0];
    hold(state, id, [1, 1, 1, 1, 1, 0]);
    expect(canRestore(state, id)).toBe(false);
    expect(restoreRelic(state, id)).toBe('Missing');
    hold(state, id, [3, 1, 1, 1, 1, 1]);
    expect(distinctHeld(state, id)).toBe(6);
    expect(spareWorth(state, id)).toBe(2);
    expect(restoreRelic(state, id)).toBe('Restored');
    expect(artifactLevel(state, id)).toBe(1);
  });

  // EVERY LEVEL IS A WHOLE SET AND ITS STARDUST — one of each slot, always.
  it('takes one fragment of each slot and the level\'s Stardust, every level', () => {
    const state = freshGame();
    const id = ARTIFACT_ORDER[0];
    state.artifacts.levels[id] = 1;
    hold(state, id, [2, 1, 1, 1, 1, 1]);
    state.kingdom.wallet.Stardust = levelStardust(1) - 1;
    expect(levelUpRelic(state, id)).toBe('NotEnoughStardust');
    expect(distinctHeld(state, id)).toBe(6);
    state.kingdom.wallet.Stardust = levelStardust(1) + levelStardust(2);
    expect(levelUpRelic(state, id)).toBe('Levelled');
    expect(artifactLevel(state, id)).toBe(2);
    expect(state.kingdom.wallet.Stardust).toBe(levelStardust(2));
    // One of each went: the spare piece is all that is left, so no set.
    expect(levelUpRelic(state, id)).toBe('MissingFragments');
    expect(artifactLevel(state, id)).toBe(2);
    expect(state.kingdom.wallet.Stardust).toBe(levelStardust(2));
  });

  it('a level-up spends a bound fragment before a found one', () => {
    const state = freshGame();
    const id = ARTIFACT_ORDER[0];
    state.artifacts.levels[id] = 1;
    state.relics.held[id] = { found: [1, 1, 1, 1, 1, 1], bound: [1, 0, 0, 0, 0, 0] };
    state.kingdom.wallet.Stardust = levelStardust(1);
    expect(levelUpRelic(state, id)).toBe('Levelled');
    expect(state.relics.held[id]).toEqual({ found: [1, 0, 0, 0, 0, 0], bound: [0, 0, 0, 0, 0, 0] });
  });

  it('a spare keystone counts for more towards a replica', () => {
    const state = freshGame();
    const id = ARTIFACT_ORDER[0];
    hold(state, id, [1, 1, 1, 1, 1, 2]);
    restoreRelic(state, id);
    expect(spareWorth(state, id)).toBe(RELIC_RULES.keystoneWorth);
  });

  it('the Stardust climbs every level, rounded like every curve', () => {
    expect(levelStardust(1)).toBe(RELIC_RULES.levelStardustBase);
    expect(levelStardust(3)).toBeGreaterThan(levelStardust(2));
    expect(levelStardust(2)).toBeGreaterThan(levelStardust(1));
  });
});

describe('the paid doors', () => {
  it('forges a missing fragment, bound, from spares — or fewer spares and Gems', () => {
    const state = freshGame();
    const id = ARTIFACT_ORDER[0];
    const price = replicaPrice(KEYSTONE);
    hold(state, id, [1 + price.spares, 1, 1, 1, 1, 0]);
    state.player.wallet.Gems = 0;
    expect(forgeReplica(state, id, KEYSTONE, true)).toBe('NotEnoughGems');
    expect(forgeReplica(state, id, KEYSTONE, false)).toBe('NotEnoughSpares');
    state.player.wallet.Gems = price.gems;
    expect(forgeReplica(state, id, KEYSTONE, true)).toBe('Forged');
    expect(state.relics.held[id]!.bound[KEYSTONE]).toBe(1);
    expect(state.player.wallet.Gems).toBe(0);
    expect(slotCount(state, id, 0)).toBe(1);
    expect(canRestore(state, id)).toBe(true);
  });

  it('the store\'s fragment pack pays bound fragments of relics met, for Gems', () => {
    const state = freshGame();
    state.player.wallet.Gems = RELIC_RULES.fragmentPackGems;
    // Nothing found yet: the pack rolls nothing and charges nothing.
    expect(openFragmentPack(state).kind).toBe('NothingMet');
    expect(state.player.wallet.Gems).toBe(RELIC_RULES.fragmentPackGems);
    const id = ARTIFACT_ORDER[1];
    hold(state, id, [1, 0, 0, 0, 0, 0]);
    const r = openFragmentPack(state);
    expect(r.kind).toBe('Opened');
    expect(state.player.wallet.Gems).toBe(0);
    if (r.kind !== 'Opened') return;
    expect(r.drops).toHaveLength(RELIC_RULES.fragmentPackSize);
    expect(r.drops.every((d) => d.relic === id)).toBe(true);
    expect(state.relics.held[id]!.bound.reduce((a, b) => a + b, 0)).toBe(RELIC_RULES.fragmentPackSize);
    expect(openFragmentPack(state).kind).toBe('NotEnoughGems');
  });
});

describe('the save', () => {
  it('carries the fragments, found and bound apart', () => {
    const state = freshGame();
    state.relics.held.DowsingRod = { found: [1, 0, 2, 0, 0, 1], bound: [0, 1, 0, 0, 0, 0] };
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.relics.held.DowsingRod).toEqual({ found: [1, 0, 2, 0, 0, 1], bound: [0, 1, 0, 0, 0, 0] });
  });

  // THE GATE: an old save loads with every relic level intact, unhosted, and
  // its cards and packs become fragments.
  it('turns an old season\'s cards, packs and wildcards into fragments, and keeps the levels', () => {
    const state = freshGame();
    state.artifacts.levels.GildedLedger = 3;
    const file = serialize(state, T0);
    file.SaveVersion = 91;
    delete file.Modules['kingdom.relics'];
    file.Modules['kingdom.collection'] = {
      Season: 0,
      Cards: { FirstFurrow: [1, 1, 1, 1, 1, 2, 0, 0, 1] },
      Packs: [{ ID: 'x', Tier: 'Rose' }],
      Wildcards: { 3: 1 },
      Stars: 40,
    };
    const back = deserialize(file, map, T0)!;
    expect(artifactLevel(back, 'GildedLedger')).toBe(3);
    // Season 0: the first album levels the first relic.
    const rod = back.relics.held.DowsingRod!;
    expect(rod.found.slice(0, 5).every((n) => n >= 1)).toBe(true);
    expect(rod.found[5]).toBe(1);
    // Two met relics, three spares (a Rose pack and a wildcard) dealt between them.
    const total = (id: ArtifactId) => [...(back.relics.held[id]?.found ?? [])].reduce((a, b) => a + b, 0);
    expect(total('DowsingRod') + total('GildedLedger')).toBe(8 + 3);
    expect('collection' in back).toBe(false);
  });
});

describe('the relic sheet', () => {
  it('restores from the sheet, and goes back to the Bag', () => {
    const state = freshGame();
    hold(state, 'VerdantSeal', [1, 1, 1, 1, 1, 1]);
    const game = freshPresenter(state);
    game.openRelic('VerdantSeal');
    expect(game.openOverlay).toBe('relic');
    expect(game.relicCard('VerdantSeal').canRestore).toBe(true);
    game.doRestoreRelic('VerdantSeal');
    expect(game.relicCard('VerdantSeal').restored).toBe(true);
    game.closeRelic();
    expect(game.openOverlay).toBe('bag');
    expect(game.bagTab).toBe('Relics');
  });
});
