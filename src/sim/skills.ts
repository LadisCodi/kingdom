// SKILLS (Docs/features/10-heroes.md §2.5, combat.md §9.3).
//
// A hero's or a villain's one skill: what it does in the fights it is in.
// Five kinds of code, sixteen skills of data. This file says what each skill
// IS — its kind, its family's material, its unit, its sentence — and turns an
// authored skill at a rank into the integers the resolver reads. The firing
// itself is the resolver's (`battle.ts`), because it is the fight.
//
// INTEGERS ON THE BOARD. A board slot carries its skill already resolved:
// percentages as per-mille, times as ticks, so the fight stays bit-exact
// (combat.md §16) whatever a rank's multiplier does to a value.

import { COMBAT, HERO_LADDER, type SkillDef, type SkillId } from './data/definitions';
import type { PreciousId } from './state';

export type SkillKind = 'strike' | 'heal' | 'shield' | 'daze' | 'rally' | 'spoils';

interface SkillInfo {
  name: string;
  kind: SkillKind;
  /** The precious material its ranks ask for: the family's. */
  material: PreciousId;
}

const STRIKE = { kind: 'strike', material: 'Starmetal' } as const;
const CARE = { material: 'Moonglass' } as const;
const SPIRIT = { material: 'Heartwood' } as const;

export const SKILLS: Record<SkillId, SkillInfo> = {
  Sharpshot: { name: 'Sharpshot', ...STRIKE },
  Crush: { name: 'Crush', ...STRIKE },
  Cleave: { name: 'Cleave', ...STRIKE },
  Ambush: { name: 'Ambush', ...STRIKE },
  Volley: { name: 'Volley', ...STRIKE },
  Mend: { name: 'Mend', kind: 'heal', ...CARE },
  Wave: { name: 'Healing wave', kind: 'heal', ...CARE },
  Shield: { name: 'Shield', kind: 'shield', ...CARE },
  Daze: { name: 'Daze', kind: 'daze', ...SPIRIT },
  WarCry: { name: 'War cry', kind: 'rally', ...SPIRIT },
  Bulwark: { name: 'Bulwark', kind: 'rally', ...SPIRIT },
  Vigour: { name: 'Vigour', kind: 'rally', ...SPIRIT },
  Plunder: { name: 'Plunder', kind: 'spoils', ...SPIRIT },
  Lore: { name: 'Lore', kind: 'spoils', ...SPIRIT },
  Seasoned: { name: 'Seasoned', kind: 'spoils', ...SPIRIT },
  FieldMedic: { name: 'Field medic', kind: 'spoils', ...SPIRIT },
};

/** The ranks a skill has: the first, and one per unlock level. */
export const maxSkillRank = (): number => 1 + HERO_LADDER.skillRankLevels.length;

/** A skill's X at a rank: each rank past the first adds `skillRankStep` of
 *  the rank-1 value. */
export const rankValue = (skill: SkillDef, rank: number): number =>
  skill.value * (1 + HERO_LADDER.skillRankStep * (Math.max(1, rank) - 1));

/** A skill as a board slot carries it: integers only. */
export interface SlotSkill {
  id: SkillId;
  /**
   * Per-mille for a share (a strike's of the fighter's damage, a heal's of
   * the target's health, a shield's of the fighter's health, a rally's or a
   * spoil's); DEF for Bulwark; ticks for a Daze.
   */
  amount: number;
  /** Ticks between two firings; 0 when it does not fire on a clock. */
  every: number;
}

const ticks = (seconds: number): number => Math.max(1, Math.round((seconds * 1000) / COMBAT.tickMs));

export function slotSkill(skill: SkillDef, rank = 1): SlotSkill {
  const v = rankValue(skill, rank);
  const amount = skill.id === 'Bulwark' ? Math.round(v)
    : skill.id === 'Daze' ? ticks(v)
      : Math.round(v * 10);
  const timed = ['strike', 'heal', 'shield', 'daze'].includes(SKILLS[skill.id].kind);
  return { id: skill.id, amount, every: timed ? ticks(skill.every) : 0 };
}

const pct = (v: number): string => `${Math.round(v * 10) / 10}%`;
const secs = (v: number): string => `${Math.round(v * 10) / 10} s`;

/** What a skill does, at a rank, as the card reads it. */
export function skillSentence(skill: SkillDef, rank = 1): string {
  const v = rankValue(skill, rank);
  const every = `Every ${secs(skill.every)}`;
  switch (skill.id) {
    case 'Sharpshot': return `${every}, strikes the weakest enemy for ${pct(v)} of its damage`;
    case 'Crush': return `${every}, strikes the strongest enemy for ${pct(v)} of its damage`;
    case 'Cleave': return `${every}, strikes every enemy in the front row for ${pct(v)} of its damage`;
    case 'Ambush': return `${every}, strikes the weakest enemy in the back row for ${pct(v)} of its damage`;
    case 'Volley': return `${every}, strikes every enemy for ${pct(v)} of its damage`;
    case 'Mend': return `${every}, heals the most wounded ally for ${pct(v)} of its health`;
    case 'Wave': return `${every}, heals every ally for ${pct(v)} of its health`;
    case 'Shield': return `${every}, shields the weakest ally in the front row for ${pct(v)} of its own health`;
    case 'Daze': return `${every}, holds the hardest-hitting enemy back ${secs(v)}`;
    case 'WarCry': return `Every ally squad hits ${pct(v)} harder`;
    case 'Bulwark': return `Every ally squad has +${Math.round(v)} defence`;
    case 'Vigour': return `Every ally squad has ${pct(v)} more health`;
    case 'Plunder': return `A won fight brings home ${pct(v)} more loot`;
    case 'Lore': return `A won fight brings home ${pct(v)} more Knowledge`;
    case 'Seasoned': return `A won fight teaches ${pct(v)} more Hero XP`;
    case 'FieldMedic': return `${Math.round(v)} more of every hundred fallen come home wounded, not lost`;
  }
}

/** What a won fight pays on top, from the spoils skills on one side of a
 *  board — shares, so 0.15 is fifteen per cent. */
export interface Spoils {
  plunder: number;
  lore: number;
  seasoned: number;
  /** Points of the fallen carried home wounded, as a share. */
  medic: number;
}

export const NO_SPOILS: Spoils = { plunder: 0, lore: 0, seasoned: 0, medic: 0 };

/** The spoils the fighters on a board bring. Each is SUMMED: two heroes are
 *  two skills, and no rarity repeats one. */
export function spoilsOf(slots: ReadonlyArray<{ kind: string; hpPool: number; skill?: SlotSkill }>): Spoils {
  const out = { ...NO_SPOILS };
  for (const s of slots) {
    if (s.kind !== 'hero' || s.skill === undefined) continue;
    const share = s.skill.amount / 1000;
    if (s.skill.id === 'Plunder') out.plunder += share;
    if (s.skill.id === 'Lore') out.lore += share;
    if (s.skill.id === 'Seasoned') out.seasoned += share;
    if (s.skill.id === 'FieldMedic') out.medic += share;
  }
  return out;
}
