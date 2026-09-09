// WHAT A TECHNOLOGY CAN MOVE, and what it may aim at.
//
// A bonus technology used to say what it does by naming a LINE — `Sawpits`,
// `TradeRoutes` — whose meaning lived in exactly one hard-coded call site. 37
// lines, 37 hooks, and a new kind of bonus meant a union member plus a call
// site. So the editor could only ever offer 37 concrete names.
//
// A technology now says it the way the adjacency sheet already says it (see
// `AdjacencyRule` in definitions.ts and `src/sim/adjacency.ts`): a STAT, an
// OP, a signed VALUE and a TARGET. "+5% tax income at Housing" and "+8% at
// Market" are one stat with two targets — no new line, no new call site, no
// code. What stays code is this registry and the one call site that owns each
// number, because something has to READ a number for it to mean anything.
//
// The registry is its own leaf module rather than part of `techTreeRules.ts`:
// that file imports `ui/research/layout` for the page geometry, and the
// resolver that reads this is on the hot path (`effectiveWorkerStrike` runs
// per strike). Here there is nothing but `balance.json` for the id lists and
// types that erase.

import balance from './balance.json';
import type { UnitTag } from './definitions';
import type { DistrictId, HarvestSourceId, TomeId, UnitId } from '../state';

/**
 * How a value enters the number.
 *
 * `flat` is added to the base in the base's own units; `percent` is authored
 * in POINTS and scales it. Which of the two a stat accepts is the registry's
 * business (`ops` below) — a percent of a base of 0 is 0, so offering one
 * would be offering a rank the player pays for and nothing collects.
 */
export type TechEffectOp = 'flat' | 'percent';

export const TECH_EFFECT_OPS: TechEffectOp[] = ['flat', 'percent'];

/** What an effect may aim at. `global` is every subject of that stat. */
export type TargetKind =
  | 'global' | 'district' | 'unit' | 'unitTag' | 'harvest' | 'tome';

/**
 * One aimed effect.
 *
 * A single-key object, the same idiom as `TechUnlock`, so `targetKey` and
 * `targetLabel` are twins of `unlockKey` and `unlockLabel` — and so the JSON
 * reads as a sentence.
 */
export type TechTarget =
  | { district: DistrictId }
  | { unit: UnitId }
  | { unitTag: UnitTag }
  | { harvest: HarvestSourceId }
  | { tome: TomeId };

/** What a technology does, in one line of data. */
export interface TechEffect {
  stat: TechStat;
  op: TechEffectOp;
  /**
   * SIGNED, exactly as `AdjacencyRule.magnitude` is: a reduction is negative
   * and a penalty is negative, so every call site adds or multiplies and none
   * subtracts. `-22` on a percent stat is −22%.
   */
  value: number;
  /** Absent = global: it moves that stat for every subject. */
  target?: TechTarget;
}

/** One number the tree can reach, and how. */
export interface StatDef {
  /** What the number IS, in the units a value is authored in. */
  what: string;
  /** Which ops make sense here. One entry means the other is inert. */
  ops: readonly TechEffectOp[];
  /**
   * What a PLAYER is told, one sentence per op in `ops`.
   *
   * `what` is the AUTHORING blurb and stays in authoring units — "seconds of
   * work one tap is worth" — which is why a card cannot be built from it:
   * "+20% seconds of work one tap is worth" is not a sentence anyone reads.
   * This is the card. A technology no longer carries prose of its own
   * (`src/sim/techProse.ts` renders these), so a stat with no sentence is a
   * bonus nobody can read.
   *
   * The little language, filled in by `effectSentence`:
   *
   * | `{v}`        | the signed amount — `+5%`, `−0.05`, `+1`               |
   * | `{pct}`      | a value authored as a FRACTION, read as a percentage:
   *                  `0.05` → `+5%`. For the flat stats whose unit is `×`    |
   * | `{target}`   | the target as a complete noun phrase                   |
   * | `{resource}` | the currency a harvest target pays                     |
   * | `[ … ]`      | dropped whole when the effect is unaimed               |
   *
   * Two rules for anyone writing one. **Articles**: a district, unit or unit
   * tag is a proper noun, so the template writes `the` or nothing; only a
   * harvest source is polymorphic, so it carries its own article. **Never a
   * noun that has to agree in number with `{v}`** — `'{v} bed'` breaks at +2.
   */
  says: Partial<Record<TechEffectOp, string>>;
  /** Which kinds of target this stat accepts. `global` only = unaimed. */
  targets: readonly TargetKind[];
  /** Which IDS of that kind it accepts, when only some of them read the
   *  number. Absent = every id of every accepted kind. Narrower than
   *  `targets` and for the same reason the `ops` list exists: a bonus aimed
   *  where nothing reads it is a rank the player pays for and nobody
   *  collects. Derive it from the workbook, never hand-list it — the sheet
   *  stays the authority on which subjects have the number at all. */
  targetIds?: readonly string[];
  /** What a flat value is measured in, for the editor's field label. */
  unit: string;
  /** The one call site that owns this number — documentation, and what
   *  `tests/techEffects.test.ts` greps for to prove nothing is inert. */
  reads: string;
  /**
   * WHY nothing reads this stat any more. Set only when the mechanic the dial
   * moved was cut and the ladders that name it have not been re-pointed yet
   * (`?dev=tree` is where that happens, and the tree is not ours to edit).
   * The stat stays declared so those ladders still validate and still read as
   * sentences; the guard that every stat has a reader skips a retired one,
   * and `tests/ladderEffects.test.ts` skips the ladders themselves.
   */
  retired?: string;
}

/**
 * The registry.
 *
 * Adding a stat is two lines here plus a `techValue()` call in the helper that
 * owns that number — the same shape as adding a `ModifierStat`, and the same
 * reason: a stat nothing reads is a bonus nobody collects. One of those two
 * lines is `says`: a technology carries no prose of its own any more, so a
 * stat without a sentence is a card the player cannot read.
 *
 * No stat accepts a `tome` target today, so no sentence is written around one.
 * The first stat that declares `targets: ['global', 'tome']` has to write the
 * wording; nothing here can guess it.
 *
 * The names say WHERE the number enters, not what it feels like. "More gold"
 * is deliberately not one stat: gold arrives as tax (`taxRate`) and out of the
 * ground (`harvestUnitsPerStrike`), and those are two numbers in two
 * functions. One stat is one number in one place.
 */
/**
 * Harvest sources that grow back IN PLACE, and so have a recovery clock at
 * all. A berry bush, a herd and a shoal do not: they are CONSUMED and reappear
 * on another tile, which is `respawnSeconds` — a different number in a
 * different call site (`harvest.ts#drawFromCell`), and a second stat if the
 * tree is ever to move it.
 *
 * Derived from the sheet, so a designer who gives the berries a regrowth time
 * makes them aimable by doing that and nothing else.
 */
const RECOVERING_SOURCES: readonly string[] = Object.entries(balance.harvest)
  .filter(([, h]) => (h as { recoverySeconds: number }).recoverySeconds > 0)
  .map(([id]) => id);

export const TECH_STATS = {
  // ---- the thumb and the crew
  tapWorkSeconds: {
    what: 'seconds of work one tap is worth',
    ops: ['percent'], targets: ['global'], unit: 's',
    says: { percent: '{v} out of every tap' },
    reads: 'upgrades.ts#tapWorkSeconds',
  },
  autoTapCooldown: {
    what: 'seconds between auto-taps while a finger is held',
    ops: ['flat', 'percent'], targets: ['global'], unit: 's',
    says: { flat: '{v}s between auto-taps', percent: '{v} on the auto-tap wait' },
    reads: 'upgrades.ts#effectiveAutoTapCooldownMs',
  },
  harvestUnitsPerStrike: {
    what: 'units one extraction takes out of a KIND OF CELL — the tap and the crew alike',
    ops: ['flat', 'percent'], targets: ['global', 'harvest'], unit: 'units',
    says: {
      flat: '{v}[ {resource}] per tap and delivery[ from {target}]',
      percent: '{v}[ {resource}] per tap and delivery[ from {target}]',
    },
    reads: 'upgrades.ts#effectiveUnitsPerStrike',
  },
  harvestRecovery: {
    what: 'the seconds a drained cell stays a stump before it grows back',
    ops: ['percent'], targets: ['global', 'harvest'], unit: 's',
    says: { percent: '{v} time before[ {target}] grows back' },
    targetIds: RECOVERING_SOURCES,
    reads: 'harvest.ts#effectiveRecoveryMs',
  },
  workerStrikeUnits: {
    what: 'units one WORKER delivery carries, on top of the cell’s own',
    ops: ['flat', 'percent'], targets: ['global'], unit: 'units',
    says: { flat: '{v} on every worker delivery', percent: '{v} on every worker delivery' },
    reads: 'upgrades.ts#effectiveWorkerStrike',
  },
  workerSpeed: {
    what: 'tiles a second a worker walks',
    ops: ['percent'], targets: ['global'], unit: 'tiles/s',
    says: { percent: '{v} worker walking speed' },
    reads: 'upgrades.ts#effectiveWorkerSpeed',
  },
  // ---- the city
  buildTime: {
    what: 'the multiplier on seconds to raise or upgrade a building',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} time to build and upgrade' },
    reads: 'upgrades.ts#effectiveBuildTimeMultiplier',
  },
  researchTime: {
    what: 'the multiplier on seconds to finish a research, fixed when it starts',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} time to finish a research' },
    reads: 'upgrades.ts#effectiveResearchTimeMultiplier',
  },
  taxRate: {
    what: 'Gold a housed villager pays a minute',
    ops: ['percent', 'flat'], targets: ['global', 'district'], unit: 'gold/min',
    says: {
      percent: '{v} tax income[ from {target}]',
      flat: '{v} Gold a minute per villager[ in {target}]',
    },
    reads: 'upgrades.ts#effectiveTaxRate',
  },
  populationCapacity: {
    what: 'beds a district provides',
    ops: ['flat', 'percent'], targets: ['global', 'district'], unit: 'beds',
    says: { flat: '{v} bed space[ at {target}]', percent: '{v} bed space[ at {target}]' },
    reads: 'population.ts#districtCapacity',
  },
  // ---- magic and the clock
  manaCap: {
    what: 'the ceiling of the Mana pool',
    ops: ['flat', 'percent'], targets: ['global'], unit: 'mana',
    says: {
      flat: '{v} to the Mana the kingdom holds',
      percent: '{v} to the Mana the kingdom holds',
    },
    reads: 'mana.ts#manaCap',
  },
  manaPerClaimedLandmark: {
    what: 'Mana an hour from EVERY claimed landmark',
    ops: ['flat'], targets: ['global'], unit: 'mana/h',
    says: { flat: '{v} Mana an hour per claimed landmark' },
    reads: 'mana.ts#manaProduction',
  },
  knowledgePerClaimedLandmark: {
    what: 'Knowledge an hour from EVERY claimed landmark',
    ops: ['flat'], targets: ['global'], unit: 'knowledge/h',
    says: { flat: '{v} Knowledge an hour per claimed landmark' },
    reads: 'mana.ts#knowledgePerHour',
  },
  knowledgePerClearedRuin: {
    what: 'Knowledge an hour from EVERY cleared ruin',
    ops: ['flat'], targets: ['global'], unit: 'knowledge/h',
    says: { flat: '{v} Knowledge an hour per cleared ruin' },
    reads: 'mana.ts#knowledgePerHour',
  },
  knowledgeYield: {
    what: 'the multiplier on the whole Knowledge drip',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} on the whole Knowledge drip' },
    reads: 'mana.ts#knowledgePerHour',
  },
  activeCost: {
    what: 'the Mana a relic’s ability costs to cast',
    ops: ['percent'], targets: ['global'], unit: 'mana',
    says: { percent: '{v} Mana to cast a relic' },
    reads: 'casting.ts#castCost',
  },
  // ---- the fog
  revealCost: {
    what: 'the Gold one cell of fog costs to clear',
    ops: ['percent'], targets: ['global'], unit: 'gold',
    says: { percent: '{v} Gold to clear a cell of fog' },
    reads: 'fog.ts#revealCostForCell',
  },
  discoverRadius: {
    what: 'how far a building sees into the fog — never how far it REVEALS',
    ops: ['flat'], targets: ['global', 'district'], unit: 'tiles',
    says: { flat: '{v} sight into the fog for every[ {target}] building' },
    reads: 'fog.ts#effectiveDiscoverRadius',
  },
  claimCost: {
    what: 'the Gold a landmark costs to claim',
    ops: ['percent'], targets: ['global'], unit: 'gold',
    says: { percent: '{v} Gold to claim a landmark' },
    reads: 'landmarks.ts#landmarkClaimCost',
  },
  // ---- the army
  armyCap: {
    what: 'the army power the halls can field',
    ops: ['flat', 'percent'], targets: ['global'], unit: 'power',
    says: {
      flat: '{v} soldiers the halls can hold',
      percent: '{v} soldiers the halls can hold',
    },
    reads: 'army.ts#armyCap',
  },
  recruitCost: {
    what: 'the multiplier on what a unit costs to recruit',
    ops: ['percent'], targets: ['global', 'unit'], unit: '×',
    says: { percent: '{v} on recruit costs[ for the {target}]' },
    reads: 'army.ts#trainCost',
  },
  unitAtk: {
    what: 'flat ATK on a unit',
    ops: ['flat'], targets: ['global', 'unitTag'], unit: 'atk',
    says: { flat: '{v} ATK to every[ {target}] unit' },
    reads: 'expeditions.ts#drillOf',
  },
  unitDef: {
    what: 'flat DEF on a unit',
    ops: ['flat'], targets: ['global', 'unitTag'], unit: 'def',
    says: { flat: '{v} DEF to every[ {target}] unit' },
    reads: 'expeditions.ts#drillOf',
  },
  typeDisadvantage: {
    what: 'how much of a bad matchup’s penalty is taken off — never past neutral',
    ops: ['flat'], targets: ['global'], unit: '×',
    says: { flat: '{pct} off a bad matchup’s penalty' },
    reads: 'expeditions.ts#drillOf',
  },
  // ---- the delve
  supplyCost: {
    what: 'the multiplier on what an expedition costs to provision',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} to what an expedition costs' },
    reads: 'expeditions.ts#supplyCost',
  },
  delveSpeed: {
    what: 'the multiplier on how long one depth takes to resolve',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} time to resolve a depth' },
    reads: 'expeditions.ts#depthMs',
    retired: 'A depth is no longer a wait: a room is one fight, resolved the '
      + 'instant it is entered (Docs/features/11-expeditions.md §5), so there '
      + 'is no clock left to speed up. Pathfinders is inert until it is '
      + 're-pointed.',
  },
  haulLoss: {
    what: 'the fraction of the haul a failed depth loses',
    ops: ['flat'], targets: ['global'], unit: '×',
    says: { flat: '{pct} of the haul lost on a bad depth' },
    reads: 'expeditions.ts#effectiveHaulLoss',
    retired: 'A room pays the moment it falls, so there is no haul to carry '
      + 'home and nothing to lose on a bad one (§5). Bearers is inert until '
      + 'it is re-pointed.',
  },
  heroXp: {
    what: 'the multiplier on the XP a delve pays a hero',
    ops: ['percent'], targets: ['global'], unit: 'xp',
    says: { percent: '{v} XP a hero brings back' },
    reads: 'heroes.ts#addHeroXp',
  },
  stardustYield: {
    what: 'the multiplier on the Stardust a depth pays',
    ops: ['percent'], targets: ['global'], unit: 'stardust',
    says: { percent: '{v} Stardust out of a ruin' },
    reads: 'expeditions.ts#depthHaul',
  },
} as const satisfies Record<string, StatDef>;

export type TechStat = keyof typeof TECH_STATS;

export const TECH_STAT_IDS = Object.keys(TECH_STATS) as TechStat[];

/** The unit tags, as values — the `TOME_IDS` trick, so a typo is a compile
 *  error even though a missing tag is not. */
export const UNIT_TAGS: UnitTag[] = ['Melee', 'Distance', 'Mounted'];

/** What each kind of target may name. Read from the workbook, so a target can
 *  only ever name something the game has. */
export const TARGET_IDS: Record<TargetKind, readonly string[]> = {
  global: [],
  district: Object.keys(balance.districts),
  unit: Object.keys(balance.units),
  unitTag: UNIT_TAGS,
  harvest: Object.keys(balance.harvest),
  tome: ['Civics', 'Warfare', 'Magic'],
};

/** Which kind of target this is, or null when it is malformed. */
export function targetKind(target: TechTarget | undefined): TargetKind {
  if (target === undefined) return 'global';
  for (const kind of Object.keys(TARGET_IDS) as TargetKind[]) {
    if (kind !== 'global' && kind in target) return kind;
  }
  return 'global';
}

/** The id a target names, or null for global. */
export function targetId(target: TechTarget | undefined): string | null {
  if (target === undefined) return null;
  const kind = targetKind(target);
  return kind === 'global' ? null : (target as Record<string, string>)[kind];
}

/**
 * One `(stat, target)` pair as a lookup key.
 *
 * KINDED, unlike `ModifierScope` — which is a bare `CurrencyId |
 * HarvestSourceId | DistrictId`, so `'Stone'` the coin and `'Stone'` the
 * mountain are the same scope there. This layer must not inherit that.
 */
export const effectKey = (stat: TechStat, target?: TechTarget): string => {
  const kind = targetKind(target);
  return kind === 'global' ? `${stat}|*` : `${stat}|${kind}:${targetId(target)}`;
};

/** What a target reads as, on a card and in the problem list. */
export const targetLabel = (target: TechTarget | undefined): string => {
  const id = targetId(target);
  return id === null ? 'everything' : id;
};

/** What one effect reads as: `+10% tax income`, `+1 units · Forest`. */
export function effectLabel(effect: TechEffect): string {
  const stat = TECH_STATS[effect.stat] as StatDef | undefined;
  const sign = effect.value > 0 ? '+' : '−';
  const size = Math.abs(effect.value);
  const amount = effect.op === 'percent' ? `${sign}${size}%` : `${sign}${size} ${stat?.unit ?? ''}`;
  const where = effect.target === undefined ? '' : ` · ${targetLabel(effect.target)}`;
  return `${amount} ${effect.stat}${where}`.replace(/\s+/g, ' ').trim();
}

/** Everything wrong with one effect, as messages. Empty = it is legal. */
export function effectProblems(effect: TechEffect): string[] {
  const out: string[] = [];
  const def = TECH_STATS[effect.stat] as StatDef | undefined;
  if (def === undefined) {
    return [`moves "${effect.stat}", which is not a stat the game has`];
  }
  if (!TECH_EFFECT_OPS.includes(effect.op)) {
    out.push(`has the op "${effect.op}"`);
  } else if (!def.ops.includes(effect.op)) {
    // The base this stat enters decides which op can mean anything: a percent
    // of a base of 0 is 0, and a flat on a bare multiplier is a number nobody
    // can reason about.
    out.push(`puts a ${effect.op} value on ${effect.stat}, which only takes `
      + `${def.ops.join(' or ')} — ${def.what}`);
  }
  if (!Number.isFinite(effect.value) || effect.value === 0) {
    out.push(`moves ${effect.stat} by ${effect.value}`);
  }
  if (effect.op === 'percent' && !Number.isInteger(effect.value)) {
    out.push(`moves ${effect.stat} by ${effect.value}% — a percent is authored in whole points`);
  }
  const kind = targetKind(effect.target);
  if (effect.target !== undefined && Object.keys(effect.target).length !== 1) {
    out.push(`aims at ${Object.keys(effect.target).length} things at once`);
  }
  if (!def.targets.includes(kind)) {
    out.push(`aims ${effect.stat} at a ${kind}, which it does not accept `
      + `(${def.targets.join(', ')})`);
  } else if (kind !== 'global') {
    const id = targetId(effect.target);
    if (id === null || !TARGET_IDS[kind].includes(id)) {
      out.push(`aims at the ${kind} "${id}", which does not exist`);
    } else if (def.targetIds !== undefined && !def.targetIds.includes(id)) {
      out.push(`aims ${effect.stat} at "${id}", which has no such number — `
        + `it reaches ${def.targetIds.join(', ')}`);
    }
  }
  return out;
}
