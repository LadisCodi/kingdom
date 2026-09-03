// Artifacts, attunement and the four actives (Docs/features/08-magic.md §2, §3).
//
// The load-bearing rule is that a passive is only worth a SLOT if wearing it
// costs you the alternative. Everything here is really testing one shape:
// attuning changes the world immediately, un-attuning takes it back, and the
// five-minute lock stops a player borrowing an ability without paying for the
// socket.
import { describe, expect, it } from 'vitest';
import {
  artifactEntry, artifactIsCarried, artifactIsCommitted, attune, attunementSlots,
  attunementSlotGemCost, buyAttunementSlot, grantArtifact, isAttuned, isSlotLocked,
  levelUpArtifact, normaliseSlots, ownsArtifact, passiveValue, raiseArtifactTier,
  slotUnlocksIn, syncArtifactModifiers,
} from '../src/sim/artifacts';
import { cast, castBlock, validCastCells } from '../src/sim/casting';
import { levelCapForTier, levelCost, tierCost, totalLevelCost } from '../src/sim/collection';
import { advance } from '../src/sim/commands';
import { ARTIFACTS, ATTUNEMENT, COLLECTION, HARVEST, RUINS } from '../src/sim/data/definitions';
import { fogState, revealCostForCell } from '../src/sim/fog';
import { drawFromCell } from '../src/sim/harvest';
import { addMana, mana } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import { effectiveTaxRate, effectiveWorkerStrike } from '../src/sim/upgrades';
import { coordKey, getWallet, type GameState } from '../src/sim/state';
import { addBuilt, completeTech, FOREST, freshGame, fund, map, reveal, T0 } from './helpers';

const withRelic = (id: Parameters<typeof grantArtifact>[1] = 'GildedLedger'): GameState => {
  const state = freshGame();
  grantArtifact(state, id);
  normaliseSlots(state);
  return state;
};

describe('owning relics', () => {
  it('a first find is the relic; a second is fragments, never a dead drop', () => {
    const state = freshGame();
    expect(grantArtifact(state, 'DowsingRod')).toBe('Granted');
    expect(ownsArtifact(state, 'DowsingRod')).toBe(true);
    expect(artifactEntry(state, 'DowsingRod')).toEqual({ level: 1, tier: 1, fragments: 0 });

    expect(grantArtifact(state, 'DowsingRod', 12)).toBe('Duplicate');
    expect(artifactEntry(state, 'DowsingRod').fragments).toBe(12);
  });

  it('every ruin holds exactly one, and no two hold the same', () => {
    const granted = Object.values(RUINS).map((r) => r.artifact);
    expect(new Set(granted).size).toBe(granted.length);
    for (const [id, def] of Object.entries(ARTIFACTS)) {
      expect(RUINS[def.source].artifact).toBe(id);
    }
  });
});

describe('the collection substrate', () => {
  it('Knowledge buys levels; Fragments raise the ceiling they run into', () => {
    const state = withRelic('DowsingRod');
    state.kingdom.wallet.Knowledge = 100_000;

    // Tier 1 allows two levels, then Knowledge has nowhere to go.
    expect(levelUpArtifact(state, 'DowsingRod')).toBe('Levelled');
    expect(artifactEntry(state, 'DowsingRod').level).toBe(2);
    expect(levelCapForTier(1)).toBe(COLLECTION.levelsPerTier);
    expect(levelUpArtifact(state, 'DowsingRod')).toBe('TierCapped');

    // Fragments open the next two.
    expect(raiseArtifactTier(state, 'DowsingRod')).toBe('NotEnoughFragments');
    state.artifacts.fragments.DowsingRod = tierCost(1);
    expect(raiseArtifactTier(state, 'DowsingRod')).toBe('Raised');
    expect(levelUpArtifact(state, 'DowsingRod')).toBe('Levelled');
  });

  it('charges the authored curve, and the runway is the documented one', () => {
    const state = withRelic('DowsingRod');
    state.kingdom.wallet.Knowledge = 1000;
    levelUpArtifact(state, 'DowsingRod');
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(1000 - levelCost(1));
    // ~3,630 Knowledge to max one collectible (Docs/features/10-heroes.md §3).
    expect(totalLevelCost()).toBeGreaterThan(3400);
    expect(totalLevelCost()).toBeLessThan(3900);
  });

  it('refuses to level a relic that has not been found', () => {
    const state = freshGame();
    state.kingdom.wallet.Knowledge = 10_000;
    expect(levelUpArtifact(state, 'DowsingRod')).toBe('NotOwned');
  });
});

describe('attunement', () => {
  it('starts at one socket, research adds one, Gems add the rest', () => {
    const state = freshGame();
    expect(attunementSlots(state)).toBe(ATTUNEMENT.baseSlots);
    completeTech(state, 'Attunement');
    expect(attunementSlots(state)).toBe(ATTUNEMENT.baseSlots + 1);

    state.player.wallet.Gems = 10_000;
    const cost = attunementSlotGemCost(state);
    expect(buyAttunementSlot(state)).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(10_000 - cost);
    expect(attunementSlots(state)).toBe(ATTUNEMENT.baseSlots + 2);
    // Escalating, so breadth stays a real purchase rather than a formality.
    expect(attunementSlotGemCost(state)).toBeGreaterThan(cost);
  });

  it('applies the passive at once and takes it back on removal', () => {
    const state = withRelic('GildedLedger'); // tax rate ×1.2
    const base = effectiveTaxRate(state);
    expect(attune(state, 0, 'GildedLedger', T0)).toBe('Attuned');
    expect(effectiveTaxRate(state)).toBeCloseTo(base * 1.2, 6);

    // The lock has to pass before it can come off again.
    expect(attune(state, 0, null, T0)).toBe('SlotLocked');
    const after = T0 + ATTUNEMENT.swapLockSeconds * 1000;
    expect(attune(state, 0, null, after)).toBe('Unattuned');
    expect(effectiveTaxRate(state)).toBe(base);
  });

  it('locks the socket for exactly the authored time', () => {
    const state = withRelic();
    attune(state, 0, 'GildedLedger', T0);
    expect(isSlotLocked(state, 0, T0)).toBe(true);
    expect(slotUnlocksIn(state, 0, T0)).toBe(ATTUNEMENT.swapLockSeconds);
    const half = T0 + (ATTUNEMENT.swapLockSeconds * 1000) / 2;
    expect(slotUnlocksIn(state, 0, half)).toBe(ATTUNEMENT.swapLockSeconds / 2);
    expect(isSlotLocked(state, 0, T0 + ATTUNEMENT.swapLockSeconds * 1000)).toBe(false);
  });

  it('will not wear the same relic in two sockets', () => {
    const state = withRelic();
    completeTech(state, 'Attunement');
    normaliseSlots(state);
    expect(attune(state, 0, 'GildedLedger', T0)).toBe('Attuned');
    expect(attune(state, 1, 'GildedLedger', T0)).toBe('AlreadyAttuned');
  });

  it('refuses a socket that does not exist, and a relic not owned', () => {
    const state = withRelic();
    expect(attune(state, 3, 'GildedLedger', T0)).toBe('NoSuchSlot');
    expect(attune(state, 0, 'DowsingRod', T0)).toBe('NotOwned');
  });

  it('the passive scales with level, and levelling re-applies it live', () => {
    const state = withRelic('ForemansSigil'); // worker yield +1, +0.2/level
    state.kingdom.wallet.Knowledge = 100_000;
    attune(state, 0, 'ForemansSigil', T0);
    const atLevel1 = effectiveWorkerStrike(state, HARVEST.Forest);
    expect(passiveValue(state, 'ForemansSigil')).toBe(ARTIFACTS.ForemansSigil.passive.base);

    levelUpArtifact(state, 'ForemansSigil');
    expect(passiveValue(state, 'ForemansSigil'))
      .toBeCloseTo(ARTIFACTS.ForemansSigil.passive.base + ARTIFACTS.ForemansSigil.passive.perLevel, 6);
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBeGreaterThanOrEqual(atLevel1);
  });

  it('the modifier rebuild is idempotent — running it twice changes nothing', () => {
    const state = withRelic();
    attune(state, 0, 'GildedLedger', T0);
    const once = JSON.stringify(state.modifiers);
    syncArtifactModifiers(state);
    syncArtifactModifiers(state);
    expect(JSON.stringify(state.modifiers)).toBe(once);
  });
});

describe('the actives', () => {
  it('need the relic to be WORN — an ability without a socket would be free', () => {
    const state = withRelic('DowsingRod');
    addMana(state, 100);
    expect(castBlock(state, 'DowsingRod')).toBe('NotAttuned');
    attune(state, 0, 'DowsingRod', T0);
    expect(castBlock(state, 'DowsingRod')).toBeNull();
  });

  it('the Gilded Ledger has no ability at all, deliberately', () => {
    expect(ARTIFACTS.GildedLedger.active).toBeNull();
    const state = withRelic('GildedLedger');
    attune(state, 0, 'GildedLedger', T0);
    expect(castBlock(state, 'GildedLedger')).toBe('NoActive');
  });

  it('Divination pays a frontier cell off outright, at the same price anywhere', () => {
    const state = withRelic('DowsingRod');
    addMana(state, 100);
    attune(state, 0, 'DowsingRod', T0);

    const targets = validCastCells(state, map, 'DowsingRod');
    expect(targets.length).toBeGreaterThan(0);
    // The near frontier and a distant one cost the SAME Mana while the Gold
    // curve doubles every ring — which is the whole argument for the relic.
    const cell = targets[0];
    const gold = revealCostForCell(state, map, cell);
    const before = mana(state);
    const report = cast(state, map, 'DowsingRod', cell, T0);
    expect(report.result).toBe('Cast');
    expect(report.goldSaved).toBe(gold);
    expect(fogState(state, map, cell)).toBe('Revealed');
    expect(mana(state)).toBe(before - ARTIFACTS.DowsingRod.active!.manaCost);
  });

  it('Bloom clears exhaustion outright inside its radius', () => {
    const state = withRelic('VerdantSeal');
    addMana(state, 100);
    attune(state, 0, 'VerdantSeal', T0);

    // Exhaust a forest the player can see. No Trees cell is inside the
    // opening reveal any more, so clear one first.
    reveal(state, [FOREST]);
    const forest = FOREST;
    drawFromCell(state, forest, HARVEST.Forest, HARVEST.Forest.stock, T0);
    expect(state.harvest[coordKey(forest)].exhaustedUntil).not.toBeNull();

    const report = cast(state, map, 'VerdantSeal', forest, T0);
    expect(report.result).toBe('Cast');
    expect(state.harvest[coordKey(forest)].exhaustedUntil).toBeNull();
    expect(state.harvest[coordKey(forest)].units).toBe(HARVEST.Forest.stock);
  });

  it('Haste is a TIMED modifier that the boundary loop retires on schedule', () => {
    const state = withRelic('ForemansSigil');
    addMana(state, 100);
    attune(state, 0, 'ForemansSigil', T0);
    const duration = ARTIFACTS.ForemansSigil.active!.durationSeconds * 1000;

    const base = effectiveWorkerStrike(state, HARVEST.Forest);
    expect(cast(state, map, 'ForemansSigil', null, T0).result).toBe('Cast');
    advance(state, map, T0 + 1000);
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBe(base * 2);

    const report = advance(state, map, T0 + duration + 1000);
    expect(report.expiredModifiers.some((m) => m.stat === 'workerYield')).toBe(true);
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBe(base);
  });

  it('refuses a target that is not on its own legal list', () => {
    const state = withRelic('DowsingRod');
    addMana(state, 100);
    attune(state, 0, 'DowsingRod', T0);
    // A cell already revealed has no reveal cost left to pay.
    const revealed = map.cells.find((c) => state.fog.revealed[coordKey(c)])!;
    expect(cast(state, map, 'DowsingRod', revealed, T0).result).toBe('InvalidTarget');
  });

  it('charges nothing when the cast is refused', () => {
    const state = withRelic('DowsingRod');
    // A new kingdom starts with a FULL pool now, so this has to be SET rather
    // than added to: the point is being short of what Divination costs.
    state.city.wallet.Mana = 3;
    attune(state, 0, 'DowsingRod', T0);
    const before = mana(state);
    expect(cast(state, map, 'DowsingRod', null, T0).result).toBe('NotEnoughMana');
    expect(mana(state)).toBe(before);
  });
});

describe('persistence', () => {
  it('round-trips the whole collection, and re-derives the passives', () => {
    const state = withRelic('GildedLedger');
    completeTech(state, 'Attunement');
    normaliseSlots(state);
    state.artifacts.levels.GildedLedger = 3;
    state.artifacts.tiers.GildedLedger = 2;
    state.artifacts.fragments.GildedLedger = 7;
    attune(state, 0, 'GildedLedger', T0);

    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.artifacts.owned).toEqual(['GildedLedger']);
    expect(artifactEntry(restored, 'GildedLedger')).toEqual({ level: 3, tier: 2, fragments: 7 });
    expect(isAttuned(restored, 'GildedLedger')).toBe(true);
    expect(effectiveTaxRate(restored)).toBeCloseTo(effectiveTaxRate(state), 6);
    expect(isSlotLocked(restored, 0, T0)).toBe(true);
  });

  it('a save written before a socket was earned loads with the socket', () => {
    const state = withRelic();
    const save = serialize(state, T0);
    // The research lands between the save being written and it being read.
    state.research.completed.push('Attunement');
    const restored = deserialize(save, map, T0)!;
    restored.research.completed.push('Attunement');
    normaliseSlots(restored);
    expect(restored.artifacts.attuned).toHaveLength(2);
    expect(restored.artifacts.lockedUntil).toHaveLength(2);
  });
});

describe('the fog discount reaches both the bar and the charge', () => {
  it('a worn Dowsing Rod cuts what a reveal tap actually costs', () => {
    const state = withRelic('DowsingRod');
    fund(state, { Gold: 10_000 });
    addBuilt(state, 'Housing', { x: 3, y: 2 });
    reveal(state, []);
    const frontier = map.cells.find((c) => fogState(state, map, c) === 'Discovered')!;
    const full = revealCostForCell(state, map, frontier);
    attune(state, 0, 'DowsingRod', T0);
    expect(revealCostForCell(state, map, frontier)).toBeLessThanOrEqual(full);
  });
});

// The socket half of attune-or-arm (Docs/features/10-heroes.md §2).
// The delve half lives in expeditions.test.ts; what matters HERE is that the
// Reliquary cannot take back a relic the sim has already committed, and that
// a carried relic draws no upkeep — the asymmetry the whole trade rests on.
describe('a relic cannot be worn and carried at once', () => {
  it('a relic underground is committed, and the socket says so', () => {
    const state = withRelic('DowsingRod');
    expect(artifactIsCarried(state, 'DowsingRod')).toBe(false);
    expect(artifactIsCommitted(state, 'DowsingRod')).toBe(false);

    // Standing in for a launch: what the sim records is a delve holding it.
    state.delves.push({
      id: 'd1', ruinId: 'HollowBarrow', heroId: 'Warden',
      artifactId: 'DowsingRod', artifactLevel: 1,
      party: [{ unitId: 'Warrior', count: 1 }], depth: 0, partyHp: 10, maxPartyHp: 10,
      haul: {}, haulFragments: 0, phase: 'descending', depthEndsAt: T0 + 1000,
      standingOrder: null, threat: 'Any', outcome: null,
    });
    expect(artifactIsCarried(state, 'DowsingRod')).toBe(true);
    expect(artifactIsCommitted(state, 'DowsingRod')).toBe(true);
    expect(attune(state, 0, 'DowsingRod', T0)).toBe('Carried');
    // Refused, so the socket is untouched AND unlocked — a refusal must never
    // cost the player the five minutes a real swap costs.
    expect(state.artifacts.attuned[0]).toBe(null);
    expect(isSlotLocked(state, 0, T0)).toBe(false);
  });

  it('an attuned relic still un-attunes normally — the rule only blocks the way in', () => {
    const state = withRelic('DowsingRod');
    expect(attune(state, 0, 'DowsingRod', T0)).toBe('Attuned');
    expect(artifactIsCommitted(state, 'DowsingRod')).toBe(true);
    const after = T0 + ATTUNEMENT.swapLockSeconds * 1000;
    expect(attune(state, 0, null, after)).toBe('Unattuned');
    expect(artifactIsCommitted(state, 'DowsingRod')).toBe(false);
  });
});
