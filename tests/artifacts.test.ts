// Relics as passives (Docs/features/09-relics.md §1, §2): a restored relic
// is always on and has no ceiling. How a relic is found and restored is
// tests/relics.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';
import { ARTIFACTS, ARTIFACT_ORDER, HARVEST, HERO_ORDER, HEROES, relicKind } from '../src/sim/data/definitions';
import {
  artifactLevel, grantArtifactLevel, ownedArtifacts, ownsArtifact,
  passiveValueAtLevel, syncArtifactModifiers,
} from '../src/sim/artifacts';
import { armyCap } from '../src/sim/army';
import { effectiveRecoveryMs, effectiveStock } from '../src/sim/harvest';
import {
  effectiveUnitsPerStrike, effectiveWorkerSpeed, effectiveWorkerStrike, workerStrikeMs,
} from '../src/sim/upgrades';
import { resolve, resolveAt } from '../src/sim/modifiers';
import type { ArtifactId, District, GameState } from '../src/sim/state';
import { addBuilt, FOREST, freshGame, map } from './helpers';

/** A cell an aura covers, and one far from it. */
const AT = { x: 1, y: 3 };
const FAR = { x: 15, y: 15 };

/** A Shrine at level 5 (radius 4) beside `AT`, holding `relic`. */
function host(state: GameState, relic: ArtifactId): void {
  state.city.districts.push({
    uniqueId: `shrine_${relic}`, definitionId: 'Shrine', ordinal: 9, level: 5, assignedWorkers: 0,
    location: { x: 0, y: 2 }, state: 'Built', visualVariant: 1, hosts: relic,
  });
}

describe('a relic is a permanent passive with no ceiling', () => {
  let state: GameState;
  beforeEach(() => { state = freshGame(); });

  it('starts with none, and every level is one album closing', () => {
    expect(ownedArtifacts(state)).toEqual([]);
    expect(ownsArtifact(state, 'GildedLedger')).toBe(false);
    expect(grantArtifactLevel(state, 'GildedLedger')).toBe('Granted');
    expect(artifactLevel(state, 'GildedLedger')).toBe(1);
    expect(grantArtifactLevel(state, 'GildedLedger')).toBe('Levelled');
    expect(artifactLevel(state, 'GildedLedger')).toBe(2);
  });

  // A WORLD RELIC'S PASSIVE IS KINGDOM-WIDE until its Chapel exists; a city
  // relic's waits for a Shrine and acts over its aura (sim/hosts.ts).
  it('puts every world relic in the modifier stack, and no city relic', () => {
    for (const id of ARTIFACT_ORDER) grantArtifactLevel(state, id);
    const relicMods = state.modifiers.filter((m) => m.source === 'artifact');
    const world = ARTIFACT_ORDER.filter((id) => relicKind(id) === 'world');
    const stats = world.reduce((n, id) => n + ARTIFACTS[id].passive.stats.length, 0);
    expect(relicMods).toHaveLength(stats);
    expect(relicMods.every((m) => m.expiresAt === null)).toBe(true);
  });

  it('has no cap — the tenth level is as reachable as the second', () => {
    for (let i = 0; i < 10; i++) grantArtifactLevel(state, 'GildedLedger');
    expect(artifactLevel(state, 'GildedLedger')).toBe(10);
    const { base, perLevel } = ARTIFACTS.GildedLedger.passive;
    expect(passiveValueAtLevel('GildedLedger', 10)).toBeCloseTo(base + perLevel * 9, 6);
  });

  it('moves the number it names, at the base stage, inside its Shrine\'s aura', () => {
    grantArtifactLevel(state, 'GildedLedger');
    host(state, 'GildedLedger');
    const before = resolveAt(state, 'taxRate', 1, AT);
    expect(before).toBeGreaterThan(1);
    grantArtifactLevel(state, 'GildedLedger');
    expect(resolveAt(state, 'taxRate', 1, AT)).toBeGreaterThan(before);
    // Outside the aura, nothing.
    expect(resolveAt(state, 'taxRate', 1, FAR)).toBe(1);
  });

  // OQ-97, and the rule the whole shape exists for. Every passive is a SPEED,
  // a yield or a capacity — the call site divides by a speed — so no level can
  // walk one to zero and stop paying. Before this, the Rod and the Seal were
  // time multipliers falling 0.05 a level and both read 0.00 at level 18.
  it('never reaches a level where the next one is worth nothing', () => {
    for (const id of ARTIFACT_ORDER) {
      for (const level of [1, 18, 50, 200]) {
        expect(passiveValueAtLevel(id, level + 1),
          `${id} stopped paying at level ${level}`)
          .toBeGreaterThan(passiveValueAtLevel(id, level));
      }
    }
  });

  // A FLAT passive is legal only on a base the workbook authors and never
  // grows; a rate has to be a multiplier or it goes stale on its own.
  it('is flat only where the base cannot grow', () => {
    const flatIsFine = new Set(['harvestStock', 'harvestUnitsPerStrike']);
    for (const id of ARTIFACT_ORDER) {
      for (const { stat, op } of ARTIFACTS[id].passive.stats) {
        if (op === 'add') expect(flatIsFine.has(stat), `${id} is flat on ${stat}`).toBe(true);
        else expect(ARTIFACTS[id].passive.base).toBeGreaterThan(1);
      }
    }
  });

  // The Rod's number is a SPEED and `effectiveRecoveryMs` divides by it, so it
  // approaches an instant recovery without ever arriving at one.
  it('shortens a wait without ever reaching zero', () => {
    let last = effectiveRecoveryMs(state, HARVEST.Forest, AT);
    grantArtifactLevel(state, 'DowsingRod');
    host(state, 'DowsingRod');
    for (let i = 0; i < 40; i++) {
      if (i > 0) grantArtifactLevel(state, 'DowsingRod');
      const now = effectiveRecoveryMs(state, HARVEST.Forest, AT);
      expect(now).toBeLessThan(last);
      expect(now).toBeGreaterThan(0);
      last = now;
    }
  });

  // ONE NUMBER, TWO CALL SITES. The Seal's `+1` has to reach the thumb and the
  // crew, or half the relic is a sentence on a card.
  it('the Seal pays the thumb and the crew from one number', () => {
    const shed = { location: FOREST, definitionId: 'Sawmill', level: 1 } as District;
    const tap = effectiveUnitsPerStrike(state, HARVEST.Forest, FOREST);
    const crew = effectiveWorkerStrike(state, HARVEST.Forest, shed);
    const held = effectiveStock(state, map, FOREST, HARVEST.Forest);
    grantArtifactLevel(state, 'VerdantSeal');
    host(state, 'VerdantSeal');
    expect(effectiveUnitsPerStrike(state, HARVEST.Forest, FOREST)).toBe(tap + 1);
    expect(effectiveWorkerStrike(state, HARVEST.Forest, shed)).toBe(crew + 1);
    expect(effectiveStock(state, map, FOREST, HARVEST.Forest)).toBe(held + 1);
  });

  // And the Sigil's one number has to reach both halves of a round trip.
  it('the Sigil hurries a crew\u2019s swing and its walk together', () => {
    const shed = { location: AT, definitionId: 'Sawmill', level: 1 } as District;
    const swing = workerStrikeMs(state, HARVEST.Forest, shed);
    const walk = effectiveWorkerSpeed(state, AT);
    grantArtifactLevel(state, 'ForemansSigil');
    host(state, 'ForemansSigil');
    expect(workerStrikeMs(state, HARVEST.Forest, shed)).toBeLessThan(swing);
    expect(effectiveWorkerSpeed(state, AT)).toBeGreaterThan(walk);
  });

  // Idempotent and total, so four callers cannot drift.
  it('rebuilds the stack rather than adding to it', () => {
    grantArtifactLevel(state, 'MusterHorn');
    syncArtifactModifiers(state);
    syncArtifactModifiers(state);
    expect(state.modifiers.filter((m) => m.source === 'artifact'))
      .toHaveLength(ARTIFACTS.MusterHorn.passive.stats.length);
  });
});

// STEP 2 (Docs/features/09-relics.md): the collection needs eight relics
// and the city had five. The three new ones take the dungeon, the war and the
// world map.
describe('the three relics outside the city', () => {
  const NEW = ['DelversLantern', 'MusterHorn', 'BailiffsTally'] as const;
  let state: GameState;
  beforeEach(() => { state = freshGame(); });

  it('brings the roster to eight, each moving its own number', () => {
    expect(ARTIFACT_ORDER).toHaveLength(8);
    const stats = ARTIFACT_ORDER.flatMap((id) => ARTIFACTS[id].passive.stats.map((p) => p.stat));
    expect(new Set(stats).size).toBe(stats.length);
  });

  // The rule the boons enforce in the other direction: the two permanent
  // layers stay legible by staying disjoint.
  it('never moves a number a legendary boon moves', () => {
    const boonStats = new Set(HERO_ORDER
      .map((id) => HEROES[id].boon?.stat)
      .filter((s): s is NonNullable<typeof s> => s !== undefined));
    for (const id of ARTIFACT_ORDER) {
      for (const { stat } of ARTIFACTS[id].passive.stats) {
        expect(boonStats.has(stat), `${id} moves ${stat}, which a boon moves`).toBe(false);
      }
    }
  });

  // THE LANTERN LOST ITS NUMBER. It moved a room's Gold and Stone, and the
  // rooms were retired with the depths: `roomHaul` is still in the stack,
  // and nothing reads it (Docs/open-questions.md OQ-113). Delete this when
  // the Lantern has a new effect.
  it('the Lantern still resolves its stat, which nothing reads any more', () => {
    expect(ARTIFACTS.DelversLantern.passive.stats[0]!.stat).toBe('roomHaul');
    grantArtifactLevel(state, 'DelversLantern');
    expect(resolve(state, 'roomHaul', 1))
      .toBeCloseTo(ARTIFACTS.DelversLantern.passive.base, 6);
  });

  it('the Horn widens what the halls can field', () => {
    addBuilt(state, 'Barracks', { x: 2, y: 0 });
    const before = armyCap(state);
    expect(before).toBeGreaterThan(0);
    grantArtifactLevel(state, 'MusterHorn');
    expect(armyCap(state)).toBe(Math.round(before * ARTIFACTS.MusterHorn.passive.base));
  });

  // THE ONE THAT IS NOT COLLECTED YET, named rather than forgotten. Delete
  // this when the world map's improvements exist.
  it('the Tally waits on the world map, and its card says so', () => {
    expect(ARTIFACTS.BailiffsTally.passive.stats[0]!.stat).toBe('worldImprovementYield');
    const pending = ARTIFACT_ORDER.filter((id) => ARTIFACTS[id].pending !== null);
    expect(pending).toEqual(['BailiffsTally']);
    grantArtifactLevel(state, 'BailiffsTally');
    // In the stack and ready; nothing resolves it yet.
    expect(resolve(state, 'worldImprovementYield', 1))
      .toBeCloseTo(ARTIFACTS.BailiffsTally.passive.base, 6);
  });

  it('levels like any other relic, from zero', () => {
    for (const id of NEW) {
      expect(artifactLevel(state, id)).toBe(0);
      expect(grantArtifactLevel(state, id)).toBe('Granted');
      expect(passiveValueAtLevel(id, 2)).toBeGreaterThan(passiveValueAtLevel(id, 1));
    }
  });
});
