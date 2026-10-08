// Troop evolutions (Docs/features/combat.md §6, §9.4, §11): a unit at five
// ranks, each a troop of its own — authored whole, gated by its technology
// and its hall's level, trained one rank to a line — and the generator that
// evolves an enemy once its board is full, then grows its villains.
import { describe, expect, it } from 'vitest';
import { armyRoster, rankGate, trainBatch, trainCost } from '../src/sim/army';
import { buildBoard, generateEnemy, scaleFighter, villainFighter } from '../src/sim/battle';
import {
  COMBAT, DISTRICTS, RANKS, TECHNOLOGIES, TROOPS, TROOP_ORDER, UNITS, UNIT_ORDER, VILLAIN_ORDER,
  isTroopId, rankOf, troopId, troopsOf, unitOf,
} from '../src/sim/data/definitions';
import balance from '../src/sim/data/balance';
import { deserialize, serialize } from '../src/sim/save';
import type { GameState, TroopId } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, freshPresenter, fund, map, T0 } from './helpers';

/** A city with a Barracks at `level`, Warriors researched, and a deep purse. */
function barracks(level: number): { state: GameState; hall: GameState['city']['districts'][number] } {
  const state = freshGame();
  addBuilt(state, 'Barracks', { x: 4, y: 4 });
  const hall = state.city.districts.find((d) => d.definitionId === 'Barracks')!;
  hall.level = level;
  completeTech(state, UNITS.Warrior.requiredTech!);
  for (let i = 0; i < 4; i++) addBuilt(state, 'Housing', { x: 2 + i * 2, y: 0 });
  fund(state, { Gold: 10_000_000, Food: 1_000_000, Wood: 1_000_000, Stone: 1_000_000 });
  return { state, hall };
}

const techFor = (troop: TroopId) => TROOPS[troop].requiredTech!;

describe('the troops', () => {
  it('are every unit at five ranks, rank I keeping the unit\'s own id', () => {
    expect(TROOP_ORDER).toHaveLength(UNIT_ORDER.length * RANKS.length);
    for (const unit of UNIT_ORDER) {
      expect(troopsOf(unit)).toEqual(RANKS.map((r) => troopId(unit, r)));
      expect(troopId(unit, 1)).toBe(unit);
      for (const t of troopsOf(unit)) {
        expect(unitOf(t)).toBe(unit);
        expect(isTroopId(t)).toBe(true);
      }
    }
    expect(rankOf('Archer_e4')).toBe(4);
    expect(isTroopId('Archer_e6')).toBe(false);
    expect(isTroopId('Dragon')).toBe(false);
  });

  it('read every rank\'s numbers off its own authored row, and the rest off the unit', () => {
    for (const unit of UNIT_ORDER) {
      const rows = (balance.units[unit] as { evolutions: Array<Record<string, unknown>> }).evolutions;
      rows.forEach((row, i) => {
        const t = TROOPS[troopId(unit, (i + 2) as 2 | 3 | 4 | 5)];
        for (const k of ['atk', 'dmg', 'def', 'hp', 'power', 'trainDurationSeconds', 'minBuildingLevel']) {
          expect(t[k as keyof typeof t], `${t.id}.${k}`).toBe(row[k]);
        }
        expect(t.recruitCost).toEqual(row.recruitCost);
        expect(t.squadSize).toBe(UNITS[unit].squadSize);
        expect(t.frontage).toBe(UNITS[unit].frontage);
        expect(t.cooldown).toBe(UNITS[unit].cooldown);
        expect(t.tags).toEqual(UNITS[unit].tags);
      });
    }
  });

  it('climb every rank: stronger, dearer, and behind a higher hall', () => {
    for (const unit of UNIT_ORDER) {
      const [lo, ...rest] = troopsOf(unit).map((t) => TROOPS[t]);
      let prev = lo!;
      for (const t of rest) {
        for (const k of ['atk', 'dmg', 'def', 'hp', 'power', 'minBuildingLevel'] as const) {
          expect(t[k], `${t.id}.${k}`).toBeGreaterThan(prev[k]);
        }
        expect(t.recruitCost.Gold!).toBeGreaterThan(prev.recruitCost.Gold!);
        prev = t;
      }
    }
  });

  it('are each opened by one technology of their own, in the tree', () => {
    for (const t of TROOP_ORDER.filter((x) => rankOf(x) > 1)) {
      const tech = TROOPS[t].requiredTech;
      expect(tech, t).not.toBeNull();
      expect(TECHNOLOGIES[tech!].unlocks).toContainEqual({ evolution: { unit: unitOf(t), rank: rankOf(t) } });
    }
  });
});

describe('training a rank', () => {
  it('needs the rank\'s technology', () => {
    const { state, hall } = barracks(10);
    expect(rankGate(state, 'Warrior_e2', hall)).toBe('TechRequired');
    expect(trainBatch(state, 'Warrior_e2', 1, T0, hall)).toBe('TechRequired');
    completeTech(state, techFor('Warrior_e2'));
    expect(trainBatch(state, 'Warrior_e2', 1, T0, hall)).toBe('Queued');
  });

  it('needs the hall at the rank\'s level', () => {
    const { state, hall } = barracks(TROOPS.Warrior_e3.minBuildingLevel - 1);
    completeTech(state, techFor('Warrior_e3'));
    expect(trainBatch(state, 'Warrior_e3', 1, T0, hall)).toBe('HallLevel');
    hall.level += 1;
    expect(trainBatch(state, 'Warrior_e3', 1, T0, hall)).toBe('Queued');
  });

  it('charges the rank\'s own price', () => {
    const { state, hall } = barracks(10);
    completeTech(state, techFor('Warrior_e5'));
    const gold = state.city.wallet.Gold!;
    expect(trainBatch(state, 'Warrior_e5', 2, T0, hall)).toBe('Queued');
    expect(gold - state.city.wallet.Gold!).toBe(2 * trainCost(state, 'Warrior_e5').Gold!);
    expect(trainCost(state, 'Warrior_e5').Gold).toBeGreaterThan(trainCost(state, 'Warrior').Gold!);
  });

  it('keeps one rank in a hall\'s line: another waits for the batch', () => {
    const { state, hall } = barracks(10);
    completeTech(state, techFor('Warrior_e2'));
    expect(trainBatch(state, 'Warrior', 3, T0, hall)).toBe('Queued');
    expect(trainBatch(state, 'Warrior_e2', 1, T0, hall)).toBe('OtherRank');
    expect(trainBatch(state, 'Warrior', 1, T0, hall)).toBe('Queued');
  });

  it('delivers the rank it was paid for, and keeps it apart in the roster', () => {
    const { state, hall } = barracks(10);
    completeTech(state, techFor('Warrior_e2'));
    trainBatch(state, 'Warrior_e2', 2, T0, hall);
    state.army.push({ uniqueId: 'w1', definitionId: 'Warrior' });
    state.city.trainingQueue.length = 0;
    state.army.push({ uniqueId: 'e1', definitionId: 'Warrior_e2' });
    const roster = armyRoster(state);
    expect(roster.Warrior).toBe(1);
    expect(roster.Warrior_e2).toBe(1);
  });
});

describe('a rank in a fight', () => {
  it('hits with its rank\'s numbers and fights as its unit', () => {
    const board = buildBoard([{ unitId: 'Lancer_e4', count: 10 }], []);
    const slot = board.slots[0]!;
    expect(slot.type).toBe('Lancer');
    expect(slot.unitId).toBe('Lancer_e4');
    expect(slot.atk).toBe(TROOPS.Lancer_e4.atk);
    expect(slot.dmg).toBe(TROOPS.Lancer_e4.dmg);
    expect(slot.hpUnit).toBe(TROOPS.Lancer_e4.hp);
    expect(slot.power).toBe(TROOPS.Lancer_e4.power);
  });

  it('takes the passive of a hero of its unit', () => {
    const villain = villainFighter(VILLAIN_ORDER.find((v) => villainFighter(v).type === 'Warrior')
      ?? VILLAIN_ORDER[0]!);
    const buff = { ...villain, type: 'Warrior' as const, troopDmgMult: 2 };
    const plain = buildBoard([{ unitId: 'Warrior_e3', count: 5 }], []).slots[0]!;
    const led = buildBoard([{ unitId: 'Warrior_e3', count: 5 }], [buff]).slots[0]!;
    expect(led.dmg).toBe(plain.dmg * 2);
  });
});

describe('the generator', () => {
  it('fields rank I while the board can hold the budget', () => {
    for (const budget of [60, 400, 1000, 1500]) {
      const plan = generateEnemy({ seed: 3, parts: ['evo', budget], budget, affinity: 'Warrior' });
      for (const s of plan.squads) expect(rankOf(s.unitId), `budget ${budget}`).toBe(1);
    }
  });

  it('evolves a full board, in two neighbouring ranks, the lair\'s own creature first', () => {
    const plan = generateEnemy({ seed: 3, parts: ['evo'], budget: 6_000, affinity: 'Lancer' });
    expect(plan.squads).toHaveLength(COMBAT.genSlotsMax);
    const ranks = plan.squads.map((s) => rankOf(s.unitId));
    expect(Math.max(...ranks) - Math.min(...ranks)).toBeLessThanOrEqual(1);
    expect(Math.max(...ranks)).toBeGreaterThan(1);
    expect(unitOf(plan.squads[0]!.unitId)).toBe('Lancer');
    expect(rankOf(plan.squads[0]!.unitId)).toBe(Math.max(...ranks));
    for (const s of plan.squads) expect(s.count).toBeLessThanOrEqual(TROOPS[s.unitId].squadSize);
  });

  it('climbs with the budget: a deeper room never fields a lower top rank', () => {
    let top = 1;
    for (let budget = 1_000; budget <= 14_000; budget += 1_000) {
      const plan = generateEnemy({ seed: 9, parts: ['climb'], budget, affinity: 'Any' });
      const now = Math.max(...plan.squads.map((s) => rankOf(s.unitId)));
      expect(now, `budget ${budget}`).toBeGreaterThanOrEqual(top);
      top = now;
    }
    expect(top).toBe(5);
  });

  it('grows its villains with what a board of rank V cannot hold', () => {
    const pool = VILLAIN_ORDER;
    const plan = generateEnemy({ seed: 4, parts: ['deep'], budget: 60_000, affinity: 'Any', villainPool: pool });
    for (const s of plan.squads) expect(rankOf(s.unitId)).toBe(5);
    expect(plan.fighters.length).toBeGreaterThan(0);
    for (const f of plan.fighters) expect(f.power).toBeGreaterThan(villainFighter(f.id as never).power);
    const spent = buildBoard(plan.squads, plan.fighters).slots.reduce((n, s) => n + s.power * s.count, 0);
    expect(spent).toBeGreaterThan(60_000 * 0.9);
  });

  it('scales a villain on the troops\' ladder', () => {
    const base = villainFighter(VILLAIN_ORDER[0]!);
    const big = scaleFighter(base, base.power * 1.56); // ×2.56: one ×1.6 step and a bit
    expect(big.hp).toBe(Math.round(base.hp * 2.56));
    expect(big.atk).toBe(base.atk + 2 * 2);
    expect(big.cooldown).toBe(base.cooldown);
    expect(scaleFighter(base, 0)).toBe(base);
  });
});

describe('the hall\'s pick', () => {
  it('shows the best rank open, and a newly opened rank takes over a pick', () => {
    const { state, hall } = barracks(10);
    const game = freshPresenter(state);
    expect(game.traineeAt(hall)).toBe('Warrior');
    completeTech(state, techFor('Warrior_e2'));
    expect(game.traineeAt(hall)).toBe('Warrior_e2');
    game.pickRank(hall, 'Warrior');
    expect(game.traineeAt(hall)).toBe('Warrior');
    completeTech(state, techFor('Warrior_e3'));
    expect(game.traineeAt(hall)).toBe('Warrior_e3');
  });

  it('refuses a rank still shut', () => {
    const { state, hall } = barracks(2);
    const game = freshPresenter(state);
    completeTech(state, techFor('Warrior_e2'));
    game.pickRank(hall, 'Warrior_e2');
    expect(game.traineeAt(hall)).toBe('Warrior');
    expect(DISTRICTS[hall.definitionId].trains).toEqual(['Warrior']);
  });
});

describe('the save', () => {
  it('keeps every rank: the army, the wounded and the line', () => {
    const { state, hall } = barracks(10);
    completeTech(state, techFor('Cavalry_e5'));
    state.army.push({ uniqueId: 'c5', definitionId: 'Cavalry_e5' }, { uniqueId: 'w1', definitionId: 'Warrior' });
    state.city.wounded.Archer_e3 = 4;
    completeTech(state, techFor('Warrior_e4'));
    trainBatch(state, 'Warrior_e4', 2, T0, hall);
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.army.map((u) => u.definitionId).sort()).toEqual(['Cavalry_e5', 'Warrior']);
    expect(back.city.wounded.Archer_e3).toBe(4);
    expect(back.city.trainingQueue.map((i) => i.trainee)).toEqual(['Warrior_e4', 'Warrior_e4']);
  });

  it('drops a troop it does not know rather than carrying it', () => {
    const state = freshGame();
    state.army.push({ uniqueId: 'x', definitionId: 'Warrior_e9' as TroopId });
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.army).toHaveLength(0);
  });
});
