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
import { tr } from '../i18n/tr';

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

// The names are in the player's language: it is set before any module loads
// (src/i18n/browser.ts), and the sim never compares one.
export const SKILLS: Record<SkillId, SkillInfo> = {
  Sharpshot: { name: tr('Sharpshot'), ...STRIKE },
  Crush: { name: tr('Crush'), ...STRIKE },
  Cleave: { name: tr('Cleave'), ...STRIKE },
  Ambush: { name: tr('Ambush'), ...STRIKE },
  Volley: { name: tr('Volley'), ...STRIKE },
  Mend: { name: tr('Mend'), kind: 'heal', ...CARE },
  Wave: { name: tr('Healing wave'), kind: 'heal', ...CARE },
  Shield: { name: tr('Shield'), kind: 'shield', ...CARE },
  Daze: { name: tr('Daze'), kind: 'daze', ...SPIRIT },
  WarCry: { name: tr('War cry'), kind: 'rally', ...SPIRIT },
  Bulwark: { name: tr('Bulwark'), kind: 'rally', ...SPIRIT },
  Vigour: { name: tr('Vigour'), kind: 'rally', ...SPIRIT },
  Plunder: { name: tr('Plunder'), kind: 'spoils', ...SPIRIT },
  Lore: { name: tr('Lore'), kind: 'spoils', ...SPIRIT },
  Seasoned: { name: tr('Seasoned'), kind: 'spoils', ...SPIRIT },
  FieldMedic: { name: tr('Field medic'), kind: 'spoils', ...SPIRIT },
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
  // `every` and `pct` carry their units; the numbers are bare, so the card
  // can find them again to show what a rank added (heroesSheet `skillSays`).
  const x = { every: secs(skill.every), pct: pct(v), secs: secs(v), n: Math.round(v) };
  switch (skill.id) {
    case 'Sharpshot': return tr('Every {every}, strikes the weakest enemy for {pct} of its damage', x);
    case 'Crush': return tr('Every {every}, strikes the strongest enemy for {pct} of its damage', x);
    case 'Cleave': return tr('Every {every}, strikes every enemy in the front row for {pct} of its damage', x);
    case 'Ambush': return tr('Every {every}, strikes the weakest enemy in the back row for {pct} of its damage', x);
    case 'Volley': return tr('Every {every}, strikes every enemy for {pct} of its damage', x);
    case 'Mend': return tr('Every {every}, heals the most wounded ally for {pct} of its health', x);
    case 'Wave': return tr('Every {every}, heals every ally for {pct} of its health', x);
    case 'Shield': return tr('Every {every}, shields the weakest ally in the front row for {pct} of its own health', x);
    case 'Daze': return tr('Every {every}, holds the hardest-hitting enemy back {secs}', x);
    case 'WarCry': return tr('Every ally squad hits {pct} harder', x);
    case 'Bulwark': return tr('Every ally squad has +{n} defence', x);
    case 'Vigour': return tr('Every ally squad has {pct} more health', x);
    case 'Plunder': return tr('A won fight brings home {pct} more loot', x);
    case 'Lore': return tr('A won fight brings home {pct} more Knowledge', x);
    case 'Seasoned': return tr('A won fight teaches {pct} more Hero XP', x);
    case 'FieldMedic': return tr('{n} more of every hundred fallen come home wounded, not lost', x);
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
