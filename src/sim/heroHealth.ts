// A HERO'S HEALTH carries from one fight to the next (Docs/features/10-heroes.md
// §2.8). What a fight took is kept, and it comes back on its own, a little at
// a time — so the same hero cannot lead every attack at full strength, and a
// second hero is worth having.
//
// Kept as a SHARE of the hero's HP, stamped with when it was taken:
// `missing` at `at`, falling by one whole share every `party.heroRecoverHours`.
// A share rather than points, so a level gained while hurt raises the ceiling
// without reopening the wound. Read lazily from the stamp — nothing is
// scheduled, so nothing is a boundary (the same shape as an exhausted cell's
// recovery).

import { HEROES, PARTY } from './data/definitions';
import type { GameState, HeroId } from './state';

const recoverMs = (): number => PARTY.heroRecoverHours * 3_600_000;

/** A hero's full HP at its level. */
export const heroMaxHp = (state: GameState, id: HeroId): number => {
  const def = HEROES[id];
  return def.hp + def.hpPerLevel * ((state.heroes.levels[id] ?? 1) - 1);
};

/** The share of its HP a hero has at `t`, 0…1. */
export function heroHpShare(state: GameState, id: HeroId, t: number): number {
  const hurt = state.heroes.hurt[id];
  if (hurt === undefined) return 1;
  const missing = Math.max(0, hurt.missing - Math.max(0, t - hurt.at) / recoverMs());
  return 1 - Math.min(1, missing);
}

/** A hero's HP at `t`, in whole points — what it walks into a fight with. */
export const heroHp = (state: GameState, id: HeroId, t: number): number =>
  // The epsilon keeps a share stored from whole points reading back as them.
  Math.floor(heroMaxHp(state, id) * heroHpShare(state, id, t) + 1e-9);

/** A hero with no HP left cannot be sent anywhere until some comes back. */
export const heroCanFight = (state: GameState, id: HeroId, t: number): boolean =>
  heroHp(state, id, t) > 0;

/** Record what a fight left a hero with: `hp` of its max, as of `t`. */
export function setHeroHp(state: GameState, id: HeroId, hp: number, t: number): void {
  const max = heroMaxHp(state, id);
  const missing = max <= 0 ? 0 : 1 - Math.max(0, Math.min(max, hp)) / max;
  if (missing <= 0) delete state.heroes.hurt[id];
  else state.heroes.hurt[id] = { missing, at: t };
}
