// What a relic IS at a level, and what the next one would change.
//
// The building card's model, applied to a relic (`upgradeStats.ts`, and
// Docs/art/ui-menus-redesign.md §7.27). Same shape, same rule: a stat is a
// NUMBER WITH A NAME, and turning it into a row is the screen's business.
//
// THE PAIRS ARE BUILT BY ZIPPING TWO READS of one function, never by a second
// table of deltas — so a stat can never appear on one side of an arrow and
// not the other, and a relic that grows a second number grows it on both
// sides at once.
//
// It replaced two lines of prose (*"Now — forests recover 30% faster"* and
// *"At level 4 — 40% faster"*). The prose was one sentence for a relic that
// moves TWO numbers, so the Sickle of Plenty and the Winged Hammer each had to
// fold their pair into a single phrase — and neither said which half was
// which. A box apiece says it without a sentence.

import { ARTIFACTS, ARTIFACT_COOLDOWN_SECONDS } from '../sim/data/definitions';
import {
  activeChargesAt, activeDurationMsAt, activePowerAt, activeRadiusAt,
} from '../sim/casting';
import { passiveValueAtLevel, relicWindowMsAt } from '../sim/artifacts';
import { auraRadiusAt } from '../sim/hosts';
import { formatDuration, formatExact, formatNumber } from './format';
import type { ModifierStat } from '../sim/modifiers';
import type { ArtifactId } from '../sim/state';
import type { IconName } from './kit/icon';
import { tr, trn } from '../i18n/tr';

/** One number a relic is judged on, at one level. */
export interface RelicStat {
  /** Stable across levels, so two reads can be zipped into a pair. */
  key: string;
  icon: IconName;
  label: string;
  value: string;
}

/** The same stat at two levels, and whether the level actually moves it. */
export interface RelicStatChange extends RelicStat {
  to: string;
  /** False for a number a level leaves alone. The row is greyed rather than
   *  dropped: a level that moves nothing has to SAY so, or the player reads
   *  the missing row as a bug. */
  changed: boolean;
}

/**
 * WHAT EACH `ModifierStat` IS CALLED ON A RELIC'S CARD, and what it is drawn
 * with. Keyed by the stat rather than by the relic, so two relics that ever
 * move the same number say the same words about it.
 *
 * A SPEED IS NAMED AS ONE. The game owns the wait as a TIME and the relic owns
 * the SPEED the call site divides by, so *Recovery speed +100%* is half the
 * wait — never a percentage of a number that is falling.
 */
const STAT_FACE: Partial<Record<ModifierStat, { icon: IconName; label: string }>> = {
  recoverySpeed: { icon: 'hourglass', label: tr('Recovery speed') },
  harvestStock: { icon: 'Wood', label: tr('Natural resources') },
  harvestUnitsPerStrike: { icon: 'plus', label: tr('Per swing and tap') },
  trainingSpeed: { icon: 'army', label: tr('Training speed') },
  workerStrikeSpeed: { icon: 'clock', label: tr('Crew swing') },
  workerSpeed: { icon: 'workers', label: tr('Crew walk') },
  taxRate: { icon: 'Gold', label: tr('Tax rate') },
  stardustYield: { icon: 'Stardust', label: tr('Stardust from rooms') },
  roomHaul: { icon: 'dungeon', label: tr('A room’s gold and stone') },
  armyCap: { icon: 'army', label: tr('Army the halls field') },
  worldImprovementYield: { icon: 'build', label: tr('District yield') },
};

/**
 * HOW BIG A MULTIPLIER IS, in the player's terms: `+320%`, never `×4.20`.
 *
 * ONE PLACE, because the page says the same number twice — as a sentence
 * beside the art and as a tile under it — and `×4.20` against *"320% faster"*
 * is the same fact in two currencies. The prose reads this too
 * (`game.ts#relicEffectText`), so the two cannot drift apart.
 */
export const relicPercent = (value: number): string =>
  `${Math.round(Math.max(0, value - 1) * 100)}%`;

/** `+320%` for a multiplier, `+3` for a flat term. The op is the fact; the
 *  formatting follows it rather than being authored beside it. */
const say = (op: 'add' | 'mul', value: number): string =>
  op === 'mul'
    ? `+${relicPercent(value)}`
    : `+${formatNumber(value, 1)}`;

/**
 * Everything this relic is worth at `level`.
 *
 * Pure in `level` — it never reads the state's own — which is the whole reason
 * the pairs are honest.
 */
export function relicStatsAt(id: ArtifactId, level: number): RelicStat[] {
  const value = passiveValueAtLevel(id, level);
  const out: RelicStat[] = [];
  for (const s of ARTIFACTS[id].passive.stats) {
    const face = STAT_FACE[s.stat];
    if (face === undefined) continue;
    out.push({ key: s.stat, icon: face.icon, label: face.label, value: say(s.op, value) });
  }
  // A CITY RELIC'S LEVEL IS ALL THREE of what an activation is worth — its
  // number, its reach round the Shrine and how long it stays awake — and a
  // level-up raises one of them, round a cycle (`cityRelicSteps`). The pair
  // greys the two a level leaves alone.
  if (ARTIFACTS[id].activation !== null) {
    const radius = auraRadiusAt(id, level);
    out.push({ key: 'aura', icon: 'compass', label: tr('Aura'), value: tr('{n} cells', { n: formatExact((2 * radius + 1) ** 2) }) });
    out.push({ key: 'window', icon: 'hourglass', label: tr('Awake for'), value: formatDuration(relicWindowMsAt(id, level) / 1000) });
  }
  return out;
}

/**
 * WHAT THE ABILITY IS WORTH AT `level` — the same four facts for every relic
 * that has one, in the order a player asks them: what it costs, how long it
 * lasts, how far it reaches, and how long until it comes back.
 *
 * The COOLDOWN IS ON THE LIST even though nothing ever moves it. A number the
 * ladder leaves alone greys rather than disappearing, and a flat cooldown is a
 * decision the player is owed — *this never gets shorter* is the answer to the
 * obvious question, and a missing row would leave it unasked.
 */
export function spellStatsAt(id: ArtifactId, level: number): RelicStat[] {
  const active = ARTIFACTS[id].active;
  if (active === null) return [];
  const out: RelicStat[] = [
    { key: 'mana', icon: 'Mana', label: tr('Mana'), value: formatExact(active.manaCost) },
  ];
  const window = activeDurationMsAt(id, level) / 1000;
  if (window > 0) {
    out.push({ key: 'window', icon: 'hourglass', label: tr('Window'), value: formatDuration(window) });
  }
  // An ability counted in EVENTS shows its uses where a timed one shows its
  // window: they are the same fact, measured in what that spell is about.
  const charges = activeChargesAt(id, level);
  if (charges > 0) {
    out.push({ key: 'charges', icon: 'dungeon', label: tr('Rooms'), value: String(charges) });
  }
  // POWER, when the ability has one — how hard the zone hits while it stands.
  const power = activePowerAt(id, level);
  if (power > 1) {
    out.push({ key: 'power', icon: 'sparkle', label: tr('Power'), value: `\u00d7${power.toFixed(2)}` });
  }
  const radius = activeRadiusAt(id, level);
  if (radius > 0) {
    // The cells a Chebyshev square covers, because the ring count is the
    // number the player feels — radius 2 to 3 is 25 cells to 49.
    out.push({
      key: 'radius',
      icon: 'compass',
      label: tr('Reach'),
      value: `${radius} \u00b7 ${tr('{n} cells', { n: (2 * radius + 1) ** 2 })}`,
    });
  }
  out.push({
    key: 'cooldown',
    icon: 'clock',
    label: tr('Cooldown'),
    value: formatDuration(ARTIFACT_COOLDOWN_SECONDS),
  });
  return out;
}

/** Two reads of one function, zipped — the shape both bands share. */
const pairs = (
  at: (level: number) => RelicStat[], level: number,
): RelicStatChange[] => {
  const before = at(level);
  const after = new Map(at(level + 1).map((s) => [s.key, s.value]));
  return before.map((s) => {
    const to = after.get(s.key) ?? s.value;
    return { ...s, to, changed: to !== s.value };
  });
};

/** This relic's PASSIVE at its level, against the next one. */
export const relicStatChanges = (id: ArtifactId, level: number): RelicStatChange[] =>
  pairs((l) => relicStatsAt(id, l), level);

/** This relic's ABILITY at its level, against the next one. */
export const spellStatChanges = (id: ArtifactId, level: number): RelicStatChange[] =>
  pairs((l) => spellStatsAt(id, l), level);

/**
 * WHAT A RELIC DOES, AS A SENTENCE (the sheet's line under the art): the
 * tiles say the numbers; this says what the relic is FOR, with the same
 * numbers in it. A city relic's sentence ends on its window, because an
 * activation is the only way it ever acts.
 */
export function relicStory(id: ArtifactId, level: number): string {
  const pct = relicPercent(passiveValueAtLevel(id, level));
  const story = STORY[id](pct);
  return ARTIFACTS[id].activation === null
    ? tr('{story}.', { story })
    : tr('{story}, for {time}.', { story, time: spokenWindow(relicWindowMsAt(id, level)) });
}

/** A window as a sentence says it: *30 minutes*, *1 hour*, *8 hours*. */
function spokenWindow(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60 || minutes % 60 !== 0) return trn(minutes, '{n} minute', '{n} minutes', { n: formatExact(minutes) });
  const hours = minutes / 60;
  return trn(hours, '{n} hour', '{n} hours', { n: formatExact(hours) });
}

const STORY: Record<ArtifactId, (p: string) => string> = {
  DowsingRod: (p) => tr('Renews the land round its Shrine: forests, fields, rocks and shoals there hold {p} more and grow back {p} faster', { p }),
  VerdantSeal: (p) => tr('Blesses every blade and every hand round its Shrine: each swing of a crew and each tap of yours there brings in {p} more', { p }),
  ForemansSigil: (p) => tr('Lends wings to every working hand round its Shrine: crews there swing and walk {p} faster, and soldiers and villagers train {p} faster', { p }),
  GildedLedger: (p) => tr('Reminds every household round its Shrine what it owes the crown: villagers there pay {p} more tax', { p }),
  WanderersCompass: (p) => tr('Draws starlight out of the dark: every room you clear in the depths pays {p} more Stardust', { p }),
  DelversLantern: (p) => tr('Its wisps find what the dark hides: every room in the depths pays {p} more gold and stone', { p }),
  MusterHorn: (p) => tr('Its call brings more to your banner: your halls field an army {p} larger', { p }),
  BailiffsTally: (p) => tr('Your stewards collect what is owed: every district you hold on the world map pays {p} more an hour', { p }),
};
