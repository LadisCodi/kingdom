// WHAT A TECHNOLOGY SAYS ABOUT ITSELF, generated from what it does.
//
// A technology used to say it twice: once as data — `unlocks` for an `unlock`,
// `effects` for a `bonus` — and once as a `description` typed beside it in
// `?dev=tree`. Only the data was checked, so the prose drifted: 150 cards
// shared 68 sentences, `TapPower` promised "+1 resource per collect tap" over
// an effect of +20% tap work, and three ladders described the same number
// three different ways.
//
// So the sentence is not authored any more. The card is a RENDERING of the
// data, and a rebalance updates its own prose. What is still written by hand
// is the half that is language rather than fact: one sentence per stat in the
// registry (`data/techEffectRules.ts` `says`), and the noun phrases below.
//
// It lives HERE rather than in `sim/data/` because it needs display names —
// `DISTRICTS[x].name`, `UNITS[x].name`, `HARVEST[x].currencyId` — and
// `definitions.ts` imports the two rule leaves, so a leaf may not import it
// back. The editor imports this module too, which is the point: the designer
// arranging the page reads the sentence the player will read.

import { DISTRICTS, HARVEST, TECHNOLOGIES, UNITS } from './data/definitions';
import {
  TECH_STATS, targetId, targetKind,
  type StatDef, type TechEffect, type TechEffectOp,
} from './data/techEffectRules';
import type { TechKind, TechUnlock } from './data/techTreeRules';
import type { DistrictId, HarvestSourceId, TechId, TerrainId, UnitId } from './state';

/** A display name for an id the DATA holds as a bare string. An unlock names
 *  a district the rules have already checked exists, so the fallback is only
 *  ever reached mid-edit in `?dev=tree`. */
const districtName = (id: string): string => DISTRICTS[id as DistrictId]?.name ?? id;
const unitName = (id: string): string => UNITS[id as UnitId]?.name ?? id;

/**
 * The shape this module can describe.
 *
 * Structural on purpose: both `TechNodeDoc` (the editor's node, mid-edit and
 * unsaved) and `TechnologyDef` (the game's) satisfy it, so the two cannot
 * drift into saying different things about one technology.
 */
export interface TechSaying {
  kind: TechKind;
  description?: string;
  unlocks?: readonly TechUnlock[];
  effects?: readonly TechEffect[];
}

// ------------------------------------------------------------------ nouns

/**
 * A harvest source as a noun phrase: singular with its article for an effect
 * ("from a forest"), plural for an unlock ("Unlocks the forests").
 *
 * Written here rather than read off `FEATURES[].name`, which looks like the
 * same fact and is not: `Crops` has no feature of its own (the FarmLands
 * provide it), and "Wild animals" / "Fish shoal" only fit the sentence by
 * accident. Eight strings authored once beat a derivation that is wrong twice.
 */
const HARVEST_SAYS: Record<HarvestSourceId, { one: string; many: string }> = {
  Forest: { one: 'a forest', many: 'the forests' },
  Crops: { one: 'a farm plot', many: 'crop plots' },
  Berries: { one: 'a berry bush', many: 'the berry bushes' },
  Meat: { one: 'wild game', many: 'the wild game' },
  Fish: { one: 'a shoal', many: 'the fish shoals' },
  Stone: { one: 'a mountain', many: 'the mountains' },
  MountainIron: { one: 'an iron mountain', many: 'the iron mountains' },
  MountainGold: { one: 'a gold mountain', many: 'the gold mountains' },
};

/** A terrain as the thing a player crosses. */
const TERRAIN_SAYS: Record<TerrainId, string> = {
  Grassland: 'the grasslands',
  Plains: 'the plains',
  Desert: 'the desert',
  Snow: 'the snows',
  Tundra: 'the tundra',
  Water: 'the open water',
};

/** A serial list: `A`, `A and B`, `A, B and C`. */
const serial = (parts: string[]): string =>
  parts.length < 2 ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

// ---------------------------------------------------------------- unlocks

/**
 * One unlock as a noun phrase — `unlockLabel`'s player-facing twin.
 *
 * The twin exists because `unlockLabel` lives in a `data/` leaf that may not
 * see `definitions.ts`, so it can only say `the ShootingGrounds`. That is the
 * right label for the editor's problem list and the wrong one for a card.
 *
 * Every kind is a NOUN phrase, never a clause with its own verb, so a
 * technology that opens a building and a unit still reads as one sentence.
 */
export function unlockPhrase(unlock: TechUnlock): string {
  if ('district' in unlock) return `the ${districtName(unlock.district)}`;
  if ('districtLevel' in unlock) {
    const { id, level } = unlock.districtLevel;
    return `${districtName(id)} level ${level}`;
  }
  if ('districtCount' in unlock) {
    // "one more", never "a second": the gate means one more may stand, which
    // stays true however many the Townhall already allows.
    return `one more ${districtName(unlock.districtCount)}`;
  }
  if ('unit' in unlock) return `the ${unitName(unlock.unit)}`;
  if ('harvest' in unlock) {
    return HARVEST_SAYS[unlock.harvest as HarvestSourceId]?.many ?? unlock.harvest;
  }
  if ('terrain' in unlock) return TERRAIN_SAYS[unlock.terrain as TerrainId] ?? unlock.terrain;
  return 'nothing';
}

/**
 * The unlocks of one technology, as clauses.
 *
 * Building LEVELS that share a number collapse into one clause: the four halls
 * reaching level 4 is one fact and four clauses of it overflow the card —
 * "Barracks, Spear Hall, Shooting Grounds and Stables at level 4" is both
 * shorter and closer to what the designer meant.
 */
function unlockClauses(unlocks: readonly TechUnlock[]): string[] {
  const byLevel = new Map<number, string[]>();
  const rest: string[] = [];
  for (const unlock of unlocks) {
    if ('districtLevel' in unlock) {
      const { id, level } = unlock.districtLevel;
      byLevel.set(level, [...(byLevel.get(level) ?? []), districtName(id)]);
    } else rest.push(unlockPhrase(unlock));
  }
  const levels = [...byLevel.entries()].map(([level, names]) => (names.length === 1
    ? `${names[0]} level ${level}`
    : `${serial(names)} at level ${level}`));
  return [...levels, ...rest];
}

// ---------------------------------------------------------------- effects

/** `+5%`, `−10%`, `+1`, `−0.05` — signed, with the same minus as `effectLabel`. */
const amount = (value: number, op: TechEffectOp): string => {
  const sign = value < 0 ? '−' : '+';
  const size = Math.abs(value);
  return op === 'percent' ? `${sign}${size}%` : `${sign}${size}`;
};

/** A value authored as a FRACTION, read as a percentage: `0.05` → `+5%`.
 *  Rounded, because `0.05 * 100` is 5.000000000000001. */
const asPercent = (value: number): string => {
  const sign = value < 0 ? '−' : '+';
  return `${sign}${Math.round(Math.abs(value) * 1000) / 10}%`;
};

/** The target of an effect, as a complete noun phrase. */
function targetPhrase(effect: TechEffect): string {
  const kind = targetKind(effect.target);
  const id = targetId(effect.target);
  if (id === null) return '';
  if (kind === 'district') return districtName(id);
  if (kind === 'unit') return unitName(id);
  if (kind === 'harvest') return HARVEST_SAYS[id as HarvestSourceId]?.one ?? id;
  return id; // a unit tag is already the word; a tome is its own name
}

/**
 * One effect as the sentence a player reads.
 *
 * The template is the stat's (`TECH_STATS[...].says[op]`); everything this
 * does is fill it in and drop the `[ … ]` segments when the effect is unaimed.
 */
export function effectSentence(effect: TechEffect): string {
  const stat = TECH_STATS[effect.stat] as StatDef | undefined;
  const template = stat?.says?.[effect.op];
  // A stat with no sentence for this op cannot be rendered, and inventing one
  // out of `what` is what this module exists to stop. The rules refuse the
  // effect long before here; this is the belt.
  if (template === undefined) return '';
  const aimed = effect.target !== undefined;
  const where = targetPhrase(effect);
  const source = targetKind(effect.target) === 'harvest'
    ? HARVEST[targetId(effect.target) as HarvestSourceId]?.currencyId ?? '' : '';
  return template
    // A bracketed segment belongs to the aim: no aim, no segment.
    .replace(/\[([^\]]*)\]/g, (_, inner: string) => (aimed ? inner : ''))
    .replace(/\{v\}/g, amount(effect.value, effect.op))
    .replace(/\{pct\}/g, asPercent(effect.value))
    .replace(/\{target\}/g, where)
    .replace(/\{resource\}/g, source)
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------- the whole

/**
 * Everything one technology says, one sentence per thing it does.
 *
 * DATA FIRST, prose last. A technology whose unlocks or effects speak for
 * themselves carries no description at all (`saysItself`, `techTreeRules.ts`),
 * and this order means a stale one left in a hand-edited file is dead rather
 * than shadowing the truth.
 *
 * The only prose left is a `mechanic`'s — the kind whose effect is code, so
 * the only kind with nothing in its own data to read — and a `planned` node's,
 * which is a promise about content that does not exist yet.
 */
export function techSentences(node: TechSaying): string[] {
  const unlocks = node.unlocks ?? [];
  if (unlocks.length > 0) return unlockClauses(unlocks).map((c) => `Unlocks ${c}`);
  const effects = node.effects ?? [];
  if (effects.length > 0) return effects.map(effectSentence).filter((s) => s !== '');
  const prose = (node.description ?? '').trim();
  return prose === '' ? [] : [prose];
}

/** All of it as ONE line: a card, a banner, a tooltip. Unlocks share their
 *  verb, so they join as clauses of one sentence rather than as a list of
 *  sentences. */
export function describeTech(node: TechSaying): string {
  const unlocks = node.unlocks ?? [];
  if (unlocks.length > 0) return `Unlocks ${serial(unlockClauses(unlocks))}`;
  return techSentences(node).join(' · ');
}

/** The line under a card's name. */
export const techLine = (id: TechId): string => describeTech(TECHNOLOGIES[id]);
