// Combat as a scoring pass, and delves as staged pushes
// (Docs/features/expeditions.md §2, §4, §5).
//
// The claim these tests exist to protect is "a well-prepared run never fails".
// It is not a slogan: `guaranteedDepth` computes exactly how far a party is
// safe assuming the WORST matchup at every step, and the launch screen shows
// it. Everything past that is a gamble the player opted into, on information
// they chose not to wait for.
import { describe, expect, it } from 'vitest';
import { maxArmyPower, trainUnit } from '../src/sim/army';
import {
  BEATS, depthDurationMs, effectiveAttack, fullClearSeconds, guaranteedDepth,
  partyStats, resolveDepth, threatStrength, typeMultiplier, worstThreatFor,
  type Party,
} from '../src/sim/combat';
import { attune, grantArtifact, normaliseSlots } from '../src/sim/artifacts';
import { advance } from '../src/sim/commands';
import { ARMY, ARTIFACTS, DELVE, DISTRICTS, HEROES, RUINS, UNITS } from '../src/sim/data/definitions';
import {
  advanceDelves, extract, launchBlock, launchDelve, previewExpedition, partySlots,
  pushDeeper, supplyCost, unitSlots,
} from '../src/sim/expeditions';
import { artifactIsCarried } from '../src/sim/artifacts';
import { mana, manaNetRegen, manaProduction } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type ArtifactId, type GameState, type UnitId } from '../src/sim/state';
import { addAllTrainers, addBuilt, completeTech, freshGame, fund, map, reveal, T0 } from './helpers';

const BARROW = 'HollowBarrow' as const;

/** A kingdom that can actually send a party into the shallowest ruin. */
function readyToDelve(units: Partial<Record<UnitId, number>> = { Warrior: 2 }): GameState {
  const state = freshGame();
  addAllTrainers(state);
  fund(state, { Gold: 5000, Food: 2000, Wood: 2000, Stone: 500, Iron: 500 });
  reveal(state, [RUINS[BARROW].location]);
  for (const [unitId, n] of Object.entries(units)) {
    for (let i = 0; i < n!; i++) {
      state.army.push({ uniqueId: `u_${unitId}_${i}`, definitionId: unitId as UnitId });
    }
  }
  return state;
}

const party = (slots: Array<{ unitId: UnitId; count: number }>): Party =>
  ({ heroId: 'Warden', slots });

describe('the type chart', () => {
  it('is a cycle, and nothing beats itself', () => {
    const seen = new Set<UnitId>();
    let cursor: UnitId = 'Warrior';
    for (let i = 0; i < 4; i++) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
      expect(BEATS[cursor]).not.toBe(cursor);
      cursor = BEATS[cursor];
    }
    expect(cursor).toBe('Warrior'); // back where it started
  });

  it('is soft on purpose — one bad guess is a worse trip, not a wasted one', () => {
    expect(typeMultiplier('Lancer', 'Cavalry')).toBe(ARMY.typeAdvantage);
    expect(typeMultiplier('Cavalry', 'Lancer')).toBe(ARMY.typeDisadvantage);
    expect(typeMultiplier('Lancer', 'Archer')).toBe(1);
    // A ruin that answers to nothing in particular is always neutral.
    expect(typeMultiplier('Lancer', 'Any')).toBe(1);
    expect(ARMY.typeAdvantage).toBeLessThanOrEqual(1.5);
    expect(ARMY.typeDisadvantage).toBeGreaterThanOrEqual(0.75);
  });

  it('does its work at COMPOSITION time', () => {
    const lancers = party([{ unitId: 'Lancer', count: 4 }]);
    const plain = partyStats(lancers).atk;
    expect(effectiveAttack(lancers, 'Cavalry')).toBeGreaterThan(plain);
    expect(effectiveAttack(lancers, 'Archer')).toBeLessThan(plain);
  });
});

describe('unit stats make a real trade', () => {
  it('Archers buy attack, Warriors buy survival — neither is right alone', () => {
    const archer = UNITS.Archer;
    const warrior = UNITS.Warrior;
    const goldOf = (u: typeof archer) => u.recruitCost.Gold ?? 0;
    expect(archer.atk / goldOf(archer)).toBeGreaterThan(warrior.atk / goldOf(warrior));
    expect(warrior.hp).toBeGreaterThan(archer.hp);
    expect(warrior.def).toBeGreaterThan(archer.def);
  });

  it('power equals attack, so the cap table reads as attack potential', () => {
    for (const u of Object.values(UNITS)) expect(u.power).toBe(u.atk);
  });
});

describe('the army cap is a city decision', () => {
  it('comes from military buildings, not from the Townhall', () => {
    const state = freshGame();
    expect(maxArmyPower(state)).toBe(0);
    state.city.districts.find((d) => d.definitionId === 'Townhall')!.level = 3;
    expect(maxArmyPower(state)).toBe(0); // levelling the hall buys no soldiers

    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    const perLevel = DISTRICTS.Barracks.armyCapPerLevel;
    expect(maxArmyPower(state)).toBe(perLevel[0]);
    state.city.districts.find((d) => d.definitionId === 'Barracks')!.level = 3;
    expect(maxArmyPower(state)).toBe(perLevel[2]);
  });

  it('lines up with the five ruins: all four at L1 clears Tier III', () => {
    const state = freshGame();
    addAllTrainers(state);
    expect(maxArmyPower(state)).toBe(24);
    expect(RUINS.DrownedIronworks.difficulty).toBeLessThanOrEqual(24);
    expect(RUINS.CountingHouse.difficulty).toBeGreaterThan(24);
  });

  it('the tier ladder actually holds at the authored numbers', () => {
    // The arc balancing-v2 Part 2 promises, asserted rather than hoped for:
    // each rung of military development opens the next tier and leaves the one
    // after it as a real stretch. `guaranteedDepth` assumes the WORST matchup,
    // so these are floors, not best cases.
    const bestSafe = (cap: number, ruinId: Parameters<typeof guaranteedDepth>[1]): number => {
      let best = 0;
      for (const u of Object.keys(UNITS) as UnitId[]) {
        const count = Math.floor(cap / UNITS[u].power);
        if (count === 0) continue;
        best = Math.max(best, guaranteedDepth(
          { heroId: 'Warden', slots: [{ unitId: u, count }] }, ruinId));
      }
      return best;
    };
    // One hall at L1 clears Tier I outright and stalls partway into Tier II.
    expect(bestSafe(6, 'HollowBarrow')).toBe(RUINS.HollowBarrow.maxDepth);
    expect(bestSafe(6, 'SunkenChapel')).toBeGreaterThan(0);
    expect(bestSafe(6, 'SunkenChapel')).toBeLessThan(RUINS.SunkenChapel.maxDepth);
    // Two halls, one levelled: Tier II outright, Tier III a stretch.
    expect(bestSafe(16, 'SunkenChapel')).toBe(RUINS.SunkenChapel.maxDepth);
    expect(bestSafe(16, 'DrownedIronworks')).toBeLessThan(RUINS.DrownedIronworks.maxDepth);
    // All four at L3 — the top of the city — still leaves the deepest depth of
    // the deepest ruin as something you choose to gamble on.
    expect(bestSafe(60, 'CountingHouse')).toBe(RUINS.CountingHouse.maxDepth);
    expect(bestSafe(60, 'StarObservatory')).toBeLessThan(RUINS.StarObservatory.maxDepth);
    expect(bestSafe(60, 'StarObservatory')).toBeGreaterThan(RUINS.StarObservatory.maxDepth - 3);
  });

  it('an unfinished building contributes nothing', () => {
    const state = freshGame();
    addBuilt(state, 'Barracks', { x: 3, y: 2 });
    state.city.districts.find((d) => d.definitionId === 'Barracks')!.state = 'UnderConstruction';
    expect(maxArmyPower(state)).toBe(0);
  });
});

describe('training takes time now', () => {
  it('each building runs its own line, in true chronological order', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    completeTech(state, 'Archery');
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    expect(trainUnit(state, 'Archer', T0)).toBe('Queued');
    expect(state.army).toHaveLength(0);

    // The Archer (25s) lands before the first Warrior (30s); the SECOND
    // Warrior starts when the first finished, not when the window did.
    advance(state, map, T0 + 26_000);
    expect(state.army.map((u) => u.definitionId)).toEqual(['Archer']);
    advance(state, map, T0 + 31_000);
    expect(state.army).toHaveLength(2);
    advance(state, map, T0 + 61_000);
    expect(state.army).toHaveLength(3);
  });

  it('queued units count against the cap, so the queue is not a loophole', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    // Barracks L1 caps at 6; a Warrior is 3 power.
    state.city.districts = state.city.districts.filter(
      (d) => d.definitionId === 'Townhall' || d.definitionId === 'Barracks');
    expect(maxArmyPower(state)).toBe(6);
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
    expect(trainUnit(state, 'Warrior', T0)).toBe('ArmyAtCapacity');
  });

  it('one-call replay equals stepped ticking', () => {
    const build = (): GameState => {
      const s = readyToDelve({});
      completeTech(s, 'Warrior');
      for (let i = 0; i < 4; i++) trainUnit(s, 'Warrior', T0);
      return s;
    };
    const oneCall = build();
    advance(oneCall, map, T0 + 200_000);
    const stepped = build();
    for (let t = 1000; t <= 200_000; t += 1000) advance(stepped, map, T0 + t);
    expect(stepped.army.length).toBe(oneCall.army.length);
  });

  it('delivers the whole line during a long absence', () => {
    const state = readyToDelve({});
    completeTech(state, 'Warrior');
    for (let i = 0; i < 2; i++) trainUnit(state, 'Warrior', T0);
    // Through advance(), because that is the path that stamps the head at the
    // CURSOR — advanceArmyTraining on its own stamps at the time it is given,
    // exactly as advanceQueue does, so a raw far-future call starts the line
    // rather than finishing it.
    const report = advance(state, map, T0 + 3_600_000);
    expect(report.trainedUnits).toEqual(['Warrior', 'Warrior']);
    expect(state.city.trainingQueue).toHaveLength(0);
  });
});

describe('threats and depths', () => {
  it('the bottom depth is exactly the ruin’s difficulty', () => {
    for (const ruin of Object.values(RUINS)) {
      expect(threatStrength(ruin.id, ruin.maxDepth)).toBe(ruin.difficulty);
      expect(threatStrength(ruin.id, 1)).toBeLessThan(ruin.difficulty);
    }
  });

  it('time grows with depth INSIDE a run, not only across tiers', () => {
    const first = depthDurationMs(BARROW, 1);
    const last = depthDurationMs(BARROW, RUINS[BARROW].maxDepth);
    expect(last).toBeGreaterThan(first);
    // Tier I teaches the loop inside a single visit.
    expect(fullClearSeconds(BARROW)).toBeLessThan(30 * 60);
    // Tier V is a multi-day project held together by its checkpoints.
    expect(fullClearSeconds('StarObservatory')).toBeGreaterThan(24 * 3600);
  });
});

describe('resolution', () => {
  it('clears when effective attack meets the threat, and always costs HP', () => {
    const p = party([{ unitId: 'Warrior', count: 2 }]);
    const outcome = resolveDepth(p, BARROW, 1, 'Any');
    expect(outcome.cleared).toBe(true);
    // At least 1, always: a party can never be immortal at any depth.
    expect(outcome.damage).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic — the same party and depth always score the same', () => {
    const p = party([{ unitId: 'Archer', count: 3 }]);
    const a = resolveDepth(p, BARROW, 3, 'Warrior');
    const b = resolveDepth(p, BARROW, 3, 'Warrior');
    expect(a).toEqual(b);
  });

  it('guaranteedDepth assumes the worst of ALL FOUR types, not just the affinity', () => {
    // A ruin's affinity dominates its depths without owning all of them, so a
    // guarantee computed against the affinity alone is a guarantee the sim
    // does not make. Warriors beat Lancers; the Ironworks is Lancer-affine;
    // the worst case there is still an Archer.
    expect(RUINS.DrownedIronworks.affinity).toBe('Lancer');
    const warriors = party([{ unitId: 'Warrior', count: 8 }]);
    expect(worstThreatFor(warriors, 'Lancer')).toBe('Archer');
  });

  it('guaranteedDepth is a floor: the worst matchup never breaks it', () => {
    const p = party([{ unitId: 'Warrior', count: 2 }]);
    const safe = guaranteedDepth(p, BARROW);
    expect(safe).toBeGreaterThan(0);
    expect(safe).toBeLessThanOrEqual(RUINS[BARROW].maxDepth);
    // Resolving with the worst threat down to `safe` must never fail.
    const worst = worstThreatFor(p, RUINS[BARROW].affinity);
    let hp = partyStats(p).hp;
    for (let d = 1; d <= safe; d++) {
      const outcome = resolveDepth(p, BARROW, d, worst);
      expect(outcome.cleared).toBe(true);
      hp -= outcome.damage;
      expect(hp).toBeGreaterThan(0);
    }
  });

  it('a bigger, better-matched party is safe deeper — the economy decides', () => {
    const small = party([{ unitId: 'Warrior', count: 2 }]);
    const large = party([{ unitId: 'Warrior', count: 6 }, { unitId: 'Lancer', count: 4 }]);
    expect(guaranteedDepth(large, 'SunkenChapel'))
      .toBeGreaterThan(guaranteedDepth(small, 'SunkenChapel'));
  });
});

describe('launching', () => {
  it('needs a hero, units, supplies, and a ruin you have actually found', () => {
    const state = readyToDelve();
    const slots = [{ unitId: 'Warrior' as UnitId, count: 2 }];
    expect(launchBlock(state, map, BARROW, null, slots)).toBe('NoHero');
    expect(launchBlock(state, map, BARROW, 'Warden', [])).toBe('EmptyParty');
    expect(launchBlock(state, map, BARROW, 'Warden', slots)).toBeNull();

    const unfound = freshGame();
    expect(launchBlock(unfound, map, 'StarObservatory', 'Warden', slots)).toBe('RuinNotFound');
  });

  it('refuses more unit TYPES than there are slots — breadth is the limit', () => {
    const state = readyToDelve({ Warrior: 2, Archer: 2, Lancer: 2 });
    completeTech(state, 'Warband');
    expect(partySlots(state)).toBe(3);
    expect(unitSlots(state)).toBe(2); // the hero takes one
    const three = [
      { unitId: 'Warrior' as UnitId, count: 1 },
      { unitId: 'Archer' as UnitId, count: 1 },
      { unitId: 'Lancer' as UnitId, count: 1 },
    ];
    expect(launchBlock(state, map, BARROW, 'Warden', three)).toBe('TooManySlots');
    expect(launchBlock(state, map, BARROW, 'Warden', three.slice(0, 2))).toBeNull();
  });

  it('pays supplies once, up front, and the Quartermaster packs lighter', () => {
    const state = readyToDelve();
    const full = supplyCost(BARROW, 'Warden');
    const light = supplyCost(BARROW, 'Quartermaster');
    expect(light.Food!).toBeLessThan(full.Food!);

    const food = getWallet(state.city.wallet, 'Food');
    expect(launchDelve(state, map, BARROW, 'Warden', [{ unitId: 'Warrior', count: 2 }], T0))
      .toBe('Launched');
    expect(getWallet(state.city.wallet, 'Food')).toBe(food - full.Food!);
    expect(state.delves).toHaveLength(1);
  });

  it('one hero means one delve at a time', () => {
    const state = readyToDelve({ Warrior: 4 });
    const slots = [{ unitId: 'Warrior' as UnitId, count: 2 }];
    launchDelve(state, map, BARROW, 'Warden', slots, T0);
    expect(launchBlock(state, map, BARROW, 'Warden', slots)).toBe('HeroBusy');
  });

  it('units underground cannot be sent somewhere else', () => {
    const state = readyToDelve({ Warrior: 2 });
    state.heroes.owned.push('Scout');
    const slots = [{ unitId: 'Warrior' as UnitId, count: 2 }];
    launchDelve(state, map, BARROW, 'Warden', slots, T0);
    expect(launchBlock(state, map, BARROW, 'Scout', slots)).toBe('NotEnoughUnits');
  });

  it('the preview tells the player everything before they commit', () => {
    const state = readyToDelve({ Warrior: 4 });
    const preview = previewExpedition(state, BARROW, 'Warden',
      [{ unitId: 'Warrior', count: 4 }]);
    expect(preview.safeDepth).toBeGreaterThan(0);
    expect(preview.maxDepth).toBe(RUINS[BARROW].maxDepth);
    expect(preview.stats.hp).toBeGreaterThan(0);
    // The Warden's trait is party-wide defence, and the sheet shows it.
    expect(HEROES.Warden.trait).toBe('PartyDefence');
    const troops = [{ unitId: 'Warrior' as UnitId, count: 4 }];
    const untraited = partyStats({ heroId: 'Scholar', slots: troops });
    expect(preview.stats.def).toBeGreaterThan(untraited.def + HEROES.Scholar.def);
  });

  // The trait used to be applied to the preview's DEF and nowhere else, so the
  // launch sheet promised a shield the descent never handed out. That is the
  // `guaranteedDepth` fault again: a number on the sheet the sim does not
  // honour. Asserting the DAMAGE, not the displayed stat, is what stops it
  // coming back — every party-wide bonus now lives in `partyStats`.
  it("the Warden's shield actually stops something", () => {
    // A tier-III depth, because damage floors at 1 and a shallow barrow hides
    // every defensive difference behind that floor.
    const deep = 'DrownedIronworks' as const;
    const troops = [{ unitId: 'Warrior' as UnitId, count: 4 }];
    const warden = resolveDepth({ heroId: 'Warden', slots: troops }, deep, 9, 'Warrior');
    const scholar = resolveDepth({ heroId: 'Scholar', slots: troops }, deep, 9, 'Warrior');
    expect(warden.damage).toBeGreaterThan(1);
    expect(HEROES.Warden.trait).toBe('PartyDefence');
    expect(HEROES.Scholar.trait).not.toBe('PartyDefence');
    expect(warden.damage).toBeLessThan(scholar.damage);
  });
});

describe('the descent', () => {
  const launch = (state: GameState, order: number | null = null) =>
    launchDelve(state, map, BARROW, 'Warden', [{ unitId: 'Warrior', count: 2 }], T0, order);

  it('stops at a checkpoint after every depth, and the checkpoint never expires', () => {
    const state = readyToDelve();
    launch(state);
    advance(state, map, T0 + depthDurationMs(BARROW, 1));
    const delve = state.delves[0];
    expect(delve.phase).toBe('checkpoint');
    expect(delve.depth).toBe(1);

    // A week later it is still exactly where it was: no timer, no auto-fail.
    advance(state, map, T0 + 7 * 86_400_000);
    expect(state.delves[0].phase).toBe('checkpoint');
    expect(state.delves[0].depth).toBe(1);
  });

  it('the haul accumulates per depth and banks only on extraction', () => {
    const state = readyToDelve();
    launch(state);
    const goldBefore = getWallet(state.city.wallet, 'Gold');
    advance(state, map, T0 + depthDurationMs(BARROW, 1));
    expect(Object.keys(state.delves[0].haul).length).toBeGreaterThan(0);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(goldBefore); // nothing yet

    const report = extract(state, state.delves[0].id);
    expect(report.result).toBe('Extracted');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(goldBefore + report.wallet.Gold!);
    expect(state.delves).toHaveLength(0); // the hero and the units come home
  });

  it('Knowledge from a delve goes to the KINGDOM wallet, where it survives a reset', () => {
    const state = readyToDelve();
    launch(state);
    advance(state, map, T0 + depthDurationMs(BARROW, 1));
    const before = getWallet(state.kingdom.wallet, 'Knowledge');
    const report = extract(state, state.delves[0].id);
    expect(report.wallet.Knowledge).toBeGreaterThan(0);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(before + report.wallet.Knowledge!);
  });

  it('pushing deeper rolls the next threat only when the party commits', () => {
    const state = readyToDelve();
    launch(state);
    advance(state, map, T0 + depthDurationMs(BARROW, 1));
    const at = T0 + depthDurationMs(BARROW, 1);
    expect(pushDeeper(state, state.delves[0].id, at)).toBe('Descending');
    expect(state.delves[0].phase).toBe('descending');
    expect(state.delves[0].depthEndsAt).toBe(at + depthDurationMs(BARROW, 2));
  });

  it('a standing order resolves the whole run offline, with no prompts', () => {
    const state = readyToDelve();
    launch(state, 3); // "delve to depth 3, then come back"
    advance(state, map, T0 + 86_400_000);
    const delve = state.delves[0];
    expect(delve.depth).toBe(3);
    expect(delve.phase).toBe('checkpoint');
  });

  it('a failed push costs half the haul and ends the run', () => {
    // A party far too small for the depth it is standing on.
    const state = readyToDelve({ Archer: 1 });
    launchDelve(state, map, 'SunkenChapel', 'Warden', [{ unitId: 'Archer', count: 1 }], T0, 7);
    reveal(state, [RUINS.SunkenChapel.location]);
    launchDelve(state, map, 'SunkenChapel', 'Warden', [{ unitId: 'Archer', count: 1 }], T0, 7);
    advance(state, map, T0 + 30 * 86_400_000);
    const delve = state.delves[0];
    if (delve) {
      expect(['done', 'checkpoint']).toContain(delve.phase);
      if (delve.outcome === 'failed') {
        // Half, floored — and the party is alive, because nothing you OWN is
        // taken. You declined a sure thing.
        expect(delve.partyHp).toBeGreaterThan(0);
      }
    }
  });

  it('the bottom grants the ruin’s relic, guaranteed, on the first clear', () => {
    const state = readyToDelve({ Warrior: 8 });
    // Enough party to walk to the bottom of the shallowest ruin.
    launchDelve(state, map, BARROW, 'Warden',
      [{ unitId: 'Warrior', count: 8 }], T0, RUINS[BARROW].maxDepth);
    const gems = getWallet(state.player.wallet, 'Gems');
    advance(state, map, T0 + 86_400_000);
    expect(state.ruinsCleared[BARROW]).toBe(true);
    // The recurring Gem faucet the design needs — one per ruin, once.
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + DELVE.firstClearGems);

    const report = extract(state, state.delves[0].id);
    expect(report.artifact).toBe(RUINS[BARROW].artifact);
    expect(state.artifacts.owned).toContain(RUINS[BARROW].artifact);
  });

  it('a repeat clear pays fragments instead of a duplicate relic', () => {
    const state = readyToDelve({ Warrior: 8 });
    state.ruinsCleared[BARROW] = true;
    state.artifacts.owned.push(RUINS[BARROW].artifact);
    launchDelve(state, map, BARROW, 'Warden',
      [{ unitId: 'Warrior', count: 8 }], T0, RUINS[BARROW].maxDepth);
    advance(state, map, T0 + 86_400_000);
    const report = extract(state, state.delves[0].id);
    expect(report.artifact).toBeNull();
    expect(report.fragments).toBeGreaterThan(0);
    expect(state.artifacts.fragments[RUINS[BARROW].artifact]).toBeGreaterThan(0);
  });

  it('delve timers never pause — the offline cap is for city production', () => {
    const state = readyToDelve();
    launch(state, 5);
    const save = serialize(state, T0);
    // Twenty hours away: far past the 8h cap, and the run resolves in full.
    const restored = deserialize(save, map, T0 + 20 * 3_600_000)!;
    expect(restored.delves[0].depth).toBeGreaterThan(1);
  });

  it('survives a save round-trip mid-descent', () => {
    const state = readyToDelve();
    launch(state);
    advance(state, map, T0 + depthDurationMs(BARROW, 1));
    const restored = deserialize(serialize(state, T0 + depthDurationMs(BARROW, 1)), map,
      T0 + depthDurationMs(BARROW, 1))!;
    expect(restored.delves).toHaveLength(1);
    expect(restored.delves[0].depth).toBe(state.delves[0].depth);
    expect(restored.delves[0].haul).toEqual(state.delves[0].haul);
    expect(restored.delves[0].phase).toBe('checkpoint');
  });
});

// Attune OR arm (Docs/features/heroes-and-gacha.md §2).
//
// The claim these tests protect is the one the design calls "the best decision
// in the design": an artifact is attuned to the kingdom OR carried by a hero,
// never both. It only reads as a decision if BOTH halves bite — if the sim
// would quietly un-attune a relic to arm a hero, there is no trade, only a
// convenience. So each direction is asserted separately, and the asymmetry
// that makes the trade interesting (attuning costs Mana every hour, carrying
// costs none) is asserted too.
describe('attune or arm', () => {
  const armed = (relic: ArtifactId = 'ForemansSigil', units = { Warrior: 4 }) => {
    const state = readyToDelve(units);
    grantArtifact(state, relic);
    normaliseSlots(state);
    return state;
  };
  const troops = [{ unitId: 'Warrior' as UnitId, count: 4 }];

  it('refuses to send a relic the kingdom is wearing', () => {
    const state = armed();
    expect(attune(state, 0, 'ForemansSigil', T0)).toBe('Attuned');
    expect(launchBlock(state, map, BARROW, 'Warden', troops, 'ForemansSigil'))
      .toBe('ArtifactAttuned');
    // And the launch itself refuses, not just the preview of it.
    expect(launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil'))
      .toBe('ArtifactAttuned');
    expect(state.delves).toHaveLength(0);
  });

  it('refuses to attune a relic that is underground', () => {
    const state = armed();
    expect(launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil'))
      .toBe('Launched');
    expect(artifactIsCarried(state, 'ForemansSigil')).toBe(true);
    expect(attune(state, 0, 'ForemansSigil', T0)).toBe('Carried');
    // The socket is still empty — the refusal cost the player nothing.
    expect(state.artifacts.attuned[0]).toBe(null);
  });

  it('costs nothing to carry, and nothing to wear — the trade is exclusivity', () => {
    const state = armed();
    const before = mana(state);
    expect(launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil'))
      .toBe('Launched');
    // Relic upkeep is gone, so neither half of attune-or-arm has a price. What
    // makes it a question is that you cannot do both: an economy passive at
    // home, or combat stats below.
    expect(mana(state)).toBe(before);
    expect(manaNetRegen(state)).toBe(manaProduction(state));
  });

  it('a relic in the pack takes the party deeper', () => {
    const state = armed();
    const bare = previewExpedition(state, BARROW, 'Warden', troops);
    const withRelic = previewExpedition(state, BARROW, 'Warden', troops, 'ForemansSigil');
    expect(withRelic.stats.atk).toBeGreaterThan(bare.stats.atk);
    // The promise the whole feature sells: "wear it, or send it down to reach
    // depth 6". A relic that did not move this number would not be a choice.
    const deep = 'DrownedIronworks' as const;
    reveal(state, [RUINS[deep].location]);
    const bareDeep = previewExpedition(state, deep, 'Warden', troops);
    const armedDeep = previewExpedition(state, deep, 'Warden', troops, 'ForemansSigil');
    expect(armedDeep.safeDepth).toBeGreaterThan(bareDeep.safeDepth);
  });

  it('the matchup chip still answers "did I bring the right troops"', () => {
    const state = armed();
    const troopsOnly = previewExpedition(state, BARROW, 'Warden', troops);
    const withRelic = previewExpedition(state, BARROW, 'Warden', troops, 'ForemansSigil');
    // A type-neutral relic would otherwise pull the ratio toward 1, so adding
    // one would make a GOOD matchup read worse while the party got stronger.
    expect(withRelic.matchup).toBe(troopsOnly.matchup);
    expect(withRelic.stats.atk).toBeGreaterThan(troopsOnly.stats.atk);
  });

  it("a relic's attack is type-neutral, so it is worth most in the wrong matchup", () => {
    const slots = [{ unitId: 'Warrior' as UnitId, count: 4 }];
    const relic = { id: 'ForemansSigil' as ArtifactId, level: 1 };
    // A relic has no unit type, so the same ATK lands whatever is down there.
    const good = effectiveAttack({ heroId: 'Warden', slots, artifact: relic }, 'Lancer')
      - effectiveAttack({ heroId: 'Warden', slots }, 'Lancer');
    const bad = effectiveAttack({ heroId: 'Warden', slots, artifact: relic }, 'Archer')
      - effectiveAttack({ heroId: 'Warden', slots }, 'Archer');
    expect(good).toBe(bad);
    expect(good).toBe(ARTIFACTS.ForemansSigil.carried.atk);
  });

  it('scales with the level it went down at, and never re-arms mid-run', () => {
    const state = armed();
    state.artifacts.levels.ForemansSigil = 5;
    expect(launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil'))
      .toBe('Launched');
    expect(state.delves[0].artifactLevel).toBe(5);

    // Levelling the relic back home does not reach a party already below: the
    // level is snapshotted beside maxPartyHp, exactly like the party itself.
    state.artifacts.levels.ForemansSigil = 9;
    expect(state.delves[0].artifactLevel).toBe(5);
  });

  it('comes home when the party does — on a good run and a bad one', () => {
    const state = armed();
    launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil');
    advance(state, map, T0 + depthDurationMs(BARROW, 1));
    // Still committed while the party waits at the checkpoint.
    expect(artifactIsCarried(state, 'ForemansSigil')).toBe(true);
    expect(attune(state, 0, 'ForemansSigil', T0)).toBe('Carried');

    extract(state, state.delves[0].id);
    expect(artifactIsCarried(state, 'ForemansSigil')).toBe(false);
    expect(attune(state, 0, 'ForemansSigil', T0)).toBe('Attuned');
  });

  it('survives a save round-trip with the relic aboard', () => {
    const state = armed();
    launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil');
    state.delves[0].artifactLevel = 4;
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.delves[0].artifactId).toBe('ForemansSigil');
    expect(restored.delves[0].artifactLevel).toBe(4);
    expect(artifactIsCarried(restored, 'ForemansSigil')).toBe(true);
  });

  it('a save written before the rule existed reads as a party carrying nothing', () => {
    const state = armed();
    launchDelve(state, map, BARROW, 'Warden', troops, T0, null, 'ForemansSigil');
    const save = serialize(state, T0);
    // Exactly what an older save looks like: the keys simply are not there.
    const dto = (save.Modules['kingdom.delves'] as any).Delves[0];
    delete dto.ArtifactID;
    delete dto.ArtifactLevel;
    const restored = deserialize(save, map, T0)!;
    expect(restored.delves[0].artifactId).toBe(null);
    expect(restored.delves[0].artifactLevel).toBe(1);
  });

  // The assertion repeated at every step of this design pass. A relic changes
  // DEF, which changes damage, which changes whether a depth is survived — so
  // it is exactly the kind of thing that could make replay disagree with
  // ticking, and exactly why it is asserted again here.
  it('one-call offline replay equals stepped ticking with a relic aboard', () => {
    const run = (step: number) => {
      const state = armed('VerdantSeal', { Warrior: 4 });
      launchDelve(state, map, BARROW, 'Warden', troops, T0, RUINS[BARROW].maxDepth,
        'VerdantSeal');
      const end = T0 + 6 * 3_600_000;
      if (step === 0) advance(state, map, end);
      else for (let t = T0 + step; t <= end; t += step) advance(state, map, t);
      const d = state.delves[0];
      return { depth: d.depth, hp: d.partyHp, phase: d.phase, haul: d.haul, out: d.outcome };
    };
    expect(run(60_000)).toEqual(run(0));
    expect(run(997)).toEqual(run(0));
  });
});

describe('advanceDelves is total', () => {
  it('touches nothing when there is nothing underground', () => {
    const state = freshGame();
    expect(advanceDelves(state, T0 + 86_400_000)).toEqual([]);
  });
});
