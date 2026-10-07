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
// per strike). Here there is nothing but the balance data for the id lists and
// types that erase.

import balance from './balance';
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
   * POSITIVE, always: every stat climbs, and a wait is moved by a speed the
   * call site divides by, so no rank ever needs a minus sign
   * (`effectProblems` refuses one).
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

/** Districts that have a store at all — a percent of no store is nothing. */
const STORING_DISTRICTS: readonly string[] = Object.entries(balance.districts)
  .filter(([, d]) => ((d as { storageCapacityPerLevel?: number[] }).storageCapacityPerLevel ?? []).length > 0)
  .map(([id]) => id);

/** Districts that run a workshop queue. */
const WORKSHOP_DISTRICTS: readonly string[] = Object.entries(balance.districts)
  .filter(([, d]) => (d as { produces?: string | null }).produces != null)
  .map(([id]) => id);

/** Harvest sources that hold a stock at all. A mountain holds none: picking
 *  at it never uses it up, so a percent of its stock is a percent of nothing. */
const STOCKED_SOURCES: readonly string[] = Object.entries(balance.harvest)
  .filter(([, h]) => (h as { stock: number }).stock > 0)
  .map(([id]) => id);

/** Harvest sources that are CONSUMED and come back somewhere else — the other
 *  harvest clock, `respawnSeconds`. */
const RESPAWNING_SOURCES: readonly string[] = Object.entries(balance.harvest)
  .filter(([, h]) => (h as { respawnSeconds: number }).respawnSeconds > 0)
  .map(([id]) => id);

/** Districts a crew works out of: something to harvest, and slots for it. */
const CREWED_PRODUCERS: readonly string[] = Object.entries(balance.districts)
  .filter(([, d]) => ((d as { harvestSources?: string[] }).harvestSources ?? []).length > 0
    && ((d as { maxWorkersPerLevel?: number[] }).maxWorkersPerLevel ?? []).length > 0)
  .map(([id]) => id);

/** Producers whose crew reaches out over an area of influence. */
const REACHING_PRODUCERS: readonly string[] = Object.entries(balance.districts)
  .filter(([, d]) => ((d as { harvestSources?: string[] }).harvestSources ?? []).length > 0
    && ((d as { influenceRadiusPerLevel?: number[] }).influenceRadiusPerLevel ?? []).length > 0)
  .map(([id]) => id);

/** Districts that supply Harmony: the decorations. */
const DECORATION_DISTRICTS: readonly string[] = Object.entries(balance.districts)
  .filter(([, d]) => ((d as { harmonySupply?: number }).harmonySupply ?? 0) > 0)
  .map(([id]) => id);

export const TECH_STATS = {
  // EVERY STAT HERE CLIMBS. A technology never makes a number smaller: a wait
  // is owned as a TIME and moved as a SPEED the call site divides by, a yield
  // is a percentage of what the ground gives, and nothing is ever discounted
  // (Docs/features/22-progression.md §9). So a bonus can stack without end
  // and never meet a floor — the failure a −5% ladder has at rank twenty.
  //
  // ---- the thumb and the crew
  tapWorkSeconds: {
    what: 'seconds of work one tap is worth',
    ops: ['percent'], targets: ['global'], unit: 's',
    says: { percent: '{v} out of every tap' },
    reads: 'upgrades.ts#tapWorkSeconds',
  },
  autoTapSpeed: {
    what: 'how fast a held finger repeats its tap — the cooldown is divided by it',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} auto-tap speed while holding' },
    reads: 'upgrades.ts#effectiveAutoTapCooldownMs',
  },
  harvestYield: {
    what: 'the share more one extraction takes out of a KIND OF CELL — the tap and the crew alike; fractions carry',
    ops: ['percent'], targets: ['global', 'harvest'], unit: '×',
    says: { percent: '{v}[ {resource}] per tap and delivery[ from {target}]' },
    reads: 'upgrades.ts#effectiveUnitsPerStrike',
  },
  regrowthSpeed: {
    what: 'how fast a drained cell grows back — its recovery time is divided by it',
    ops: ['percent'], targets: ['global', 'harvest'], unit: '×',
    says: { percent: '{v} regrowth speed[ for {target}]' },
    targetIds: RECOVERING_SOURCES,
    reads: 'harvest.ts#effectiveRecoveryMs',
  },
  crewYield: {
    what: 'the share more every WORKER delivery carries — never the tap; fractions carry',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} on every worker delivery' },
    reads: 'upgrades.ts#effectiveWorkerStrike',
  },
  workerSpeed: {
    what: 'tiles a second a worker walks',
    ops: ['percent'], targets: ['global'], unit: 'tiles/s',
    says: { percent: '{v} worker walking speed' },
    reads: 'upgrades.ts#effectiveWorkerSpeed',
  },
  cellStock: {
    what: 'the share more a cell holds when full — a tree’s Wood, a plot’s Food; never a mountain, which holds no stock',
    ops: ['percent'], targets: ['global', 'harvest'], unit: '×',
    says: { percent: '{v}[ {resource}] held in every cell[ of {target}]' },
    targetIds: STOCKED_SOURCES,
    reads: 'harvest.ts#effectiveStock',
  },
  respawnSpeed: {
    what: 'how fast a consumed feature comes back somewhere else — its respawn time is divided by it',
    ops: ['percent'], targets: ['global', 'harvest'], unit: '×',
    says: { percent: '{v} speed coming back[ for {target}]' },
    targetIds: RESPAWNING_SOURCES,
    reads: 'harvest.ts#effectiveRespawnMs',
  },
  crewStrikeSpeed: {
    what: 'how fast a building’s crew swings — the time between strikes is divided by it',
    ops: ['percent'], targets: ['global', 'district'], unit: '×',
    says: { percent: '{v} work speed for the crew[ of the {target}]' },
    targetIds: CREWED_PRODUCERS,
    reads: 'upgrades.ts#workerStrikeMs',
  },
  crewSlots: {
    what: 'workers a producer can take on — whole workers, so flat',
    ops: ['flat'], targets: ['global', 'district'], unit: 'workers',
    says: { flat: '{v} worker slots[ at the {target}]' },
    targetIds: CREWED_PRODUCERS,
    reads: 'workers.ts#assignableWorkerLimit',
  },
  influenceRadius: {
    what: 'how far a producer’s crew reaches for cells to work — whole tiles, so flat',
    ops: ['flat'], targets: ['global', 'district'], unit: 'tiles',
    says: { flat: '{v} reach for the crew[ of the {target}]' },
    targetIds: REACHING_PRODUCERS,
    reads: 'workers.ts#influenceRadius',
  },
  // ---- the city
  buildSpeed: {
    what: 'how fast the builders work — build and upgrade times are divided by it',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} build speed' },
    reads: 'upgrades.ts#effectiveBuildTimeMultiplier',
  },
  storageCapacity: {
    what: 'units a building’s store holds before the building stops',
    ops: ['percent'], targets: ['global', 'district'], unit: '×',
    says: { percent: '{v} storage[ in {target}]' },
    targetIds: STORING_DISTRICTS,
    reads: 'storage.ts#storageCapacity',
  },
  taxRate: {
    what: 'Gold a housed villager pays a minute',
    ops: ['percent'], targets: ['global', 'district'], unit: 'gold/min',
    says: { percent: '{v} tax income[ from {target}]' },
    reads: 'upgrades.ts#effectiveTaxRate',
  },
  populationCapacity: {
    what: 'beds a district provides — whole villagers, so flat',
    ops: ['flat'], targets: ['global', 'district'], unit: 'beds',
    says: { flat: '{v} bed space[ at {target}]' },
    reads: 'population.ts#districtCapacity',
  },
  villagerTrainingSpeed: {
    what: 'how fast the Townhall trains a villager — the time is divided by it',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} villager training speed' },
    reads: 'army.ts#trainSecondsAt',
  },
  workshopSpeed: {
    what: 'how fast a workshop turns out its good — the work time is divided by it',
    ops: ['percent'], targets: ['global', 'district'], unit: '×',
    says: { percent: '{v} workshop speed[ at {target}]' },
    targetIds: WORKSHOP_DISTRICTS,
    reads: 'workshops.ts#queuedWorkMs',
  },
  workshopQueueSlots: {
    what: 'orders a workshop can hold in its queue at once — whole orders, so flat',
    ops: ['flat'], targets: ['global', 'district'], unit: 'orders',
    says: { flat: '{v} order slots in the queue[ of the {target}]' },
    targetIds: WORKSHOP_DISTRICTS,
    reads: 'workshops.ts#queueCapacity',
  },
  ownGold: {
    what: 'the Gold the Townhall makes by itself a minute, with nobody in it',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} Gold the Townhall makes by itself' },
    reads: 'population.ts#ownGoldPerMinute',
  },
  decorationHarmony: {
    what: 'Harmony a standing decoration supplies — whole points, so a percent is rounded down',
    ops: ['flat', 'percent'], targets: ['global', 'district'], unit: 'Harmony',
    says: {
      flat: '{v} Harmony from every[ {target}] decoration',
      percent: '{v} Harmony from every[ {target}] decoration',
    },
    targetIds: DECORATION_DISTRICTS,
    reads: 'harmony.ts#decorationHarmony',
  },
  // ---- magic and the clock
  manaCap: {
    what: 'the ceiling of the Mana pool, after every landmark and Sanctum level',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} to the Mana the kingdom holds' },
    reads: 'mana.ts#manaCap',
  },
  manaRegen: {
    what: 'Mana an hour, from every source',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} Mana regeneration' },
    reads: 'mana.ts#manaProduction',
  },
  knowledgeYield: {
    what: 'the multiplier on every lump of Knowledge — never the drip, never a purchase',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} on every lump of Knowledge' },
    reads: 'knowledge.ts#knowledgeLump',
  },
  landmarkKnowledge: {
    what: 'the share more Knowledge a landmark pays when it is claimed, paid back at once for every landmark held',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} Knowledge from every landmark claimed' },
    reads: 'knowledge.ts#landmarkClaimLump',
  },
  lairKnowledge: {
    what: 'the share more Knowledge a lair pays when it is cleared, paid back at once for every lair cleared',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} Knowledge from every lair cleared' },
    reads: 'knowledge.ts#firstClearLump',
  },
  // ---- the fog
  discoverRadius: {
    what: 'how far a building sees into the fog — whole cells, so flat; never how far it REVEALS',
    ops: ['flat'], targets: ['global', 'district'], unit: 'tiles',
    says: { flat: '{v} sight into the fog for every[ {target}] building' },
    reads: 'fog.ts#effectiveDiscoverRadius',
  },
  treasureYield: {
    what: 'the share more a treasure in the fog pays — never the first one, never its Knowledge',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} from every treasure found in the fog' },
    reads: 'treasures.ts#treasureReward',
  },
  // ---- the world board
  explorerSlots: {
    what: 'explorers that can be out on the world board at once — whole explorers, so flat',
    ops: ['flat'], targets: ['global'], unit: 'explorers',
    says: { flat: '{v} to the explorers out at once' },
    reads: 'explorers.ts#explorerSlots',
  },
  worldRevealRadius: {
    what: 'hexes an explorer reveals round each hex of its path — whole hexes, so flat, and capped',
    ops: ['flat'], targets: ['global'], unit: 'hexes',
    says: { flat: '{v} to how far an explorer sees round its path' },
    reads: 'explorers.ts#revealRadius',
  },
  explorerSpeed: {
    what: 'how fast an explorer marches over every hex — each hex’s time is divided by it',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} explorer speed on the world board' },
    reads: 'explorers.ts#explorerSpeed',
  },
  armyMarchSpeed: {
    what: 'how fast an army marches over every hex — each hex’s time is divided by it',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} army marching speed on the world board' },
    reads: 'armies.ts#armyMarchSpeed',
  },
  improvementYield: {
    what: 'the share more a world improvement makes an hour',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} from every improvement on the world board' },
    reads: 'boost.ts#worldImprovementBoost',
  },
  improvementStore: {
    what: 'the share more a world improvement’s store holds',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} storage in every improvement on the world board' },
    reads: 'boost.ts#worldImprovementBoost',
  },
  // ---- the army
  armyCap: {
    what: 'the army power the halls can field',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} soldiers the halls can hold' },
    reads: 'army.ts#armyCap',
  },
  recruitSpeed: {
    what: 'how fast a hall trains a soldier — the time is divided by it',
    ops: ['percent'], targets: ['global', 'unit'], unit: '×',
    says: { percent: '{v} training speed[ for the {target}]' },
    reads: 'army.ts#trainSecondsAt',
  },
  unitAtk: {
    what: 'the share more a unit hits for',
    ops: ['percent'], targets: ['global', 'unitTag'], unit: '×',
    says: { percent: '{v} damage for every[ {target}] unit' },
    reads: 'expeditions.ts#drillOf',
  },
  unitDef: {
    what: 'the share more a unit shrugs off',
    ops: ['percent'], targets: ['global', 'unitTag'], unit: '×',
    says: { percent: '{v} defence for every[ {target}] unit' },
    reads: 'expeditions.ts#drillOf',
  },
  unitHp: {
    what: 'the share more health every unit fields with',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} health for every unit' },
    reads: 'expeditions.ts#drillOf',
  },
  infirmaryBeds: {
    what: 'the wounded the Infirmary can hold',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} beds in the Infirmary' },
    reads: 'army.ts#woundedCap',
  },
  healSpeed: {
    what: 'how fast the Infirmary mends — a ward’s time is divided by it, priced when the mending starts',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} healing speed in the Infirmary' },
    reads: 'army.ts#healSecondsAt',
  },
  // ---- the heroes
  heroXp: {
    what: 'the multiplier on every grant of Hero XP',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} Hero XP' },
    reads: 'heroes.ts#addHeroXp',
  },
  summonStardust: {
    what: 'the multiplier on the Stardust a call on a banner draws',
    ops: ['percent'], targets: ['global'], unit: '×',
    says: { percent: '{v} Stardust from calls' },
    reads: 'heroes.ts#callStardust',
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
  tome: ['Kingdom', 'Sagas', 'Atlas'],
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
  } else if (effect.value < 0) {
    // A bonus only ever climbs (Docs/features/22-progression.md §9): a
    // shrinking number meets zero at some rank, and a stack of them breaks.
    out.push(`moves ${effect.stat} by ${effect.value} — a bonus only ever climbs; `
      + 'make the wait a speed, or the cost a yield');
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
