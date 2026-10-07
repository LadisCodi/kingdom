// Relics (Docs/features/09-relics.md §1, §2): five permanent kingdom
// passives, each one number that rises with its level.
//
// EVERY RELIC THE PLAYER HAS IS ALWAYS ON. Nothing is worn, socketed or
// swapped, and nothing carries one anywhere — so there is no loadout, no swap
// lock and no slot to buy. What used to be the decision ("which passive do I
// wear?") is now the collection's: which album do I finish.
//
// A relic has NO CEILING. `level` is the count of seasons its album was
// completed, so the ladder is the player's history rather than a curve with a
// top, and `per_level` is sized as a season's worth of growth.

import {
  ARTIFACTS, ARTIFACT_ORDER, CITY_RELIC_LEVELS, relicKind, type CityRelicAxis,
} from './data/definitions';
import { addModifier, type Modifier } from './modifiers';
import type { ArtifactId, GameState } from './state';

// ------------------------------------------------------------------ the five

/** 0 = not found. A relic is owned iff its level is at least 1. */
export const artifactLevel = (state: GameState, id: ArtifactId): number =>
  state.artifacts.levels[id] ?? 0;

export const ownsArtifact = (state: GameState, id: ArtifactId): boolean =>
  artifactLevel(state, id) >= 1;

/** Relics the player owns, in authored order (stable across renders). */
export const ownedArtifacts = (state: GameState): ArtifactId[] =>
  ARTIFACT_ORDER.filter((id) => ownsArtifact(state, id));

export type GrantResult = 'Granted' | 'Levelled';

/**
 * What completing an album pays (§5): the relic at level 1 the first time,
 * +1 level every time after. It is the ONLY way a relic level moves — there
 * is no Stardust ladder and no tier gate, and nothing rushes one relic ahead
 * of the others.
 */
export function grantArtifactLevel(state: GameState, id: ArtifactId): GrantResult {
  const had = ownsArtifact(state, id);
  state.artifacts.levels[id] = artifactLevel(state, id) + 1;
  syncArtifactModifiers(state);
  return had ? 'Levelled' : 'Granted';
}

// ------------------------------------------------------------ the city cycle

/**
 * WHAT A CITY RELIC'S LEVEL-UPS HAVE RAISED by `level` (09-relics.md §2.1):
 * level 2 raises the cycle's first axis, level 3 its second, level 4 its
 * third, level 5 the first again. A window step past the last authored
 * window raises the effect instead, so no level is the last one worth having.
 * A world relic has no cycle: every level is its effect.
 */
export function cityRelicSteps(id: ArtifactId, level: number): Record<CityRelicAxis, number> {
  const steps: Record<CityRelicAxis, number> = { window: 0, radius: 0, effect: 0 };
  if (ARTIFACTS[id].activation === null) {
    steps.effect = Math.max(0, level - 1);
    return steps;
  }
  const { cycle, windowMinutes } = CITY_RELIC_LEVELS;
  for (let l = 2; l <= level; l++) {
    const axis = cycle[(l - 2) % cycle.length];
    if (axis === 'window' && steps.window >= windowMinutes.length - 1) steps.effect += 1;
    else steps[axis] += 1;
  }
  return steps;
}

/** What the level-up from `level` raises on a city relic, or null on a
 *  world relic, where every level is its effect. */
export function nextCityRelicAxis(id: ArtifactId, level: number): CityRelicAxis | null {
  if (ARTIFACTS[id].activation === null) return null;
  const now = cityRelicSteps(id, level);
  const next = cityRelicSteps(id, level + 1);
  return (['window', 'radius', 'effect'] as const).find((a) => next[a] > now[a]) ?? null;
}

/** How long a city relic's activation lasts at `level`, in ms. */
export const relicWindowMsAt = (id: ArtifactId, level: number): number =>
  CITY_RELIC_LEVELS.windowMinutes[Math.min(cityRelicSteps(id, level).window, CITY_RELIC_LEVELS.windowMinutes.length - 1)]
    * 60_000;

// -------------------------------------------------------------- the passives

/** The passive's value at a level — `base + per_level × effect steps`: every
 *  level after the first on a world relic, the cycle's effect steps on a city
 *  relic. */
export function passiveValueAtLevel(id: ArtifactId, level: number): number {
  const { passive } = ARTIFACTS[id];
  const value = passive.base + passive.perLevel * cityRelicSteps(id, Math.max(1, level)).effect;
  // A multiplier must never cross zero into a sign flip; an additive one must
  // never subtract what it is meant to add.
  return Math.max(0, value);
}

/** The passive's value at this relic's current level. */
export const passiveValue = (state: GameState, id: ArtifactId): number =>
  passiveValueAtLevel(id, artifactLevel(state, id));

/** What the card promises for the level after this one (§11.4). */
export const nextPassiveValue = (state: GameState, id: ArtifactId): number =>
  passiveValueAtLevel(id, artifactLevel(state, id) + 1);

const MODIFIER_PREFIX = 'artifact:';

/**
 * Rebuild the relic half of the modifier stack from the levels map.
 *
 * Idempotent and total, rather than incremental: an album completing, a save
 * loading and a season closing all move the same inputs, and one rebuild that
 * cannot drift beats three paths that each have to remember to add AND
 * remove. Relic passives are PERMANENT modifiers (`expiresAt: null`) at the
 * base stage — a level is not a technology and never expires.
 */
export function syncArtifactModifiers(state: GameState): void {
  state.modifiers = state.modifiers.filter((m) => !m.id.startsWith(MODIFIER_PREFIX));
  for (const id of ownedArtifacts(state)) {
    // A city relic acts only where a Shrine holds it — the aura stage
    // (sim/hosts.ts); a world relic only while a Chapel holds it.
    if (relicKind(id) === 'city' || !state.world.chapels.includes(id)) continue;
    const value = passiveValue(state, id);
    // A relic may move more than one number with one value — the Sickle's stock
    // and swing, the Hammer's swing and walk. The id carries the stat so two
    // entries from one relic cannot collide, and the filter above still takes
    // both away.
    for (const { stat, scope, op } of ARTIFACTS[id].passive.stats) {
      const modifier: Modifier = {
        id: `${MODIFIER_PREFIX}${id}:${stat}`,
        source: 'artifact',
        stat,
        scope,
        op,
        value,
        expiresAt: null,
      };
      addModifier(state, modifier);
    }
  }
}
