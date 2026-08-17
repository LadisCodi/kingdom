// Spellbook, casting, Rain and Tap effects, feature wear-out/regrowth (Docs/07).

import { FEATURES, SPELLS, levelIndexed } from './data/definitions';
import { generationPerMinute } from './economy';
import type { MapData } from './grid';
import { recalculateCityProduction } from './recalc';
import {
  addToWallet, coordKey, districtAt, getWallet, newId,
  type Coord, type CurrencyId, type GameState, type Rng, type SpellId,
} from './state';

export type CastResult = 'Cast' | 'NotUnlocked' | 'AlreadyActive' | 'NotEnoughMana' | 'InvalidTarget';

const foodBoostTargetable = (state: GameState, cell: Coord): boolean => {
  const district = districtAt(state, cell);
  if (!district || district.state !== 'Built') return false;
  const gen = district.generators.find((g) => g.currencyId === 'Food');
  return gen !== undefined && generationPerMinute(gen) > 0;
};

const regrowTargetable = (state: GameState, cell: Coord): boolean =>
  state.features[coordKey(cell)]?.featureId === 'TreesCut';

const tapTargetable = (state: GameState, cell: Coord): boolean => {
  const feature = state.features[coordKey(cell)];
  if (!feature || districtAt(state, cell)) return false;
  const yieldEntries = Object.entries(FEATURES[feature.featureId].baseYield).filter(
    ([, v]) => (v as number) > 0,
  );
  return yieldEntries.length > 0;
};

/** An effect is the composite of its interactions: CanTarget = any can apply. */
export function canTarget(state: GameState, spellId: SpellId, cell: Coord): boolean {
  switch (spellId) {
    case 'Rain':
      return foodBoostTargetable(state, cell) || regrowTargetable(state, cell);
    case 'Tap':
      return tapTargetable(state, cell);
  }
}

/** Swap a cell's feature (destruction or regrowth) and recalc production. */
export function replaceFeature(
  state: GameState,
  map: MapData,
  cell: Coord,
  replacement: keyof typeof FEATURES | null,
  now: number,
  rng: Rng,
): void {
  const key = coordKey(cell);
  if (replacement === null) delete state.features[key];
  else state.features[key] = { featureId: replacement, taps: 0, threshold: 0 };
  recalculateCityProduction(state, map, now, rng); // e.g. a Lumber camp loses/gains the tile
}

export function castSpell(
  state: GameState,
  map: MapData,
  spellId: SpellId,
  cell: Coord,
  now: number,
  rng: Rng,
): CastResult {
  const def = SPELLS[spellId];
  const spell = state.spellbook[spellId];
  if (!spell?.unlocked) return 'NotUnlocked';
  if (!def.stackable) {
    const already = state.activeSpells.some(
      (s) => s.spellId === spellId && s.cell.x === cell.x && s.cell.y === cell.y,
    );
    if (already) return 'AlreadyActive';
  }
  if (!canTarget(state, spellId, cell)) return 'InvalidTarget';
  const levelDef = levelIndexed(def.levels, spell.level);
  if (getWallet(state.kingdom.wallet, 'Mana') < levelDef.manaCost) return 'NotEnoughMana';
  addToWallet(state.kingdom.wallet, 'Mana', -levelDef.manaCost);

  const sourceId = newId(state, `spell_${spellId}`);

  if (spellId === 'Rain') {
    // Food boost while active; forest regrowth happens on expiry.
    if (foodBoostTargetable(state, cell)) {
      const district = districtAt(state, cell)!;
      const gen = district.generators.find((g) => g.currencyId === 'Food')!;
      gen.modifiers.push({
        category: 'Spell',
        source: sourceId,
        kind: 'Percentage',
        value: levelDef.effectMagnitude - 1, // magnitude 5 ⇒ +4 ⇒ ×5 total
      });
    }
    state.activeSpells.push({
      spellId, cell, level: spell.level,
      magnitude: levelDef.effectMagnitude,
      expiresAt: now + levelDef.durationSeconds * 1000,
      sourceId,
    });
    return 'Cast';
  }

  // Tap: instant extraction + durability wear-out. Not stored as an active spell.
  const key = coordKey(cell);
  const feature = state.features[key]!;
  const featureDef = FEATURES[feature.featureId];
  const positiveYields = Object.entries(featureDef.baseYield).filter(([, v]) => (v as number) > 0);
  const [currencyId] = positiveYields[Math.floor(rng() * positiveYields.length)];
  addToWallet(state.city.wallet, currencyId as CurrencyId, 1); // city currencies only today

  if (featureDef.tapMaxDurability > 0) {
    if (feature.threshold === 0) {
      const min = Math.min(Math.max(featureDef.tapMinDurability, 1), featureDef.tapMaxDurability);
      feature.threshold = min + Math.floor(rng() * (featureDef.tapMaxDurability - min + 1));
    }
    feature.taps += 1;
    if (feature.taps >= feature.threshold) {
      replaceFeature(state, map, cell, featureDef.destroyedReplacement, now, rng);
    }
  }
  return 'Cast';
}

/** Per-second driver: expire active spells past expiresAt, running removal side effects. */
export function expireSpells(state: GameState, map: MapData, now: number, rng: Rng): Coord[] {
  const regrown: Coord[] = [];
  const stillActive = state.activeSpells.filter((s) => s.expiresAt > now);
  const expired = state.activeSpells.filter((s) => s.expiresAt <= now);
  state.activeSpells = stillActive;
  for (const spell of expired) {
    if (spell.spellId === 'Rain') {
      // Remove the food-boost modifier.
      const district = districtAt(state, spell.cell);
      if (district) {
        for (const gen of district.generators) {
          gen.modifiers = gen.modifiers.filter((m) => m.source !== spell.sourceId);
        }
      }
      // Forest regrowth: the TreesCut cell upgrades back to Trees when the rain ends.
      const feature = state.features[coordKey(spell.cell)];
      if (feature && FEATURES[feature.featureId].upgradedReplacement) {
        replaceFeature(
          state, map, spell.cell,
          FEATURES[feature.featureId].upgradedReplacement, now, rng,
        );
        regrown.push(spell.cell);
      }
    }
  }
  return regrown;
}

/** Load rule: casts that expired while away are dropped WITHOUT removal effects. */
export function dropOfflineExpiredSpells(state: GameState, now: number): void {
  state.activeSpells = state.activeSpells.filter((s) => s.expiresAt > now);
}
