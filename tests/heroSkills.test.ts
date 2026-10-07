// HERO SKILLS (Docs/features/10-heroes.md §2.5, combat.md §9.3): one skill a
// hero or villain, acting in the fights it is in, ranked up with Stardust and
// a precious material once the level allows.
import { describe, expect, it } from 'vitest';
import {
  buildBoard, poolsAfter, resolveBattle, survivorsOf, type BattleEvent, type FighterSpec,
} from '../src/sim/battle';
import { HEROES, HERO_LADDER, HERO_ORDER, LANDMARKS, VILLAINS } from '../src/sim/data/definitions';
import {
  buySkillRank, skillRank, skillRankBlock, skillRankPrice,
} from '../src/sim/heroes';
import { SKILLS, maxSkillRank, rankValue, skillSentence, slotSkill } from '../src/sim/skills';
import { serialize, deserialize } from '../src/sim/save';
import { attackLair, claimLair } from '../src/sim/expeditions';
import { addToWallet, getWallet, type HeroId, type UnitId } from '../src/sim/state';
import { addAllTrainers, freshGame, fund, map, reveal, T0, toLastFight } from './helpers';
import { LAIRS } from '../src/sim/data/definitions';

const body = (over: Partial<FighterSpec> = {}): FighterSpec => ({
  id: 'test', name: 'Test', type: 'Warrior', atk: 2, dmg: 40, def: 2, hp: 600, cooldown: 12, power: 0,
  troopDmgMult: 1, troopHpMult: 1, troopDefBonus: 0, ...over,
});

const kinds = (events: readonly BattleEvent[], kind: BattleEvent['kind']) =>
  events.filter((e) => e.kind === kind);

describe('the roster', () => {
  it('gives every hero and every villain a skill, and no skill twice within a rarity', () => {
    for (const rarity of ['Common', 'Rare', 'Legendary'] as const) {
      const skills = HERO_ORDER.filter((id) => HEROES[id].rarity === rarity).map((id) => HEROES[id].skill.id);
      expect(new Set(skills).size, rarity).toBe(skills.length);
    }
    for (const v of Object.values(VILLAINS)) {
      expect(SKILLS[v.skill.id].kind, v.id).not.toBe('spoils');
    }
  });

  it('reads every skill as a sentence', () => {
    for (const id of HERO_ORDER) {
      expect(skillSentence(HEROES[id].skill), id).toMatch(/\w/);
    }
  });
});

describe('a skill in the fight', () => {
  const fight = (ours: FighterSpec[], foe = buildBoard([{ unitId: 'Warrior', count: 40 }], [])) =>
    resolveBattle(buildBoard([{ unitId: 'Warrior', count: 30 }], ours), foe);

  it('strikes on its own clock, beside the fighter\'s own swing', () => {
    const log = fight([body({ skill: slotSkill({ id: 'Volley', value: 50, every: 2 }) })]);
    const fired = kinds(log.events, 'skill');
    expect(fired.length).toBeGreaterThan(1);
    const strikes = log.events.filter((e) => e.kind === 'attack' && e.skill === 'Volley');
    expect(strikes.length).toBeGreaterThan(0);
  });

  it('heals the most wounded ally, and the heal is what survives', () => {
    const log = fight([body({ skill: slotSkill({ id: 'Mend', value: 20, every: 1 }) })]);
    const healed = kinds(log.events, 'healed');
    expect(healed.length).toBeGreaterThan(0);
    // Survivors read the heals: a troop brought back up is a troop alive.
    const last = healed[healed.length - 1] as Extract<BattleEvent, { kind: 'healed' }>;
    if (last.at.side === 'ours') expect(survivorsOf(log, 'ours').has(last.at.id)).toBe(true);
    expect(poolsAfter(log, 'ours').size).toBeGreaterThan(0);
  });

  it('shields, and a shield soaks before health', () => {
    const log = fight([body({ skill: slotSkill({ id: 'Shield', value: 50, every: 1 }) })]);
    expect(kinds(log.events, 'shielded').length).toBeGreaterThan(0);
    expect(log.events.some((e) => e.kind === 'attack' && (e.absorbed ?? 0) > 0)).toBe(true);
  });

  it('dazes the hardest-hitting enemy', () => {
    const log = fight([body({ skill: slotSkill({ id: 'Daze', value: 2, every: 2 }) })]);
    const dazed = kinds(log.events, 'dazed') as Array<Extract<BattleEvent, { kind: 'dazed' }>>;
    expect(dazed.length).toBeGreaterThan(0);
    expect(dazed[0]!.ticks).toBe(20);
  });

  it('rallies every squad of every type from the start, and names it', () => {
    const squads = [{ unitId: 'Archer' as UnitId, count: 10 }];
    const plain = buildBoard(squads, [body()]);
    const rallied = buildBoard(squads, [body({ skill: slotSkill({ id: 'WarCry', value: 20, every: 0 }) })]);
    expect(rallied.slots[0]!.dmg).toBeGreaterThan(plain.slots[0]!.dmg);
    const log = resolveBattle(rallied, buildBoard([{ unitId: 'Warrior', count: 5 }], []));
    expect(log.events.find((e) => e.kind === 'skill')).toMatchObject({ tick: 0, skill: 'WarCry' });
  });

  it('is deterministic: the same boards are the same fight', () => {
    const ours = buildBoard([{ unitId: 'Lancer', count: 20 }],
      [body({ skill: slotSkill({ id: 'Wave', value: 5, every: 3 }) })]);
    const theirs = buildBoard([{ unitId: 'Cavalry', count: 18 }], [body({ id: 'BarrowThane', skill: slotSkill(VILLAINS.BarrowThane.skill) })]);
    expect(resolveBattle(ours, theirs)).toEqual(resolveBattle(ours, theirs));
  });
});

describe('the ranks', () => {
  const HERO: HeroId = 'Cleric';
  const owned = () => {
    const state = freshGame();
    state.heroes.owned.push(HERO);
    return state;
  };

  it('start at one, and each adds a step of the first rank\'s value', () => {
    const skill = HEROES[HERO].skill;
    expect(rankValue(skill, 1)).toBe(skill.value);
    expect(rankValue(skill, maxSkillRank())).toBeCloseTo(skill.value * (1 + HERO_LADDER.skillRankStep * (maxSkillRank() - 1)));
  });

  it('unlock at a level and are bought — never raised on their own', () => {
    const state = owned();
    addToWallet(state.kingdom.wallet, 'Stardust', 10_000);
    expect(skillRankBlock(state, HERO)).toBe('LevelTooLow');
    state.heroes.levels[HERO] = HERO_LADDER.skillRankLevels[0]!;
    expect(skillRank(state, HERO)).toBe(1);
    expect(buySkillRank(state, HERO)).toBe('Ranked');
    expect(skillRank(state, HERO)).toBe(2);
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(10_000 - HERO_LADDER.skillRankStardust[0]!);
  });

  it('ask for Stardust alone while the world is shut, and the family\'s material once it is open', () => {
    const state = owned();
    state.heroes.levels[HERO] = HERO_LADDER.skillRankLevels[0]!;
    expect(skillRankPrice(state, HERO)!.goods).toEqual({});
    const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;
    state.landmarks.claimed[tower.id] = true;
    const material = SKILLS[HEROES[HERO].skill.id].material;
    expect(skillRankPrice(state, HERO)!.goods).toEqual({ [material]: HERO_LADDER.skillRankMaterial[0] });
    addToWallet(state.kingdom.wallet, 'Stardust', 10_000);
    expect(skillRankBlock(state, HERO)).toBe('NotEnoughMaterial');
  });

  it('survive a save', () => {
    const state = owned();
    state.heroes.skillRanks[HERO] = 3;
    const back = deserialize(JSON.parse(JSON.stringify(serialize(state, T0))), map, T0)!;
    expect(back.heroes.skillRanks[HERO]).toBe(3);
  });
});

describe('the spoils', () => {
  it('Seasoned teaches more Hero XP, paid when the lair is claimed', () => {
    const run = (heroes: HeroId[]) => {
      const state = freshGame();
      addAllTrainers(state);
      fund(state, { Gold: 5000, Food: 2000, Wood: 2000, Stone: 500 });
      reveal(state, [LAIRS.Orcs.location]);
      state.lairs.Orcs = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: false, cleared: false };
      toLastFight(state, 'Orcs');
      for (let i = 0; i < 60; i++) state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
      state.heroes.owned.push(...heroes);
      expect(attackLair(state, map, 'Orcs', heroes, [{ unitId: 'Warrior', count: 60 }]).result).toBe('Cleared');
      return claimLair(state, 'Orcs').heroXp;
    };
    const plain = run(['Warden']);
    const seasoned = run(['Adventurer']);
    expect(HEROES.Adventurer.skill.id).toBe('Seasoned');
    expect(seasoned).toBe(Math.round(plain * (1 + HEROES.Adventurer.skill.value / 100)));
  });
});
